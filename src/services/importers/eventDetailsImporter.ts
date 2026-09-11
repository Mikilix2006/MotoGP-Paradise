import { prisma } from "@/lib/prisma";
import { fetchMotoGPApi } from "@/services/motogp/apiClient";

import type { Session as SessionRecord } from "@prisma/client";

import { saveApiSnapshot } from "./syncTracking";

/*
 * ============================================================
 * IMPORTADOR DE DETALLES DE EVENTO
 * ============================================================
 *
 * Fuente: MOTOGP_API_URL /events?seasonYear={year}
 *
 * Este endpoint es mucho más rico que /results/events y es el
 * único que proporciona:
 *
 * - coordenadas del circuito;
 * - trazados (CircuitTrack) y sus imágenes (CircuitAsset);
 * - descripciones del circuito por idioma;
 * - horario del Gran Premio (EventScheduleDay);
 * - enlaces del evento (EventUrl);
 * - acrónimo, prioridad y timing_id de cada categoría;
 * - los campos de sesión que /results/sessions no devuelve.
 *
 * La unión con la base de datos se hace mediante:
 *
 *   Event.toadApiUuid  ==  id del evento en esta API
 *   Category.legacyId  ==  category.timing_id
 */

interface ApiAsset {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  path?: string | null;
  mimetype?: string | null;
}

interface ApiLengthUnits {
  meters?: number | null;
  kiloMeters?: number | null;
  miles?: number | null;
  feet?: number | null;
}

interface ApiTrack {
  id?: string | null;
  first_grid?: string | number | null;
  box_entry?: boolean | string | null;
  box_exit?: boolean | string | null;

  lenght_units?: ApiLengthUnits | null;
  width_units?: ApiLengthUnits | null;
  longest_straight_units?: ApiLengthUnits | null;

  left_corners?: string | number | null;
  right_corners?: string | number | null;

  is_active?: boolean | null;

  assets?: Record<string, ApiAsset | null> | null;
}

interface ApiCircuitDescription {
  id?: string | null;
  business_unit_id?: { id?: string | null } | null;
  language?: string | null;
  description?: string | null;
}

interface ApiCircuit {
  id?: string | null;
  name?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;

  tracks?: ApiTrack[] | null;
  circuit_descriptions?: ApiCircuitDescription[] | null;
}

interface ApiScheduleOption {
  dateStart?: string | null;
  name?: string | null;
  day?: number | null;
  month?: string | null;
  day_suffix?: string | null;
  gp_day?: number | null;
}

interface ApiEventUrl {
  language?: string | null;
  url?: string | null;
  type?: string | null;
}

interface ApiBroadcastCategory {
  id?: string | null;
  acronym?: string | null;
  name?: string | null;
  active?: boolean | null;
  timing_id?: number | null;
  priority?: number | null;
}

interface ApiBroadcast {
  id?: string | null;
  shortname?: string | null;
  name?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  type?: string | null;
  kind?: string | null;
  status?: string | null;
  num_laps?: number | null;
  progressive?: number | null;
  has_timing?: boolean | null;
  has_live?: boolean | null;
  has_report?: boolean | null;
  has_results?: boolean | null;
  has_on_demand?: boolean | null;
  is_live?: boolean | null;
  is_live_timing?: boolean | null;
  gp_day?: number | null;
  timing_id?: number | null;
  category?: ApiBroadcastCategory | null;
}

interface ApiEventDetails {
  id?: string | null;
  name?: string | null;
  sequence?: number | null;
  time_zone?: string | null;

  circuit?: ApiCircuit | null;

  schedule?: {
    options?: ApiScheduleOption[] | null;
  } | null;

  urls?: ApiEventUrl[] | null;

  broadcasts?: ApiBroadcast[] | null;
}

export interface EventDetailsImportResult {
  seasonsProcessed: number;
  eventsMatched: number;
  eventsNotFound: number;

