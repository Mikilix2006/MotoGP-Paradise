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
  is_next_gp: boolean;
}

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

// Horarios de sesiones. La hora se muestra siempre en hora peninsular; las
// columnas se agrupan por el día LOCAL del circuito (weekday: 0=domingo…6=sábado).
const HORA_PENINSULAR = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Madrid",
});

const DAY_COLUMNS = [
  { weekday: 4, label: "Jueves" },
  { weekday: 5, label: "Viernes" },
  { weekday: 6, label: "Sábado" },
  { weekday: 0, label: "Domingo" },
];

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

function formatSessionTime(date: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "—" : HORA_PENINSULAR.format(parsed);
}

// Cada día es una lista independiente (las sesiones de distintas columnas no
// se corresponden fila a fila), así que se usa una <ol> por día y no una tabla.
// El orden viene ya cronológico de la API (mezclando categorías).
type ScheduleColumn = (typeof DAY_COLUMNS)[number] & {
  sessions: CalendarSession[];
};

function getScheduleColumns(sessions: CalendarSession[] | undefined): ScheduleColumn[] {
  return DAY_COLUMNS.map((day) => ({
    ...day,
    sessions: (sessions ?? []).filter((session) => session.weekday === day.weekday),
  })).filter((column) => column.sessions.length > 0);
}

function SessionSchedule({
  columns,
  idPrefix,
}: {
  columns: ScheduleColumn[];
  idPrefix: string;
}) {
  return (
    <div className="border-t border-white/10 pt-4">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        Horarios · Hora peninsular
      </p>
      <div
        role="group"
        aria-label="Horarios de las sesiones de Moto3, Moto2 y MotoGP en hora peninsular"
        className={`mt-3 grid divide-x divide-white/5 overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] ${GRID_COLS[columns.length]}`}
      >
        {columns.map((column) => (
          <div key={column.weekday} className="min-w-0">
            <h4
              id={`${idPrefix}-dia-${column.weekday}`}
              className="border-b border-white/5 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:px-3"
            >
              {column.label}
            </h4>
            <ol aria-labelledby={`${idPrefix}-dia-${column.weekday}`}>
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
                      {formatSessionTime(session.date_start)}
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
}: {
  event: CalendarEventData;
  idPrefix?: string;
  // Card destacada del próximo GP: borde rojo y resplandor diagonal, como la
  // card principal del inicio.
  featured?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const round = getRound(event.legacy_id);
  const columns = getScheduleColumns(event.sessions);
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
            className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
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
          className={`grid transition-[grid-template-rows,visibility] duration-200 motion-reduce:transition-none ${
            open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-5 pb-5">
              <SessionSchedule columns={columns} idPrefix={panelId} />
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
          <EventCard event={nextGp} idPrefix="proximo" featured />
          <div className="mb-8 mt-10 border-t border-white/10" />
        </>
      )}

      <h2 className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-zinc-500">
        Todos los Grandes Premios de la temporada
      </h2>
      <div className="grid gap-4">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
