import { describe, expect, it } from "vitest";
import { buildPointsProgress, classifySession, selectRoster } from "./pointsProgressModel";
import {
  base,
  cancelados,
  conSustituto,
  dosGp,
  empates,
  reiniciada,
  sesionesAntiguas,
  tipoNulo,
} from "./__fixtures__/pointsProgress";

const rider = (data: ReturnType<typeof buildPointsProgress>, id: string) =>
  data.riders.find((r) => r.id === `uuid-${id}`)!;

describe("classifySession", () => {
  it("RAC y SPR por tipo; SESSION antiguo por shortname; el resto no puntúa", () => {
    expect(classifySession("RAC", null)).toBe("race");
    expect(classifySession("SPR", null)).toBe("sprint");
    expect(classifySession("SESSION", "RAC2")).toBe("race");
    expect(classifySession("SESSION", "SPR")).toBe("sprint");
    expect(classifySession("SESSION", "FP1")).toBeNull();
    expect(classifySession("SESSION", null)).toBeNull();
    expect(classifySession("QP", "QP")).toBeNull();
  });
});

describe("orden, acumulado y nulos (GRA-U01..U03)", () => {
  const data = buildPointsProgress(dosGp);

  it("ordena los eventos por sequence y devuelve su ficha", () => {
    expect(data.events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(data.events[0]).toMatchObject({
      short_name: "E1",
      circuit_name: "Circuito e1",
      country_iso: "ES",
      sequence: 1,
    });
  });

  it("suma sprint y carrera con desglose y acumulado", () => {
    expect(
      rider(data, "a").progress.map((p) => [p.sprint_points, p.race_points, p.points, p.cumulative])
    ).toEqual([
      [12, 20, 32, 32],
      [9, 25, 34, 66],
    ]);
  });

  it("sin fila en un GP: puntos null (no 0) y acumulado plano", () => {
    const b = rider(data, "b");
    expect(b.progress[1]).toEqual({
      event_id: "e2",
      points: null,
      sprint_points: null,
      race_points: null,
      cumulative: 34,
    });
    expect(b.total_points).toBe(34);
  });

  it("tiene un paso por evento y cuadra con la clasificación", () => {
    for (const r of data.riders) expect(r.progress).toHaveLength(data.events.length);
    for (const id of ["a", "b"]) expect(rider(data, id).total_points).toBe(rider(data, id).standing_points);
  });

  it("acumulado null antes de la primera participación", () => {
    const tarde = buildPointsProgress(
      base({
        events: dosGp.events,
        results: dosGp.results.filter((r) => !(r.riderId === "b" && r.eventId === "e1")),
      })
    );
    expect(rider(tarde, "b").progress.map((p) => p.cumulative)).toEqual([null, null]);
    expect(rider(tarde, "a").progress.map((p) => p.cumulative)).toEqual([32, 66]);
  });

  it("incluye dorsal, equipo, color, constructor y posición final", () => {
    expect(rider(data, "a")).toMatchObject({
      number: 1,
      constructor_name: "Ducati",
      final_position: 1,
      team: { name: "Equipo a", color: "#ff0000" },
    });
  });
});

describe("carrera reiniciada (GRA-U04)", () => {
  const data = buildPointsProgress(reiniciada);
  const a = rider(data, "a");

  it("RAC sin puntos + RAC2 con ellos: cuenta RAC2", () => {
    expect(a.progress[0].race_points).toBe(25);
  });

  it("dos sesiones con la suma completa: solo la más tardía, sin doblar", () => {
    expect(a.progress[1].race_points).toBe(20);
    expect(rider(data, "b").progress[1].race_points).toBe(25);
  });

  it("la efectiva puede tener shortname nulo y puntos decimales", () => {
    expect(a.progress[2].race_points).toBe(12.5);
    expect(a.total_points).toBe(57.5);
  });
});

describe("eventos que no cuentan (GRA-U05)", () => {
  const data = buildPointsProgress(cancelados);

  it("excluye cancelados, de test y sin resultados", () => {
    expect(data.events.map((e) => e.id)).toEqual(["e1", "aus"]);
  });

  it("carrera cancelada con sprint disputada: el GP cuenta por su sprint", () => {
    expect(rider(data, "a").progress[1]).toMatchObject({
      sprint_points: 12,
      race_points: null,
      points: 12,
      cumulative: 37,
    });
  });
});

describe("sesiones antiguas type=SESSION (GRA-U06)", () => {
  it("solo cuentan las que empiezan por RAC/SPR", () => {
    const data = buildPointsProgress(sesionesAntiguas);
    expect(rider(data, "a").total_points).toBe(15);
    expect(rider(data, "b").total_points).toBe(12);
  });
});

describe("titulares (GRA-U07, GRA-U08)", () => {
  it("el sustituto no aparece aunque puntúe", () => {
    const data = buildPointsProgress(conSustituto);
    expect(data.riders.map((r) => r.id)).toEqual(["uuid-a", "uuid-b"]);
  });

  it("sin type informado, el respaldo son los pilotos de la clasificación", () => {
    const data = buildPointsProgress(tipoNulo);
    expect(data.riders.map((r) => r.id).sort()).toEqual(["uuid-a", "uuid-b"]);
  });

  it("piloto de la clasificación sin ninguna entrada también entra", () => {
    expect(
      selectRoster([], [{ riderId: "z", position: 1, points: 1, team: null, constructorName: null }])
    ).toEqual(["z"]);
  });
});

describe("empates (GRA-U09)", () => {
  it("ordena por posición final de la clasificación, no por puntos", () => {
    const data = buildPointsProgress(empates);
    expect(data.riders.map((r) => r.id)).toEqual(["uuid-b", "uuid-a", "uuid-c"]);
  });

  it("sin posición va al final, por puntos y nombre, sin NaN", () => {
    const data = buildPointsProgress({ ...empates, standings: [] });
    expect(data.riders.map((r) => r.id)).toEqual(["uuid-a", "uuid-b", "uuid-c"]);
  });
});
