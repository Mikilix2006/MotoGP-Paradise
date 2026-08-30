"use client";

import { useEffect, useState } from "react";

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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

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

      {/* CIRCUITO */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Circuito
          </span>
        </div>

        <p className="mt-4 text-xl font-black text-white">
          {grandPrix?.circuit.name ?? "—"}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          {track?.lengthKm ?? "—"} km
          {" · "}
          {track?.totalCorners ?? "—"} curvas
          {" · "}
          {track?.laps ?? "—"} vueltas
        </p>
      </div>

      {/* VICTORIAS DEL LÍDER */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Victorias del líder
          </span>

          <Flag
            size={18}
            className="text-red-500"
          />
        </div>

        <p className="mt-4 text-3xl font-black text-white">
          {stats.leader.statistics.first_position}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          victorias esta temporada
        </p>
      </div>

    </div>
  );
}