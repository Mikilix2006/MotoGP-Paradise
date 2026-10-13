import { prisma } from "@/lib/prisma";

import { getCurrentSeason } from "./seasonRepository";

const MOTOGP_CATEGORY_LEGACY_ID = 3;

export interface ConstructorStanding {
  id: string;
  name: string;
  position: number;
  points: number;
  wins: number;
  poles: number;
  color: string | null;
}

/**
 * Clasificación de constructores de MotoGP de la temporada actual.
 *
 * No hay tabla de clasificación de constructores: se calcula sumando
 * los puntos de los resultados de carrera y sprint de cada marca.
 */
export async function getMotoGPConstructorStandings(): Promise<ConstructorStanding[]> {
  const season = await getCurrentSeason();

  if (!season) {
    throw new Error("No se encontró la temporada actual");
  }

  const session = {
    category: { legacyId: MOTOGP_CATEGORY_LEGACY_ID },
    event: { seasonId: season.id, isTest: false },
  };

  const [points, wins, poles] = await Promise.all([
    prisma.sessionResult.groupBy({
      by: ["constructorId"],
      where: {
        constructorId: { not: null },
        session: { ...session, type: { in: ["RAC", "SPR"] } },
      },
      _sum: { points: true },
    }),

    prisma.sessionResult.groupBy({
      by: ["constructorId"],
      where: {
        constructorId: { not: null },
        position: 1,
        session: { ...session, type: "RAC" },
      },
      _count: true,
    }),

    // Pole = primera posición en Q2 (la sesión que fija la parrilla delantera).
    prisma.sessionResult.groupBy({
      by: ["constructorId"],
      where: {
        constructorId: { not: null },
        position: 1,
        session: { ...session, type: "Q2" },
      },
      _count: true,
    }),
  ]);

  const ids = points.map((row) => row.constructorId as string);

  const constructors = await prisma.constructor.findMany({
    where: { id: { in: ids } },
  });

  // El constructor no guarda color: se toma el del equipo de sus pilotos (el primero con color).
  const entries = await prisma.riderSeasonEntry.findMany({
    where: {
      seasonId: season.id,
      category: { legacyId: MOTOGP_CATEGORY_LEGACY_ID },
      constructorId: { in: ids },
    },
    select: { constructorId: true, team: { select: { color: true } }, constructor: false },
  });

  const colorById = new Map<string, string>();
  for (const entry of entries) {
    if (entry.constructorId && entry.team?.color && !colorById.has(entry.constructorId)) {
      colorById.set(entry.constructorId, entry.team.color);
    }
  }

  const byId = new Map(constructors.map((item) => [item.id, item]));
  const winsById = new Map(wins.map((row) => [row.constructorId, row._count]));

  const polesById = new Map(poles.map((row) => [row.constructorId, row._count]));

  return points
    .map((row) => {
      const item = byId.get(row.constructorId as string);

      return {
        id: item?.motogpUuid ?? (row.constructorId as string),
        name: item?.name ?? "",
        points: Number(row._sum.points ?? 0),
        wins: winsById.get(row.constructorId) ?? 0,
        poles: polesById.get(row.constructorId) ?? 0,
        color: colorById.get(row.constructorId as string) ?? null,
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.poles - a.poles)
    .map((item, index) => ({ ...item, position: index + 1 }));
}
