"use client";

import { useEffect, useState } from "react";

import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

import type {
  Favorite,
  FavoritesResponse,
} from "@/types/favorites";

interface ApiResponse {
  data: FavoritesResponse;
}

const INITIAL_VISIBLE = 5;

/*
 * Componentes del índice, en el orden en que se muestran.
 */
const COMPONENTS = [
  { key: "circuit", label: "Circuito" },
  { key: "form", label: "Forma" },
  { key: "bike", label: "Moto" },
  { key: "reliability", label: "Fiabilidad" },
  { key: "trend", label: "Tendencia" },
] as const;

function formatPosition(position: number | null): string {
  if (position === null) {
    return "—";
  }

  return `${position}º`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ScoreBar({
  value,
  accent = false,
}: {
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="h-2 rounded-full bg-zinc-800">
      <div
        className={`h-2 rounded-full ${
          accent ? "bg-red-600" : "bg-zinc-400"
        }`}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function FavoriteDetails({ favorite }: { favorite: Favorite }) {
  const { circuit, form, reliability, trend } = favorite.breakdown;

  return (
    <div className="mt-4 space-y-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      {/* COMPONENTES */}
      <div className="space-y-3">
        {COMPONENTS.map((component) => {
          const score = favorite.breakdown[component.key].score;

          return (
            <div key={component.key}>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">
                  {component.label}
                </span>

                <span className="font-bold text-white">
                  {Math.round(score * 100)}
                </span>
              </div>

              <div className="mt-1.5">
                <ScoreBar value={score} />
              </div>
            </div>
          );
        })}
      </div>

      {/* CIRCUITO */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          En este circuito
        </p>

        {circuit.races === 0 ? (
          <p className="mt-2 text-xs text-zinc-400">
            Sin carreras de MotoGP aquí: el índice se apoya en su forma actual.
          </p>
        ) : (
          <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
            <div>
              <dt className="text-zinc-500">Carreras</dt>
              <dd className="font-bold text-white">{circuit.races}</dd>
            </div>

            <div>
              <dt className="text-zinc-500">Victorias</dt>
              <dd className="font-bold text-white">{circuit.wins}</dd>
            </div>

            <div>
              <dt className="text-zinc-500">Podios</dt>
              <dd className="font-bold text-white">{circuit.podiums}</dd>
            </div>

            <div>
              <dt className="text-zinc-500">Media</dt>
              <dd className="font-bold text-white">
                {circuit.average_position !== null
                  ? `${circuit.average_position}º`
                  : "—"}
              </dd>
            </div>

            <div>
              <dt className="text-zinc-500">Abandonos</dt>
              <dd className="font-bold text-white">{circuit.dnfs}</dd>
            </div>

            <div>
              <dt className="text-zinc-500">Regularidad</dt>
              <dd className="font-bold text-white">
                {formatPercent(circuit.consistency)}
                {circuit.position_spread !== null && (
                  <span className="ml-1 font-normal text-zinc-500">
                    ±{circuit.position_spread}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}

        {circuit.races > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Credibilidad del historial:{" "}
            <span className="text-zinc-300">
              {formatPercent(circuit.credibility)}
            </span>
            . Con pocas carreras aquí, el índice de circuito se acerca a su forma actual.
          </p>
        )}

        {/* HISTORIAL */}
        {favorite.circuit_history.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {favorite.circuit_history.map((result, index) => (
              <span
                key={`${result.season_year}-${result.session_type}-${index}`}
                className={`rounded-md border px-2 py-1 text-[11px] font-bold ${
                  !result.finished
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : result.position !== null && result.position <= 3
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-zinc-300"
                }`}
                title={`${result.season_year} · ${
                  result.session_type === "SPR" ? "Sprint" : "Carrera"
                }`}
              >
                <span className="mr-1 font-normal text-zinc-500">
                  {String(result.season_year).slice(2)}
                  {result.session_type === "SPR" ? "S" : ""}
                </span>
                {result.finished ? formatPosition(result.position) : "DNF"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* TEMPORADA */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          Esta temporada
        </p>

        <p className="mt-2 text-xs text-zinc-400">
          {form.races} carreras · {form.wins} victorias · {form.podiums} podios · media{" "}
          {form.average_position !== null ? `${form.average_position}º` : "—"}
          {" · "}termina el {formatPercent(reliability.finish_rate)}
          {trend.delta !== 0 && (
            <>
              {" · "}
              <span
                className={trend.delta > 0 ? "text-emerald-400" : "text-red-400"}
              >
                {trend.delta > 0 ? "va a más" : "va a menos"}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function GrandPrixFavorites() {
  const [data, setData] = useState<FavoritesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function loadFavorites() {
      try {
        setLoading(true);

        const response = await fetch("/api/next-gp/favorites");

        if (!response.ok) {
          throw new Error(
            "No se pudieron calcular los favoritos"
          );
        }

        const result: ApiResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error desconocido"
        );
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, []);

  const favorites = data?.favorites ?? [];

  const visible = showAll
    ? favorites
    : favorites.slice(0, INITIAL_VISIBLE);

  return (
    <aside className="card p-6">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        Índice estadístico
      </p>

      <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
        <Trophy className="text-red-500" /> Favoritos del GP
      </h2>

      {data && (
        <p className="mt-1 text-xs text-zinc-500">
          {data.event.circuit.name}
        </p>
      )}

      {/* CARGANDO */}
      {loading && (
        <div className="mt-7 space-y-5">
          {Array.from({ length: INITIAL_VISIBLE }).map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-40 rounded bg-white/10" />
                <div className="h-4 w-12 rounded bg-white/10" />
              </div>
              <div className="mt-2 h-2 rounded-full bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="mt-7 rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* VACÍO */}
      {!loading && !error && favorites.length === 0 && (
        <div className="mt-7 rounded-xl border border-white/5 bg-zinc-900/50 py-10 text-center text-sm text-zinc-500">
          Todavía no hay datos suficientes para este GP.
        </div>
      )}

      {/* LISTA */}
      {!loading && !error && favorites.length > 0 && (
        <div className="mt-7 space-y-5">
          {visible.map((favorite) => {
            const isExpanded = expanded === favorite.rider.id;

            return (
              <div key={favorite.rider.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(isExpanded ? null : favorite.rider.id)
                  }
                  className="w-full text-left transition hover:opacity-90"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center">
                      <b className="mr-3 text-zinc-600">
                        {String(favorite.rank).padStart(2, "0")}
                      </b>

                      <span className="min-w-0">
                        <span className="block truncate font-bold text-white">
                          {favorite.rider.full_name}
                        </span>

                        <span className="block truncate text-[11px] text-zinc-500">
                          #{favorite.rider.number} · {favorite.rider.team_name}
                        </span>
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-right">
                        <b className="block text-white">
                          {favorite.score}/100
                        </b>

                        <span className="block text-[11px] text-zinc-500">
                          {favorite.win_probability}% victoria
                        </span>
                      </span>

                      {isExpanded ? (
                        <ChevronUp size={16} className="text-zinc-500" />
                      ) : (
                        <ChevronDown size={16} className="text-zinc-500" />
                      )}
                    </span>
                  </div>

                  <div className="mt-2">
                    <ScoreBar value={favorite.score / 100} accent />
                  </div>
                </button>

                {isExpanded && <FavoriteDetails favorite={favorite} />}
              </div>
            );
          })}

          {favorites.length > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/10"
            >
              {showAll
                ? "Ver solo los favoritos"
                : `Ver toda la parrilla (${favorites.length})`}
            </button>
          )}
        </div>
      )}

      <p className="mt-8 flex gap-2 border-t border-white/10 pt-5 text-xs leading-relaxed text-zinc-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          El índice combina historial en el circuito (40%), forma de la
          temporada (35%), rendimiento de la moto aquí (10%), fiabilidad
          (10%) y tendencia (5%). Los resultados irregulares y los
          abandonos restan; un historial corto pesa menos que uno largo.
          Pulsa un piloto para ver el desglose.
        </span>
      </p>
    </aside>
  );
}
