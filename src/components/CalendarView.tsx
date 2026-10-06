"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  MapPin,
  LoaderCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface Event {
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
}

interface ApiResponse {
  data: Event[];
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getStatusBadge(status: string) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    FINISHED: {
      bg: "bg-zinc-900",
      text: "text-zinc-400",
      icon: <CheckCircle2 size={16} />,
      label: "Finalizado",
    },
    CURRENT: {
      bg: "bg-red-950",
      text: "text-red-400",
      icon: <Clock size={16} />,
      label: "En curso",
    },
    "NOT-STARTED": {
      bg: "bg-blue-950",
      text: "text-blue-400",
      icon: <CalendarDays size={16} />,
      label: "Próximamente",
    },
  };

  const statusConfig = config[status] || config["NOT-STARTED"];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border ${statusConfig.bg} px-3 py-1 text-xs font-semibold ${statusConfig.text}`}
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

function getRound(legacyIds: Event["legacy_id"]) {
  if (!legacyIds || legacyIds.length === 0) {
    return null;
  }
  return legacyIds[0].eventId;
}

export function CalendarView() {
  const [events, setEvents] = useState<Event[]>([]);
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

  return (
    <div className="grid gap-4">
      {events.map((event) => {
        const round = getRound(event.legacy_id);

        return (
          <article
            key={event.id}
            className="card relative border border-white/10 p-5 pr-20 transition-all hover:border-white/20 hover:bg-white/5"
          >
            {/* Información del GP */}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-wider text-red-400">
                  {round ? `ROUND ${round}` : event.short_name}
                </span>

                {getStatusBadge(event.status)}
              </div>

              <h3 className="mt-4 text-xl font-bold text-white md:text-2xl">
                {event.sponsored_name || event.name}
              </h3>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex gap-2">
                  <MapPin size={16} className="mt-1 shrink-0 text-red-500" />
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-100">
                      {event.circuit.name}
                    </p>
                    <p className="text-zinc-500">
                      {event.circuit.place}, {event.country.name}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <CalendarDays size={16} className="mt-1 shrink-0 text-red-500" />
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-100">
                      {formatDate(event.date_start)}
                    </p>
                    <p className="text-zinc-500">
                      hasta {formatDate(event.date_end)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bandera del país, esquina superior derecha */}
            <div className="absolute right-5 top-5">
              <CountryFlag
                url={event.flag_url}
                iso={event.country.iso}
                name={event.country.name}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
