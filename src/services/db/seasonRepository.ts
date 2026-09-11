import { prisma } from "@/lib/prisma";

export interface CurrentSeason {
  /** Id interno de PostgreSQL. */
  id: string;

  /** Uuid de la temporada en la API de resultados. */
  motogpUuid: string | null;

  year: number;
}

/**
 * Devuelve la temporada marcada como actual en la base
 * de datos (Season.current = true).
 */
export async function getCurrentSeason(): Promise<CurrentSeason | null> {
  return prisma.season.findFirst({
    where: {
      current: true,
    },

    select: {
      id: true,
      motogpUuid: true,
      year: true,
    },
  });
}
