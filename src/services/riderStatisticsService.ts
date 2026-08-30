import { motogpFetch } from "./motogpApi";

import type {
  RiderStatisticsApiResponse,
  RiderStatistics,
} from "@/types/rider";

/**
 * Obtiene todas las estadísticas históricas
 * de un piloto.
 */
export async function getRiderStatistics(
  legacyId: number
): Promise<RiderStatisticsApiResponse[]> {
  return motogpFetch<RiderStatisticsApiResponse[]>(
    `/riders/${legacyId}/statistics`
  );
}

/**
 * Busca las estadísticas del piloto
 * correspondientes a la temporada actual.
 */
export function getCurrentSeasonStatistics(
  statistics: RiderStatisticsApiResponse[],
  currentSeasonYear: number
): RiderStatistics | null {
  const currentSeasonStatistics =
    statistics.find(
      (statistic) =>
        statistic.season === String(currentSeasonYear)
    );

  if (!currentSeasonStatistics) {
    return null;
  }

  return {
    constructor:
      currentSeasonStatistics.constructor,

    starts:
      currentSeasonStatistics.starts,

    first_position:
      currentSeasonStatistics.first_position,

    second_position:
      currentSeasonStatistics.second_position,

    third_position:
      currentSeasonStatistics.third_position,

    podiums:
      currentSeasonStatistics.podiums,

    poles:
      currentSeasonStatistics.poles,

    points:
      currentSeasonStatistics.points,

    position:
      currentSeasonStatistics.position,
  };
}