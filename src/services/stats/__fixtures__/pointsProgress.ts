/*
 * Fixtures a mano de la gráfica de puntos. Cada constante reproduce una trampa
 * de los datos reales (ver TESTS.md, casos GRA-*).
 */
import type {
  EntryInput,
  EventInput,
  PointsProgressInput,
  ResultRowInput,
  StandingInput,
} from "../pointsProgressModel";

export const event = (id: string, sequence: number | null, over: Partial<EventInput> = {}): EventInput => ({
  id,
  shortName: id.toUpperCase(),
  name: `GP ${id}`,
  circuitName: `Circuito ${id}`,
  countryIso: "ES",
  countryName: "España",
  sequence,
  status: "FINISHED",
  isTest: false,
  ...over,
});

let session = 0;

/** Filas de una sesión: [riderId, puntos][]. `date` es el día de enero, para ordenar fácilmente. */
export function rows(
  eventId: string,
  sessionType: string | null,
  shortname: string | null,
  date: number,
  points: [string, number | null][]
): ResultRowInput[] {
  session += 1;
  return points.map(([riderId, p]) => ({
    eventId,
    sessionId: `s${session}`,
    sessionType,
    shortname,
    sessionDate: new Date(2026, 0, date),
    riderId,
    points: p,
  }));
}

export const official = (riderId: string, number: number): EntryInput => ({
  riderId,
  type: "Official",
  number,
  team: { id: `t-${riderId}`, name: `Equipo ${riderId}`, color: "#ff0000" },
  constructorName: "Ducati",
});

export const standing = (riderId: string, position: number | null, points: number | null): StandingInput => ({
  riderId,
  position,
  points,
  team: null,
  constructorName: null,
});

const riders = ["a", "b", "c", "x"].map((id) => ({
  id,
  publicId: `uuid-${id}`,
  fullName: `Piloto ${id.toUpperCase()}`,
}));

export function base(over: Partial<PointsProgressInput> = {}): PointsProgressInput {
  return {
    season: 2026,
    category: 3,
    events: [],
    results: [],
    entries: [official("a", 1), official("b", 2)],
    standings: [standing("a", 1, 0), standing("b", 2, 0)],
    riders,
    ...over,
  };
}

/* Dos GP con sprint y carrera; B no tiene fila en el segundo (lesionado). */
export const dosGp = base({
  events: [event("e2", 2), event("e1", 1)], // desordenados a propósito
  results: [
    ...rows("e1", "SPR", "SPR", 1, [["a", 12], ["b", 9]]),
    ...rows("e1", "RAC", "RAC", 2, [["a", 20], ["b", 25]]),
    ...rows("e2", "SPR", "SPR", 8, [["a", 9]]),
    ...rows("e2", "RAC", "RAC", 9, [["a", 25]]),
  ],
  standings: [standing("a", 1, 66), standing("b", 2, 34)],
});

/* carrera-reiniciada: RAC sin puntos (interrumpida) y RAC2 con ellos, y shortname nulo. */
export const reiniciada = base({
  events: [event("e1", 1), event("e2", 2), event("e3", 3)],
  results: [
    ...rows("e1", "RAC", "RAC", 1, [["a", 0], ["b", 0]]),
    ...rows("e1", "RAC", "RAC2", 2, [["a", 25], ["b", 20]]),
    // Duplicado con la suma completa en las dos: solo cuenta la más tardía.
    ...rows("e2", "RAC", "RAC", 1, [["a", 25], ["b", 20]]),
    ...rows("e2", "RAC", "RAC2", 2, [["a", 20], ["b", 25]]),
    // La buena es la de shortname nulo (THA 2026).
    ...rows("e3", "RAC", "RAC2", 1, [["a", 0], ["b", 0]]),
    ...rows("e3", "RAC", null, 2, [["a", 12.5], ["b", 10]]),
  ],
});

/* GP cancelado: evento CANCELLED con filas, evento sin resultados, test y carrera cancelada con sprint. */
export const cancelados = base({
  events: [
    event("e1", 1),
    event("cancel", 2, { status: "CANCELLED" }),
    event("futuro", 3, { status: "NOT-STARTED" }),
    event("test", 4, { isTest: true }),
    event("aus", 5),
  ],
  results: [
    ...rows("e1", "RAC", "RAC", 1, [["a", 25], ["b", 20]]),
    ...rows("cancel", "RAC", "RAC", 2, [["a", 25]]),
    ...rows("test", "RAC", "RAC", 3, [["a", 25]]),
    // AUS: la carrera cancelada no tiene filas, así que solo queda la sprint.
    ...rows("aus", "SPR", "SPR", 4, [["a", 12], ["b", 9]]),
  ],
});

/* type='SESSION' antiguo: solo RAC* / SPR* cuentan; FP, QP y WUP se ignoran. */
export const sesionesAntiguas = base({
  events: [event("e1", 1)],
  results: [
    ...rows("e1", "SESSION", "FP1", 1, [["a", 99]]),
    ...rows("e1", "SESSION", "QP1", 1, [["a", 99]]),
    ...rows("e1", "SESSION", "WUP", 1, [["a", 99]]),
    ...rows("e1", "SESSION", "RAC", 2, [["a", 15], ["b", 12]]),
    ...rows("e1", "FP", "FP1", 1, [["a", 99]]),
  ],
});

/* Sustituto: X corre y puntúa pero no es titular; sale de la lista. */
export const conSustituto = base({
  events: [event("e1", 1)],
  results: rows("e1", "RAC", "RAC", 1, [["a", 25], ["x", 20], ["b", 16]]),
  entries: [official("a", 1), official("b", 2), { ...official("x", 99), type: "Substitute" }],
  standings: [standing("a", 1, 25), standing("x", 2, 20), standing("b", 3, 16)],
});

/* type nulo en toda la temporada: respaldo = pilotos de la clasificación. */
export const tipoNulo = base({
  events: [event("e1", 1)],
  results: rows("e1", "RAC", "RAC", 1, [["a", 25], ["b", 20], ["c", 16]]),
  entries: [
    { ...official("a", 1), type: null },
    { ...official("b", 2), type: null },
  ],
  standings: [standing("a", 1, 25), standing("b", 2, 20)], // C corre pero no está en la clasificación
});

/* empates: dos pilotos con los mismos puntos; manda la posición de la clasificación. */
export const empates = base({
  events: [event("e1", 1)],
  results: rows("e1", "RAC", "RAC", 1, [["a", 20], ["b", 20], ["c", 10]]),
  entries: [official("a", 1), official("b", 2), official("c", 3)],
  standings: [standing("b", 1, 20), standing("a", 2, 20), standing("c", null, 10)],
});
