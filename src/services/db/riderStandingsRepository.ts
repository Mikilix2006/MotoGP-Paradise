import { prisma } from "@/lib/prisma";

import { getCurrentSeason } from "./seasonRepository";

import type { MotoGPRider } from "@/types/rider";

const MOTOGP_CATEGORY_LEGACY_ID = 3;

/**
 * Obtiene desde PostgreSQL la clasificación de pilotos de
 * MotoGP de la temporada actual.
 *
 * Igual que hacía la API externa, la lista de pilotos sale
 * del BMW Award, los puntos y posición de las estadísticas
 * de temporada y el dorsal de la inscripción del piloto
 * (RiderSeasonEntry).
 */
export async function getMotoGPRiderStandings(): Promise<MotoGPRider[]> {
  const season = await getCurrentSeason();

  if (!season) {
    throw new Error(
      "No se encontró la temporada actual"
    );
  }

  const motogpCategory = {
    legacyId: MOTOGP_CATEGORY_LEGACY_ID,
  };

  /*
   * Estos modelos tienen una relación llamada `constructor`, que
   * choca con la propiedad del mismo nombre de Object al inferir
   * el tipo del include/select. Indicarla explícitamente evita el
   * error de tipos.
   */
  const [standings, statistics, entries] = await Promise.all([
    prisma.bmwAwardStanding.findMany({
      where: {
        seasonId: season.id,
      },

      include: {
        rider: {
          include: {
            country: true,
          },
        },

        team: true,

        constructor: false,
      },
    }),

    prisma.riderSeasonStatistics.findMany({
      where: {
        seasonId: season.id,
        category: motogpCategory,
      },

      include: {
        constructor: true,
      },
    }),

    prisma.riderSeasonEntry.findMany({
      where: {
        seasonId: season.id,
        category: motogpCategory,
      },

      select: {
        riderId: true,
        number: true,

        team: {
          select: {
            id: true,
            motogpUuid: true,
            name: true,
            legacyId: true,
          },
        },

        constructor: false,
      },
    }),
  ]);

  const statisticsByRiderId = new Map(
    statistics.map((statistic) => [statistic.riderId, statistic])
  );

  const entriesByRiderId = new Map(
    entries.map((entry) => [entry.riderId, entry])
  );

  const riders: MotoGPRider[] = [];

  for (const standing of standings) {
    const currentStatistics =
      statisticsByRiderId.get(standing.riderId);

    /*
     * Si el piloto no tiene estadísticas de la temporada,
     * se ignora, como hacía la versión que leía de la API.
     */
    if (!currentStatistics) {
      continue;
    }

    const { rider } = standing;

    const entry = entriesByRiderId.get(standing.riderId);

    const team = standing.team ?? entry?.team ?? null;

    riders.push({
      id: rider.motogpUuid ?? rider.id,

      full_name: rider.fullName ?? "",

      country: {
        iso: rider.country?.iso ?? "",
        name: rider.country?.name ?? "",
      },

      legacy_id: rider.legacyId ?? 0,

      riders_id: rider.ridersId ?? "",

      number: entry?.number ?? 0,

      team: {
        id: team?.motogpUuid ?? team?.id ?? "",
        name: team?.name ?? "",
        legacy_id: team?.legacyId ?? 0,
      },

      statistics: {
        constructor: currentStatistics.constructor?.name ?? "",

        starts: currentStatistics.starts ?? 0,

        first_position: currentStatistics.wins ?? 0,
        second_position: currentStatistics.secondPlaces ?? 0,
        third_position: currentStatistics.thirdPlaces ?? 0,

        podiums: currentStatistics.podiums ?? 0,
        poles: currentStatistics.poles ?? 0,

        points: currentStatistics.points ?? 0,

        position: currentStatistics.championshipPosition ?? 0,
      },
    });
  }

  return riders.sort(
    (a, b) => b.statistics.points - a.statistics.points
  );
}
