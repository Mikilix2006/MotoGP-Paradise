// Fixtures escritos a mano para resultsModel: sesiones visibles y filas de resultados.
import type { VisibleSession } from "../resultsModel";
import type { ResultRow } from "@/types/results";

let n = 0;
export const sesion = (o: Partial<VisibleSession> = {}): VisibleSession => ({
  id: `s${n++}`, shortname: "RAC", dateStart: n, seasonId: "y", eventId: "e1", eventName: "GP UNO", eventDate: 1,
  circuitId: "c1", circuitName: "Circuito", circuitPlace: null, countryIso: null, countryName: null, categoryId: "k3", categoryLegacyId: 3, categoryName: "MotoGP™", ...o,
});

const moto2 = { categoryLegacyId: 2, categoryName: "Moto2™", categoryId: "k2" };
const moto3 = { categoryLegacyId: 1, categoryName: "Moto3™", categoryId: "k1" };

// Temporada normal: e1 con MotoGP+Moto2, e2 solo Moto2 (corre después), e0 solo Moto3 (aún más tarde).
export const temporada = (): VisibleSession[] => [
  sesion({ eventId: "e1", shortname: "FP1", dateStart: 1 }),
  sesion({ eventId: "e1", shortname: "RAC", dateStart: 5 }),
  sesion({ eventId: "e1", shortname: "RAC", dateStart: 6, ...moto2 }),
  sesion({ eventId: "e1", shortname: "Q2", dateStart: 4, ...moto2 }),
  sesion({ eventId: "e2", shortname: "RAC", dateStart: 20, eventDate: 2, circuitId: "c2", ...moto2 }),
  sesion({ eventId: "e0", shortname: "FP1", dateStart: 30, eventDate: 3, circuitId: "c3", ...moto3 }),
];

// 500cc: en la BD cuelga de MotoGP™ (legacyId 3) pero el año es <= 2001.
export const quinientos = (): VisibleSession[] => [
  sesion({ eventId: "jp", eventName: "JAPANESE GP", shortname: "RAC", circuitName: "Suzuka" }),
  sesion({ eventId: "jp", eventName: "JAPANESE GP", shortname: "RAC", categoryLegacyId: 2, categoryName: "250cc", categoryId: "k2" }),
];

// Tests de pretemporada: solo sesiones de entrenamiento, sin carrera; FP1 y FP2 empatadas en hora.
export const pretemporada = (): VisibleSession[] => [
  sesion({ eventId: "sep", eventName: "SEPANG TEST", shortname: "FP2", dateStart: 10, circuitId: "sepang", circuitName: "Sepang" }),
  sesion({ eventId: "sep", eventName: "SEPANG TEST", shortname: "FP1", dateStart: 10, circuitId: "sepang", circuitName: "Sepang" }),
  sesion({ eventId: "sep", eventName: "SEPANG TEST", shortname: "FP3", dateStart: 11, circuitId: "sepang", circuitName: "Sepang" }),
];

export const fila = (o: Partial<ResultRow> = {}): ResultRow => ({
  position: 1, rider_name: "A", number: 1, team_name: "T", status: "INSTND",
  time: "40:24.740", gap: "0.000", fastest_lap: null, points: 25, laps_completed: 24, ...o,
});

// Test sin tiempo ni mejor vuelta.
export const filaTest = (o: Partial<ResultRow> = {}): ResultRow =>
  fila({ time: null, fastest_lap: null, points: null, gap: null, ...o });
