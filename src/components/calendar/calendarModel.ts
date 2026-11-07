import type { CalendarSession } from "@/types/grandPrix";

const STATUS_CONFIG: Record<string, { style: string; label: string }> = {
  FINISHED: { style: "border-white/10 text-zinc-400", label: "Finalizado" },
  CURRENT: { style: "border-red-500/30 text-red-400", label: "En curso" },
  "NOT-STARTED": {
    // Pill de contorno en zinc claro: se distingue del "Finalizado" (relleno
    // apagado) y del rojo de "En curso" / "RONDA N", sin salir de la paleta.
    style: "border-white/20 bg-transparent text-zinc-200",
    label: "Próximamente",
  },
};

// Estilo y texto de la pill de estado; un estado desconocido cuenta como "Próximamente".
export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG["NOT-STARTED"];
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

// Horarios de sesiones. Las horas se muestran en la zona del modo activo ("tu
// hora" o "hora local del circuito") y las columnas son los DÍAS en esa zona.
export const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

// Los formateadores Intl son caros de crear: se reutilizan por tipo y zona.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function getFormatter(
  kind: string,
  locale: string,
  zone: string | undefined,
  options: Intl.DateTimeFormatOptions
) {
  const key = `${kind}|${zone ?? ""}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

// Zona IANA válida para Intl (la de la BD llega en mayúsculas y se acepta tal cual).
export function validZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

// Fecha AAAA-MM-DD del instante en la zona dada.
export function getDayKey(date: Date, zone: string | undefined) {
  const parts = getFormatter("dia", "en-CA", zone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getWeekdayLabel(date: Date, zone: string | undefined) {
  const name = getFormatter("semana", "es-ES", zone, {
    weekday: "long",
  }).format(date);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Desfase legible ("UTC+2", "UTC+5:30", "UTC-7") de la zona en ese instante.
export function getOffsetLabel(date: Date, zone: string | undefined) {
  const raw =
    getFormatter("offset", "en-US", zone, { timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = raw.match(/GMT([+\-−])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "UTC+0";
  const sign = match[1] === "+" ? "+" : "-";
  const minutes = match[3] && match[3] !== "00" ? `:${match[3]}` : "";
  return `UTC${sign}${Number(match[2])}${minutes}`;
}

export const SESSION_LABELS: Record<string, string> = {
  FP1: "FP1",
  FP2: "FP2",
  PR: "Práctica",
  Q1: "Q1",
  Q2: "Q2",
  SPR: "Sprint",
  WUP: "Warm Up",
  RAC: "Carrera",
  // RAC2 es la carrera reiniciada y la única de su categoría en ese evento.
  RAC2: "Carrera",
};

export function formatSessionTime(date: string | null, zone: string | undefined) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return getFormatter("hora", "es-ES", zone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

// Cada día es una lista independiente (las sesiones de distintas columnas no
// se corresponden fila a fila), así que se usa una <ol> por día y no una tabla.
// El orden dentro de cada columna es el cronológico que ya trae la API.
export interface ScheduleColumn {
  key: string;
  label: string;
  sessions: CalendarSession[];
}

// Columnas = días en la zona mostrada (en "tu hora", una sesión del viernes del
// circuito puede caer en jueves). Se ordenan por fecha, no por día de la semana.
// Las sesiones sin fecha válida se muestran como "—" bajo el día local del
// circuito (weekday), al final; sin weekday tampoco se muestran (como antes).
export function getScheduleColumns(
  sessions: CalendarSession[] | undefined,
  zone: string | undefined
): ScheduleColumn[] {
  const dated = new Map<string, ScheduleColumn>();
  const undated = new Map<number, ScheduleColumn>();

  for (const session of sessions ?? []) {
    const parsed = session.date_start ? new Date(session.date_start) : null;

    if (parsed && !Number.isNaN(parsed.getTime())) {
      const key = getDayKey(parsed, zone);
      const column = dated.get(key) ?? {
        key,
        label: getWeekdayLabel(parsed, zone),
        sessions: [],
      };
      column.sessions.push(session);
      dated.set(key, column);
    } else if (session.weekday !== null && WEEKDAY_NAMES[session.weekday]) {
      const column = undated.get(session.weekday) ?? {
        key: `sin-fecha-${session.weekday}`,
        label: WEEKDAY_NAMES[session.weekday],
        sessions: [],
      };
      column.sessions.push(session);
      undated.set(session.weekday, column);
    }
  }

  return [
    ...[...dated.values()].sort((a, b) =>
      a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    ),
    ...[...undated.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, column]) => column),
  ];
}
