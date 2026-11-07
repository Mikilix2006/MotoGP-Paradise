/*
 * Lógica pura de la gráfica de puntos por piloto (sin base de datos).
 *
 * Decisiones sobre los datos reales (verificadas contra la BD):
 *
 * - Carrera reiniciada: en un mismo evento y categoría puede haber varias
 *   sesiones de tipo RAC (RAC y RAC2, RAC1 y RAC2, o una con shortname nulo).
 *   A veces las dos traen la suma completa de puntos (duplicado) y a veces solo
 *   una tiene puntos. Solo cuenta UNA por evento y clase (carrera / sprint):
 *   la más tardía que reparte algún punto; si ninguna reparte, la más tardía
 *   con resultados. Es la regla "la carrera reiniciada sustituye a la
 *   interrumpida" y evita doblar puntos.
 *   Límite conocido: en Moto E (RAC1 y RAC2 son dos carreras reales) esta
 *   regla perdería una; la ruta solo admite categorías 1, 2 y 3.
 * - Sesiones antiguas con type='SESSION': se aceptan solo si el shortname
 *   empieza por RAC (carrera) o SPR (sprint); el resto (FP, QP, WUP) se ignora.
 *   Su `points` es 0 en lo guardado, así que no alteran totales.
 * - Un evento cuenta como disputado si tiene resultados de carrera o de sprint
 *   (una carrera cancelada con sprint disputada sigue puntuando).
 *   Se descartan los de test, los cancelados y los que no tienen resultados.
 */

import type {
  PointsProgress,
  PointsProgressEvent,
  PointsProgressRider,
  PointsProgressStep,
} from "@/types/pointsProgress";

export interface EventInput {
  id: string;
  shortName: string | null;
  name: string;
  circuitName: string | null;
  countryIso: string | null;
  countryName: string | null;
  sequence: number | null;
  status: string | null;
  isTest: boolean;
}

export interface ResultRowInput {
  eventId: string;
  sessionId: string;
  sessionType: string | null;
  shortname: string | null;
  sessionDate: Date | null;
  riderId: string;
  points: number | null;
}

export interface EntryInput {
  riderId: string;
  type: string | null;
  number: number | null;
  team: { id: string; name: string; color: string | null } | null;
  constructorName: string | null;
}

export interface StandingInput {
  riderId: string;
  position: number | null;
  points: number | null;
  team: { id: string; name: string; color: string | null } | null;
  constructorName: string | null;
}

export interface RiderInfoInput {
  id: string;
  /** Id público (motogpUuid ?? id), el que se devuelve en la respuesta. */
  publicId: string;
  fullName: string;
}

export interface PointsProgressInput {
  season: number;
  category: number;
  events: EventInput[];
  results: ResultRowInput[];
  entries: EntryInput[];
  standings: StandingInput[];
  riders: RiderInfoInput[];
}

/** Comparador con nulos al final (Infinity - Infinity daría NaN). */
const order = (a: number | null, b: number | null) => (a ?? Infinity) === (b ?? Infinity) ? 0 : (a ?? Infinity) < (b ?? Infinity) ? -1 : 1;

/** Redondeo a milésimas: los puntos son Decimal(10,3) y las sumas en coma flotante arrastran ruido. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Clase de sesión que puntúa; `null` si no cuenta para el campeonato. */
export function classifySession(
  type: string | null,
  shortname: string | null
): "race" | "sprint" | null {
  if (type === "RAC") return "race";
  if (type === "SPR") return "sprint";
  if (type === "SESSION") {
    const name = (shortname ?? "").toUpperCase();
    if (name.startsWith("RAC")) return "race";
    if (name.startsWith("SPR")) return "sprint";
  }
  return null;
}

/** Eventos disputables en orden de calendario (sequence; sin ella al final). */
export function selectEvents(events: EventInput[]): EventInput[] {
  return events
    .filter((e) => !e.isTest && e.status !== "CANCELLED")
    .sort(
      (a, b) =>
        order(a.sequence, b.sequence) ||
        a.name.localeCompare(b.name)
    );
}

/**
 * Sesión efectiva de cada clase en un evento (ver regla de carrera reiniciada
 * arriba). Devuelve las filas de la sesión elegida.
 *
 * Límite conocido: un piloto que solo aparece en una sesión RAC descartada
 * pierde sus puntos de ese GP (GER 2010 MotoGP, 4 pilotos). `standing_points`
 * y `total_points` de la respuesta sirven para detectarlo (no cuadran).
 */
