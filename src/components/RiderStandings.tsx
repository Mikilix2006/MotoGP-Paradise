"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

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

  return (
    <section>
      {/* CABECERA */}
      <div className="flex items-start justify-between border-b border-white/10 p-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Campeonato
          </p>

          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
            <Trophy className="text-red-500" />
            Clasificación de pilotos
          </h2>
        </div>

        {!loading && !error && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
            {riders.length} pilotos
          </span>
        )}
      </div>

      {/* CARGANDO */}
      {loading && (
        <div className="p-6">
          <div className="flex items-center justify-center rounded-xl border border-white/5 bg-zinc-900/50 py-12 text-sm text-zinc-500">
            Cargando clasificación...
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="p-6">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400">
            {error}
          </div>
        </div>
      )}

      {/* CLASIFICACIÓN */}
      {!loading && !error && (
        <div>
          {/* CABECERA DE COLUMNAS */}
          <div className="hidden grid-cols-[52px_minmax(0,1fr)_90px_80px] items-center gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:grid">
            <span>Pos.</span>

            <span>Piloto</span>

            <span className="text-center">
              Victorias
            </span>

            <span className="text-right">
              Puntos
            </span>
          </div>

          {/* PILOTOS */}
          <div>
            {riders.map((rider) => (
              <div
                key={rider.id}
                className="grid grid-cols-[42px_minmax(0,1fr)_70px] items-center gap-3 border-b border-white/5 px-5 py-4 transition hover:bg-white/[0.03] sm:grid-cols-[52px_minmax(0,1fr)_90px_80px] sm:gap-4 sm:px-6"
              >
                {/* POSICIÓN */}
                <div>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black ${
                      rider.statistics.position <= 3
                        ? "bg-red-600 text-white"
                        : "bg-white/5 text-zinc-300"
                    }`}
                  >
                    {String(
                      rider.statistics.position
                    ).padStart(2, "0")}
                  </span>
                </div>

                {/* PILOTO */}
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-red-500">
                      #{rider.number}
                    </span>

                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-white">
                        {rider.full_name}
                      </h3>

                      <p className="truncate text-xs text-zinc-500">
                        {rider.team.name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* VICTORIAS */}
                <div className="hidden text-center sm:block">
                  <p className="text-sm font-bold text-white">
                    {rider.statistics.first_position}
                  </p>

                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Wins
                  </p>
                </div>

                {/* PUNTOS */}
                <div className="text-right">
                  <p className="text-lg font-black text-white">
                    {rider.statistics.points}
                  </p>

                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}