import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { getCurrentSeason } from "./seasonRepository";

import { wallClockToInstant } from "@/utils/date";

import type { CalendarSession, MotoGPEvent } from "@/types/grandPrix";

/*
 * legacy_id de la categoría MotoGP en la API de resultados.
 * Coincide con Category.legacyId y con el timing_id de la
 * API de broadcast.
 */
const MOTOGP_CATEGORY_LEGACY_ID = 3;

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
   * Hora de inicio de la Sprint tal y como está guardada:
   * hora del circuito etiquetada como UTC. Se interpreta con
   * getMadridTimestamp() igual que la carrera principal.
   */
  sprintDate: string | null;
  sprintLaps: number | null;
}

export interface NextGrandPrixData extends MotoGPEvent {
  circuit: MotoGPEvent["circuit"] & {
    track: CircuitTrackDetails | null;
  };

  /** Hora de inicio de la carrera principal de MotoGP. */
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

type CalendarEventWithDetails = Prisma.EventGetPayload<{
  include: typeof calendarEventInclude;
}>;

type CalendarSessionRow = CalendarEventWithDetails["sessions"][number];

type Track = NonNullable<EventWithDetails["circuit"]>["tracks"][number];

function toDateOnly(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

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
          status: { not: "FINISHED" },
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

    infoImageUrl: infoAsset?.path ?? null,

    sprintDate:
      sprintSession?.dateStart?.toISOString() ?? null,

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
 * Devuelve null si al evento le falta el circuito, el país o la
 * sesión de carrera de MotoGP con fecha de inicio.
 */
function toNextGrandPrixData(
  event: EventWithDetails,
  season: SeasonSummary
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
      name: country.name,
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

    nextMotoGPRace: raceSession.dateStart.toISOString(),

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
 * Convierte la hora de pared guardada (hora local del circuito
 * etiquetada como UTC) al instante absoluto correcto. Sin zona
 * horaria válida no se inventa nada: devuelve null.
 */
function toAbsoluteIso(
  dateStart: Date | null,
  timeZone: string | null
): string | null {
  if (!dateStart || !timeZone) {
    return null;
  }

  try {
    return wallClockToInstant(dateStart, timeZone).toISOString();
  } catch {
    // Zona IANA no reconocida por Intl.
    return null;
  }
}

/*
 * La API de resultados publica para los últimos GP (aún NOT-STARTED)
 * un calendario provisional con las sesiones desplazadas varios días
 * (la hora es correcta, el día no). El horario de la API general, que
 * está en EventScheduleDay, sí es el real.
 *
 * Se detecta el calendario provisional a nivel de evento: alguna
 * sesión cae fuera de [Event.dateStart, Event.dateEnd], que son
 * correctos. Solo entonces se toma el día de EventScheduleDay (por
 * gpDay) y la hora de la propia sesión. No se aplica siempre porque
 * en otros eventos (JPN, AUS) el gpDay de sesiones y horario no
 * encaja con la numeración y corregiría de más.
 */

function toLocalDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function findProvisionalCorrector(
  event: CalendarEventWithDetails
): ((session: CalendarSessionRow) => Date | null) | null {
  if (!event.timeZone || !event.dateStart || !event.dateEnd) {
    return null;
  }

  const first = toLocalDateKey(event.dateStart);
  const last = toLocalDateKey(event.dateEnd);

  /*
   * La decisión se toma solo con las sesiones de MotoGP (como antes de
   * añadir Moto2/Moto3): el calendario provisional desplaza a todas las
   * categorías por igual y así un dato suelto de otra categoría no
   * puede activar la corrección en un evento correcto.
   */
  const isProvisional = event.sessions.some(
    (session) =>
      session.category.legacyId === MOTOGP_CATEGORY_LEGACY_ID &&
      session.dateStart !== null &&
      (toLocalDateKey(session.dateStart) < first ||
        toLocalDateKey(session.dateStart) > last)
  );

  if (!isProvisional) {
    return null;
  }

  return (session) => {
    if (!session.dateStart || !session.gpDay) {
      return null;
    }

    const matches = event.scheduleDays.filter(
      (day) => day.gpDay === session.gpDay && day.dateStart !== null
    );

    // Sin día único para ese gpDay no se inventa nada.
    if (matches.length !== 1 || !matches[0].dateStart) {
      return null;
    }

    const day = matches[0].dateStart;
    const time = session.dateStart;

    // Fecha del horario real + hora de reloj de la sesión.
    const corrected = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        time.getUTCHours(),
        time.getUTCMinutes(),
        time.getUTCSeconds(),
        time.getUTCMilliseconds()
      )
    );

    const key = toLocalDateKey(corrected);

    // La fecha corregida debe caer dentro del fin de semana del GP.
    return key >= first && key <= last ? corrected : null;
  };
}

/** Nombre de categoría para mostrar: el de la BD sin el símbolo ™. */
function toCategoryLabel(category: CalendarSessionRow["category"]): string {
  const label = category.name.replace(/™/g, "").trim();

  return label || category.acronym || "";
}

/*
 * En las carreras reiniciadas la API de resultados añade un duplicado
 * "basura" de la carrera: sin shortname ni name, sin broadcastUuid ni
 * gpDay, junto a la sesión real (RAC2). Se descarta solo si existe otra
 * sesión de la misma categoría y tipo; nada más se filtra.
 */
function isGhostDuplicate(
  session: CalendarSessionRow,
  all: CalendarSessionRow[]
): boolean {
  return (
    session.shortname === null &&
    session.name === null &&
    session.broadcastUuid === null &&
    session.gpDay === null &&
    all.some(
      (other) =>
        other.id !== session.id &&
        other.categoryId === session.categoryId &&
        other.type === session.type
    )
  );
}

function toCalendarSessions(
  event: CalendarEventWithDetails
): CalendarSession[] {
  const correct = findProvisionalCorrector(event);

  const visible = event.sessions.filter(
    (session) => !isGhostDuplicate(session, event.sessions)
  );

  const sessions = visible.map((session) => {
    // Reloj de pared del circuito (corregido si el calendario es provisional).
    const wallClock = correct?.(session) ?? session.dateStart;

    const calendarSession: CalendarSession = {
      id: session.resultsUuid ?? session.broadcastUuid ?? session.id,
      shortname: session.shortname ?? session.type ?? "",
      name: session.name ?? session.shortname ?? "",
      type: session.type ?? "",
      status: session.status ?? "",
      date_start: toAbsoluteIso(wallClock, event.timeZone),

      // Día local del circuito: los campos UTC son su reloj de pared.
      weekday: wallClock ? wallClock.getUTCDay() : null,

      category: toCategoryLabel(session.category),
      category_legacy_id: session.category.legacyId ?? 0,
    };

    return calendarSession;
  });

  /*
   * Línea temporal mezclando categorías: por instante ya corregido
   * (no por Session.dateStart crudo). Sin fecha, al final. Desempate
   * determinista: categoría (Moto3, Moto2, MotoGP) y después id.
   */
  return sessions.sort((a, b) => {
    if (a.date_start !== b.date_start) {
      if (a.date_start === null) return 1;
      if (b.date_start === null) return -1;

      return (
        new Date(a.date_start).getTime() -
        new Date(b.date_start).getTime()
      );
    }

    return (
      a.category_legacy_id - b.category_legacy_id ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  });
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

      orderBy: {
        dateStart: "asc",
      },
    }),

    // Misma lógica que la portada; se compara por id interno.
    findCurrentOrNextEventId(season.id),
  ]);

  return events.flatMap((event) => {
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

    const base = toNextGrandPrixData(motogpOnly, season);

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

  return toNextGrandPrixData(event, season);
}
