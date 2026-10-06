"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  MapPin,
  LoaderCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
} from "lucide-react";
import type { CalendarSession } from "@/types/grandPrix";

interface CalendarEventData {
  id: string;
  sponsored_name: string;
  name: string;
  short_name: string;
  date_start: string;
  date_end: string;
  status: string;
  legacy_id: Array<{
    categoryId: number;
    eventId: number;
  }>;
  country: {
    iso: string;
    name: string;
  };
  flag_url: string | null;
  circuit: {
    name: string;
    place: string;
  };
  sessions?: CalendarSession[];
  // Zona IANA del circuito (llega en mayúsculas, p. ej. "ASIA/TOKYO"); null si no hay.
  time_zone: string | null;
  is_next_gp: boolean;
}

// Zona en la que se muestran las horas: la del usuario o la del circuito.
type TimeMode = "tu" | "circuito";

interface ApiResponse {
  data: CalendarEventData[];
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getStatusBadge(status: string) {
  const config: Record<string, { style: string; icon: React.ReactNode; label: string }> = {
    FINISHED: {
      style: "border-white/10 bg-zinc-900 text-zinc-400",
      icon: <CheckCircle2 size={16} />,
      label: "Finalizado",
    },
    CURRENT: {
      style: "border-red-500/30 bg-red-950 text-red-400",
      icon: <Clock size={16} />,
      label: "En curso",
    },
    "NOT-STARTED": {
      // Pill de contorno en zinc claro: se distingue del "Finalizado" (relleno
      // apagado) y del rojo de "En curso" / "ROUND N", sin salir de la paleta.
      style: "border-white/20 bg-transparent text-zinc-200",
      icon: <CalendarDays size={16} />,
      label: "Próximamente",
    },
  };

  const statusConfig = config[status] || config["NOT-STARTED"];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border ${statusConfig.style} px-3 py-1 text-xs font-semibold`}
    >
      {statusConfig.icon}
      <span>{statusConfig.label}</span>
    </div>
  );
}

// Lienzo común de las SVG de banderas de MotoGP: la bandera real va centrada
// en vertical a todo el ancho, con franjas transparentes arriba y abajo.
const FLAG_CANVAS_W = 162;
const FLAG_CANVAS_H = 116;

// Mide la franja vertical realmente pintada (en unidades del lienzo).
function measureFlag(img: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = FLAG_CANVAS_W;
  canvas.height = FLAG_CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, FLAG_CANVAS_W, FLAG_CANVAS_H);
  const { data } = ctx.getImageData(0, 0, FLAG_CANVAS_W, FLAG_CANVAS_H);
  let first = -1;
  let last = -1;
  for (let y = 0; y < FLAG_CANVAS_H; y++) {
    for (let x = 0; x < FLAG_CANVAS_W; x++) {
      if (data[(y * FLAG_CANVAS_W + x) * 4 + 3] > 10) {
        if (first < 0) first = y;
        last = y;
        break;
      }
    }
  }
  if (first < 0) return null;
  return { top: first, height: last - first + 1 };
}

// Bandera del país. Se ajusta a la vertical: el alto pintado de la bandera
// llena el alto de la caja y se recorta solo por los lados. Si no se puede
// medir, object-cover; si no hay URL o falla la carga, el código ISO en una pill.
function CountryFlag({
  url,
  iso,
  name,
}: {
  url: string | null;
  iso: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const [fit, setFit] = useState<
    "pending" | "fallback" | { top: number; height: number }
  >("pending");
  const measured = useRef(false);

  if (!url || failed) {
    return (
      <span
        title={name}
        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-400"
      >
        {iso}
      </span>
    );
  }

  function handleLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    if (measured.current) return;
    measured.current = true;
    try {
      setFit(measureFlag(event.currentTarget) ?? "fallback");
    } catch {
      // Lienzo contaminado (CORS) u otro fallo: se usa object-cover.
      setFit("fallback");
    }
  }

  const ajustada = typeof fit === "object";

  return (
    <span className="relative block h-7 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        crossOrigin="anonymous"
        alt={`Bandera de ${name}`}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={() => setFailed(true)}
        className={
          ajustada
            ? "absolute left-1/2 max-w-none -translate-x-1/2"
            : `h-full w-full object-cover ${fit === "pending" ? "opacity-0" : ""}`
        }
        style={
          ajustada
            ? {
                height: `${(FLAG_CANVAS_H / fit.height) * 100}%`,
                top: `${(-fit.top / fit.height) * 100}%`,
              }
            : undefined
        }
      />
    </span>
  );
}

function getRound(legacyIds: CalendarEventData["legacy_id"]) {
  if (!legacyIds || legacyIds.length === 0) {
    return null;
  }
  return legacyIds[0].eventId;
}

// Horarios de sesiones. Las horas se muestran en la zona del modo activo ("tu
// hora" o "hora local del circuito") y las columnas son los DÍAS en esa zona.
const WEEKDAY_NAMES = [
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

function getFormatter(
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

// Zona del usuario según el navegador (undefined = la que Intl use por defecto).
function getUserZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

// Zona IANA válida para Intl (la de la BD llega en mayúsculas y se acepta tal cual).
function validZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

// Fecha AAAA-MM-DD del instante en la zona dada.
function getDayKey(date: Date, zone: string | undefined) {
  const parts = getFormatter("dia", "en-CA", zone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getWeekdayLabel(date: Date, zone: string | undefined) {
  const name = getFormatter("semana", "es-ES", zone, {
    weekday: "long",
  }).format(date);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Desfase legible ("UTC+2", "UTC+5:30", "UTC-7") de la zona en ese instante.
function getOffsetLabel(date: Date, zone: string | undefined) {
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

const SESSION_LABELS: Record<string, string> = {
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

// Clases estáticas (Tailwind no detecta nombres construidos dinámicamente).
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function formatSessionTime(date: string | null, zone: string | undefined) {
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
interface ScheduleColumn {
  key: string;
  label: string;
  sessions: CalendarSession[];
}

// Columnas = días en la zona mostrada (en "tu hora", una sesión del viernes del
// circuito puede caer en jueves). Se ordenan por fecha, no por día de la semana.
// Las sesiones sin fecha válida se muestran como "—" bajo el día local del
// circuito (weekday), al final; sin weekday tampoco se muestran (como antes).
function getScheduleColumns(
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

const MODE_BUTTON_BASE =
  "rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50";

function SessionSchedule({
  columns,
  idPrefix,
  zone,
  mode,
  circuitAvailable,
  offsetLabel,
  onModeChange,
}: {
  columns: ScheduleColumn[];
  idPrefix: string;
  zone: string | undefined;
  // Modo efectivo (sin zona del circuito válida siempre es "tu").
  mode: TimeMode;
  circuitAvailable: boolean;
  offsetLabel: string;
  onModeChange: (mode: TimeMode) => void;
}) {
  const modeText = mode === "tu" ? "Tu hora" : "Hora local del circuito";

  return (
    <div className="border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Horarios · {modeText} ({offsetLabel})
        </p>
        <div
          role="group"
          aria-label="Zona horaria de los horarios"
          className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5"
        >
          <button
            type="button"
            aria-pressed={mode === "tu"}
            onClick={() => onModeChange("tu")}
            className={`${MODE_BUTTON_BASE} cursor-pointer ${
              mode === "tu"
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            TU HORA
          </button>
          <button
            type="button"
            aria-pressed={mode === "circuito"}
            aria-disabled={!circuitAvailable}
            disabled={!circuitAvailable}
            title={
              circuitAvailable
                ? "Mostrar las horas en la zona horaria del circuito"
                : "No se conoce la zona horaria de este circuito"
            }
            onClick={() => onModeChange("circuito")}
            className={`${MODE_BUTTON_BASE} ${
              !circuitAvailable
                ? "cursor-not-allowed text-zinc-600"
                : mode === "circuito"
                  ? "cursor-pointer bg-white/10 text-white"
                  : "cursor-pointer text-zinc-500 hover:text-zinc-300"
            }`}
          >
            HORA LOCAL
          </button>
        </div>
      </div>
      <div
        role="group"
        aria-label={`Horarios de las sesiones de Moto3, Moto2 y MotoGP en ${modeText.toLowerCase()}`}
        className={`mt-3 grid divide-x divide-white/5 overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] ${GRID_COLS[Math.min(columns.length, 4)]}`}
      >
        {columns.map((column) => (
          <div key={column.key} className="min-w-0">
            <h4
              id={`${idPrefix}-dia-${column.key}`}
              className="border-b border-white/5 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:px-3"
            >
              {column.label}
            </h4>
            <ol aria-labelledby={`${idPrefix}-dia-${column.key}`}>
              {column.sessions.map((session) => {
                const key = session.shortname.trim();
                const highlight = key === "RAC" || key === "RAC2" || key === "SPR";
                const finished = session.status === "FINISHED";
                const motogp = session.category === "MotoGP";
                return (
                  <li
                    key={session.id}
                    className="border-b border-white/5 px-2 py-1.5 last:border-b-0 sm:flex sm:items-baseline sm:gap-3 sm:px-3"
                  >
                    <span
                      className={`block text-sm font-bold tabular-nums sm:w-11 sm:shrink-0 ${
                        finished ? "text-zinc-400" : "text-white"
                      }`}
                    >
                      {formatSessionTime(session.date_start, zone)}
                    </span>
                    <span className="block min-w-0 text-[10px] font-bold uppercase leading-tight tracking-wider sm:text-xs">
                      <span
                        className={
                          motogp && !finished ? "text-white" : "text-zinc-500"
                        }
                      >
                        {session.category}
                      </span>{" "}
                      <span
                        className={`whitespace-nowrap ${
                          highlight
                            ? "text-red-400"
                            : finished
                              ? "text-zinc-500"
                              : motogp
                                ? "text-zinc-300"
                                : "text-zinc-400"
                        }`}
                      >
                        {SESSION_LABELS[key] ?? key}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

// Card de un GP. Con horarios, la cabecera es un botón que despliega la tabla
// (estado propio por card: pueden estar abiertas varias a la vez). El h3 envuelve
// al botón (patrón de acordeón WAI-ARIA) para no perder la navegación por
// encabezados; dentro del botón solo hay spans (contenido de frase válido).
//
// idPrefix hace únicos los ids de accesibilidad cuando el mismo evento se pinta
// más de una vez (la copia destacada del próximo GP y la del listado).
function EventCard({
  event,
  idPrefix = "horarios",
  featured = false,
  mode,
  userZone,
  onModeChange,
}: {
  event: CalendarEventData;
  // Estado compartido por todas las cards (vive en CalendarView).
  mode: TimeMode;
  userZone: string | undefined;
  onModeChange: (mode: TimeMode) => void;
  idPrefix?: string;
  // Card destacada del próximo GP: borde rojo y resplandor diagonal, como la
  // card principal del inicio.
  featured?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const round = getRound(event.legacy_id);
  // Sin zona del circuito válida el conmutador queda deshabilitado y se usa "tu hora".
  const circuitZone = validZone(event.time_zone);
  const effectiveMode: TimeMode = circuitZone ? mode : "tu";
  const zone = effectiveMode === "circuito" ? (circuitZone ?? undefined) : userZone;
  const columns = getScheduleColumns(event.sessions, zone);
  // El desfase puede variar con el horario de verano: se calcula en la fecha de
  // la primera sesión del evento.
  const firstSession = (event.sessions ?? []).find(
    (session) => session.date_start && !Number.isNaN(new Date(session.date_start).getTime())
  );
  const offsetLabel = getOffsetLabel(
    firstSession?.date_start ? new Date(firstSession.date_start) : new Date(`${event.date_start}T12:00:00Z`),
    zone
  );
  const expandable = columns.length > 0;
  const panelId = `${idPrefix}-${event.id}`;

  const header = (
    <>
      <span className="flex flex-wrap items-center gap-3 pr-14">
        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-wider text-red-400">
          {round ? `ROUND ${round}` : event.short_name}
        </span>
        {getStatusBadge(event.status)}
      </span>

      <span className="mt-4 block text-xl font-bold text-white md:text-2xl">
        {event.sponsored_name || event.name}
      </span>

      <span className="mt-4 grid gap-3 sm:grid-cols-2">
        <span className="flex gap-2">
          <MapPin size={16} className="mt-1 shrink-0 text-red-500" />
          <span className="block text-sm">
            <span className="block font-semibold text-zinc-100">
              {event.circuit.name}
            </span>
            <span className="block font-normal text-zinc-500">
              {event.circuit.place}, {event.country.name}
            </span>
          </span>
        </span>

        <span className="flex gap-2">
          <CalendarDays size={16} className="mt-1 shrink-0 text-red-500" />
          <span className="block text-sm">
            <span className="block font-semibold text-zinc-100">
              {formatDate(event.date_start)}
            </span>
            <span className="block font-normal text-zinc-500">
              hasta {formatDate(event.date_end)}
            </span>
          </span>
        </span>
      </span>

      {expandable && (
        <span className="absolute bottom-5 right-5 flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-500">
          Horarios
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`transition-transform duration-300 ease-in-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </span>
      )}
    </>
  );

  return (
    <article
      className={`card relative transition-all ${
        featured
          ? "overflow-hidden !border-red-500/30 hover:!border-red-500/50 hover:bg-white/5"
          : "border border-white/10 hover:border-white/20 hover:bg-white/5"
      } ${expandable ? "" : "p-5"}`}
    >
      {featured && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-950/40 via-transparent to-transparent"
        />
      )}
      <div className="relative">
      <h3 className="m-0 text-base font-normal">
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="relative block w-full cursor-pointer rounded-[18px] p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
          >
            {header}
          </button>
        ) : (
          <span className="block">{header}</span>
        )}
      </h3>

      {expandable && (
        <div
          id={panelId}
          className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none ${
            open
              ? "visible opacity-100 grid-rows-[1fr]"
              : "invisible opacity-0 grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-5 pb-5">
              <SessionSchedule
                columns={columns}
                idPrefix={panelId}
                zone={zone}
                mode={effectiveMode}
                circuitAvailable={circuitZone !== null}
                offsetLabel={offsetLabel}
                onModeChange={onModeChange}
              />
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Bandera del país, esquina superior derecha (no intercepta el click) */}
      <div className="pointer-events-none absolute right-5 top-5">
        <CountryFlag
          url={event.flag_url}
          iso={event.country.iso}
          name={event.country.name}
        />
      </div>
    </article>
  );
}

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Modo de zona horaria compartido por todas las cards. No se persiste (opción
  // futura: localStorage con try/catch). La zona del usuario solo se usa tras el
  // fetch en el navegador, así que no hay desajuste de hidratación.
  const [mode, setMode] = useState<TimeMode>("tu");
  const [userZone] = useState(getUserZone);

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await fetch("/api/calendar");

        if (!response.ok) {
          throw new Error("No se pudo obtener el calendario");
        }

        const result: ApiResponse = await response.json();
        setEvents(result.data);
      } catch (error) {
        console.error("Error cargando el calendario:", error);
        setError("No se ha podido cargar el calendario");
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <LoaderCircle size={20} className="animate-spin" />
          <span>Cargando calendario...</span>
        </div>
      </div>
    );
  }

  if (error || events.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="font-medium text-red-400">
            {error || "No hay Grandes Premios disponibles"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Inténtalo de nuevo más tarde.
          </p>
        </div>
      </div>
    );
  }

  const nextGp = events.find((event) => event.is_next_gp);

  return (
    <div>
      {nextGp && (
        <>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-red-500">
            Próximo Gran Premio
          </h2>
          <EventCard
            event={nextGp}
            idPrefix="proximo"
            featured
            mode={mode}
            userZone={userZone}
            onModeChange={setMode}
          />
          <div className="mb-8 mt-10 border-t border-white/10" />
        </>
      )}

      <h2 className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-zinc-500">
        Todos los Grandes Premios de la temporada
      </h2>
      <div className="grid gap-4">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            mode={mode}
            userZone={userZone}
            onModeChange={setMode}
          />
        ))}
      </div>
    </div>
  );
}
