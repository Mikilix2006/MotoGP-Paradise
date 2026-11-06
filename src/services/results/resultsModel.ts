// Lógica pura de /resultados (sin BD ni React): selección en cascada, etiquetas y formato de filas.
import type {
  ResultRow,
  ResultsCategoryOption,
  ResultsEventOption,
  ResultsSelected,
  ResultsSessionOption,
} from "../../types/results";

export const MOTOGP_LEGACY_ID = 3;

// Sesión con resultados visibles; es lo que carga el repositorio para un año y sección.
export interface VisibleSession {
  id: string;
  shortname: string;
  dateStart: number;
  seasonId: string;
  eventId: string;
  eventName: string;
  eventDate: number;
  circuitId: string | null;
  circuitName: string | null;
  categoryId: string;
  categoryLegacyId: number;
  categoryName: string;
}

export interface SelectionRequest {
  event?: string;
  category?: number;
  session?: string;
}

export interface ResolvedSelection {
  selected: Omit<ResultsSelected, "year">;
  session: VisibleSession;
  events: ResultsEventOption[];
  categories: ResultsCategoryOption[];
  sessions: ResultsSessionOption[];
}

const SESSION_LABELS: Record<string, string> = {
  FP1: "Libres 1",
  FP2: "Libres 2",
  PR: "Práctica",
  Q1: "Q1",
  Q2: "Q2",
  SPR: "Sprint",
  WUP: "Warm-up",
  RAC: "Carrera",
};

// Sin entrada ni patrón conocido se muestra el shortname tal cual.
export function sessionLabel(shortname: string): string {
  if (SESSION_LABELS[shortname]) return SESSION_LABELS[shortname];
  const n = /^(FP|P|RAC|QP)(\d)$/.exec(shortname);
  if (n) return `${{ FP: "Libres", P: "Práctica", RAC: "Carrera", QP: "Clasificación" }[n[1]]} ${n[2]}`;
  if (shortname === "QP") return "Clasificación";
  if (shortname === "FP") return "Libres";
  return shortname;
}

// Las sesiones hasta 2001 cuelgan de MotoGP™ en la BD: solo cambia la etiqueta.
export function categoryLabel(legacyId: number, name: string, year: number): string {
  if (legacyId === MOTOGP_LEGACY_ID && year <= 2001) return "500cc";
  return name.replace("™", "").trim();
}

// Los nombres de evento vienen a veces en mayúsculas: se pasan a tipo título.
function titleIfUpper(text: string): string {
  const t = text.trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
}

const CATEGORY_ORDER = [3, 2, 1, 19, 5, 9, 10, 8, 7, -1];
const categoryRank = (legacyId: number) => {
  const i = CATEGORY_ORDER.indexOf(legacyId);
  return i < 0 ? CATEGORY_ORDER.length : i;
};

function uniqueEvents(sessions: VisibleSession[]): VisibleSession[] {
  const seen = new Map<string, VisibleSession>();
  for (const s of sessions) if (!seen.has(s.eventId)) seen.set(s.eventId, s);
  return [...seen.values()].sort((a, b) => a.eventDate - b.eventDate || a.eventName.localeCompare(b.eventName));
}

// Etiqueta = circuito; el evento solo se añade si ese circuito tiene varios eventos visibles.
export function eventOptions(sessions: VisibleSession[]): ResultsEventOption[] {
  const events = uniqueEvents(sessions);
  const perCircuit = new Map<string, number>();
  for (const e of events) if (e.circuitId) perCircuit.set(e.circuitId, (perCircuit.get(e.circuitId) ?? 0) + 1);
  return events.map((e) => {
    const eventName = titleIfUpper(e.eventName);
    const many = e.circuitId && (perCircuit.get(e.circuitId) ?? 0) > 1;
    return {
      id: e.eventId,
      // El evento va delante: en un <select> cerrado se corta el final de la etiqueta.
      label: e.circuitName ? (many ? `${eventName} · ${e.circuitName}` : e.circuitName) : eventName,
    };
  });
}

/**
 * Cascada evento > categoría > sesión sobre las sesiones visibles de un año.
 * Cada nivel conserva lo pedido si existe; si no, cae al último evento con la
 * categoría preferida (MotoGP por defecto) y a su última sesión.
 * `requestedCircuitId`: circuito del evento pedido (de otro año), para conservar el circuito.
 */
