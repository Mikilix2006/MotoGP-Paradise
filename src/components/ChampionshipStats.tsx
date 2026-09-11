"use client";

import { useEffect, useState } from "react";

import { getMadridTimestamp } from "@/utils/date";

import {
  Trophy,
  Medal,
  Map,
  Flag,
} from "lucide-react";

interface RiderStatistics {
  constructor: string;
  starts: number;
  first_position: number;
  second_position: number;
  third_position: number;
  podiums: number;
  poles: number;
  points: number;
  position: number;
}

interface MotoGPRider {
  id: string;
  full_name: string;
  number: number;

  team: {
    id: string;
    name: string;
    legacy_id: number;
  };

  statistics: RiderStatistics;
}

interface CircuitTrack {
  eventUuid: string;
  lengthKm: number | null;
  totalCorners: number | null;
  laps: number | null;
  infoImageUrl: string | null;
  sprintDate: string | null;
  sprintLaps: number | null;
}

interface GrandPrixData {
  circuit: {
    id: string;
    name: string;
    track?: CircuitTrack | null;
  };
}

interface RidersApiResponse {
  data: MotoGPRider[];
}

interface GrandPrixApiResponse {
  data: GrandPrixData;
}

interface ChampionshipStatsData {
  leader: MotoGPRider;
}

function formatSprintDate(
  date: string | null
): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    }
  ).format(new Date(getMadridTimestamp(date)));
}

function formatSprintTime(
  date: string | null
): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Madrid",
    }
  ).format(new Date(getMadridTimestamp(date)));
}

export default function ChampionshipStats() {
  const [stats, setStats] =
    useState<ChampionshipStatsData | null>(
      null
    );

  const [grandPrix, setGrandPrix] =
    useState<GrandPrixData | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);

        /*
         * Cargamos clasificación y GP al mismo tiempo.
         */
        const [
          ridersResponse,
          grandPrixResponse,
        ] = await Promise.all([
          fetch("/api/riders/standings"),
          fetch("/api/next-gp"),
        ]);

        if (!ridersResponse.ok) {
          throw new Error(
            "No se pudo obtener la clasificación"
          );
        }

        if (!grandPrixResponse.ok) {
          throw new Error(
            "No se pudo obtener el Gran Premio"
          );
        }

        const ridersResult:
          RidersApiResponse =
          await ridersResponse.json();

        const grandPrixResult:
          GrandPrixApiResponse =
          await grandPrixResponse.json();

        if (
          !ridersResult.data ||
          ridersResult.data.length === 0
        ) {
          throw new Error(
            "No hay pilotos disponibles"
          );
        }

        /*
         * La API ya devuelve los pilotos ordenados,
         * pero nos aseguramos de que el líder sea
         * el piloto con más puntos.
         */
        const riders = [
          ...ridersResult.data,
        ].sort(
          (a, b) =>
            b.statistics.points -
            a.statistics.points
        );

        setStats({
          leader: riders[0],
        });

        setGrandPrix(
          grandPrixResult.data
        );
      } catch (error) {
        console.error(
          "Error cargando estadísticas:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <div
              key={index}
              className="card animate-pulse p-5"
            >
              <div className="h-3 w-24 rounded bg-white/10" />

              <div className="mt-4 h-8 w-36 rounded bg-white/10" />

              <div className="mt-3 h-3 w-28 rounded bg-white/10" />
            </div>
          )
        )}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const track =
    grandPrix?.circuit.track;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

      {/* LÍDER */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Líder
          </span>

          <Trophy
            size={18}
            className="text-red-500"
          />
        </div>

        <p className="mt-4 text-xl font-black text-white">
          {stats.leader.full_name}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          #{stats.leader.number} ·{" "}
          {stats.leader.team.name}
        </p>
      </div>

      {/* PUNTOS DEL LÍDER */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Puntos del líder
          </span>

          <Medal
            size={18}
            className="text-red-500"
          />
        </div>

        <p className="mt-4 text-3xl font-black text-white">
          {stats.leader.statistics.points}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          puntos en el campeonato
        </p>
      </div>

      {/* DATOS DEL CIRCUITO */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Circuito
          </span>

          <Map
            size={18}
            className="text-red-500"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3">

          {/* IMAGEN */}
          <div className="flex items-center justify-center">
            {track?.infoImageUrl ? (
              <img
                src={track.infoImageUrl}
                alt="Información del circuito"
                className="max-h-40 w-auto max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-zinc-500">
                Información del circuito no disponible
              </p>
            )}
          </div>
          {/* KILÓMETROS */}
          <div>
            <p className="text-2xl font-black text-white">
              {track?.lengthKm ?? "—"}
            </p>

            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
              KM
            </p>
          </div>

          {/* CURVAS */}
          <div>
            <p className="text-2xl font-black text-white">
              {track?.totalCorners ?? "—"}
            </p>

            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
              Curvas
            </p>
          </div>

          {/* VUELTAS */}
          <div>
            <p className="text-2xl font-black text-white">
              {track?.laps ?? "—"}
            </p>

            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
              Vueltas
            </p>
          </div>

        </div>
      </div>

      {/* SPRINT */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Sprint
          </span>

          <Flag
            size={18}
            className="text-red-500"
          />
        </div>

        {/* FECHA */}
        <div className="mt-5">
          <p className="text-xl font-black capitalize text-white">
            {formatSprintDate(
              track?.sprintDate ?? null
            )}
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Día de la Sprint
          </p>
        </div>

        {/* HORA */}
        <div className="mt-4">
          <p className="text-3xl font-black text-white">
            {formatSprintTime(
              track?.sprintDate ?? null
            )}
          </p>

          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
            Hora peninsular
          </p>
        </div>

        {/* VUELTAS */}
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-3xl font-black text-white">
            {track?.sprintLaps ?? "—"}
          </p>

          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
            Vueltas
          </p>
        </div>
      </div>

    </div>
  );
}