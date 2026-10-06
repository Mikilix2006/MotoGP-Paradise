"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  MapPin,
  Flag,
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
            className="card border border-white/10 p-5 transition-all hover:border-white/20 hover:bg-white/5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
              {/* Información del GP */}
              <div className="flex-1">
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

              {/* Bandera del país */}
              <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-sm text-zinc-400 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <Flag size={16} />
                <span className="font-semibold">{event.country.iso}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