export function resolveSelection(
  sessions: VisibleSession[],
  year: number,
  req: SelectionRequest,
  requestedCircuitId: string | null = null
): ResolvedSelection | null {
  const events = uniqueEvents(sessions);
  if (events.length === 0) return null;

  const pref = req.category ?? MOTOGP_LEGACY_ID;
  const has = (eventId: string, cat: number) =>
    sessions.some((s) => s.eventId === eventId && s.categoryLegacyId === cat);
  const lastPreferred = (list: VisibleSession[]) =>
    list.filter((e) => has(e.eventId, pref)).at(-1) ??
    list.filter((e) => has(e.eventId, MOTOGP_LEGACY_ID)).at(-1) ??
    list.at(-1);

  const event =
    events.find((e) => e.eventId === req.event) ??
    (requestedCircuitId ? lastPreferred(events.filter((e) => e.circuitId === requestedCircuitId)) : undefined) ??
    lastPreferred(events)!;

  const inEvent = sessions.filter((s) => s.eventId === event.eventId);
  const legacyIds = [...new Set(inEvent.map((s) => s.categoryLegacyId))].sort((a, b) => categoryRank(a) - categoryRank(b));
  const category =
    req.category !== undefined && legacyIds.includes(req.category)
      ? req.category
      : legacyIds.includes(MOTOGP_LEGACY_ID)
        ? MOTOGP_LEGACY_ID
        : legacyIds[0];

  const list = inEvent
    .filter((s) => s.categoryLegacyId === category)
    .sort((a, b) => a.dateStart - b.dateStart || a.shortname.localeCompare(b.shortname));
  const session = list.find((s) => s.shortname === req.session) ?? list[list.length - 1];

  return {
    selected: { event: event.eventId, category, session: session.shortname },
    session,
    events: eventOptions(sessions),
    categories: legacyIds.map((id) => ({
      legacy_id: id,
      label: categoryLabel(id, inEvent.find((s) => s.categoryLegacyId === id)!.categoryName, year),
    })),
    sessions: list.map((s) => ({ shortname: s.shortname, label: sessionLabel(s.shortname) })),
  };
}

// ---------- filas ----------

const STATUS_LABELS: Record<string, string> = {
  OUTSTND: "Abandono",
  NOTSTARTED: "No salió",
  DISQUALIFIED: "Descalificado",
  EXCLUDED: "Excluido",
  OUTOFTIME: "Fuera de tiempo",
  NOTFINISHFIRST: "No terminó",
  NOTONRESTARTGRID: "No tomó la salida",
};

export function statusLabel(status: string | null): string {
  return (status && STATUS_LABELS[status]) || "—";
}

// Con tiempo en alguna fila es carrera/sprint (por los datos, no por type: hay tipos antiguos).
export function isRaceSession(rows: Pick<ResultRow, "time">[]): boolean {
  return rows.some((r) => r.time !== null && r.time !== "");
}

// Clasificados por posición; sin posición al final, por vueltas completadas.
export function sortRows<T extends Pick<ResultRow, "position" | "laps_completed" | "rider_name">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;
    return (b.laps_completed ?? -1) - (a.laps_completed ?? -1) || a.rider_name.localeCompare(b.rider_name);
  });
}

export interface FormattedRow {
  pos: string;
  number: string;
  rider: string;
  team: string;
  /** Carrera: tiempo, diferencia o estado. Entrenamiento: mejor vuelta. */
  main: string;
  /** Carrera: puntos. Entrenamiento: diferencia con el primero. */
  extra: string;
  /** Pilotos sin posición: el estado va en texto, no solo en color. */
  noPosition: boolean;
}

const dash = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);
const pointsFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });

export function formatRow(row: ResultRow, isRace: boolean): FormattedRow {
  const noPosition = row.position === null;
  let main: string;
  let extra: string;
  if (isRace) {
    if (noPosition) main = statusLabel(row.status);
    else if (row.position === 1) main = dash(row.time);
    else main = row.gap ? `+${row.gap}` : dash(row.time);
    extra = row.points === null ? "—" : pointsFormat.format(row.points);
  } else {
    main = dash(row.fastest_lap);
    extra = noPosition || row.position === 1 || !row.gap ? "—" : `+${row.gap}`;
  }
  return {
    pos: noPosition ? "—" : String(row.position),
    number: row.number === null ? "—" : String(row.number),
    rider: row.rider_name,
    team: dash(row.team_name),
    main,
    extra,
    noPosition,
  };
}
