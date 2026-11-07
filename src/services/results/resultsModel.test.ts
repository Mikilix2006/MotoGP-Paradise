import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  eventOptions,
  formatRow,
  isRaceSession,
  resolveSelection,
  sessionLabel,
  sortRows,
  statusLabel,
} from "./resultsModel";
import { fila, filaTest, pretemporada, quinientos, sesion, temporada } from "./__fixtures__/sesiones";

describe("sessionLabel (RES-07)", () => {
  it("etiquetas fijas", () => {
    expect(sessionLabel("FP1")).toBe("Libres 1");
    expect(sessionLabel("FP2")).toBe("Libres 2");
    expect(sessionLabel("PR")).toBe("Práctica");
    expect(sessionLabel("Q1")).toBe("Q1");
    expect(sessionLabel("Q2")).toBe("Q2");
    expect(sessionLabel("SPR")).toBe("Sprint");
    expect(sessionLabel("WUP")).toBe("Warm-up");
    expect(sessionLabel("RAC")).toBe("Carrera");
  });

  it("patrones FPn, Pn y QPn; QP y FP sueltos", () => {
    expect(sessionLabel("FP3")).toBe("Libres 3");
    expect(sessionLabel("P1")).toBe("Práctica 1");
    expect(sessionLabel("QP1")).toBe("Clasificación 1");
    expect(sessionLabel("QP")).toBe("Clasificación");
    expect(sessionLabel("FP")).toBe("Libres");
  });

  it("un shortname desconocido se muestra tal cual", () => {
    expect(sessionLabel("XYZ")).toBe("XYZ");
  });

  // Decidido por el usuario: RAC2 es "Carrera", como en el calendario. Hoy da "Carrera 2".
  it.fails("SOSPECHA 6: RAC2 se etiqueta 'Carrera' (igual que el calendario)", () => {
    expect(sessionLabel("RAC2")).toBe("Carrera");
  });
});

describe("categoryLabel (RES-07)", () => {
  it("MotoGP hasta 2001 es 500cc", () => {
    expect(categoryLabel(3, "MotoGP™", 2001)).toBe("500cc");
    expect(categoryLabel(3, "MotoGP™", 1975)).toBe("500cc");
  });

  it("MotoGP desde 2002 y el resto, sin ™", () => {
    expect(categoryLabel(3, "MotoGP™", 2002)).toBe("MotoGP");
    expect(categoryLabel(2, "Moto2™", 1990)).toBe("Moto2");
    expect(categoryLabel(2, "  250cc ", 1990)).toBe("250cc");
  });
});

