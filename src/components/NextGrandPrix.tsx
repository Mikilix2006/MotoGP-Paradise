"use client";

import { useEffect, useState } from "react";
import { Countdown } from "./Countdown";
import {
CalendarDays,
MapPin,
Flag,
LoaderCircle,
} from "lucide-react";

interface GrandPrix {
id: string;

sponsored_name: string;
name: string;
additional_name: string;
short_name: string;

date_start: string;
date_end: string;

status: string;

legacy_id: {
  categoryId: number;
  eventId: number;
}[];

country: {
iso: string;
name: string;
region_iso: string;
};

circuit: {
id: string;
name: string;
place: string;
nation: string;
};

nextMotoGPRace: string;

race: {
  seasonUuid: string;
  eventUuid: string;
  categoryUuid: string;
  sessionUuid: string;
};

}

interface ApiResponse {
data: GrandPrix;
}

function formatDate(date: string) {
return new Intl.DateTimeFormat("es-ES", {
day: "numeric",
month: "long",
year: "numeric",
}).format(new Date(`${date}T12:00:00`));
}

function formatStatus(status: string) {
  const statuses: Record<string, string> = {
    CURRENT: "En curso",
    "NOT-STARTED": "Próximamente",
    FINISHED: "Finalizado",
  };

  return statuses[status] ?? status;
}

function getRound(legacyIds: GrandPrix["legacy_id"]) {
if (!legacyIds || legacyIds.length === 0) {
return null;
}

// Los eventos contienen un eventId por categoría.
// Para un GP, normalmente todos representan el mismo número de ronda.
return legacyIds[0].eventId;
}


export function NextGrandPrix() {
const [grandPrix, setGrandPrix] =
useState<GrandPrix | null>(null);

const [loading, setLoading] =
useState(true);

const [error, setError] =
useState<string | null>(null);

useEffect(() => {
async function loadGrandPrix() {
try {
const response =
await fetch("/api/next-gp");

    if (!response.ok) {
      throw new Error(
        "No se pudo obtener el próximo Gran Premio"
      );
    }

    const result: ApiResponse =
      await response.json();

    setGrandPrix(result.data);
  } catch (error) {
    console.error(
      "Error cargando el GP:",
      error
    );

    setError(
      "No se ha podido cargar la información del próximo GP"
    );
  } finally {
    setLoading(false);
  }
}

loadGrandPrix();

}, []);

if (loading) {
return ( <article className="card flex min-h-[380px] items-center justify-center p-8"> <div className="flex items-center gap-3 text-zinc-500"> <LoaderCircle
         size={20}
         className="animate-spin"
       />

      <span>
        Cargando próximo Gran Premio...
      </span>
    </div>
  </article>
);

}

if (error || !grandPrix) {
return ( <article className="card flex min-h-[380px] items-center justify-center p-8"> <div className="text-center"> <p className="font-medium text-red-400">
{error ||
"No hay información disponible"} </p>

      <p className="mt-2 text-sm text-zinc-500">
        Inténtalo de nuevo más tarde.
      </p>
    </div>
  </article>
);

}

const round = getRound(grandPrix.legacy_id);

return ( <article className="card relative overflow-hidden p-7 md:p-10"> <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 via-transparent to-transparent" />

  <div className="relative">
    <div className="flex items-center justify-between">
      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-wider text-red-400">
        {round ? `ROUND ${round}` : grandPrix.short_name}
      </span>

      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-wider text-red-400">
        {grandPrix.short_name}
      </span>

      <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
        {formatStatus(grandPrix.status)}
      </span>
    </div>

    <div className="mt-10">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-red-500">
        Próximo Gran Premio
      </p>

      <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight md:text-5xl">
        {grandPrix.sponsored_name || grandPrix.name}
      </h2>
    </div>

    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <div className="flex gap-3">
        <MapPin
          size={20}
          className="mt-1 shrink-0 text-red-500"
        />

        <div>
          <p className="font-semibold text-zinc-100">
            {grandPrix.circuit.name}
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            {grandPrix.circuit.place},{" "}
            {grandPrix.country.name}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <CalendarDays
          size={20}
          className="mt-1 shrink-0 text-red-500"
        />

        <div>
          <p className="font-semibold text-zinc-100">
            {formatDate(grandPrix.date_start)}
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Finaliza el{" "}
            {formatDate(grandPrix.date_end)}
          </p>
        </div>
      </div>
    </div>

    <div className="mt-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-red-500">
            Cuenta atrás para el Gran Premio
        </p>

        <Countdown
          targetDate={grandPrix.nextMotoGPRace}
        />
    </div>

    <div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-6 text-sm text-zinc-500">
      <Flag size={16} />

      <span>
        {grandPrix.country.iso} ·{" "}
        {grandPrix.additional_name}
      </span>
    </div>
  </div>
</article>

);
}
