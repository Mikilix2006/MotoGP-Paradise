"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { PointsProgress } from "@/types/pointsProgress";

import {
  CATEGORIES,
  MIN_YEAR,
  parseChartParams,
  resolveSelection,
  riderToken,
  serializeChartParams,
  type CategoryId,
  type ChartMode,
  type ChartParams,
} from "./chartModel";
import PointsChart, { LineSample } from "./PointsChart";
import { buildRiderStyles } from "./riderColorsModel";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50";
// Select plano: solo subrayado, como las pestañas.
const SELECT_CLASS = `min-h-11 w-full border-0 border-b-2 border-white/20 bg-transparent px-0 text-sm font-semibold text-white [&>option]:bg-[var(--surface)] ${FOCUS_RING}`;
const ERROR_TEXT = "No se pudo cargar la gráfica de puntos.";
const LABEL_CLASS = "mb-1 block text-[11px] font-bold uppercase tracking-widest text-zinc-500";
// Controles planos: subrayado en vez de caja.
const TAB_CLASS = (active: boolean) =>
  `min-h-11 border-b-2 px-3 text-xs font-bold uppercase tracking-wider transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
    active ? "border-red-600 text-white" : "border-transparent text-zinc-500 hover:text-white"
  }`;
const LINK_BUTTON = `min-h-11 px-2 text-xs font-bold uppercase tracking-wider text-zinc-400 underline-offset-4 hover:text-white hover:underline ${FOCUS_RING}`;

interface Result {
  key: string;
  data: PointsProgress | null;
  error: string | null;
  empty: boolean;
}

export default function GraficasPage() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const currentYear = new Date().getFullYear();
  const params = parseChartParams(search, currentYear);

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const requestKey = `${params.year}-${params.category}#${attempt}`;
  const loading = result?.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const done = (r: Omit<Result, "key">) => setResult({ key: requestKey, ...r });

    fetch(`/api/riders/points-progress?year=${params.year}&category=${params.category}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 404) return done({ data: null, error: null, empty: true });
        const data = (body as { data?: PointsProgress }).data;
        if (!response.ok || !data || !Array.isArray(data.events) || !Array.isArray(data.riders)) {
          throw new Error(`Respuesta no válida (${response.status})`);
        }
        done({ data, error: null, empty: data.events.length === 0 || data.riders.length === 0 });
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        console.error("Error cargando la gráfica de puntos:", err);
        done({ data: null, error: ERROR_TEXT, empty: false });
      });

    return () => controller.abort();
  }, [params.year, params.category, requestKey]);

  const data = loading ? null : result?.data ?? null;
  const riders = useMemo(() => data?.riders ?? [], [data]);
  const styles = useMemo(() => buildRiderStyles(riders), [riders]);
  const selectedIds = useMemo(() => new Set(resolveSelection(riders, params.riders)), [riders, params.riders]);
  const selected = riders.filter((r) => selectedIds.has(r.id));

  function go(next: Partial<ChartParams>, push = false) {
    const url = `${pathname}?${serializeChartParams({ ...params, ...next })}`;
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }

  function select(ids: Set<string>) {
    go({ riders: riders.filter((r) => ids.has(r.id)).map((r) => riderToken(r, riders)) });
  }

  function toggle(id: string) {
    const ids = new Set(selectedIds);
    if (!ids.delete(id)) ids.add(id);
    select(ids);
  }

  const years = Array.from({ length: currentYear - MIN_YEAR + 1 }, (_, i) => currentYear - i);

  return (
    <div>
      {/* CONTROLES */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="w-32">
          <label htmlFor="gra-year" className={LABEL_CLASS}>Temporada</label>
          <select
            id="gra-year"
            className={SELECT_CLASS}
            value={params.year}
            onChange={(e) => go({ year: Number(e.target.value), riders: null }, true)}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <span id="gra-category" className={LABEL_CLASS}>Categoría</span>
          <div role="group" aria-labelledby="gra-category" className="flex gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={params.category === c.id}
                onClick={() => params.category !== c.id && go({ category: c.id as CategoryId, riders: null }, true)}
                className={TAB_CLASS(params.category === c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span id="gra-mode" className={LABEL_CLASS}>Vista</span>
          <div role="group" aria-labelledby="gra-mode" className="flex gap-1">
            {(
              [
                ["acumulado", "Acumulado"],
                ["carrera", "Por carrera"],
              ] as [ChartMode, string][]
            ).map(([mode, label]) => (
              <button key={mode} type="button" aria-pressed={params.mode === mode} onClick={() => go({ mode })} className={TAB_CLASS(params.mode === mode)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ESTADOS */}
      {loading && (
        <div role="status" aria-busy="true" aria-label="Cargando gráfica" className="mt-8 animate-pulse">
          <div className="h-72 w-full rounded bg-white/10 sm:h-96" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-5 w-2/3 rounded bg-white/10" />
            ))}
          </div>
        </div>
      )}

      {!loading && result?.error && (
        <div role="alert" className="mt-8 text-sm text-red-400">
          {result.error}
          <p className="mt-1 text-xs text-zinc-500">Inténtalo de nuevo en unos segundos.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-ghost mt-4">
            Reintentar
          </button>
        </div>
      )}

      {!loading && result?.empty && (
        <p className="py-10 text-center text-sm text-zinc-500">
          No hay Grandes Premios disputados con resultados para esta temporada y categoría.
        </p>
      )}

      {data && !result?.empty && (
        <>
          {/* GRÁFICA */}
          <div className="mt-8">
            {selected.length === 0 ? (
              <p className="py-16 text-center text-sm text-zinc-500">Selecciona al menos un piloto para ver la gráfica.</p>
            ) : (
              <PointsChart data={data} riders={selected} styles={styles} mode={params.mode} />
            )}
          </div>

          {/* LEYENDA Y SELECTOR: una sola lista (color/trazo, dorsal, nombre) */}
          <fieldset className="mt-8 min-w-0 border-0 p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-1">
              <legend className="float-left text-[11px] font-bold uppercase tracking-widest text-zinc-500">Pilotos titulares: leyenda y selección</legend>
              <div className="flex gap-1">
                <button type="button" className={LINK_BUTTON} onClick={() => go({ riders: null })}>Top 5</button>
                <button type="button" className={LINK_BUTTON} onClick={() => select(new Set(riders.map((r) => r.id)))}>Todos</button>
                <button type="button" className={LINK_BUTTON} onClick={() => select(new Set())}>Ninguno</button>
              </div>
            </div>
            <ul className="mt-2 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {riders.map((r, i) => (
                <li key={r.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 shrink-0"
                      style={{ accentColor: styles[r.id].color }}
                    />
                    <span className={selectedIds.has(r.id) ? "" : "opacity-40"}><LineSample style={styles[r.id]} /></span>
                    <span className="min-w-0 truncate">
                      <span className="text-zinc-500">{r.final_position ?? i + 1}.</span> {r.number ?? "–"} {r.full_name}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      )}
    </div>
  );
}