describe("eventOptions (RES-07)", () => {
  it("nombres en mayúsculas pasan a título; el evento va delante solo si el circuito tiene varios", () => {
    const sesiones = [
      sesion({ eventId: "a", eventName: "GRAN PREMIO DE SAN MARINO", eventDate: 1, circuitName: "Misano" }),
      sesion({ eventId: "b", eventName: "EMILIA-ROMAGNA", eventDate: 2, circuitName: "Misano" }),
      sesion({ eventId: "c", eventName: "OTRO", eventDate: 3, circuitId: "c2", circuitName: "Jerez" }),
    ];
    expect(eventOptions(sesiones).map((e) => e.label)).toEqual([
      "Gran Premio De San Marino · Misano",
      "Emilia-Romagna · Misano",
      "Jerez",
    ]);
  });

  it("un nombre ya en tipo título no se toca", () => {
    const [e] = eventOptions([
      sesion({ eventId: "a", eventName: "Gran Premio de Italia", circuitId: "x", circuitName: null }),
    ]);
    expect(e.label).toBe("Gran Premio de Italia");
  });

  it("sin circuito, la etiqueta es el nombre del evento", () => {
    const [e] = eventOptions([sesion({ circuitId: null, circuitName: null, eventName: "SIN CIRCUITO" })]);
    expect(e.label).toBe("Sin Circuito");
  });

  it("varias sesiones del mismo evento dan una sola opción, ordenada por fecha (tests: pretemporada)", () => {
    expect(eventOptions(pretemporada())).toEqual([{ id: "sep", label: "Sepang" }]);
  });

  it("eventos con la misma fecha se ordenan por nombre", () => {
    const opts = eventOptions([
      sesion({ eventId: "b", eventName: "Beta", eventDate: 1, circuitId: "cb", circuitName: "B" }),
      sesion({ eventId: "a", eventName: "Alfa", eventDate: 1, circuitId: "ca", circuitName: "A" }),
    ]);
    expect(opts.map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("resolveSelection (RES-03, RES-04)", () => {
  it("conserva lo pedido si existe: carrera Moto2 del evento e1", () => {
    const r = resolveSelection(temporada(), 2024, { event: "e1", category: 2, session: "RAC" })!;
    expect(r.selected).toEqual({ event: "e1", category: 2, session: "RAC" });
  });

  it("sesión inexistente en la categoría: cae a la última", () => {
    const r = resolveSelection(temporada(), 2024, { event: "e1", category: 3, session: "Q2" })!;
    expect(r.selected.session).toBe("RAC");
  });

  it("categoría basura o ausente del evento: cae a MotoGP", () => {
    const r = resolveSelection(temporada(), 2024, { event: "e1", category: 9, session: "Q2" })!;
    expect(r.selected.category).toBe(3);
  });

  it("sin petición: último evento con MotoGP aunque otras categorías corran después", () => {
    const r = resolveSelection(temporada(), 2024, {})!;
    expect(r.selected).toEqual({ event: "e1", category: 3, session: "RAC" });
  });

  it("categoría preferida: el último evento que la tiene", () => {
    const r = resolveSelection(temporada(), 2024, { category: 2 })!;
    expect(r.selected).toEqual({ event: "e2", category: 2, session: "RAC" });
  });

  it("evento desconocido (de otro año) conserva el circuito", () => {
    const r = resolveSelection(temporada(), 2024, { event: "otroAnio" }, "c2")!;
    expect(r.selected.event).toBe("e2");
  });

  it("evento desconocido y circuito sin eventos este año: valor por defecto", () => {
    const r = resolveSelection(temporada(), 2024, { event: "otroAnio" }, "nadie")!;
    expect(r.selected.event).toBe("e1");
  });

  it("sin sesiones devuelve null", () => {
    expect(resolveSelection([], 2024, {})).toBeNull();
  });

  it("devuelve opciones de eventos, categorías (MotoGP primero) y sesiones por hora", () => {
    const r = resolveSelection(temporada(), 2024, { event: "e1" })!;
    expect(r.categories).toEqual([
      { legacy_id: 3, label: "MotoGP" },
      { legacy_id: 2, label: "Moto2" },
    ]);
    expect(r.sessions).toEqual([
      { shortname: "FP1", label: "Libres 1" },
      { shortname: "RAC", label: "Carrera" },
    ]);
    expect(r.events.map((e) => e.id)).toEqual(["e1", "e2", "e0"]);
  });

  it("categoría desconocida (fuera del orden) va al final y no rompe", () => {
    const r = resolveSelection(
      [...temporada(), sesion({ eventId: "e1", categoryLegacyId: 77, categoryName: "Rara", dateStart: 50 })],
      2024,
      { event: "e1" }
    )!;
    expect(r.categories.map((c) => c.legacy_id)).toEqual([3, 2, 77]);
  });

  it("500cc: la categoría se etiqueta por año", () => {
    expect(resolveSelection(quinientos(), 2001, {})!.categories[0].label).toBe("500cc");
    expect(resolveSelection(quinientos(), 2002, {})!.categories[0].label).toBe("MotoGP");
  });

  it("tests de pretemporada: última sesión por hora; a igual hora, por shortname", () => {
    const r = resolveSelection(pretemporada(), 2026, {})!;
    expect(r.sessions.map((s) => s.shortname)).toEqual(["FP1", "FP2", "FP3"]);
    expect(r.selected.session).toBe("FP3");
  });
});

describe("statusLabel (RES-05)", () => {
  it("estados conocidos", () => {
    expect(statusLabel("OUTSTND")).toBe("Abandono");
    expect(statusLabel("NOTSTARTED")).toBe("No salió");
    expect(statusLabel("DISQUALIFIED")).toBe("Descalificado");
    expect(statusLabel("EXCLUDED")).toBe("Excluido");
    expect(statusLabel("OUTOFTIME")).toBe("Fuera de tiempo");
    expect(statusLabel("NOTFINISHFIRST")).toBe("No terminó");
    expect(statusLabel("NOTONRESTARTGRID")).toBe("No tomó la salida");
  });

  it("desconocido o nulo: raya", () => {
    expect(statusLabel("INSTND")).toBe("—");
    expect(statusLabel(null)).toBe("—");
  });
});

describe("isRaceSession (RES-05, RES-06)", () => {
  it("carrera si alguna fila tiene tiempo", () => {
    expect(isRaceSession([filaTest(), fila()])).toBe(true);
  });

  it("test: sin tiempos, o con tiempo vacío, no es carrera", () => {
    expect(isRaceSession([filaTest(), filaTest({ time: "" })])).toBe(false);
    expect(isRaceSession([])).toBe(false);
  });
});

describe("sortRows (RES-05)", () => {
  it("clasificados por posición; sin posición al final, por vueltas y luego nombre", () => {
    const rows = [
      fila({ position: null, status: "OUTSTND", laps_completed: 6, rider_name: "B" }),
      fila({ position: 2, rider_name: "X" }),
      fila({ position: null, status: "NOTSTARTED", laps_completed: 0, rider_name: "C" }),
      fila({ position: null, status: "OUTSTND", laps_completed: 20, rider_name: "D" }),
      fila({ position: 1, rider_name: "W" }),
    ];
    expect(sortRows(rows).map((r) => r.rider_name)).toEqual(["W", "X", "D", "B", "C"]);
  });

  it("sin vueltas (null) va tras los que tienen 0; empate de vueltas por nombre", () => {
    const rows = [
      fila({ position: null, laps_completed: null, rider_name: "N" }),
      fila({ position: null, laps_completed: 0, rider_name: "Z" }),
      fila({ position: null, laps_completed: 0, rider_name: "A" }),
    ];
    expect(sortRows(rows).map((r) => r.rider_name)).toEqual(["A", "Z", "N"]);
  });

  it("empate de posición: se conserva el orden de entrada y no se muta la lista", () => {
    const rows = [fila({ position: 3, rider_name: "P" }), fila({ position: 3, rider_name: "Q" })];
    const copia = [...rows];
    expect(sortRows(rows).map((r) => r.rider_name)).toEqual(["P", "Q"]);
    expect(rows).toEqual(copia);
  });
});

describe("formatRow en carrera (RES-05)", () => {
  it("P1 con tiempo, el resto con +gap", () => {
    expect(formatRow(fila(), true)).toMatchObject({ pos: "1", main: "40:24.740", extra: "25", noPosition: false });
    expect(formatRow(fila({ position: 2, gap: "1.107", time: "40:25.847", points: 20 }), true).main).toBe("+1.107");
  });

  it("sin gap en un clasificado: muestra su tiempo, o raya si tampoco hay", () => {
    expect(formatRow(fila({ position: 5, gap: null, time: "41:00.000" }), true).main).toBe("41:00.000");
    expect(formatRow(fila({ position: 5, gap: null, time: null }), true).main).toBe("—");
  });

  it("sin posición: estado en texto y posición '—'", () => {
    const f = formatRow(fila({ position: null, status: "OUTSTND" }), true);
    expect(f).toMatchObject({ pos: "—", main: "Abandono", noPosition: true });
    expect(formatRow(fila({ position: null, status: "INSTND", number: null, team_name: null }), true)).toMatchObject({
      main: "—",
      number: "—",
      team: "—",
    });
  });

  it("puntos con decimales en es-ES, 0 y nulo", () => {
    expect(formatRow(fila({ points: 12.5 }), true).extra).toBe("12,5");
    expect(formatRow(fila({ points: 0 }), true).extra).toBe("0");
    expect(formatRow(fila({ points: null }), true).extra).toBe("—");
  });
});

describe("formatRow fuera de carrera (RES-06)", () => {
  it("mejor vuelta y diferencia con el primero", () => {
    const f = formatRow(fila({ position: 2, time: null, fastest_lap: "01:40.912", gap: "0.411", points: null }), false);
    expect([f.main, f.extra]).toEqual(["01:40.912", "+0.411"]);
  });

  it("el primero, sin gap o sin posición: diferencia '—'", () => {
    expect(formatRow(filaTest({ position: 1, fastest_lap: "1:40.0", gap: "0.000" }), false).extra).toBe("—");
    expect(formatRow(filaTest({ position: 2, gap: null }), false).extra).toBe("—");
    expect(formatRow(filaTest({ position: null, gap: "0.5" }), false).extra).toBe("—");
  });

  it("test de pretemporada sin mejor vuelta: '—'", () => {
    expect(formatRow(filaTest({ position: 3 }), false).main).toBe("—");
  });
});
