import { describe, expect, it } from "vitest";
import {
  MODEL_WEIGHTS,
  computeBikeComponents,
  computeCircuit,
  computeFavorites,
  computeForm,
  computeReliability,
  computeTrend,
  didFinish,
  didStart,
  positionScore,
  type FavoriteInput,
  type RaceResultInput,
} from "./favoritesModel";

let contador = 0;

// Resultado mínimo; cada llamada genera una sesión distinta salvo que se fije sessionKey.
function res(over: Partial<RaceResultInput> = {}): RaceResultInput {
  contador += 1;
  return {
    riderId: "r1",
    sessionKey: `s${contador}`,
    seasonYear: 2026,
    date: new Date(2026, 2, contador),
    sessionType: "RAC",
    position: 1,
    status: "INSTND",
    constructorName: "Ducati",
    eventShortName: "QAT",
    ...over,
  };
}

describe("didStart / didFinish", () => {
  it("no salió si el estado es NOTSTARTED o WILLNOTSTART", () => {
    expect(didStart(res({ status: "NOTSTARTED" }))).toBe(false);
    expect(didStart(res({ status: "WILLNOTSTART" }))).toBe(false);
  });

  it("salió con cualquier otro estado, incluido null", () => {
    expect(didStart(res({ status: "INSTND" }))).toBe(true);
    expect(didStart(res({ status: "OUTSTND" }))).toBe(true);
    expect(didStart(res({ status: null }))).toBe(true);
  });

  it("terminó solo si salió y tiene puesto", () => {
    expect(didFinish(res({ position: 4 }))).toBe(true);
    expect(didFinish(res({ position: null }))).toBe(false);
    expect(didFinish(res({ position: 4, status: "NOTSTARTED" }))).toBe(false);
  });
});

describe("positionScore", () => {
  it("ganar vale 1, abandonar 0 y no salir 0", () => {
    expect(positionScore(res({ position: 1 }))).toBe(1);
    expect(positionScore(res({ position: null }))).toBe(0);
    expect(positionScore(res({ position: 1, status: "NOTSTARTED" }))).toBe(0);
  });

  it("decrece con el puesto y queda entre 0 y 1", () => {
    const s2 = positionScore(res({ position: 2 }));
    const s10 = positionScore(res({ position: 10 }));
    expect(s2).toBeCloseTo(Math.exp(-1 / 6), 10);
    expect(s2).toBeGreaterThan(s10);
    expect(s10).toBeGreaterThan(0);
  });
});

describe("computeForm", () => {
  it("sin resultados devuelve el prior y medias nulas", () => {
    const f = computeForm([]);
    expect(f).toMatchObject({ races: 0, finishes: 0, wins: 0, podiums: 0, averagePosition: null });
    expect(f.score).toBe(0.25);
  });

  it("un solo resultado se acerca al prior pero lo supera si ganó", () => {
    const f = computeForm([res({ position: 1 })]);
    expect(f).toMatchObject({ races: 1, finishes: 1, wins: 1, podiums: 1, averagePosition: 1 });
    expect(f.score).toBeCloseTo(0.5, 3);
  });

  it("ignora las carreras en las que no salió", () => {
    const f = computeForm([res({ position: 1 }), res({ status: "NOTSTARTED", position: null })]);
    expect(f.races).toBe(1);
  });

  it("los abandonos cuentan como carrera sin terminar", () => {
    const f = computeForm([res({ position: null })]);
    expect(f).toMatchObject({ races: 1, finishes: 0, averagePosition: null });
    expect(f.score).toBeLessThan(0.25);
  });

  it("empate de fecha: la sprint pesa menos que la carrera del mismo día", () => {
    const fecha = new Date(2026, 4, 10);
    const sprintMala = res({ date: fecha, sessionType: "SPR", position: 15 });
    const carreraBuena = res({ date: fecha, sessionType: "RAC", position: 1 });
    const mixta = computeForm([sprintMala, carreraBuena]);
    const igualPeso = computeForm([
      res({ date: fecha, sessionType: "RAC", position: 15 }),
      carreraBuena,
    ]);
    expect(mixta.score).toBeGreaterThan(igualPeso.score);
  });

  it("las citas recientes pesan más que las antiguas", () => {
    const antigua = res({ date: new Date(2026, 0, 1), position: 15 });
    const reciente = res({ date: new Date(2026, 5, 1), position: 1 });
    const mejorAlFinal = computeForm([antigua, reciente]).score;
    const peorAlFinal = computeForm([
      res({ date: new Date(2026, 0, 1), position: 1 }),
      res({ date: new Date(2026, 5, 1), position: 15 }),
    ]).score;
    expect(mejorAlFinal).toBeGreaterThan(peorAlFinal);
  });
});

