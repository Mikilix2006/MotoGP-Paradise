import { prisma } from "@/lib/prisma";
import { buildPointsProgress } from "@/services/stats/pointsProgressModel";
import type { PointsProgress } from "@/types/pointsProgress";
import { countryNameEs } from "@/utils/country";

import { getCurrentSeason } from "./seasonRepository";

/**
 * Evolución de puntos por piloto en una temporada y categoría.
 *
 * Devuelve `null` si la temporada o la categoría no existen. Las reglas
 * (carrera reiniciada, titulares, nulos) viven en pointsProgressModel.ts.
 */
export async function getPointsProgress(
  year: number | undefined,
  categoryLegacyId: number
): Promise<PointsProgress | null> {
  const season = year
    ? await prisma.season.findUnique({ where: { year }, select: { id: true, year: true } })
    : await getCurrentSeason();
  if (!season) return null;

  const category = await prisma.category.findFirst({
    where: { legacyId: categoryLegacyId },
    select: { id: true },
  });
  if (!category) return null;

  const [events, results, entries, standings] = await Promise.all([
    prisma.event.findMany({
      where: { seasonId: season.id, isTest: false },
      select: {
        id: true,
        shortName: true,
        name: true,
        sequence: true,
        status: true,
        isTest: true,
        circuit: { select: { name: true } },
        country: { select: { iso: true, name: true } },
      },
    }),

    // Carrera y sprint; las sesiones antiguas type='SESSION' se filtran por shortname.
    prisma.sessionResult.findMany({
      where: {
        session: {
          categoryId: category.id,
          event: { seasonId: season.id, isTest: false },
          OR: [
            { type: { in: ["RAC", "SPR"] } },
            { type: "SESSION", shortname: { startsWith: "RAC" } },
            { type: "SESSION", shortname: { startsWith: "SPR" } },
          ],
        },
      },
      select: {
        riderId: true,
        points: true,
        constructor: false,
        session: {
          select: { id: true, eventId: true, type: true, shortname: true, dateStart: true },
        },
      },
    }),

    prisma.riderSeasonEntry.findMany({
      where: { seasonId: season.id, categoryId: category.id },
      select: {
        riderId: true,
        type: true,
        number: true,
        team: { select: { id: true, motogpUuid: true, name: true, color: true } },
        constructorId: true,
        constructor: false,
      },
    }),

    prisma.championshipStanding.findMany({
      where: { seasonId: season.id, categoryId: category.id },
      select: {
        riderId: true,
        position: true,
        points: true,
        team: { select: { id: true, motogpUuid: true, name: true, color: true } },
        constructorId: true,
        constructor: false,
      },
    }),
  ]);

  const teamOut = (team: { id: string; motogpUuid: string | null; name: string; color: string | null } | null) =>
    team ? { id: team.motogpUuid ?? team.id, name: team.name, color: team.color } : null;

  const riderIds = [...new Set([...entries, ...standings].map((row) => row.riderId))];
  const [riders, constructors] = await Promise.all([
    prisma.rider.findMany({
      where: { id: { in: riderIds } },
      select: { id: true, motogpUuid: true, fullName: true },
    }),
    prisma.constructor.findMany(),
  ]);
  const constructorById = new Map(constructors.map((c) => [c.id, c.name]));
  const constructorName = (id: string | null) => (id ? constructorById.get(id) ?? null : null);

  return buildPointsProgress({
    season: season.year,
    category: categoryLegacyId,

    events: events.map((e) => ({
      id: e.id,
      shortName: e.shortName,
      name: e.name,
      circuitName: e.circuit?.name ?? null,
      countryIso: e.country?.iso ?? null,
      countryName: e.country ? countryNameEs(e.country.iso, e.country.name) : null,
      sequence: e.sequence,
      status: e.status,
      isTest: e.isTest,
    })),

    results: results.map((r) => ({
      eventId: r.session.eventId,
      sessionId: r.session.id,
      sessionType: r.session.type,
      shortname: r.session.shortname,
      sessionDate: r.session.dateStart,
      riderId: r.riderId,
      points: r.points === null ? null : Number(r.points),
    })),

    entries: entries.map((e) => ({
      riderId: e.riderId,
      type: e.type,
      number: e.number,
      team: teamOut(e.team),
      constructorName: constructorName(e.constructorId),
    })),

    standings: standings.map((s) => ({
      riderId: s.riderId,
      position: s.position,
      points: s.points === null ? null : Number(s.points),
      team: teamOut(s.team),
      constructorName: constructorName(s.constructorId),
    })),

    riders: riders.map((r) => ({
      id: r.id,
      publicId: r.motogpUuid ?? r.id,
      fullName: r.fullName ?? "",
    })),
  });
}
