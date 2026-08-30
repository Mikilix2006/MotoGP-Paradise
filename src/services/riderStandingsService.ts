import { motogpFetch } from "./motogpApi";

import type {
  BMWAwardRider,
} from "@/types/rider";

/**
 * Obtiene la clasificación BMW Award de una temporada.
 *
 * A partir de esta respuesta obtenemos:
 * - Pilotos
 * - País
 * - Número
 * - Equipo
 * - legacy_id
 */
export async function getBMWAwardStandings(
  seasonUuid: string
): Promise<BMWAwardRider[]> {
  const response = await motogpFetch<{
    file: string;
    classification: BMWAwardRider[];
  }>(
    `/results/standings/bmwaward?seasonUuid=${seasonUuid}`
  );

  return response.classification;
}