import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { getCurrentSeason } from "./seasonRepository";

import type { MotoGPEvent } from "@/types/grandPrix";

/*
 * legacy_id de la categoría MotoGP en la API de resultados.
 * Coincide con Category.legacyId y con el timing_id de la
 * API de broadcast.
 */
const MOTOGP_CATEGORY_LEGACY_ID = 3;

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

type EventWithDetails = Prisma.EventGetPayload<{
  include: typeof eventInclude;
}>;

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

  if (!event || !event.circuit || !event.country) {
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
      iso: event.country.iso,
      name: event.country.name,
      region_iso: event.country.regionIso ?? "",
    },

    circuit: {
      id: event.circuit.motogpUuid ?? event.circuit.id,
      name: event.circuit.name,
      legacy_id: event.circuit.legacyId ?? 0,
      place: event.circuit.place ?? "",
      nation: event.circuit.nation ?? "",
      events_id: null,

      track: buildTrackDetails(event),
    },

    sponsored_name: event.sponsoredName ?? event.name,
    additional_name: event.additionalName ?? "",
    name: event.name,
    short_name: event.shortName ?? "",

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
