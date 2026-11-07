import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { getCurrentSeason } from "./seasonRepository";

import {
  MOTOGP_CATEGORY_LEGACY_ID,
  toCalendarSessions,
  toDateOnly,
  toInstantIso,
} from "@/services/calendar/calendarModel";

import type { CalendarSession, MotoGPEvent } from "@/types/grandPrix";
import { countryNameEs } from "@/utils/country";

/*
 * legacy_id de la categoría MotoGP en la API de resultados.
 * Coincide con Category.legacyId y con el timing_id de la
 * API de broadcast.
 */

/*
 * Categorías que se muestran en el horario del calendario: Moto3 (1),
 * Moto2 (2) y MotoGP (3). Se excluyen MotoE (19) y las categorías
 * históricas (125cc, 250cc...). El orden numérico del legacyId es
 * también el orden de desempate al mezclar sesiones (de menor a mayor
 * cilindrada, como en los horarios oficiales: Moto3, Moto2, MotoGP).
 */
const CALENDAR_CATEGORY_LEGACY_IDS = [1, 2, 3];

const RACE_SESSION_TYPE = "RAC";
const SPRINT_SESSION_TYPE = "SPR";

const INFO_ASSET_TYPE = "INFO";

export interface CircuitTrackDetails {
  eventUuid: string;
  lengthKm: number | null;
  totalCorners: number | null;
  laps: number | null;
  infoImageUrl: string | null;

  /**
   * Instante absoluto (ISO) de inicio de la Sprint, convertido
   * desde la hora del circuito con su zona horaria.
   */
  sprintDate: string | null;
  sprintLaps: number | null;
}

export interface NextGrandPrixData extends MotoGPEvent {
  circuit: MotoGPEvent["circuit"] & {
    track: CircuitTrackDetails | null;
  };

  /** Instante absoluto (ISO) de inicio de la carrera principal de MotoGP. */
  nextMotoGPRace: string;

  race: {
    seasonUuid: string;
    eventUuid: string;
    categoryUuid: string;
    sessionUuid: string;
  };
}

/*
 * Relaciones necesarias para montar la respuesta: circuito con
 * sus trazados e imágenes, ids legacy, la categoría MotoGP del
 * evento (vueltas) y sus sesiones de carrera y sprint.
 */
const eventInclude = {
  country: true,

  circuit: {
    include: {
      tracks: {
        include: {
          assets: true,
        },
      },
    },
  },

  legacyMappings: true,

  scheduleDays: true,

  categories: {
    where: {
      category: {
        legacyId: MOTOGP_CATEGORY_LEGACY_ID,
      },
    },
  },

  sessions: {
    where: {
      category: {
        legacyId: MOTOGP_CATEGORY_LEGACY_ID,
      },

      type: {
        in: [RACE_SESSION_TYPE, SPRINT_SESSION_TYPE],
      },
    },

    include: {
      category: {
        select: {
          motogpUuid: true,
        },
      },
    },

    orderBy: {
      dateStart: "asc",
    },
  },
} satisfies Prisma.EventInclude;

/*
 * Variante para el calendario: igual que eventInclude pero con TODAS
 * las sesiones (FP, PR, Q, SPR, WUP, RAC) de Moto3, Moto2 y MotoGP,
 * en una sola consulta. getNextGrandPrix sigue usando eventInclude.
 */
const calendarEventInclude = {
  ...eventInclude,

  sessions: {
    where: {
      category: {
        legacyId: { in: CALENDAR_CATEGORY_LEGACY_IDS },
      },
    },

    include: {
      category: {
        select: {
          motogpUuid: true,
          legacyId: true,
          name: true,
          acronym: true,
        },
      },
    },

    orderBy: {
      dateStart: "asc",
    },
  },
} satisfies Prisma.EventInclude;

type EventWithDetails = Prisma.EventGetPayload<{
  include: typeof eventInclude;
}>;

export type CalendarEventWithDetails = Prisma.EventGetPayload<{
  include: typeof calendarEventInclude;
}>;

export type CalendarSessionRow = CalendarEventWithDetails["sessions"][number];

type Track = NonNullable<EventWithDetails["circuit"]>["tracks"][number];

/**
 * Selecciona el Gran Premio a mostrar.
 *
 * El estado que da la API no basta: MotoGP mantiene el evento en
 * CURRENT hasta bastante después de la carrera del domingo. Por
 * eso se elige el primer evento (por fecha) cuya carrera de MotoGP
 * aún no está FINISHED: durante el fin de semana es el GP en
 * curso y, en cuanto acaba la carrera, pasa a ser el siguiente.
 * Los tests de pretemporada no cuentan.
 *
 * Devuelve solo el id para que otros repositorios (favoritos,
 * etc.) puedan cargar del evento lo que necesiten.
 */
