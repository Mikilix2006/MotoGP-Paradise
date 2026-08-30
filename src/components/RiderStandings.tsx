"use client";

import { useEffect, useState } from "react";

interface RiderCountry {
  iso: string;
  name: string;
}

interface RiderTeam {
  id: string;
  name: string;
  legacy_id: number;
}

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

  country: RiderCountry;

  legacy_id: number;
  riders_id: string;
  number: number;

  team: RiderTeam;

  statistics: RiderStatistics;
}

interface ApiResponse {
  data: MotoGPRider[];
}

export default function RiderStandings() {
  const [riders, setRiders] = useState<MotoGPRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRiders() {
      try {
        setLoading(true);

        const response = await fetch(
          "/api/riders/standings"
        );

        if (!response.ok) {
          throw new Error(
            "No se pudo obtener la clasificación"
          );
        }

        const result: ApiResponse =
          await response.json();

        setRiders(result.data);
      } catch (error) {
        console.error(
          "Error cargando clasificación:",
          error
        );

        setError(
          "No se pudo cargar la clasificación de pilotos"
        );
      } finally {
        setLoading(false);
      }
    }

    loadRiders();
  }, []);

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">
          Clasificación de pilotos
        </h2>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-8 text-center text-zinc-400">
          Cargando clasificación...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">
          Clasificación de pilotos
        </h2>

        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section className="m-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-red-500">
            Campeonato
          </p>

          <h2 className="text-2xl font-bold text-white">
            Clasificación de pilotos
          </h2>
        </div>

        <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-zinc-400">
          {riders.length} pilotos
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
        {riders.map((rider) => (
          <div
            key={rider.id}
            className="flex items-center gap-4 border-b border-white/5 p-4 last:border-b-0 transition hover:bg-white/5"
          >
            {/* POSICIÓN */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg font-bold text-white">
              {rider.statistics.position}
            </div>

            {/* NÚMERO */}
            <div className="hidden w-10 text-center text-xl font-black text-zinc-500 sm:block">
              #{rider.number}
            </div>

            {/* INFORMACIÓN DEL PILOTO */}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold text-white">
                {rider.full_name}
              </h3>

              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>
                  {rider.country.iso}
                </span>

                <span className="text-zinc-600">
                  •
                </span>

                <span className="truncate">
                  {rider.team.name}
                </span>
              </div>
            </div>

            {/* CONSTRUCTOR */}
            <div className="hidden text-right md:block">
              <p className="text-xs text-zinc-500">
                Constructor
              </p>

              <p className="font-medium text-zinc-300">
                {rider.statistics.constructor}
              </p>
            </div>

            {/* PODIOS */}
            <div className="hidden w-16 text-center lg:block">
              <p className="text-xs text-zinc-500">
                Podios
              </p>

              <p className="font-bold text-white">
                {rider.statistics.podiums}
              </p>
            </div>

            {/* VICTORIAS */}
            <div className="hidden w-16 text-center lg:block">
              <p className="text-xs text-zinc-500">
                Victorias
              </p>

              <p className="font-bold text-white">
                {rider.statistics.first_position}
              </p>
            </div>

            {/* PUNTOS */}
            <div className="w-16 text-right">
              <p className="text-xs text-zinc-500">
                Puntos
              </p>

              <p className="text-xl font-black text-white">
                {rider.statistics.points}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}