function pickEffective(rows: ResultRowInput[]): ResultRowInput[] {
  const bySession = new Map<string, ResultRowInput[]>();
  for (const row of rows) {
    bySession.set(row.sessionId, [...(bySession.get(row.sessionId) ?? []), row]);
  }
  const sessions = [...bySession.values()];
  const scoring = sessions.filter((s) => s.some((r) => (r.points ?? 0) > 0));
  const candidates = scoring.length > 0 ? scoring : sessions;

  // Más tardía por fecha; empate de fecha -> shortname mayor (RAC2 sobre RAC); luego id.
  const key = (s: ResultRowInput[]) => s[0];
  candidates.sort((a, b) => {
    const da = key(a).sessionDate?.getTime() ?? 0;
    const db = key(b).sessionDate?.getTime() ?? 0;
    return (
      db - da ||
      (key(b).shortname ?? "").localeCompare(key(a).shortname ?? "") ||
      key(b).sessionId.localeCompare(key(a).sessionId)
    );
  });
  return candidates[0] ?? [];
}

/**
 * Titulares: entradas `Official`. Si la temporada/categoría no tiene `type`
 * informado, el respaldo son los pilotos presentes en la clasificación. Los
 * pilotos de la clasificación con entrada de otro tipo (sustituto, wildcard)
 * quedan fuera; los que no tienen entrada o la tienen con type nulo, dentro.
 */
export function selectRoster(entries: EntryInput[], standings: StandingInput[]): string[] {
  const entryByRider = new Map(entries.map((e) => [e.riderId, e]));
  const ids = new Set<string>();

  for (const entry of entries) {
    if (entry.type === "Official") ids.add(entry.riderId);
  }
  for (const standing of standings) {
    const entry = entryByRider.get(standing.riderId);
    if (!entry || entry.type === null) ids.add(standing.riderId);
  }
  return [...ids];
}

export function buildPointsProgress(input: PointsProgressInput): PointsProgress {
  const events = selectEvents(input.events);
  const rowsByEvent = new Map<string, Map<"race" | "sprint", ResultRowInput[]>>();

  for (const row of input.results) {
    const kind = classifySession(row.sessionType, row.shortname);
    if (!kind) continue;
    const byKind = rowsByEvent.get(row.eventId) ?? new Map();
    byKind.set(kind, [...(byKind.get(kind) ?? []), row]);
    rowsByEvent.set(row.eventId, byKind);
  }

  /* Eventos disputados con sus sesiones efectivas: eventId -> clase -> riderId -> puntos. */
  const played: PointsProgressEvent[] = [];
  const pointsByEvent = new Map<string, Record<"race" | "sprint", Map<string, number | null> | null>>();

  for (const event of events) {
    const byKind = rowsByEvent.get(event.id);
    const race = byKind?.get("race");
    const sprint = byKind?.get("sprint");
    // AUS 2026: carrera cancelada pero sprint disputada -> el GP cuenta por su sprint.
    if (!race?.length && !sprint?.length) continue;

    const toMap = (rows: ResultRowInput[] | undefined) =>
      rows && rows.length > 0
        ? new Map(pickEffective(rows).map((r) => [r.riderId, r.points] as const))
        : null;

    pointsByEvent.set(event.id, { race: toMap(race), sprint: toMap(sprint) });
    played.push({
      id: event.id,
      short_name: event.shortName,
      name: event.name,
      circuit_name: event.circuitName,
      country_iso: event.countryIso,
      country_name: event.countryName,
      sequence: event.sequence,
    });
  }

  const entryByRider = new Map(input.entries.map((e) => [e.riderId, e]));
  const standingByRider = new Map(input.standings.map((s) => [s.riderId, s]));
  const infoByRider = new Map(input.riders.map((r) => [r.id, r]));

  const riders: PointsProgressRider[] = selectRoster(input.entries, input.standings).map((riderId) => {
    const entry = entryByRider.get(riderId);
    const standing = standingByRider.get(riderId);
    let cumulative: number | null = null;

    const progress: PointsProgressStep[] = played.map((event) => {
      const sessions = pointsByEvent.get(event.id)!;
      // `?? null`: sin fila (o fila sin puntos) es null, nunca 0.
      const race = sessions.race?.get(riderId) ?? null;
      const sprint = sessions.sprint?.get(riderId) ?? null;
      const points = race === null && sprint === null ? null : round3((race ?? 0) + (sprint ?? 0));
      if (points !== null) cumulative = round3((cumulative ?? 0) + points);
      return { event_id: event.id, points, sprint_points: sprint, race_points: race, cumulative };
    });

    return {
      id: infoByRider.get(riderId)?.publicId ?? riderId,
      full_name: infoByRider.get(riderId)?.fullName ?? "",
      number: entry?.number ?? null,
      team: entry?.team ?? standing?.team ?? null,
      constructor_name: entry?.constructorName ?? standing?.constructorName ?? null,
      final_position: standing?.position ?? null,
      standing_points: standing?.points ?? null,
      total_points: cumulative,
      progress,
    };
  });

  // Posición final del campeonato; sin posición al final, por puntos y nombre.
  riders.sort(
    (a, b) =>
      order(a.final_position, b.final_position) ||
      (b.total_points ?? -1) - (a.total_points ?? -1) ||
      a.full_name.localeCompare(b.full_name)
  );

  return { season: input.season, category: input.category, events: played, riders };
}