export async function findCurrentOrNextEventId(
  seasonId: string
): Promise<string | null> {
  const withPendingRace = await prisma.event.findFirst({
    where: {
      seasonId,
      isTest: false,

      sessions: {
        some: {
          type: RACE_SESSION_TYPE,
          category: { legacyId: MOTOGP_CATEGORY_LEGACY_ID },
          // Una carrera cancelada (p. ej. AUS 2026) tampoco está pendiente.
          status: { notIn: ["FINISHED", "CANCELLED"] },
        },
      },
    },

    orderBy: {
      dateStart: "asc",
    },

    select: {
      id: true,
    },
  });

  if (withPendingRace) {
    return withPendingRace.id;
  }

  /*
   * Sin carreras pendientes (fin de temporada o sesiones aún sin
   * importar): se recurre al estado que da la API.
   */
  for (const status of ["CURRENT", "NOT-STARTED"]) {
    const event = await prisma.event.findFirst({
      where: {
        seasonId,
        isTest: false,
        status,
      },

      orderBy: {
        dateStart: "asc",
      },

      select: {
        id: true,
      },
    });

    if (event) {
      return event.id;
    }
  }

  return null;
}

async function findCurrentOrNextEvent(
  seasonId: string
): Promise<EventWithDetails | null> {
  const eventId = await findCurrentOrNextEventId(seasonId);

  if (!eventId) {
    return null;
  }

  return prisma.event.findUnique({
    where: {
      id: eventId,
    },

    include: eventInclude,
  });
}

/**
 * La base de datos guarda todos los trazados históricos de un
 * circuito y no marca cuál es el vigente. Se toma el que tiene
 * imagen informativa y, en su defecto, el que tiene datos de
 * curvas.
 */
function pickTrack(tracks: Track[]): Track | null {
  if (tracks.length === 0) {
    return null;
  }

  const withInfoAsset = tracks.find((track) =>
    track.assets.some((asset) => asset.type === INFO_ASSET_TYPE)
  );

  if (withInfoAsset) {
    return withInfoAsset;
  }

  const withCorners = tracks.find(
    (track) => track.totalCorners !== null
  );

  return withCorners ?? tracks[0];
}

function buildTrackDetails(
  event: EventWithDetails
): CircuitTrackDetails {
  const track = event.circuit
    ? pickTrack(event.circuit.tracks)
    : null;

  const eventCategory = event.categories[0] ?? null;

  const raceSession = event.sessions.find(
    (session) => session.type === RACE_SESSION_TYPE
  );

  const sprintSession = event.sessions.find(
    (session) => session.type === SPRINT_SESSION_TYPE
  );

  const infoAsset = track?.assets.find(
    (asset) => asset.type === INFO_ASSET_TYPE
  );

  /*
   * Las vueltas vienen de la API de broadcast: primero de la
   * propia sesión y, si no se importó, de la categoría del evento.
   */
  const laps =
    raceSession?.numLaps ??
    eventCategory?.numLaps ??
    null;

  const sprintLaps =
    sprintSession?.numLaps ??
    eventCategory?.sprintNumLaps ??
    null;

  return {
    eventUuid: event.toadApiUuid ?? event.id,

    lengthKm: track?.lengthKm?.toNumber() ?? null,

    totalCorners: track?.totalCorners ?? null,

    laps,

    // Imagen oficial de photos.motogp.com, sin permiso: fuera de producción (ver aviso legal).
    infoImageUrl:
      process.env.NODE_ENV === "production" ? null : infoAsset?.path ?? null,

    sprintDate: sprintSession?.dateStart
      ? toInstantIso(sprintSession.dateStart, event.timeZone)
      : null,

    sprintLaps,
  };
}

type SeasonSummary = {
  id: string;
  motogpUuid: string | null;
};

/**
 * Mapeo único de un evento de Prisma a la forma de respuesta
 * (snake_case, la misma que devolvía la API externa).
 *
 * `round` es la posición del evento en el calendario (ver
 * getSeasonEvents / getEventRound).
 *
 * Devuelve null si al evento le falta el circuito, el país o la
 * sesión de carrera de MotoGP con fecha de inicio.
 */
