"use client";

import { useEffect, useRef, useState } from "react";

import type { PointsProgress, PointsProgressRider } from "@/types/pointsProgress";

import {
  eventLabel,
  labelStep,
  linePath,
  linearScale,
  maxValue,
  nearestIndex,
  niceTicks,
  seriesValues,
  type ChartMode,
} from "./chartModel";
import type { MarkerShape, SeriesStyle } from "./riderColorsModel";

const NUMBER = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });
const M = { top: 22, right: 14, bottom: 30, left: 42 };
const PAD_X = 10;
const MAX_TIP_ROWS = 10;

export function Marker({ shape, x, y, r, color }: { shape: MarkerShape; x: number; y: number; r: number; color: string }) {
  if (shape === "square") return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={color} />;
  if (shape === "diamond") {
    return <polygon points={`${x},${y - r * 1.3} ${x + r * 1.3},${y} ${x},${y + r * 1.3} ${x - r * 1.3},${y}`} fill={color} />;
  }
  return <circle cx={x} cy={y} r={r} fill={color} />;
}

/** Muestra de trazo + marcador (leyenda y casillas). */
export function LineSample({ style }: { style: SeriesStyle }) {
  return (
    <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden className="shrink-0">
      <line x1="1" y1="6" x2="29" y2="6" stroke={style.color} strokeWidth="2.5" strokeDasharray={style.dash ?? undefined} />
      <Marker shape={style.marker} x={15} y={6} r={3.2} color={style.color} />
    </svg>
  );
}

interface Props {
  data: PointsProgress;
  riders: PointsProgressRider[];
  styles: Record<string, SeriesStyle>;
  mode: ChartMode;
}

