"use client";

import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import CountryFlag from "./CountryFlag";
import type { CalendarSession } from "@/types/grandPrix";
import { getLiveSessionId, getSessionState } from "./calendar/sessionState";
import {
  SESSION_LABELS,
  formatDate,
  formatSessionTime,
  getOffsetLabel,
  getScheduleColumns,
  getStatusConfig,
  validZone,
  type ScheduleColumn,
} from "./calendar/calendarModel";

interface CalendarEventData {
  id: string;
  sponsored_name: string;
  name: string;
  short_name: string;
  date_start: string;
  date_end: string;
  status: string;
  round: number | null;
  country: {
    iso: string;
    name: string;
  };
  flag_url: string | null;
  circuit: {
    name: string;
    place: string;
    track?: { infoImageUrl: string | null } | null;
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

function getStatusBadge(status: string) {
  const statusConfig = getStatusConfig(status);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border ${statusConfig.style} px-3 py-1 text-xs font-semibold`}
    >
      <span>{statusConfig.label}</span>
    </div>
  );
}

// Zona del usuario según el navegador (undefined = la que Intl use por defecto).
function getUserZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

// Clases estáticas (Tailwind no detecta nombres construidos dinámicamente).
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};


const MODE_BUTTON_BASE =
  "rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50";

function SessionSchedule({
  columns,
  idPrefix,
  zone,
  mode,
  circuitAvailable,
  offsetLabel,
  onModeChange,
  now,
}: {
  now: number;
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
  const liveId = getLiveSessionId(columns.flatMap((column) => column.sessions), now);

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
                ? "bg-red-600 text-[#fff]"
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
                ? "cursor-not-allowed text-zinc-500"
                : mode === "circuito"
                  ? "cursor-pointer bg-red-600 text-[#fff]"
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
              className="border-b border-white/5 px-2 py-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500 sm:px-3"
            >
              {column.label}
            </h4>
            <ol aria-labelledby={`${idPrefix}-dia-${column.key}`}>
              {column.sessions.map((session) => {
                const key = session.shortname.trim();
                const highlight = key === "RAC" || key === "RAC2" || key === "SPR";
                const { live, finished } = getSessionState(session, liveId, now);
                const motogp = session.category === "MotoGP";
                return (
                  <li
                    key={session.id}
                    className={`border-b border-white/5 px-2 py-1.5 last:border-b-0 sm:flex sm:items-baseline sm:gap-3 sm:px-3`}
                  >
                    <span
                      className={`block text-sm font-bold tabular-nums sm:w-11 sm:shrink-0 ${
                        finished ? "text-zinc-400" : "text-white"
                      }`}
                    >
                      {formatSessionTime(session.date_start, zone)}
                    </span>
                    <span className="block min-w-0 text-[11px] font-bold uppercase leading-tight tracking-wider sm:text-xs">
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
                      {live && (
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-px align-middle text-[10px] font-bold tracking-wider text-[#fff]">
                          EN VIVO
                          <Circle size={8} fill="currentColor" aria-hidden="true" className="animate-pulse" />
                        </span>
                      )}
                      {finished && (
                        <>
                          <span className="ml-1.5 rounded-full border border-white/10 px-1.5 py-px align-middle text-[11px] font-semibold normal-case tracking-normal text-zinc-400 inline-block">
                            Terminada
                          </span>
                        </>
                      )}
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
  now,
}: {
  now: number;
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
  const { round } = event;
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
        <span className="tag">
          {round ? `RONDA ${round}` : event.short_name}
        </span>
        {getStatusBadge(event.status)}
      </span>

      <span className="mt-4 block font-display text-3xl font-black uppercase italic leading-none text-white md:text-4xl">
        {event.sponsored_name || event.name}
      </span>

      <span className="mt-4 grid gap-3 sm:grid-cols-2">
        <span className="flex gap-2">
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
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </span>
      )}
    </>
  );

  return (
    <article
      className={`panel relative ${
        featured
          ? "!border-red-600 shadow-[0_0_0_1px_var(--accent)]"
          : ""
      } ${expandable ? "" : "p-5"}`}
    >
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
                now={now}
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
  // Reloj para marcar sesiones terminadas sin recargar (se refresca cada 60 s).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

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
      <div role="status" aria-label="Cargando calendario" className="animate-pulse">
        <div className="mb-4 h-3.5 w-44 rounded bg-white/10" />
        <div className="card pt-5">
          <div className="flex items-center gap-3">
            <div className="h-6 w-20 rounded-full bg-white/10" />
            <div className="h-6 w-24 rounded-full bg-white/10" />
          </div>
          <div className="mt-4 h-7 w-2/3 max-w-sm rounded bg-white/10" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-10 rounded bg-white/5" />
            <div className="h-10 rounded bg-white/5" />
          </div>
        </div>
        <div className="mb-8 mt-10 border-t border-white/10" />
        <div className="mb-4 h-3.5 w-72 max-w-full rounded bg-white/10" />
        <div className="grid gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card pt-5">
            <div className="flex items-center gap-3">
              <div className="h-6 w-20 rounded-full bg-white/10" />
              <div className="h-6 w-24 rounded-full bg-white/10" />
            </div>
            <div className="mt-4 h-7 w-2/3 max-w-sm rounded bg-white/10" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="h-10 rounded bg-white/5" />
              <div className="h-10 rounded bg-white/5" />
            </div>
          </div>
        ))}
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
            now={now}
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
            now={now}
            mode={mode}
            userZone={userZone}
            onModeChange={setMode}
          />
        ))}
      </div>
    </div>
  );
}