  circuitsUpdated: number;
  tracksProcessed: number;
  assetsProcessed: number;
  descriptionsProcessed: number;

  scheduleDaysProcessed: number;
  urlsProcessed: number;

  categoriesEnriched: number;
  sessionsUpdated: number;
  sessionsCreated: number;
}

function toNumber(
  value: string | number | null | undefined
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toText(
  value: string | number | boolean | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

/**
 * Convierte la fecha de la API conservando la hora local
 * tal y como aparece en la cadena, ignorando el offset.
 *
 * Es imprescindible para que estas fechas sean comparables
 * con las que ya importa sessionImporter desde la API de
 * resultados, que devuelve la hora local del circuito
 * etiquetada siempre como +00:00.
 */
function toWallClockDate(
  value: string | null | undefined
): Date | null {
  if (!value) {
    return null;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  );

  if (!match) {
    return null;
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
  ] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );
}

/**
 * Reduce el nombre de una sesión a su tipo base, para poder
 * comparar los nombres de una API con los de la otra:
 *
 *   FP1 → FP     Q2 → Q     P2 → FP     RAC → RAC
 */
function baseSessionType(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[0-9]+$/, "");

  if (!normalized) {
    return null;
  }

  /*
   * Algunas categorías nombran los entrenamientos como P
   * en una API y como FP en la otra.
   */
  return normalized === "P" ? "FP" : normalized;
}

function buildSessionData(
  broadcast: ApiBroadcast,
  session: SessionRecord | null
) {
  const broadcastStart = toWallClockDate(broadcast.date_start);
  const broadcastEnd = toWallClockDate(broadcast.date_end);

  /*
   * Las dos APIs no expresan la hora igual, así que no se puede
   * guardar dateStart de una y dateEnd de la otra: la fila
   * quedaría descuadrada.
   *
   * Cuando la sesión ya tiene hora de inicio importada desde la
   * API de resultados, se le suma la duración que indica esta
   * API, de modo que ambas fechas sean coherentes entre sí.
   */
  let dateEnd = broadcastEnd;

  if (session?.dateStart && broadcastStart && broadcastEnd) {
    const duration =
      broadcastEnd.getTime() - broadcastStart.getTime();

    dateEnd = new Date(
      session.dateStart.getTime() + duration
    );
  }

  return {
    broadcastUuid: broadcast.id ?? null,

    shortname: broadcast.shortname ?? null,
    name: broadcast.name ?? null,
    kind: broadcast.kind ?? null,

    dateEnd,

    numLaps: broadcast.num_laps ?? null,

    progressive:
      broadcast.progressive !== null &&
      broadcast.progressive !== undefined
        ? Boolean(broadcast.progressive)
        : null,

    gpDay: toText(broadcast.gp_day),
    timingId: toText(broadcast.timing_id),

    hasTiming: broadcast.has_timing ?? null,
    hasLive: broadcast.has_live ?? null,
    hasReport: broadcast.has_report ?? null,
    hasResults: broadcast.has_results ?? null,
    hasOnDemand: broadcast.has_on_demand ?? null,
    isLive: broadcast.is_live ?? null,
    isLiveTiming: broadcast.is_live_timing ?? null,
  };
}

/**
 * Empareja las sesiones de broadcasts[] con las que ya existen
 * en la base de datos para el mismo evento y categoría.
 *
 * Se hacen tres pasadas, de más a menos fiable:
 *
 * 1. UUID de broadcast, si ya se importó antes;
 * 2. hora de inicio exacta, válida donde no hay horario de verano;
 * 3. tipo base (FP, Q, RAC...) y orden cronológico dentro del tipo.
 *
 * Si ninguna pasada encuentra correspondencia se devuelve sin
 * pareja y la sesión se creará. No se empareja "a ciegas" por
 * orden porque escribir los datos en la sesión equivocada es
 * peor que crear una sesión de más.
 */