function toNextGrandPrixData(
  event: EventWithDetails,
  season: SeasonSummary,
  round: number | null
): NextGrandPrixData | null {
  const { country, circuit } = event;

  if (!circuit || !country) {
    return null;
  }

  const raceSession = event.sessions.find(
    (session) => session.type === RACE_SESSION_TYPE
  );

  if (!raceSession?.dateStart) {
    return null;
  }

  return {
    id: event.resultsUuid ?? event.id,

    country: {
      iso: country.iso,
      name: countryNameEs(country.iso, country.name),
      region_iso: country.regionIso ?? "",
    },

    circuit: {
      id: circuit.motogpUuid ?? circuit.id,
      name: circuit.name,
      legacy_id: circuit.legacyId ?? 0,
      place: circuit.place ?? "",
      nation: circuit.nation ?? "",
      events_id: null,

      track: buildTrackDetails(event),
    },

    sponsored_name: event.sponsoredName ?? event.name,
    additional_name: event.additionalName ?? "",
    name: event.name,
    short_name: event.shortName ?? "",

    flag_url: event.flagUrl ?? null,

    date_start: toDateOnly(event.dateStart),
    date_end: toDateOnly(event.dateEnd),

    legacy_id: event.legacyMappings.map((mapping) => ({
      categoryId: mapping.categoryLegacyId,
      eventId: mapping.eventLegacyId,
    })),

    status: event.status ?? "",

    round,

    nextMotoGPRace: toInstantIso(raceSession.dateStart, event.timeZone),

    race: {
      seasonUuid: season.motogpUuid ?? season.id,
      eventUuid: event.resultsUuid ?? event.id,
      categoryUuid:
        raceSession.category.motogpUuid ?? raceSession.categoryId,
      sessionUuid: raceSession.resultsUuid ?? raceSession.id,
    },
  };
}

/** Gran Premio del calendario con las sesiones de Moto3, Moto2 y MotoGP. */
export interface CalendarEvent extends NextGrandPrixData {
  sessions: CalendarSession[];

  /** Zona IANA del circuito (llega en mayúsculas, p. ej. "ASIA/TOKYO"); null si no hay. */
  time_zone: string | null;

  /**
   * true solo en el "próximo GP", con la MISMA definición que la
   * portada (findCurrentOrNextEventId: primer evento por fecha, no
   * test, cuya carrera de MotoGP aún no está FINISHED), para que
   * calendario y portada nunca discrepen. false en el resto y en
   * todos si no hay próximo GP. Si el evento marcado se descarta
   * por falta de circuito, país o carrera, no hay ninguno true.
   */
  is_next_gp: boolean;
}

/**
 * Round de un evento: su posición (desde 1) entre los eventos no test
 * de la temporada ordenados por (dateStart asc, id asc). Es el mismo
 * orden que usa getSeasonEvents. null si es test o no tiene fecha.
 */
async function getEventRound(
  event: EventWithDetails
): Promise<number | null> {
  if (event.isTest || !event.dateStart) {
    return null;
  }

  const before = await prisma.event.count({
    where: {
      seasonId: event.seasonId,
      isTest: false,

      OR: [
        { dateStart: { lt: event.dateStart } },
        { dateStart: event.dateStart, id: { lt: event.id } },
      ],
    },
  });

  return before + 1;
}

export async function getSeasonEvents(): Promise<CalendarEvent[]> {
  const season = await getCurrentSeason();

  if (!season) {
    throw new Error(
      "No se encontró ninguna temporada marcada como actual"
    );
  }

  const [events, nextEventId] = await Promise.all([
    prisma.event.findMany({
      where: {
        seasonId: season.id,
        isTest: false,
      },

      include: calendarEventInclude,

      orderBy: [{ dateStart: "asc" }, { id: "asc" }],
    }),

    // Misma lógica que la portada; se compara por id interno.
    findCurrentOrNextEventId(season.id),
  ]);

  return events.flatMap((event, index) => {
    /*
     * La base (carrera, sprint, vueltas) se calcula solo con las
     * sesiones de MotoGP, igual que antes de incluir Moto2/Moto3.
     */
    const motogpOnly: EventWithDetails = {
      ...event,
      sessions: event.sessions.filter(
        (session) =>
          session.category.legacyId === MOTOGP_CATEGORY_LEGACY_ID
      ),
    };

    /*
     * Posición en la lista completa de eventos no test (antes de
     * descartar ninguno) para que la numeración no salte. Los eventos
     * sin fecha van al final y no tienen round.
     */
    const round = event.dateStart ? index + 1 : null;

    const base = toNextGrandPrixData(motogpOnly, season, round);

    return base
      ? [
          {
            ...base,
            sessions: toCalendarSessions(event),
            time_zone: event.timeZone ?? null,
            is_next_gp:
              nextEventId !== null && event.id === nextEventId,
          },
        ]
      : [];
  });
}

/**
 * Obtiene desde PostgreSQL el Gran Premio actual o próximo
 * de la temporada en curso, con los datos del circuito y la
 * carrera principal de MotoGP.
 *
 * Devuelve la misma forma que devolvía la API externa para que
 * los componentes no cambien.
 */
export async function getNextGrandPrix(): Promise<NextGrandPrixData | null> {
  const season = await getCurrentSeason();

  if (!season) {
    throw new Error(
      "No se encontró ninguna temporada marcada como actual"
    );
  }

  const event = await findCurrentOrNextEvent(season.id);

  if (!event) {
    return null;
  }

  return toNextGrandPrixData(
    event,
    season,
    await getEventRound(event)
  );
}
