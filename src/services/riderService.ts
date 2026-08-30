import { getCurrentSeason } from "./seasonService";

import {
  getBMWAwardStandings,
} from "./riderStandingsService";

import {
  getRiderStatistics,
  getCurrentSeasonStatistics,
} from "./riderStatisticsService";

import type {
  MotoGPRider,
} from "@/types/rider";

/**
 * Obtiene la clasificación completa
 * de pilotos de MotoGP.
 */
export async function getMotoGPRiderStandings():
  Promise<MotoGPRider[]> {

  /*
   * PASO 1
   *
   * Obtener la temporada actual.
   */
  const currentSeason =
    await getCurrentSeason();

  if (!currentSeason) {
    throw new Error(
      "No se encontró la temporada actual"
    );
  }

  const seasonUuid =
    currentSeason.id;

  const currentSeasonYear =
    currentSeason.year;


  /*
   * PASO 2
   *
   * Obtener los pilotos desde BMW Award.
   */
  const standings =
    await getBMWAwardStandings(
      seasonUuid
    );


  /*
   * PASO 3
   *
   * Para cada piloto obtenemos sus
   * estadísticas de la temporada actual.
   *
   * Promise.all permite hacer todas
   * las peticiones simultáneamente.
   */
  const ridersWithStatistics =
    await Promise.all(
      standings.map(async (standing) => {

        const riderStatistics =
          await getRiderStatistics(
            standing.rider.legacy_id
          );

        const currentStatistics =
          getCurrentSeasonStatistics(
            riderStatistics,
            currentSeasonYear
          );

        /*
         * Si por algún motivo no existen
         * estadísticas para la temporada,
         * ignoramos al piloto.
         */
        if (!currentStatistics) {
          return null;
        }

        const rider: MotoGPRider = {
          id:
            standing.rider.id,

          full_name:
            standing.rider.full_name,

          country: {
            iso:
              standing.rider.country.iso,

            name:
              standing.rider.country.name,
          },

          legacy_id:
            standing.rider.legacy_id,

          riders_id:
            standing.rider.riders_id,

          number:
            standing.rider.number,

          team: {
            id:
              standing.team.id,

            name:
              standing.team.name,

            legacy_id:
              standing.team.legacy_id,
          },

          statistics:
            currentStatistics,
        };

        return rider;
      })
    );


  /*
   * Eliminamos posibles valores null.
   */
  const riders =
    ridersWithStatistics.filter(
      (
        rider
      ): rider is MotoGPRider =>
        rider !== null
    );


  /*
   * PASO 4
   *
   * Ordenar de mayor a menor
   * según los puntos.
   */
  return riders.sort(
    (a, b) =>
      b.statistics.points -
      a.statistics.points
  );
}