function matchBroadcastsToSessions(
  broadcasts: ApiBroadcast[],
  sessions: SessionRecord[]
): Map<ApiBroadcast, SessionRecord> {
  const matches = new Map<ApiBroadcast, SessionRecord>();

  const usedSessionIds = new Set<string>();

  const pending: ApiBroadcast[] = [];

  /*
   * 1. UUID de broadcast.
   */
  for (const broadcast of broadcasts) {
    const session = sessions.find(
      (candidate) =>
        candidate.broadcastUuid === broadcast.id &&
        !usedSessionIds.has(candidate.id)
    );

    if (session) {
      matches.set(broadcast, session);
      usedSessionIds.add(session.id);
    } else {
      pending.push(broadcast);
    }
  }

  /*
   * 2. Hora de inicio exacta.
   */
  const stillPending: ApiBroadcast[] = [];

  for (const broadcast of pending) {
    const dateStart = toWallClockDate(broadcast.date_start);

    const session = dateStart
      ? sessions.find(
          (candidate) =>
            candidate.dateStart?.getTime() ===
              dateStart.getTime() &&
            !usedSessionIds.has(candidate.id)
        )
      : undefined;

    if (session) {
      matches.set(broadcast, session);
      usedSessionIds.add(session.id);
    } else {
      stillPending.push(broadcast);
    }
  }

  /*
   * 3. Tipo base y orden cronológico dentro del tipo.
   */
  const sessionsByType = new Map<string, SessionRecord[]>();

  for (const session of sessions) {
    if (usedSessionIds.has(session.id)) {
      continue;
    }

    const type = baseSessionType(session.type);

    if (!type) {
      continue;
    }

    const group = sessionsByType.get(type) ?? [];

    group.push(session);

    sessionsByType.set(type, group);
  }

  const unmatched: ApiBroadcast[] = [];

  for (const broadcast of stillPending) {
    const type = baseSessionType(broadcast.shortname);

    const group = type
      ? sessionsByType.get(type)
      : undefined;

    const session = group?.shift();

    if (session) {
      matches.set(broadcast, session);
      usedSessionIds.add(session.id);
    } else {
      unmatched.push(broadcast);
    }
  }

  /*
   * 4. Orden cronológico, solo si quedan exactamente las mismas
   *    sesiones por emparejar en ambos lados.
   *
   *    Las dos APIs no siempre nombran igual la misma sesión
   *    (por ejemplo PR frente a FP3 en Moto2 y Moto3). Si los
   *    números cuadran, el orden en pista es fiable.
   */
  const remainingSessions = sessions.filter(
    (session) => !usedSessionIds.has(session.id)
  );

  if (
    unmatched.length > 0 &&
    unmatched.length === remainingSessions.length
  ) {
    remainingSessions.sort(
      (a, b) =>
        (a.dateStart?.getTime() ?? 0) -
        (b.dateStart?.getTime() ?? 0)
    );

    unmatched.forEach((broadcast, index) => {
      const session = remainingSessions[index];

      if (session) {
        matches.set(broadcast, session);
        usedSessionIds.add(session.id);
      }
    });
  }

  return matches;
}

export interface ImportOptions {
  /*
   * Permite limitar la importación a una única temporada,
   * útil para probar antes de lanzar el histórico completo.
   */
  seasonYear?: number;
}

