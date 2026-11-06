import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  isRaceSession,
  resolveSelection,
  sortRows,
  type SelectionRequest,
  type VisibleSession,
} from "@/services/results/resultsModel";

import type { ResultRow, ResultsPayload, ResultsSection } from "@/types/results";

export interface ResultsRequest extends SelectionRequest {
  section: ResultsSection;
  year?: number;
}

/*
 * Sesión visible: tiene shortname y algún resultado con tiempo o mejor vuelta.
 * En tests la importación solo guarda posición y diferencia (nunca tiempo ni
 * vuelta), así que ahí también cuenta `gap`; con la regla estricta no habría tests.
 */
function visible(section: ResultsSection) {
  const hasData =
    section === "tests"
      ? Prisma.sql`(r.time IS NOT NULL OR r.fastest_lap IS NOT NULL OR r.gap IS NOT NULL)`
      : Prisma.sql`(r.time IS NOT NULL OR r.fastest_lap IS NOT NULL)`;
  return Prisma.sql`s.shortname IS NOT NULL AND EXISTS (SELECT 1 FROM session_results r WHERE r.session_id = s.id AND ${hasData})`;
}

async function getYears(section: ResultsSection): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ year: number }[]>`
    SELECT DISTINCT se.year
    FROM sessions s
    JOIN events e ON e.id = s.event_id
    JOIN seasons se ON se.id = e.season_id
    WHERE e.is_test = ${section === "tests"} AND ${visible(section)}
    ORDER BY se.year DESC`;
  return rows.map((r) => r.year);
}

async function getVisibleSessions(section: ResultsSection, year: number): Promise<VisibleSession[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      shortname: string;
      date_start: Date | null;
      season_id: string;
      event_id: string;
      event_name: string;
      additional_name: string | null;
      event_date: Date | null;
      circuit_id: string | null;
      circuit_name: string | null;
      category_id: string;
      legacy_id: number | null;
      category_name: string;
    }[]
  >`
    SELECT s.id, s.shortname, s.date_start, e.season_id, e.id AS event_id, e.name AS event_name,
           e.additional_name, e.date_start AS event_date, e.circuit_id, ci.name AS circuit_name,
           c.id AS category_id, c.legacy_id, c.name AS category_name
    FROM sessions s
    JOIN events e ON e.id = s.event_id
    JOIN seasons se ON se.id = e.season_id
    JOIN categories c ON c.id = s.category_id
    LEFT JOIN circuits ci ON ci.id = e.circuit_id
    WHERE se.year = ${year} AND e.is_test = ${section === "tests"} AND c.legacy_id IS NOT NULL AND ${visible(section)}`;

  return rows.map((r) => ({
    id: r.id,
    shortname: r.shortname,
    dateStart: r.date_start?.getTime() ?? 0,
    seasonId: r.season_id,
    eventId: r.event_id,
    // additional_name es el nombre corto ("SAN MARINO"); sirve de etiqueta de evento.
    eventName: r.additional_name?.trim() || r.event_name,
    eventDate: r.event_date?.getTime() ?? 0,
    circuitId: r.circuit_id,
    circuitName: r.circuit_name,
    categoryId: r.category_id,
    categoryLegacyId: r.legacy_id as number,
    categoryName: r.category_name,
  }));
}

async function getClassification(session: VisibleSession): Promise<ResultRow[]> {
  const results = await prisma.sessionResult.findMany({
    where: { sessionId: session.id },
    select: {
      riderId: true,
      position: true,
      status: true,
      time: true,
      gap: true,
      fastestLap: true,
      points: true,
      lapsCompleted: true,
      rider: { select: { fullName: true, firstName: true, lastName: true } },
      team: { select: { name: true } },
      constructor: false,
    },
  });

  // El dorsal sale de la inscripción del piloto en esa temporada y categoría.
  const entries = await prisma.riderSeasonEntry.findMany({
    where: {
      seasonId: session.seasonId,
      categoryId: session.categoryId,
      riderId: { in: results.map((r) => r.riderId) },
    },
    select: { riderId: true, number: true, constructor: false },
  });
  const numbers = new Map(entries.map((e) => [e.riderId, e.number]));

  return sortRows(
    results.map((r) => ({
      position: r.position,
      rider_name:
        r.rider.fullName ?? ([r.rider.firstName, r.rider.lastName].filter(Boolean).join(" ") || "—"),
      number: numbers.get(r.riderId) ?? null,
      team_name: r.team?.name ?? null,
      status: r.status,
      time: r.time || null,
      gap: r.gap || null,
      fastest_lap: r.fastestLap || null,
      points: r.points === null ? null : Number(r.points),
      laps_completed: r.lapsCompleted,
    }))
  );
}

/** Selectores resueltos (con la cascada aplicada) y clasificación de la sesión elegida; null si no hay datos. */
export async function getResults(req: ResultsRequest): Promise<ResultsPayload | null> {
  const years = await getYears(req.section);
  if (years.length === 0) return null;

  const year = req.year !== undefined && years.includes(req.year) ? req.year : years[0];
  const sessions = await getVisibleSessions(req.section, year);

  // Un evento de otro año (o sección) no existe aquí: se conserva su circuito.
  let circuitId: string | null = null;
  if (req.event && !sessions.some((s) => s.eventId === req.event)) {
    circuitId = (await prisma.event.findUnique({ where: { id: req.event }, select: { circuitId: true } }))?.circuitId ?? null;
  }

  const resolved = resolveSelection(sessions, year, req, circuitId);
  if (!resolved) return null;

  const rows = await getClassification(resolved.session);
  return {
    section: req.section,
    years,
    events: resolved.events,
    categories: resolved.categories,
    sessions: resolved.sessions,
    selected: { year, ...resolved.selected },
    is_race: isRaceSession(rows),
    rows,
  };
}
