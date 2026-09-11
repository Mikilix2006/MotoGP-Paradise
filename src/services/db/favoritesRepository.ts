import { prisma } from "@/lib/prisma";

import { getCurrentSeason } from "./seasonRepository";

import { findCurrentOrNextEventId } from "./nextGrandPrixRepository";

import {
  computeBikeScores,
  computeFavorites,
  didFinish,
  MODEL_WEIGHTS,
  type FavoriteInput,
  type RaceResultInput,
  type RaceType,
} from "@/services/stats/favoritesModel";

import type { Favorite, FavoritesResponse } from "@/types/favorites";

const MOTOGP_CATEGORY_LEGACY_ID = 3;

const RACE_TYPES: RaceType[] = ["RAC", "SPR"];

/*
 * La parrilla "actual" son los pilotos que corrieron la última
 * cita disputada (entran sustitutos que están corriendo, salen
 * wildcards de citas anteriores) más los titulares de la
 * alineación vigente que hayan corrido alguna carrera este
 * año (por si se perdieron la última cita).
 */
const GRID_LOOKBACK_EVENTS = 1;

/* Temporadas (además de la actual) que alimentan la fiabilidad. */
const RELIABILITY_SEASONS = 2;

/* Ediciones del circuito que definen el rendimiento de cada moto. */
const BIKE_SEASONS = 3;

/* Resultados en el circuito que se devuelven por piloto. */
const HISTORY_LIMIT = 8;

/*
 * Un resultado de carrera con lo justo para el modelo.
 *
 * La relación `constructor` NO se incluye: además del choque de
 * tipos con Object.prototype.constructor, al incluirla Prisma
 * deja de convertir las fechas del resultado en `Date`. Se
 * guarda el id y el nombre se resuelve con una consulta aparte.
 */
const raceResultSelect = {
  riderId: true,
  position: true,
  status: true,
  constructorId: true,
  constructor: false,

  session: {
    select: {
      type: true,
      dateStart: true,

      event: {
        select: {
          shortName: true,
          dateStart: true,
          circuitId: true,

          season: {
            select: {
              year: true,
            },
          },
        },
      },
    },
  },
} as const;

type RaceResultRow = {
  riderId: string;
  position: number | null;
  status: string | null;
  constructorId: string | null;
  session: {
    type: string | null;
    dateStart: Date | null;
    event: {
      shortName: string | null;
      dateStart: Date | null;
      circuitId: string | null;
      season: { year: number };
    };
  };
};

type ConstructorNames = Map<string, string>;

/**
 * Nombres de constructor por id, para no incluir la relación
 * `constructor` en las consultas de resultados.
 */
async function loadConstructorNames(): Promise<ConstructorNames> {
  const constructors = await prisma.constructor.findMany();

  return new Map(
    constructors.map((constructor) => [constructor.id, constructor.name])
  );
}

function toModelInput(
  row: RaceResultRow,
  constructorNames: ConstructorNames
): RaceResultInput {
  return {
    seasonYear: row.session.event.season.year,

    date:
      row.session.dateStart ??
      row.session.event.dateStart ??
      new Date(0),

    sessionType: row.session.type as RaceType,

    position: row.position,
    status: row.status,
    constructorName: row.constructorId
      ? (constructorNames.get(row.constructorId) ?? null)
      : null,
    eventShortName: row.session.event.shortName,
  };
}

/**
 * Resultados de carrera y sprint de MotoGP que cumplen el
 * filtro indicado (temporada, circuito, pilotos...).
 */
async function loadRaceResults(where: {
  riderIds?: string[];
  circuitId?: string;
  seasonYears?: number[];
}): Promise<RaceResultRow[]> {
  return prisma.sessionResult.findMany({
    where: {
      ...(where.riderIds ? { riderId: { in: where.riderIds } } : {}),

      session: {
        type: { in: RACE_TYPES },

        category: {
          legacyId: MOTOGP_CATEGORY_LEGACY_ID,
        },

        event: {
          isTest: false,

          ...(where.circuitId ? { circuitId: where.circuitId } : {}),

          ...(where.seasonYears
            ? { season: { year: { in: where.seasonYears } } }
            : {}),
        },
      },
    },

    select: raceResultSelect,
  });
}