export async function importEventDetails(
  options: ImportOptions = {}
): Promise<EventDetailsImportResult> {
  const seasons = await prisma.season.findMany({
    where:
      options.seasonYear !== undefined
        ? {
            year: options.seasonYear,
          }
        : undefined,

    orderBy: {
      year: "asc",
    },
  });

  const result: EventDetailsImportResult = {
    seasonsProcessed: 0,
    eventsMatched: 0,
    eventsNotFound: 0,
    circuitsUpdated: 0,
    tracksProcessed: 0,
    assetsProcessed: 0,
    descriptionsProcessed: 0,
    scheduleDaysProcessed: 0,
    urlsProcessed: 0,
    categoriesEnriched: 0,
    sessionsUpdated: 0,
    sessionsCreated: 0,
  };

  /*
   * Las categorías se resuelven por legacyId, que coincide
   * con el category.timing_id de esta API.
   */
  const categories = await prisma.category.findMany();

  const categoriesByLegacyId = new Map(
    categories
      .filter((category) => category.legacyId !== null)
      .map((category) => [
        category.legacyId as number,
        category,
      ])
  );

  for (const season of seasons) {
    console.log(
      `📅 Detalles de eventos de la temporada ${season.year}...`
    );

    let events: ApiEventDetails[];

    const endpoint = `/events?seasonYear=${season.year}`;

    try {
      events =
        await fetchMotoGPApi<ApiEventDetails[]>(endpoint);
    } catch (error) {
      console.warn(
        `⚠️ No se pudieron obtener los detalles de ${season.year}`
      );

      console.warn(error);

      continue;
    }

    result.seasonsProcessed++;

    await saveApiSnapshot({
      source: "BROADCAST",
      endpoint: "/events",

      requestParameters: {
        seasonYear: season.year,
      },

      entityType: "Season",

      entityExternalId:
        season.motogpUuid ?? String(season.year),

      payload: events,
    });

    for (const apiEvent of events) {
      if (!apiEvent.id) {
        continue;
      }

      /*
       * ============================================================
       * EVENTO
       * ============================================================
       *
       * El id de esta API es el mismo valor que la API de
       * resultados devuelve como toad_api_uuid.
       */

      const event = await prisma.event.findFirst({
        where: {
          toadApiUuid: apiEvent.id,
        },
      });

      if (!event) {
        result.eventsNotFound++;
        continue;
      }

      result.eventsMatched++;

      await prisma.event.update({
        where: {
          id: event.id,
        },

        data: {
          timeZone: apiEvent.time_zone ?? null,
          sequence: apiEvent.sequence ?? null,
        },
      });

      /*
       * ============================================================
       * CIRCUITO
       * ============================================================
       */

      const apiCircuit = apiEvent.circuit;
      const circuitId = event.circuitId;

      if (circuitId && apiCircuit) {
        const latitude = toNumber(apiCircuit.lat);
        const longitude = toNumber(apiCircuit.lng);

        if (latitude !== null || longitude !== null) {
          await prisma.circuit.update({
            where: {
              id: circuitId,
            },

            data: {
              latitude,
              longitude,
            },
          });

          result.circuitsUpdated++;
        }

        /*
         * TRAZADOS E IMÁGENES
         */

        for (const apiTrack of apiCircuit.tracks ?? []) {
          if (!apiTrack.id) {
            continue;
          }

          const leftCorners = toNumber(apiTrack.left_corners);
          const rightCorners = toNumber(apiTrack.right_corners);

          const totalCorners =
            leftCorners !== null && rightCorners !== null
              ? leftCorners + rightCorners
              : null;

          const trackData = {
            circuitId,

            lengthMeters: toNumber(
              apiTrack.lenght_units?.meters
            ),

            lengthKm: toNumber(
              apiTrack.lenght_units?.kiloMeters
            ),

            lengthMiles: toNumber(
              apiTrack.lenght_units?.miles
            ),

            lengthFeet: toNumber(
              apiTrack.lenght_units?.feet
            ),

            widthMeters: toNumber(
              apiTrack.width_units?.meters
            ),

            longestStraightMeters: toNumber(
              apiTrack.longest_straight_units?.meters
            ),

            leftCorners,
            rightCorners,
            totalCorners,

            firstGrid: toText(apiTrack.first_grid),
            boxEntry: toText(apiTrack.box_entry),
            boxExit: toText(apiTrack.box_exit),
          };

          const track = await prisma.circuitTrack.upsert({
            where: {
              motogpUuid: apiTrack.id,
            },

            create: {
              motogpUuid: apiTrack.id,
              ...trackData,
            },

            update: trackData,
          });

          result.tracksProcessed++;

          /*
           * CircuitAsset no tiene restricción única, por lo que
           * se busca antes de crear para no duplicar.
           */

          for (const apiAsset of Object.values(
            apiTrack.assets ?? {}
          )) {
            if (!apiAsset?.path || !apiAsset.type) {
              continue;
            }

            const assetData = {
              circuitId,
              trackId: track.id,
              name: apiAsset.name ?? apiAsset.type,
              type: apiAsset.type,
              path: apiAsset.path,
              mimeType: apiAsset.mimetype ?? null,
            };

            const existingAsset =
              await prisma.circuitAsset.findFirst({
                where: apiAsset.id
                  ? {
                      motogpUuid: apiAsset.id,
                    }
                  : {
                      trackId: track.id,
                      type: apiAsset.type,
                    },
              });

            if (existingAsset) {
              await prisma.circuitAsset.update({
                where: {
                  id: existingAsset.id,
                },

                data: assetData,
              });
            } else {
              await prisma.circuitAsset.create({
                data: {
                  motogpUuid: apiAsset.id ?? null,
                  ...assetData,
                },
              });
            }

            result.assetsProcessed++;
          }
        }

        /*
         * DESCRIPCIONES DEL CIRCUITO
         */

        for (const apiDescription of apiCircuit.circuit_descriptions ??
        []) {
          if (!apiDescription.language) {
            continue;
          }

          const businessUnitId =
            apiDescription.business_unit_id?.id ?? null;

          const existingDescription =
            await prisma.circuitDescription.findFirst({
              where: {
                circuitId,
                language: apiDescription.language,
                businessUnitId,
              },
            });

          if (existingDescription) {
            await prisma.circuitDescription.update({
              where: {
                id: existingDescription.id,
              },

              data: {
                description:
                  apiDescription.description ?? null,

                motogpUuid: apiDescription.id ?? null,
              },
            });
          } else {
            await prisma.circuitDescription.create({
              data: {
                circuitId,
                language: apiDescription.language,
                businessUnitId,

                description:
                  apiDescription.description ?? null,

                motogpUuid: apiDescription.id ?? null,
              },
            });
          }

          result.descriptionsProcessed++;
        }
      }

      /*
       * ============================================================
       * HORARIO DEL GRAN PREMIO
       * ============================================================
       */

      for (const option of apiEvent.schedule?.options ?? []) {
        if (!option.name) {
          continue;
        }

        const dayDate = toWallClockDate(option.dateStart);

        const scheduleData = {
          dateStart: dayDate,
          day: option.day ?? null,

          /*
           * El mes llega como nombre ("March"), pero la columna
           * es numérica, por lo que se deriva de la fecha.
           */
          month:
            dayDate !== null
              ? dayDate.getUTCMonth() + 1
              : null,

          daySuffix: option.day_suffix ?? null,
          gpDay: toText(option.gp_day),
        };

        const existingDay =
          await prisma.eventScheduleDay.findFirst({
            where: {
              eventId: event.id,
              name: option.name,
            },
          });

        if (existingDay) {
          await prisma.eventScheduleDay.update({
            where: {
              id: existingDay.id,
            },

            data: scheduleData,
          });
        } else {
          await prisma.eventScheduleDay.create({
            data: {
              eventId: event.id,
              name: option.name,
              ...scheduleData,
            },
          });
        }

        result.scheduleDaysProcessed++;
      }

      /*
       * ============================================================
       * ENLACES DEL EVENTO
       * ============================================================
       */

      for (const apiUrl of apiEvent.urls ?? []) {
        if (!apiUrl.url || !apiUrl.type) {
          continue;
        }

        const existingUrl = await prisma.eventUrl.findFirst({
          where: {
            eventId: event.id,
            type: apiUrl.type,
            language: apiUrl.language ?? null,
          },
        });

        if (existingUrl) {
          await prisma.eventUrl.update({
            where: {
              id: existingUrl.id,
            },

            data: {
              url: apiUrl.url,
            },
          });
        } else {
          await prisma.eventUrl.create({
            data: {
              eventId: event.id,
              type: apiUrl.type,
              language: apiUrl.language ?? null,
              url: apiUrl.url,
            },
          });
        }

        result.urlsProcessed++;
      }

      /*
       * ============================================================
       * CATEGORÍAS
       * ============================================================
       *
       * broadcasts[] es la única fuente de acrónimo, prioridad
       * y timing_id de cada categoría.
       */

      const broadcastsByCategory = new Map<string, ApiBroadcast[]>();

      const enrichedCategories = new Set<string>();

      for (const broadcast of apiEvent.broadcasts ?? []) {
        const apiCategory = broadcast.category;

        const categoryLegacyId = apiCategory?.timing_id ?? null;

        const category =
          categoryLegacyId !== null
            ? categoriesByLegacyId.get(categoryLegacyId)
            : undefined;

        if (
          category &&
          apiCategory &&
          !enrichedCategories.has(category.id)
        ) {
          await prisma.category.update({
            where: {
              id: category.id,
            },

            data: {
              acronym: apiCategory.acronym ?? null,
              timingId: toText(apiCategory.timing_id),
              priority: apiCategory.priority ?? null,
              active: apiCategory.active ?? true,
            },
          });

          enrichedCategories.add(category.id);
          result.categoriesEnriched++;
        }

        /*
         * broadcasts[] incluye ruedas de prensa y contenido de
         * medios (type MEDIA). Solo interesan las sesiones que
         * ocurren en pista.
         */
        if (
          !broadcast.id ||
          broadcast.type === "MEDIA" ||
          !category
        ) {
          continue;
        }

        const group =
          broadcastsByCategory.get(category.id) ?? [];

        group.push(broadcast);

        broadcastsByCategory.set(category.id, group);
      }

      /*
       * ============================================================
       * SESIONES
       * ============================================================
       *
       * Las sesiones ya existen importadas desde la API de
       * resultados, pero las dos APIs no comparten identificador
       * ni horario:
       *
       * - /results/sessions devuelve la hora estándar del circuito
       *   (sin horario de verano) etiquetada como +00:00;
       * - /events devuelve la hora real con su offset.
       *
       * Por eso el emparejamiento no puede basarse solo en la hora
       * y se hace en varias pasadas, de más a menos fiable.
       */

      for (const [
        categoryId,
        broadcasts,
      ] of broadcastsByCategory) {
        const sessions = await prisma.session.findMany({
          where: {
            eventId: event.id,
            categoryId,
          },

          orderBy: {
            dateStart: "asc",
          },
        });

        const sortedBroadcasts = [...broadcasts].sort(
          (a, b) =>
            (toWallClockDate(a.date_start)?.getTime() ?? 0) -
            (toWallClockDate(b.date_start)?.getTime() ?? 0)
        );

        const matches = matchBroadcastsToSessions(
          sortedBroadcasts,
          sessions
        );

        for (const broadcast of sortedBroadcasts) {
          const session = matches.get(broadcast) ?? null;

          const sessionData = buildSessionData(
            broadcast,
            session
          );

          if (session) {
            await prisma.session.update({
              where: {
                id: session.id,
              },

              data: sessionData,
            });

            result.sessionsUpdated++;
          } else {
            await prisma.session.create({
              data: {
                eventId: event.id,
                categoryId,

                type: broadcast.type ?? null,
                status: broadcast.status ?? null,

                dateStart: toWallClockDate(
                  broadcast.date_start
                ),

                ...sessionData,
              },
            });

            result.sessionsCreated++;
          }
        }
      }
    }

    console.log(
      `✅ Temporada ${season.year}: ${events.length} eventos analizados`
    );
  }

  return result;
}
