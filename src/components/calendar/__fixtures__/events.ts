import type { CalendarSession } from "@/types/grandPrix";

// Fixtures escritas a mano para el calendario (forma de la respuesta de /api/calendar).
export function calSession(
  id: string,
  shortname: string,
  date_start: string | null,
  extra: Partial<CalendarSession> = {}
): CalendarSession {
  return {
    id,
    shortname,
    name: shortname,
    type: shortname,
    status: "NOT-STARTED",
    date_start,
    date_end: null,
    weekday: null,
    category: "MotoGP",
    category_legacy_id: 3,
    ...extra,
  };
}

/*
 * cambio-horario: GP de Japón (Asia/Tokyo, UTC+9). El viernes a las 09:00 JST
 * (00:00Z) cae el jueves en Los Ángeles (17:00 PDT del día 1).
 */
export const cambioHorario: CalendarSession[] = [
  calSession("fp1", "FP1", "2026-10-02T00:00:00.000Z"), // vie 09:00 JST
  calSession("q2", "Q2", "2026-10-03T05:00:00.000Z"), // sáb 14:00 JST
  calSession("rac", "RAC", "2026-10-04T06:00:00.000Z"), // dom 15:00 JST
];

/* sin-fecha: sesiones sin date_start, con y sin weekday. */
export const sinFecha: CalendarSession[] = [
  calSession("a", "FP1", "2026-05-01T08:00:00.000Z"),
  calSession("b", "FP2", null, { weekday: 5 }), // viernes
  calSession("c", "Q1", null, { weekday: null }), // sin fecha ni día: no sale
];

export function calendarEvent(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    sponsored_name: `GP ${id}`,
    name: `GP ${id}`,
    short_name: id.toUpperCase(),
    date_start: "2026-05-01",
    date_end: "2026-05-03",
    status: "NOT-STARTED",
    round: 1,
    country: { iso: "ES", name: "España" },
    flag_url: null,
    circuit: { name: `Circuito ${id}`, place: "Lugar" },
    sessions: [
      calSession(`${id}-fp1`, "FP1", "2026-05-01T08:00:00.000Z"),
      calSession(`${id}-rac`, "RAC", "2026-05-03T13:00:00.000Z"),
    ],
    time_zone: "EUROPE/MADRID",
    is_next_gp: false,
    ...over,
  };
}