export default function PointsChart({ data, riders, styles, mode }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0); // 0 = aún sin medir: no se pinta para evitar parpadeo
  const [active, setActive] = useState<number | null>(null);
  const [byKeyboard, setByKeyboard] = useState(false); // el lector solo anuncia la navegación por teclado
  const count = data.events.length;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = (w: number) => setWidth(Math.max(260, Math.floor(w)));
    if (typeof ResizeObserver === "undefined") return fit(el.clientWidth || 800); // sin ResizeObserver (jsdom)
    const observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const narrow = width < 520; // en móvil el tooltip va bajo la gráfica para no taparla
  const height = narrow ? 320 : 440;
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const { max, ticks } = niceTicks(maxValue(riders, mode));
  const x = (i: number) => (count <= 1 ? M.left + plotW / 2 : linearScale(0, count - 1, M.left + PAD_X, width - M.right - PAD_X)(i));
  const y = linearScale(0, max, M.top + plotH, M.top);
  const every = labelStep(count, plotW - 2 * PAD_X);

  function pointerIndex(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setByKeyboard(false);
    setActive(nearestIndex(event.clientX - rect.left, count, M.left + PAD_X, plotW - 2 * PAD_X));
  }

  function onKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    const moves: Record<string, number | null> = {
      ArrowRight: active === null ? 0 : Math.min(count - 1, active + 1),
      ArrowLeft: active === null ? count - 1 : Math.max(0, active - 1),
      Home: 0,
      End: count - 1,
      Escape: null,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setByKeyboard(true);
    setActive(moves[event.key]);
  }

  const event = active !== null ? data.events[active] : null;
  const rows =
    active === null
      ? []
      : riders
          .map((rider) => ({ rider, step: rider.progress[active] }))
          .sort((a, b) => (b.step.cumulative ?? -1) - (a.step.cumulative ?? -1));
  const shownRows = narrow ? rows : rows.slice(0, MAX_TIP_ROWS); // en escritorio el tooltip no debe tapar la leyenda
  const modeLabel = mode === "acumulado" ? "Puntos acumulados" : "Puntos por carrera";

  return (
    <div ref={wrapRef} className="relative w-full min-w-0" style={width === 0 ? { minHeight: 320 } : undefined}>
      {width > 0 && (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        tabIndex={0}
        aria-label={`Gráfica de ${modeLabel.toLowerCase()} de ${riders.length} pilotos en ${count} Grandes Premios. Usa las flechas izquierda y derecha para recorrer los Grandes Premios.`}
        className="block touch-pan-y select-none rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/60"
        onPointerMove={pointerIndex}
        onPointerDown={pointerIndex}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <text x={M.left - 34} y={12} fontSize="10" fontWeight="700" letterSpacing="0.08em" style={{ fill: "var(--muted)" }}>
          {mode === "acumulado" ? "PUNTOS ACUMULADOS" : "PUNTOS POR CARRERA"}
        </text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} style={{ stroke: "rgb(var(--fg-rgb) / .14)" }} />
            <text x={M.left - 6} y={y(t) + 3.5} fontSize="11" textAnchor="end" style={{ fill: "var(--muted)" }}>
              {NUMBER.format(t)}
            </text>
          </g>
        ))}
        {data.events.map((ev, i) =>
          i % every === 0 ? (
            <text key={ev.id} x={x(i)} y={height - 10} fontSize="10.5" fontWeight="600" textAnchor="middle" style={{ fill: "var(--muted)" }}>
              {eventLabel(ev)}
            </text>
          ) : null
        )}
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} strokeWidth="1.5" style={{ stroke: "rgb(var(--fg-rgb) / .45)" }} />
        )}
        {riders.map((rider) => {
          const style = styles[rider.id];
          const values = seriesValues(rider, mode);
          return (
            <g key={rider.id} data-rider={rider.id}>
              <path
                d={linePath(values, x, y)}
                fill="none"
                stroke={style.color}
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap={style.dash ? "butt" : "round"}
                strokeDasharray={style.dash ?? undefined}
              />
              {values.map((v, i) =>
                v === null ? null : (
                  <Marker key={i} shape={style.marker} x={x(i)} y={y(v)} r={active === i ? 4.2 : count > 24 ? 2 : 2.8} color={style.color} />
                )
              )}
            </g>
          );
        })}
      </svg>
      )}

      {event && (
        <div
          role="status"
          aria-live={byKeyboard ? "polite" : "off"}
          className={`z-10 rounded-lg border bg-[var(--surface)] px-3 py-2 text-xs ${narrow ? "mt-2 max-h-64 overflow-y-auto" : "pointer-events-none absolute max-w-[20rem] overflow-hidden"}`}
          style={{
            borderColor: "rgb(var(--fg-rgb) / .15)",
            boxShadow: "var(--shadow-sm)",
            ...(narrow
              ? {}
              : { top: M.top, maxHeight: plotH, ...(x(active!) > width / 2 ? { right: width - x(active!) + 10 } : { left: x(active!) + 10 }) }),
          }}
        >
          <p className="font-bold text-white">
            {event.circuit_name ?? event.name}
            <span className="ml-1 font-semibold text-zinc-500">
              ({eventLabel(event)}
              {event.country_name ? `, ${event.country_name}` : ""})
            </span>
          </p>
          <ul className="mt-1 space-y-1">
            {shownRows.map(({ rider, step }) => (
              <li key={rider.id} className="flex items-start gap-2">
                <span className="mt-0.5"><LineSample style={styles[rider.id]} /></span>
                <span className="min-w-0 text-zinc-400">
                  <span className="font-semibold text-white">
                    {rider.number ?? "–"} {rider.full_name}
                  </span>
                  :{" "}
                  {step.points === null ? (
                    "no participó"
                  ) : (
                    <>
                      {NUMBER.format(step.points)} pts
                      {step.sprint_points !== null && ` (sprint ${NUMBER.format(step.sprint_points)}, carrera ${step.race_points === null ? "–" : NUMBER.format(step.race_points)})`}
                    </>
                  )}
                  {step.cumulative !== null && ` · acum. ${NUMBER.format(step.cumulative)}`}
                </span>
              </li>
            ))}
          </ul>
          {shownRows.length < rows.length && (
            <p className="mt-1 text-zinc-500">y {rows.length - shownRows.length} pilotos más, ordenados por puntos acumulados.</p>
          )}
        </div>
      )}
    </div>
  );
}