/**
 * Pilotos en parrilla (ver GRID_LOOKBACK_EVENTS), con su
 * dorsal, equipo y constructor actuales.
 */
async function loadCurrentGrid(
  seasonId: string,
  constructorNames: ConstructorNames
) {
  const lastEvents = await prisma.event.findMany({
    where: {
      seasonId,
      isTest: false,
      status: "FINISHED",
    },

    orderBy: {
      dateStart: "desc",
    },

    take: GRID_LOOKBACK_EVENTS,

    select: {
      id: true,
    },
  });

  const officialEntries = await prisma.riderSeasonEntry.findMany({
    where: {
      seasonId,
      category: { legacyId: MOTOGP_CATEGORY_LEGACY_ID },
      current: true,
      inGrid: true,
      type: "Official",
    },

    select: {
      riderId: true,
      constructor: false,
    },
  });

  const recentResults = await prisma.sessionResult.findMany({
    where: {
      session: {
        type: { in: RACE_TYPES },
        category: { legacyId: MOTOGP_CATEGORY_LEGACY_ID },
        event: { seasonId, isTest: false },
      },

      OR: [
        {
          session: {
            eventId: { in: lastEvents.map((event) => event.id) },
          },
        },
        {
          riderId: { in: officialEntries.map((entry) => entry.riderId) },
        },
      ],
    },

    orderBy: {
      session: {
        dateStart: "desc",
      },
    },

    select: {
      riderId: true,
      constructorId: true,
      constructor: false,
      team: { select: { name: true } },
    },
  });

  /*
   * El primer resultado de cada piloto es el más reciente:
   * de ahí salen su constructor y equipo actuales.
   */
  const latestByRider = new Map<
    string,
    { constructorName: string | null; teamName: string | null }
  >();

  for (const result of recentResults) {
    if (!latestByRider.has(result.riderId)) {
      latestByRider.set(result.riderId, {
        constructorName: result.constructorId
          ? (constructorNames.get(result.constructorId) ?? null)
          : null,
        teamName: result.team?.name ?? null,
      });
    }
  }

  const riderIds = [...latestByRider.keys()];

  const riders = await prisma.rider.findMany({
    where: {
      id: { in: riderIds },
    },

    select: {
      id: true,
      motogpUuid: true,
      fullName: true,
      country: { select: { iso: true } },

      seasonEntries: {
        where: {
          seasonId,
          category: { legacyId: MOTOGP_CATEGORY_LEGACY_ID },
        },

        select: {
          number: true,
          team: { select: { name: true } },
          constructor: false,
        },
      },
    },
  });

  return riders.map((rider) => {
    const latest = latestByRider.get(rider.id);
    const entry = rider.seasonEntries[0];

    return {
      id: rider.id,
      publicId: rider.motogpUuid ?? rider.id,
      fullName: rider.fullName ?? "",
      number: entry?.number ?? 0,
      teamName: latest?.teamName ?? entry?.team?.name ?? "",
      constructorName: latest?.constructorName ?? null,
      countryIso: rider.country?.iso ?? "",
    };
  });
}

/**
 * Calcula el índice de favoritos para el próximo Gran Premio
 * a partir de los resultados guardados en PostgreSQL.
 */
