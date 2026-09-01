import { prisma } from "@/lib/prisma";
import { fetchMotoGPResults } from "@/services/motogp/resultsClient";

interface ApiCountry {
  iso?: string | null;
  name?: string | null;
  region_iso?: string | null;
}

interface ApiRider {
  id?: string | null;
  full_name?: string | null;
  country?: ApiCountry | null;
  legacy_id?: number | null;
  riders_id?: string | null;
  riders_api_uuid?: string | null;
  rider_api_uuid?: string | null;
  number?: number | null;
}

interface ApiTeam {
  id?: string | null;
  name?: string | null;
  legacy_id?: number | null;
}

interface ApiConstructor {
  id?: string | null;
  name?: string | null;
  legacy_id?: number | null;
}

interface ApiClassificationResult {
  id?: string | null;
  position?: number | null;

  rider?: ApiRider | null;
  team?: ApiTeam | null;
  constructor?: ApiConstructor | null;

  best_lap?: {
    number?: number | null;
    time?: string | null;
  } | null;

  total_laps?: number | null;

  top_speed?: number | string | null;

  gap?: {
    first?: string | null;
    prev?: string | null;
  } | null;

  status?: string | null;
}

interface ApiClassificationResponse {
  classification?: ApiClassificationResult[];
}

export interface SessionResultImportResult {
  sessionsProcessed: number;
  sessionsSkipped: number;
  resultsProcessed: number;
  resultsCreated: number;
  resultsUpdated: number;
  ridersCreated: number;
  teamsCreated: number;
  constructorsCreated: number;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value.replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

export async function importSessionResults(): Promise<SessionResultImportResult> {
  const sessions = await prisma.session.findMany({
    where: {
      resultsUuid: {
        not: null,
      },
    },

    include: {
      event: {
        include: {
          season: true,
        },
      },
    },

    orderBy: {
      dateStart: "asc",
    },
  });

  let sessionsProcessed = 0;
  let sessionsSkipped = 0;
  let resultsProcessed = 0;
  let resultsCreated = 0;
  let resultsUpdated = 0;
  let ridersCreated = 0;
  let teamsCreated = 0;
  let constructorsCreated = 0;

  for (const session of sessions) {
    if (!session.resultsUuid) {
      sessionsSkipped++;
      continue;
    }

    const seasonYear = session.event.season.year;

    const params = new URLSearchParams({
      seasonYear: String(seasonYear),
    });

    /*
     * Las sesiones pertenecientes a eventos de test necesitan
     * obligatoriamente el parámetro test=true.
     */
    if (session.event.isTest) {
      params.set("test", "true");
    }

    const endpoint =
      `/session/${session.resultsUuid}/classification?${params.toString()}`;

    console.log(
      `🏍️ ${session.event.name} | ${session.type ?? "UNKNOWN"} | ${seasonYear}${
        session.event.isTest ? " | TEST" : ""
      }`
    );

    let response: ApiClassificationResponse;

    try {
      response =
        await fetchMotoGPResults<ApiClassificationResponse>(
          endpoint
        );
    } catch (error) {
      console.warn(
        `⚠️ No se pudo obtener clasificación: ${session.resultsUuid}`
      );

      console.warn(error);

      sessionsSkipped++;
      continue;
    }

    sessionsProcessed++;

    const classification = response.classification ?? [];

    if (classification.length === 0) {
      console.log("   ℹ️ Sin resultados");

      continue;
    }

    for (const item of classification) {
      resultsProcessed++;

      /*
       * ============================================================
       * RIDER
       * ============================================================
       */

      if (!item.rider?.id) {
        console.warn(
          `⚠️ Resultado sin piloto: sesión ${session.resultsUuid}`
        );

        continue;
      }

      let countryId: string | null = null;

      if (item.rider.country?.iso) {
        const countryIso = item.rider.country.iso.trim();

        const countryName =
          item.rider.country.name?.trim() ||
          countryIso;

        const country = await prisma.country.upsert({
          where: {
            iso: countryIso,
          },

          create: {
            iso: countryIso,
            name: countryName,
            regionIso:
              item.rider.country.region_iso || null,
          },

          update: {
            name: countryName,
            regionIso:
              item.rider.country.region_iso || null,
          },
        });

        countryId = country.id;
      }

      /*
       * El campo countryId es nullable en el scalar,
       * pero la relación Rider.country es obligatoria en
       * el schema actual.
       *
       * Por tanto, no podemos crear un Rider sin país.
       */
      if (!countryId) {
        console.warn(
          `⚠️ Piloto sin país: ${item.rider.full_name ?? item.rider.id}`
        );

        continue;
      }

      const existingRider = await prisma.rider.findUnique({
        where: {
          motogpUuid: item.rider.id,
        },
      });

      const rider = await prisma.rider.upsert({
        where: {
          motogpUuid: item.rider.id,
        },

        create: {
          motogpUuid: item.rider.id,

          legacyId:
            item.rider.legacy_id ?? null,

          ridersApiUuid:
            item.rider.riders_api_uuid ??
            item.rider.rider_api_uuid ??
            null,

          ridersId:
            item.rider.riders_id ?? null,

          fullName:
            item.rider.full_name ?? null,

          countryId,
        },

        update: {
          legacyId:
            item.rider.legacy_id ?? null,

          ridersApiUuid:
            item.rider.riders_api_uuid ??
            item.rider.rider_api_uuid ??
            null,

          ridersId:
            item.rider.riders_id ?? null,

          fullName:
            item.rider.full_name ?? null,

          countryId,
        },
      });

      if (!existingRider) {
        ridersCreated++;
      }

      /*
       * ============================================================
       * TEAM
       * ============================================================
       */

      let teamId: string | null = null;

      if (item.team?.id && item.team.name) {
        const existingTeam =
          await prisma.team.findUnique({
            where: {
              motogpUuid: item.team.id,
            },
          });

        const team = await prisma.team.upsert({
          where: {
            motogpUuid: item.team.id,
          },

          create: {
            motogpUuid: item.team.id,
            legacyId:
              item.team.legacy_id ?? null,
            name: item.team.name,
          },

          update: {
            legacyId:
              item.team.legacy_id ?? null,
            name: item.team.name,
          },
        });

        teamId = team.id;

        if (!existingTeam) {
          teamsCreated++;
        }
      }

      /*
       * ============================================================
       * CONSTRUCTOR
       * ============================================================
       */

      let constructorId: string | null = null;

      if (
        item.constructor?.id &&
        item.constructor.name
      ) {
        const existingConstructor =
          await prisma.constructor.findUnique({
            where: {
              motogpUuid: item.constructor.id,
            },
          });

        const constructor =
          await prisma.constructor.upsert({
            where: {
              motogpUuid:
                item.constructor.id,
            },

            create: {
              motogpUuid:
                item.constructor.id,

              legacyId:
                item.constructor.legacy_id ??
                null,

              name:
                item.constructor.name,
            },

            update: {
              legacyId:
                item.constructor.legacy_id ??
                null,

              name:
                item.constructor.name,
            },
          });

        constructorId = constructor.id;

        if (!existingConstructor) {
          constructorsCreated++;
        }
      }

      /*
       * ============================================================
       * SESSION RESULT
       * ============================================================
       */

      const existingResult =
        await prisma.sessionResult.findUnique({
          where: {
            sessionId_riderId: {
              sessionId: session.id,
              riderId: rider.id,
            },
          },
        });

      /*
       * En la respuesta tenemos:
       *
       * best_lap.time → fastestLap
       * total_laps    → lapsCompleted
       * top_speed     → topSpeed
       * gap.first     → gap
       *
       * La respuesta mostrada no contiene:
       * points
       * time total
       * average speed
       * grid position
       */
      const resultData = {
        teamId,
        constructorId,

        position:
          item.position ?? null,

        positionText:
          item.position !== null &&
          item.position !== undefined
            ? String(item.position)
            : null,

        points: null,

        lapsCompleted:
          item.total_laps ?? null,

        time: null,

        gap:
          item.gap?.first ??
          item.gap?.prev ??
          null,

        status:
          item.status ?? null,

        fastestLap:
          item.best_lap?.time ?? null,

        averageSpeed: null,

        topSpeed:
          toNumber(item.top_speed),

        gridPosition: null,
      };

      await prisma.sessionResult.upsert({
        where: {
          sessionId_riderId: {
            sessionId: session.id,
            riderId: rider.id,
          },
        },

        create: {
          sessionId: session.id,
          riderId: rider.id,
          ...resultData,
        },

        update: resultData,
      });

      if (existingResult) {
        resultsUpdated++;
      } else {
        resultsCreated++;
      }
    }
  }

  return {
    sessionsProcessed,
    sessionsSkipped,
    resultsProcessed,
    resultsCreated,
    resultsUpdated,
    ridersCreated,
    teamsCreated,
    constructorsCreated,
  };
}