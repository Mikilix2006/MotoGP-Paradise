// Comprobación de la lógica pura de /resultados: npx tsx scripts/check-results.ts
import assert from "node:assert/strict";

import {
  categoryLabel,
  eventOptions,
  formatRow,
  isRaceSession,
  resolveSelection,
  sessionLabel,
  sortRows,
  type VisibleSession,
} from "../src/services/results/resultsModel";
import type { ResultRow } from "../src/types/results";

let n = 0;
const s = (o: Partial<VisibleSession>): VisibleSession => ({
  id: `s${n++}`, shortname: "RAC", dateStart: n, seasonId: "y", eventId: "e1", eventName: "GP UNO", eventDate: 1,
  circuitId: "c1", circuitName: "Circuito", categoryId: "k3", categoryLegacyId: 3, categoryName: "MotoGP™", ...o,
});

// etiquetas
assert.equal(sessionLabel("FP1"), "Libres 1");
assert.equal(sessionLabel("SPR"), "Sprint");
assert.equal(sessionLabel("XYZ"), "XYZ");
assert.equal(categoryLabel(3, "MotoGP™", 2001), "500cc");
assert.equal(categoryLabel(3, "MotoGP™", 2002), "MotoGP");
assert.equal(categoryLabel(2, "Moto2™", 1990), "Moto2");

// circuito: el evento solo se añade si hay varios en el mismo circuito
const mis = [s({ eventId: "a", eventName: "GRAN PREMIO DE SAN MARINO", eventDate: 1, circuitName: "Misano" }),
  s({ eventId: "b", eventName: "EMILIA-ROMAGNA", eventDate: 2, circuitName: "Misano" }),
  s({ eventId: "c", eventName: "OTRO", eventDate: 3, circuitId: "c2", circuitName: "Jerez" })];
assert.deepEqual(eventOptions(mis).map((e) => e.label), ["Gran Premio De San Marino · Misano", "Emilia-Romagna · Misano", "Jerez"]);

// cascada: carrera MotoGP -> carrera Moto2; sin la sesión, cae a la última
const sess = [
  s({ eventId: "e1", shortname: "FP1", dateStart: 1 }), s({ eventId: "e1", shortname: "RAC", dateStart: 5 }),
  s({ eventId: "e1", shortname: "RAC", dateStart: 6, categoryLegacyId: 2, categoryName: "Moto2™", categoryId: "k2" }),
  s({ eventId: "e1", shortname: "Q2", dateStart: 4, categoryLegacyId: 2, categoryName: "Moto2™", categoryId: "k2" }),
  s({ eventId: "e2", shortname: "RAC", dateStart: 20, eventDate: 2, circuitId: "c2", categoryLegacyId: 2, categoryId: "k2" }),
  s({ eventId: "e0", shortname: "FP1", dateStart: 30, eventDate: 3, circuitId: "c3" , categoryLegacyId: 1, categoryId: "k1" }),
];
let r = resolveSelection(sess, 2024, { event: "e1", category: 2, session: "RAC" })!;
assert.equal(r.selected.session, "RAC"); assert.equal(r.selected.category, 2);
r = resolveSelection(sess, 2024, { event: "e1", category: 3, session: "Q2" })!; // no existe en MotoGP: última
assert.equal(r.selected.session, "RAC");
r = resolveSelection(sess, 2024, { event: "e1", category: 9, session: "Q2" })!; // categoría basura -> MotoGP
assert.equal(r.selected.category, 3);
// por defecto: último evento con MotoGP aunque otra categoría corra después (e0 solo Moto3, e2 solo Moto2)
r = resolveSelection(sess, 2024, {})!;
assert.deepEqual(r.selected, { event: "e1", category: 3, session: "RAC" });
// evento de otro año: se conserva el circuito
r = resolveSelection(sess, 2024, { event: "otroAnio" }, "c2")!;
assert.equal(r.selected.event, "e2");
assert.equal(resolveSelection([], 2024, {}), null);

// filas
const row = (o: Partial<ResultRow>): ResultRow => ({ position: 1, rider_name: "A", number: 1, team_name: "T", status: "INSTND",
  time: "40:24.740", gap: "0.000", fastest_lap: null, points: 25, laps_completed: 24, ...o });
const rows = [row({ position: null, status: "OUTSTND", laps_completed: 6, rider_name: "B" }),
  row({ position: 2, gap: "1.107", time: "40:25.847", points: 20 }),
  row({ position: null, status: "NOTSTARTED", laps_completed: 0, rider_name: "C" }),
  row({ position: null, status: "OUTSTND", laps_completed: 20, rider_name: "D" }), row({})];
const sorted = sortRows(rows);
assert.deepEqual(sorted.map((x) => x.rider_name), ["A", "A", "D", "B", "C"]);
assert.ok(isRaceSession(rows));
const f = sorted.map((x) => formatRow(x, true));
assert.equal(f[0].main, "40:24.740");
assert.equal(f[1].main, "+1.107");
assert.equal(f[2].main, "Abandono"); assert.equal(f[2].pos, "—"); assert.equal(f[4].main, "No salió");
assert.equal(formatRow(row({ position: null, status: "INSTND", number: null, team_name: null }), true).main, "—");
const fp = row({ position: 2, time: null, fastest_lap: "01:40.912", gap: "0.411", points: null });
assert.ok(!isRaceSession([fp]));
assert.deepEqual([formatRow(fp, false).main, formatRow(fp, false).extra], ["01:40.912", "+0.411"]);
assert.equal(formatRow(row({ position: null, time: null, gap: "0.000", fastest_lap: null }), false).main, "—");

console.log("resultsModel: todas las comprobaciones correctas");
