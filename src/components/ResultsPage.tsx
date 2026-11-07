"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatRow } from "@/services/results/resultsModel";

import type { ResultsPayload, ResultsSection } from "@/types/results";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50";

const SELECT_CLASS = `min-h-11 w-full rounded-lg border border-white/15 bg-[var(--surface)] px-3 text-sm font-semibold text-white disabled:opacity-50 ${FOCUS_RING}`;
const LABEL_CLASS = "mb-1 block text-[11px] font-bold uppercase tracking-widest text-zinc-500";

// Equipo y dorsal se ocultan en móvil (sin scroll horizontal).
const GRID_BASE = "grid items-center gap-1.5 px-1 sm:gap-4 sm:px-6";
const GRID = `${GRID_BASE} grid-cols-[40px_minmax(0,1fr)_76px_46px] sm:grid-cols-[52px_52px_minmax(0,1fr)_minmax(0,1fr)_130px_72px]`;
// Los tests no traen mejor vuelta: sin esa columna solo queda la diferencia.
const GRID_NO_LAP = `${GRID_BASE} grid-cols-[40px_minmax(0,1fr)_76px] sm:grid-cols-[52px_52px_minmax(0,1fr)_minmax(0,1fr)_72px]`;

function Skeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando clasificación">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={`${GRID} animate-pulse border-b border-white/5 py-4`}>
          <div className="h-8 w-8 rounded-lg bg-white/10" />
          <div className="h-4 w-2/3 rounded bg-white/10 sm:col-span-3" />
          <div className="h-4 w-full rounded bg-white/10" />
          <div className="ml-auto h-4 w-8 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/results?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar los resultados");
        setData((body as { data: ResultsPayload }).data);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        console.error("Error cargando resultados:", err);
        setData(null);
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, attempt]);

  // La URL lleva toda la selección resuelta; el servidor aplica la cascada a lo que cambia.
  function navigate(change: Record<string, string>, section: ResultsSection | undefined = data?.section) {
    if (!data) {
      router.push(section === "tests" ? `${pathname}?section=tests` : pathname, { scroll: false });
      return;
    }
    const next = new URLSearchParams({
      year: String(data.selected.year),
      event: data.selected.event,
      category: String(data.selected.category),
      session: data.selected.session,
      ...change,
    });
    if (section === "tests") next.set("section", "tests");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const section = data?.section ?? (search.get("section") === "tests" ? "tests" : "season");
  const formatted = data ? data.rows.map((row) => formatRow(row, data.is_race)) : [];
  const showMain = !data || data.is_race || data.rows.some((row) => row.fastest_lap);
  const grid = showMain ? GRID : GRID_NO_LAP;

  return (
    <section className="section">
      {/* SECCIÓN */}
      <div className="flex gap-2 border-b border-white/10 px-4 pb-4 sm:px-6">
        {(
          [
            ["season", "Temporada"],
            ["tests", "Tests"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={section === key}
            onClick={() => section !== key && navigate({}, key)}
            className={section === key ? "btn-race" : "btn-ghost"}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SELECTORES */}
      {data && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 border-b border-white/10 px-4 py-4 sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:px-6">
          <div className="min-w-0">
            <label htmlFor="res-year" className={LABEL_CLASS}>Año</label>
            <select id="res-year" className={SELECT_CLASS} value={data.selected.year} onChange={(e) => navigate({ year: e.target.value })}>
              {data.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="res-event" className={LABEL_CLASS}>Circuito</label>
            <select id="res-event" className={SELECT_CLASS} value={data.selected.event} onChange={(e) => navigate({ event: e.target.value })}>
              {data.events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="res-session" className={LABEL_CLASS}>Sesión</label>
            <select id="res-session" className={SELECT_CLASS} value={data.selected.session} onChange={(e) => navigate({ session: e.target.value })}>
              {data.sessions.map((s) => (
                <option key={s.shortname} value={s.shortname}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <span id="res-category" className={LABEL_CLASS}>Categoría</span>
            <div role="group" aria-labelledby="res-category" className="flex flex-wrap gap-2">
              {data.categories.map((c) => {
                const active = c.legacy_id === data.selected.category;
                return (
                  <button
                    key={c.legacy_id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => !active && navigate({ category: String(c.legacy_id) })}
                    className={`min-h-11 rounded-lg px-5 text-xs font-bold uppercase tracking-wider transition motion-reduce:transition-none ${FOCUS_RING} ${
                      active
                        ? "bg-[image:var(--accent-grad)] text-[#fff] shadow-md"
                        : "border border-white/15 bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div role="alert" className="px-4 py-10 text-center sm:px-6">
          <p className="text-sm text-red-400">{error}</p>
          <p className="mt-1 text-xs text-zinc-500">Inténtalo de nuevo en unos segundos.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-ghost mt-4">
            Reintentar
          </button>
        </div>
      )}

      {/* CARGANDO */}
      {loading && !error && <Skeleton />}

      {/* CLASIFICACIÓN */}
      {data && !loading && !error && (
        <div>
          {formatted.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">
              Esta sesión no tiene resultados publicados todavía.
            </p>
          ) : (
            <table className="block w-full">
              <caption className="sr-only">Clasificación de la sesión</caption>
              <thead className="block">
                <tr className={`${grid} border-b border-white/10 bg-white/[0.02] py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500`}>
                  <th scope="col" className="text-left">Pos.</th>
                  <th scope="col" className="hidden text-left sm:block">Nº</th>
                  <th scope="col" className="text-left">Piloto</th>
                  <th scope="col" className="hidden text-left sm:block">Equipo</th>
                  {showMain && <th scope="col" className="text-right">{data.is_race ? "Tiempo" : "Mejor vuelta"}</th>}
                  <th scope="col" className="text-right">{data.is_race ? "Pts." : "Dif."}</th>
                </tr>
              </thead>
              <tbody className="block">
                {formatted.map((row, i) => (
                  <tr key={i} className={`${grid} border-b border-white/5 py-3 transition hover:bg-red-500/[0.07]`}>
                    <td>
                      <span
                        className={`cut flex h-9 w-10 items-center justify-center rounded-md pr-1 text-lg font-display font-black italic tabular-nums ${
                          !row.noPosition && Number(row.pos) <= 3
                            ? "bg-[image:var(--accent-grad)] text-[#fff]"
                            : "bg-white/10 text-zinc-300"
                        }`}
                      >
                        {row.pos}
                      </span>
                    </td>
                    <td className="hidden font-display text-base font-black tabular-nums text-red-500 sm:block">{row.number}</td>
                    <td className="min-w-0 break-words text-sm font-semibold leading-tight text-white sm:truncate">{row.rider}</td>
                    <td className="hidden min-w-0 truncate text-sm text-zinc-400 sm:block">{row.team}</td>
                    {showMain && <td className={`text-right text-sm tabular-nums ${row.noPosition ? "text-zinc-500" : "text-white"}`}>{row.main}</td>}
                    <td className="text-right text-sm tabular-nums text-zinc-400">{row.extra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
