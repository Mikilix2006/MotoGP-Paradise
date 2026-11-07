// Lógica pura de la gráfica de puntos: escalas, trazados con huecos, ejes y parámetros de la URL.
import type { PointsProgressEvent, PointsProgressRider } from "@/types/pointsProgress";

export type ChartMode = "acumulado" | "carrera";
export type CategoryId = 1 | 2 | 3;

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 3, label: "MotoGP" },
  { id: 2, label: "Moto2" },
  { id: 1, label: "Moto3" },
];

/** Primera temporada con datos fiables (cruzada con la clasificación). */
export const MIN_YEAR = 2014;
export const DEFAULT_TOP = 5;

export function linearScale(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0;
  return (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}

/** Máximo "redondo" del eje Y y sus marcas (paso 1, 2, 5 × 10^k; ~5 marcas). */
export function niceTicks(max: number, target = 5): { max: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { max: 10, ticks: [0, 5, 10] };
  const rough = max / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { max: top, ticks };
}

export function seriesValues(rider: PointsProgressRider, mode: ChartMode): (number | null)[] {
  return rider.progress.map((p) => (mode === "acumulado" ? p.cumulative : p.points));
}

/** Trazado SVG: un tramo `M…L…` por cada serie de valores consecutivos; `null` corta la línea. */
export function linePath(
  values: (number | null)[],
  x: (index: number) => number,
  y: (value: number) => number
): string {
  let d = "";
  let open = false;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    d += `${open ? "L" : d ? " M" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    open = true;
  });
  return d;
}

/** Cada cuántos GP se rotula el eje X para que las etiquetas no se pisen. */
export function labelStep(count: number, plotWidth: number, minGap = 28): number {
  if (count <= 1) return 1;
  return Math.max(1, Math.ceil(minGap / (plotWidth / (count - 1))));
}

/** Índice de GP más cercano a una posición horizontal (en unidades del plot). */
export function nearestIndex(px: number, count: number, plotLeft: number, plotWidth: number): number {
  if (count <= 1) return 0;
  const ratio = (px - plotLeft) / plotWidth;
  return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
}

export function eventLabel(event: PointsProgressEvent): string {
  return event.short_name ?? event.name.replace(/^GRAND PRIX OF /i, "").slice(0, 3).toUpperCase();
}

/** Mayor valor de las series visibles (para el eje Y). */
export function maxValue(riders: PointsProgressRider[], mode: ChartMode): number {
  let max = 0;
  for (const r of riders) for (const v of seriesValues(r, mode)) if (v !== null && v > max) max = v;
  return max;
}

// --- URL: ?temporada=&categoria=&modo=&pilotos= ---

export interface ChartParams {
  year: number;
  category: CategoryId;
  mode: ChartMode;
  /** Fichas de piloto (dorsal o id); `null` = no indicado en la URL (se usa el top 5). */
  riders: string[] | null;
}

interface ParamSource {
  get(name: string): string | null;
}

export function parseChartParams(search: ParamSource, currentYear: number): ChartParams {
  const year = Number(search.get("temporada"));
  const category = Number(search.get("categoria"));
  const pilotos = search.get("pilotos");
  return {
    year: Number.isInteger(year) && year >= MIN_YEAR && year <= currentYear ? year : currentYear,
    category: category === 1 || category === 2 || category === 3 ? category : 3,
    mode: search.get("modo") === "carrera" ? "carrera" : "acumulado",
    riders: pilotos === null ? null : pilotos.split(",").map((t) => t.trim()).filter(Boolean),
  };
}

export function serializeChartParams(params: ChartParams): string {
  const q = new URLSearchParams({
    temporada: String(params.year),
    categoria: String(params.category),
    modo: params.mode,
  });
  // Sin `pilotos` = top 5; con `pilotos=` vacío = ninguno.
  if (params.riders !== null) q.set("pilotos", params.riders.join(","));
  return q.toString();
}

/** Ficha corta de un piloto en la URL: su dorsal si es único en la lista; si no, su id. */
export function riderToken(rider: PointsProgressRider, all: PointsProgressRider[]): string {
  const unique = rider.number !== null && all.filter((r) => r.number === rider.number).length === 1;
  return unique ? String(rider.number) : rider.id;
}

/** Ids de los pilotos seleccionados (en orden de clasificación); fichas desconocidas se ignoran. */
export function resolveSelection(all: PointsProgressRider[], tokens: string[] | null): string[] {
  if (tokens === null) return all.slice(0, DEFAULT_TOP).map((r) => r.id);
  const wanted = new Set(tokens);
  return all.filter((r) => wanted.has(riderToken(r, all))).map((r) => r.id);
}