export async function getNextGrandPrixFavorites(): Promise<FavoritesResponse | null> {
  const season = await getCurrentSeason();

  if (!season) {
    throw new Error(
      "No se encontró ninguna temporada marcada como actual"
    );
  }

  const eventId = await findCurrentOrNextEventId(season.id);

  if (!eventId) {
    return null;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },

    select: {
      id: true,
      resultsUuid: true,
      name: true,
      shortName: true,
      dateStart: true,

      circuit: {
        select: {
          id: true,
          motogpUuid: true,
          name: true,
          place: true,
        },
      },
    },
  });

  if (!event?.circuit) {
    return null;
  }

  const constructorNames = await loadConstructorNames();

  const grid = await loadCurrentGrid(season.id, constructorNames);

  if (grid.length === 0) {
    return null;
  }

  const riderIds = grid.map((rider) => rider.id);

  const reliabilityYears = Array.from(
    { length: RELIABILITY_SEASONS + 1 },
    (_, offset) => season.year - offset
  );

  const bikeYears = Array.from(
    { length: BIKE_SEASONS },
    (_, offset) => season.year - 1 - offset
  );

  const [circuitRows, seasonRows, recentRows, bikeRows] =
    await Promise.all([
      loadRaceResults({ riderIds, circuitId: event.circuit.id }),
      loadRaceResults({ riderIds, seasonYears: [season.year] }),
      loadRaceResults({ riderIds, seasonYears: reliabilityYears }),
      loadRaceResults({
        circuitId: event.circuit.id,
        seasonYears: bikeYears,
      }),
    ]);

  const groupByRider = (rows: RaceResultRow[]) => {
    const groups = new Map<string, RaceResultInput[]>();

    for (const row of rows) {
      const group = groups.get(row.riderId) ?? [];

      group.push(toModelInput(row, constructorNames));

      groups.set(row.riderId, group);
    }

    return groups;
  };

  const circuitByRider = groupByRider(circuitRows);
  const seasonByRider = groupByRider(seasonRows);
  const recentByRider = groupByRider(recentRows);

  const bikeScores = computeBikeScores(
    bikeRows.map((row) => toModelInput(row, constructorNames))
  );

  const inputs: FavoriteInput[] = grid.map((rider) => ({
    riderId: rider.id,
    circuitResults: circuitByRider.get(rider.id) ?? [],
    seasonResults: seasonByRider.get(rider.id) ?? [],
    recentResults: recentByRider.get(rider.id) ?? [],
    constructorName: rider.constructorName,
  }));

  const outputs = computeFavorites(inputs, season.year, bikeScores);

  const gridById = new Map(grid.map((rider) => [rider.id, rider]));

  const favorites: Favorite[] = outputs.map((output, index) => {
    const rider = gridById.get(output.riderId)!;

    const { circuit, form, bike, reliability, trend } = output.breakdown;

    const history = (circuitByRider.get(output.riderId) ?? [])
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, HISTORY_LIMIT);

    return {
      rank: index + 1,

      rider: {
        id: rider.publicId,
        full_name: rider.fullName,
        number: rider.number,
        team_name: rider.teamName,
        constructor_name: rider.constructorName ?? "",
        country_iso: rider.countryIso,
      },

      score: Math.round(output.index * 100),
      win_probability: Math.round(output.winProbability * 1000) / 10,

      breakdown: {
        circuit: {
          races: circuit.races,
          finishes: circuit.finishes,
          dnfs: circuit.dnfs,
          wins: circuit.wins,
          podiums: circuit.podiums,
          best_position: circuit.bestPosition,
          average_position: circuit.averagePosition,
          raw_mean: circuit.rawMean,
          position_spread: circuit.positionSpread,
          consistency: circuit.consistency,
          credibility: circuit.credibility,
          score: circuit.score,
        },

        form: {
          races: form.races,
          finishes: form.finishes,
          wins: form.wins,
          podiums: form.podiums,
          average_position: form.averagePosition,
          score: form.score,
        },

        bike: {
          constructor_name: bike.constructorName,
          score: bike.score,
        },

        reliability: {
          starts: reliability.starts,
          finishes: reliability.finishes,
          finish_rate: reliability.finishRate,
          score: reliability.score,
        },

        trend: {
          delta: trend.delta,
          score: trend.score,
        },
      },

      circuit_history: history.map((result) => ({
        season_year: result.seasonYear,
        event_short_name: result.eventShortName,
        session_type: result.sessionType,
        position: result.position,
        finished: didFinish(result),
      })),
    };
  });

  return {
    event: {
      id: event.resultsUuid ?? event.id,
      name: event.name,
      short_name: event.shortName ?? "",
      date_start: event.dateStart?.toISOString().slice(0, 10) ?? "",

      circuit: {
        id: event.circuit.motogpUuid ?? event.circuit.id,
        name: event.circuit.name,
        place: event.circuit.place ?? "",
      },
    },

    model: {
      weights: { ...MODEL_WEIGHTS },
    },

    favorites,
  };
}