describe("computeCircuit", () => {
  it("sin historial: score igual a la forma, consistencia y credibilidad 0", () => {
    const c = computeCircuit([], 2026, 0.4);
    expect(c).toMatchObject({
      races: 0, positionSpread: null, consistency: 0, credibility: 0,
      averagePosition: null, bestPosition: null,
    });
    expect(c.score).toBeCloseTo(0.4, 3);
  });

  it("una sola carrera: consistencia neutra 0.5 y sin dispersión", () => {
    const c = computeCircuit([res({ seasonYear: 2025, position: 2 })], 2026, 0.4);
    expect(c.races).toBe(1);
    expect(c.positionSpread).toBeNull();
    expect(c.consistency).toBe(0.5);
    expect(c.credibility).toBeGreaterThan(0);
    expect(c.credibility).toBeLessThan(1);
  });

  it("descarta ediciones de hace más de 15 años", () => {
    const c = computeCircuit([res({ seasonYear: 2010 }), res({ seasonYear: 2025 })], 2026, 0.4);
    expect(c.races).toBe(1);
  });

  it("un historial irregular recorta el score frente a uno regular con la misma media", () => {
    const regular = [4, 4, 4, 4].map((p) => res({ seasonYear: 2025, position: p }));
    const irregular = [1, 1, null, null].map((p) => res({ seasonYear: 2025, position: p }));
    const a = computeCircuit(regular, 2026, 0.4);
    const b = computeCircuit(irregular, 2026, 0.4);
    expect(a.consistency).toBeGreaterThan(b.consistency);
  });

  it("score, consistencia y credibilidad quedan en 0..1", () => {
    const hist = Array.from({ length: 12 }, (_, i) =>
      res({ seasonYear: 2014 + i, position: i % 3 === 0 ? null : 1 + i })
    );
    const c = computeCircuit(hist, 2026, 0.9);
    for (const v of [c.score, c.consistency, c.credibility]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("computeTrend", () => {
  it("sin resultados es neutra", () => {
    expect(computeTrend([])).toEqual({ delta: 0, score: 0.5 });
  });

  it("un solo resultado no tiene tendencia", () => {
    expect(computeTrend([res({ position: 3 })])).toEqual({ delta: 0, score: 0.5 });
  });

  it("positiva si las últimas citas son mejores que el resto", () => {
    const rs = [15, 15, 15, 15, 1, 1, 1].map((p, i) => res({ date: new Date(2026, i, 1), position: p }));
    const t = computeTrend(rs);
    expect(t.delta).toBeGreaterThan(0);
    expect(t.score).toBeGreaterThan(0.5);
  });

  it("negativa si van a menos y acotada a -1..1", () => {
    const rs = [1, 1, 1, 1, null, null, null].map((p, i) => res({ date: new Date(2026, i, 1), position: p }));
    const t = computeTrend(rs);
    expect(t.delta).toBeLessThan(0);
    expect(t.delta).toBeGreaterThanOrEqual(-1);
    expect(t.score).toBeGreaterThanOrEqual(0);
  });
});

describe("computeReliability", () => {
  it("sin resultados usa el prior 0.85", () => {
    expect(computeReliability([])).toEqual({ starts: 0, finishes: 0, finishRate: 0, score: 0.85 });
  });

  it("calcula la tasa de llegada y suaviza hacia el prior", () => {
    const r = computeReliability([res({ position: 1 }), res({ position: null })]);
    expect(r).toMatchObject({ starts: 2, finishes: 1, finishRate: 0.5 });
    expect(r.score).toBeGreaterThan(0.5);
    expect(r.score).toBeLessThan(0.85);
  });

  it("no cuenta los que no salieron", () => {
    const r = computeReliability([res({ status: "NOTSTARTED", position: null })]);
    expect(r.starts).toBe(0);
  });
});

describe("computeBikeComponents", () => {
  it("sin resultados no devuelve ningún constructor", () => {
    expect(computeBikeComponents([], [], []).size).toBe(0);
  });

  it("ignora resultados sin constructor", () => {
    expect(computeBikeComponents([res({ constructorName: null })], [], []).size).toBe(0);
  });

  it("sin año anterior ni circuito: mejora nula, circuito = temporada y mejora neutra", () => {
    const actual = [3, 3, 3].map((p) => res({ position: p }));
    const bike = computeBikeComponents(actual, [], []).get("Ducati")!;
    expect(bike.seasonMedianPosition).toBe(3);
    expect(bike.seasonStrength).toBe(1);
    expect(bike.previousMedianPosition).toBeNull();
    expect(bike.improvement).toBeNull();
    expect(bike.improvementScore).toBe(0.5);
    expect(bike.circuitStrength).toBe(bike.seasonStrength);
    expect(bike.riders).toBe(1);
  });

  it("mejora positiva si la mediana sube respecto al año anterior", () => {
    const actual = [3, 3].map((p) => res({ position: p }));
    const previo = [7, 7].map((p) => res({ position: p, seasonYear: 2025 }));
    const bike = computeBikeComponents(actual, previo, []).get("Ducati")!;
    expect(bike.improvement).toBe(4);
    expect(bike.sameRiderImprovement).toBe(4);
    expect(bike.improvementScore).toBe(1);
  });

  it("la mediana de la sesión no se deja arrastrar por un piloto excepcional", () => {
    const key = "misma";
    const actual = [1, 12, 13].map((p, i) =>
      res({ sessionKey: key, riderId: `r${i}`, position: p })
    );
    const bike = computeBikeComponents(actual, [], []).get("Ducati")!;
    expect(bike.seasonMedianPosition).toBe(12);
    expect(bike.riders).toBe(3);
  });

  it("score entre 0 y 1", () => {
    const actual = [1, 20, null].map((p) => res({ position: p }));
    const { score } = computeBikeComponents(actual, [], []).get("Ducati")!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("MODEL_WEIGHTS", () => {
  it("suman 1", () => {
    const total = Object.values(MODEL_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("computeFavorites", () => {
  function entrada(id: string, posicion: number | null, constructorName: string | null = "Ducati"): FavoriteInput {
    const season = [res({ riderId: id, position: posicion, date: new Date(2026, 2, 1) })];
    return {
      riderId: id,
      circuitResults: [res({ riderId: id, seasonYear: 2025, position: posicion })],
      seasonResults: season,
      recentResults: season,
      constructorName,
    };
  }

  const bikes = new Map(computeBikeComponents([res({ position: 3 })], [], []));

  it("sin pilotos devuelve una lista vacía", () => {
    expect(computeFavorites([], 2026, bikes)).toEqual([]);
  });

  it("un solo piloto se lleva toda la probabilidad", () => {
    const [f] = computeFavorites([entrada("a", 1)], 2026, bikes);
    expect(f.winProbability).toBe(1);
  });

  it("ordena por índice descendente y la probabilidad suma ~1 (100 %)", () => {
    const out = computeFavorites(
      [entrada("a", 12), entrada("b", 1), entrada("c", 5), entrada("d", null)],
      2026,
      bikes
    );
    expect(out.map((f) => f.riderId)[0]).toBe("b");
    for (let i = 1; i < out.length; i++) expect(out[i - 1].index).toBeGreaterThanOrEqual(out[i].index);
    expect(out.reduce((s, f) => s + f.winProbability, 0)).toBeCloseTo(1, 2);
    for (const f of out) {
      expect(f.index).toBeGreaterThanOrEqual(0);
      expect(f.index).toBeLessThanOrEqual(1); // el endpoint lo escala a 0..100
    }
  });

  it("empate: pilotos idénticos tienen el mismo índice y la misma probabilidad", () => {
    const out = computeFavorites([entrada("a", 3), entrada("b", 3)], 2026, bikes);
    expect(out[0].index).toBe(out[1].index);
    expect(out[0].winProbability).toBe(out[1].winProbability);
    expect(out[0].winProbability).toBeCloseTo(0.5, 3);
  });

  it("sin constructor (o desconocido) usa una moto vacía con score 0", () => {
    const [sin] = computeFavorites([entrada("a", 1, null)], 2026, bikes);
    expect(sin.breakdown.bike).toMatchObject({ constructorName: null, riders: 0, score: 0 });
    const [raro] = computeFavorites([entrada("a", 1, "Marca X")], 2026, bikes);
    expect(raro.breakdown.bike).toMatchObject({ constructorName: "Marca X", score: 0 });
  });
});
