import { motogpFetch } from "./motogpApi";

import type { MotoGPSession } from "@/types/session";

/**
 * Obtiene todas las sesiones de una categoría
 * dentro de un evento concreto.
 */
export async function getSessionsByEvent(
  eventUuid: string,
  categoryUuid: string
): Promise<MotoGPSession[]> {
  return motogpFetch<MotoGPSession[]>(
    `/results/sessions?eventUuid=${eventUuid}&categoryUuid=${categoryUuid}`
  );
}

/**
 * Busca la carrera principal de MotoGP.
 *
 * La carrera principal se identifica mediante:
 * - session.category.id === categoryUuid
 * - session.type === "RAC"
 */
export function getMainRaceSession(
  sessions: MotoGPSession[],
  categoryUuid: string
): MotoGPSession | null {
  return (
    sessions.find(
      (session) =>
        session.category.id === categoryUuid &&
        session.type === "RAC"
    ) ?? null
  );
}