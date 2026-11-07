import { describe, expect, it } from "vitest";

import type { PointsProgressRider } from "@/types/pointsProgress";

import {
  eventLabel,
  labelStep,
  linePath,
  linearScale,
  maxValue,
  nearestIndex,
  niceTicks,
  parseChartParams,
  resolveSelection,
  riderToken,
  serializeChartParams,
  seriesValues,
} from "./chartModel";

const step = (n: number | null, c: number | null) => ({
  event_id: "e",
  points: n,
  sprint_points: null,
  race_points: n,
  cumulative: c,
});
const rider = (id: string, number: number | null, progress = [step(25, 25)]): PointsProgressRider => ({
  id,
  full_name: id,
  number,
  team: null,
  constructor_name: null,
  final_position: 1,
  standing_points: null,
  total_points: null,
  progress,
});

describe("escalas y ejes (GRA-U10)", () => {
  it("linearScale mapea y no divide por cero", () => {
    const s = linearScale(0, 100, 200, 0);
    expect(s(0)).toBe(200);
    expect(s(100)).toBe(0);
    expect(linearScale(5, 5, 0, 10)(5)).toBe(5);
  });

  it("niceTicks redondea el máximo a 1/2/5 × 10^k", () => {
    expect(niceTicks(0)).toEqual({ max: 10, ticks: [0, 5, 10] });
    expect(niceTicks(437)).toEqual({ max: 500, ticks: [0, 100, 200, 300, 400, 500] });
    expect(niceTicks(23).max).toBe(25);
    expect(niceTicks(Number.NaN).max).toBe(10);
  });

  it("labelStep salta etiquetas si no caben y nearestIndex se queda en rango", () => {
    expect(labelStep(19, 900)).toBe(1);
    expect(labelStep(19, 300)).toBe(2);
    expect(labelStep(1, 300)).toBe(1);
    expect(nearestIndex(-50, 5, 40, 400)).toBe(0);
    expect(nearestIndex(240, 5, 40, 400)).toBe(2);
    expect(nearestIndex(900, 5, 40, 400)).toBe(4);
  });

  it("eventLabel usa la abreviatura o un respaldo", () => {
    const base = { id: "1", name: "GRAND PRIX OF THAILAND", circuit_name: null, country_iso: null, country_name: null, sequence: 1 };
    expect(eventLabel({ ...base, short_name: "THA" })).toBe("THA");
    expect(eventLabel({ ...base, short_name: null })).toBe("THA");
  });
});

describe("trazado con huecos (GRA-U11)", () => {
  const x = (i: number) => i * 10;
  const y = (v: number) => 100 - v;

  it("una línea continua", () => {
    expect(linePath([0, 10, 20], x, y)).toBe("M0.0 100.0L10.0 90.0L20.0 80.0");
  });

  it("null corta la línea y nunca se dibuja como 0", () => {
    expect(linePath([5, null, 7, 8], x, y)).toBe("M0.0 95.0 M20.0 93.0L30.0 92.0");
    expect(linePath([null, null, 3], x, y)).toBe("M20.0 97.0");
    expect(linePath([null, null], x, y)).toBe("");
  });

  it("seriesValues elige acumulado o por carrera sin rellenar nulos", () => {
    const r = rider("a", 1, [step(null, null), step(25, 25), step(null, 25)]);
    expect(seriesValues(r, "acumulado")).toEqual([null, 25, 25]);
    expect(seriesValues(r, "carrera")).toEqual([null, 25, null]);
    expect(maxValue([r], "carrera")).toBe(25);
    expect(maxValue([], "acumulado")).toBe(0);
  });
});

describe("parámetros de la URL (GRA-U12)", () => {
  const get = (q: string) => new URLSearchParams(q);

  it("sin parámetros: temporada actual, MotoGP, acumulado y top 5 (null)", () => {
    expect(parseChartParams(get(""), 2026)).toEqual({ year: 2026, category: 3, mode: "acumulado", riders: null });
  });

  it("valores inválidos caen al defecto", () => {
    const p = parseChartParams(get("temporada=1999&categoria=9&modo=xx"), 2026);
    expect(p).toMatchObject({ year: 2026, category: 3, mode: "acumulado" });
    expect(parseChartParams(get("temporada=abc"), 2026).year).toBe(2026);
    expect(parseChartParams(get("temporada=2027"), 2026).year).toBe(2026);
  });

  it("lee y serializa ida y vuelta; pilotos vacío = ninguno", () => {
    const p = parseChartParams(get("temporada=2024&categoria=2&modo=carrera&pilotos=93,89"), 2026);
    expect(p).toEqual({ year: 2024, category: 2, mode: "carrera", riders: ["93", "89"] });
    expect(serializeChartParams(p)).toBe("temporada=2024&categoria=2&modo=carrera&pilotos=93%2C89");
    expect(parseChartParams(get("pilotos="), 2026).riders).toEqual([]);
    expect(serializeChartParams({ ...p, riders: null })).not.toContain("pilotos");
  });

  it("selección: top 5 por defecto, dorsal o id, orden de clasificación y fichas desconocidas ignoradas", () => {
    const all = [1, 2, 3, 4, 5, 6, 7].map((n) => rider(`id${n}`, n * 10));
    expect(resolveSelection(all, null)).toEqual(["id1", "id2", "id3", "id4", "id5"]);
    expect(resolveSelection(all, ["70", "20", "999"])).toEqual(["id2", "id7"]);
    expect(resolveSelection(all, [])).toEqual([]);
  });

  it("dorsal repetido o nulo usa el id como ficha", () => {
    const all = [rider("a", 5), rider("b", 5), rider("c", null), rider("d", 7)];
    expect(riderToken(all[0], all)).toBe("a");
    expect(riderToken(all[2], all)).toBe("c");
    expect(riderToken(all[3], all)).toBe("7");
    expect(resolveSelection(all, ["a", "7"])).toEqual(["a", "d"]);
  });
});
