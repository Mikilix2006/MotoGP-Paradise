/*
 * ============================================================
 * MODELO DE FAVORITOS PARA EL PRÓXIMO GRAN PREMIO
 * ============================================================
 *
 * Funciones puras: no tocan la base de datos. Reciben los
 * resultados ya cargados y devuelven un índice por piloto.
 *
 * Cada carrera se convierte en una puntuación entre 0 y 1
 * según el puesto (ganar vale 1, abandonar vale 0) y el
 * índice final combina cinco componentes:
 *
 *   circuit      historial del piloto en este circuito,
 *                corregido por consistencia y por tamaño
 *                de muestra (credibilidad);
 *   form         resultados de la temporada en curso, con
 *                más peso en las últimas citas;
 *   bike         rendimiento de su constructor en este
 *                circuito en las últimas temporadas;
 *   reliability  proporción de carreras terminadas;
 *   trend        si sus últimas citas mejoran o empeoran
 *                su media de temporada.
 *
 * La idea central es que ganar dos veces aquí no basta si
 * en las otras ocho ocasiones el piloto ha sido irregular:
 * la media de puesto ya baja, la consistencia penaliza el
 * índice y la muestra grande hace que ese historial pese
 * más que su forma actual.
 */

export type RaceType = "RAC" | "SPR";

export interface RaceResultInput {
  /** Año de la temporada en la que se corrió. */
  seasonYear: number;

  /** Fecha de la carrera, para ordenar dentro de una temporada. */
  date: Date;

  sessionType: RaceType;

  /** Puesto final; null si no terminó. */
  position: number | null;

  /** Estado de la clasificación (INSTND, OUTSTND, NOTSTARTED...). */
  status: string | null;

  /** Nombre del constructor con el que corrió. */
  constructorName: string | null;

  /** Texto identificativo del evento (RSM, EMI...). */
  eventShortName: string | null;
}

export interface CircuitComponent {
  races: number;
  finishes: number;
  dnfs: number;
  wins: number;
  podiums: number;
  bestPosition: number | null;
  averagePosition: number | null;

  /** Media de puntuación ponderada por recencia (0-1). */
  rawMean: number;

  /** Desviación típica del puesto (abandono = DNF_POSITION). */
  positionSpread: number | null;

  /** 0 = errático, 1 = siempre el mismo nivel. */
  consistency: number;

  /** 0 = sin historial, 1 = muestra sobrada. */
  credibility: number;

  /** Componente final (0-1). */
  score: number;
}

export interface FormComponent {
  races: number;
  finishes: number;
  wins: number;
  podiums: number;
  averagePosition: number | null;
  score: number;
}

export interface TrendComponent {
  /** Diferencia entre las últimas citas y la media de temporada (-1..1). */
  delta: number;
  score: number;
}

export interface BikeComponent {
  constructorName: string | null;
  score: number;
}

export interface ReliabilityComponent {
  starts: number;
  finishes: number;
  finishRate: number;
  score: number;
}

export interface FavoriteBreakdown {
  circuit: CircuitComponent;
  form: FormComponent;
  bike: BikeComponent;
  reliability: ReliabilityComponent;
  trend: TrendComponent;
}

export interface FavoriteInput {
  riderId: string;

  /** Carreras del piloto en el circuito del próximo GP (todas las temporadas). */
  circuitResults: RaceResultInput[];

  /** Carreras del piloto en la temporada en curso. */
  seasonResults: RaceResultInput[];

  /** Carreras del piloto en las últimas temporadas, para la fiabilidad. */
  recentResults: RaceResultInput[];

  /** Constructor con el que corre ahora mismo. */
  constructorName: string | null;
}

export interface FavoriteOutput {
  riderId: string;
  index: number;
  winProbability: number;
  breakdown: FavoriteBreakdown;
}

/*
 * ------------------------------------------------------------
 * PARÁMETROS DEL MODELO
 * ------------------------------------------------------------
 */
export const MODEL_WEIGHTS = {
  circuit: 0.4,
  form: 0.35,
  bike: 0.1,
  reliability: 0.1,
  trend: 0.05,
} as const;

const MODEL = {
  /*
   * Puntuación por puesto: exp(-(puesto-1)/POSITION_DECAY).
   * Con 6: P1 = 1, P2 = 0.85, P3 = 0.72, P5 = 0.51, P10 = 0.22.
   */
  POSITION_DECAY: 6,

  /* Una sprint vale algo menos que una carrera larga. */
  SPRINT_WEIGHT: 0.6,

  /* Peso por año de antigüedad en el historial del circuito. */
  CIRCUIT_YEAR_DECAY: 0.8,

  /* Años de historial que se consideran. */
  CIRCUIT_MAX_YEARS: 15,

  /*
   * Fuerza del prior en el historial del circuito: número de
   * carreras "virtuales" que se le suponen al piloto con su
   * forma actual. Con pocas carreras reales manda la forma.
   */
  CIRCUIT_PRIOR_STRENGTH: 2.5,

  /*
   * Puesto que se le asigna a un abandono al medir la
   * regularidad, y desviación típica (en puestos) a partir de
   * la cual el piloto se considera totalmente errático.
   */
  DNF_POSITION: 20,
  CIRCUIT_MAX_POSITION_STD: 8,

  /* Cuánto puede recortar el índice de circuito la falta de consistencia. */
  CIRCUIT_CONSISTENCY_FLOOR: 0.65,

  /* Peso por cita de antigüedad dentro de la temporada. */
  FORM_EVENT_DECAY: 0.85,

  FORM_PRIOR: 0.25,
  FORM_PRIOR_STRENGTH: 2,

  /* Citas que se comparan con la media de temporada para la tendencia. */
  TREND_EVENTS: 3,
  TREND_RANGE: 0.3,

  RELIABILITY_PRIOR: 0.85,
  RELIABILITY_PRIOR_STRENGTH: 5,

  /* Temperatura del softmax que reparte la probabilidad de victoria. */
  PROBABILITY_TEMPERATURE: 0.1,
} as const;

/*
 * Estados en los que el piloto ni siquiera tomó la salida:
 * no dicen nada de su rendimiento y se descartan.
 */
const NOT_STARTED_STATUSES = new Set([
  "NOTSTARTED",
  "WILLNOTSTART",
]);

/*
 * ------------------------------------------------------------
 * UTILIDADES
 * ------------------------------------------------------------
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

export function didStart(result: RaceResultInput): boolean {
  return !NOT_STARTED_STATUSES.has(result.status ?? "");
}

export function didFinish(result: RaceResultInput): boolean {
  return didStart(result) && result.position !== null;
}

/**
 * Puntuación de un resultado: 1 por ganar, decreciente con el
 * puesto, 0 por abandonar.
 */
export function positionScore(result: RaceResultInput): number {
  if (!didFinish(result) || result.position === null) {
    return 0;
  }

  return Math.exp(-(result.position - 1) / MODEL.POSITION_DECAY);
}

interface WeightedValue {
  value: number;
  weight: number;
}

function weightedMean(values: WeightedValue[]): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return (
    values.reduce((sum, item) => sum + item.value * item.weight, 0) /
    totalWeight
  );
}

function weightedStd(values: WeightedValue[]): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const mean = weightedMean(values);

  const variance =
    values.reduce(
      (sum, item) => sum + item.weight * (item.value - mean) ** 2,
      0
    ) / totalWeight;

  return Math.sqrt(variance);
}

/**
 * Media bayesiana: acerca la media observada al prior tanto
 * más cuanto menor es la muestra.
 */
function shrink(
  mean: number,
  sampleSize: number,
  prior: number,
  priorStrength: number
): number {
  return (
    (mean * sampleSize + prior * priorStrength) /
    (sampleSize + priorStrength)
  );
}

function sessionWeight(result: RaceResultInput): number {
  return result.sessionType === "SPR" ? MODEL.SPRINT_WEIGHT : 1;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarize(results: RaceResultInput[]) {
  const started = results.filter(didStart);
  const finished = started.filter(didFinish);

  const positions = finished.map((result) => result.position as number);

  return {
    races: started.length,
    finishes: finished.length,
    dnfs: started.length - finished.length,
    wins: positions.filter((position) => position === 1).length,
    podiums: positions.filter((position) => position <= 3).length,
    bestPosition: positions.length ? Math.min(...positions) : null,
    averagePosition: average(positions),
  };
}

/*
 * ------------------------------------------------------------
 * COMPONENTES
 * ------------------------------------------------------------
 */

/**
 * Forma de la temporada en curso. Las últimas citas pesan más
 * y las sprints algo menos que las carreras.
 */
export function computeForm(
  seasonResults: RaceResultInput[]
): FormComponent {
  const started = seasonResults.filter(didStart);

  const eventDates = [...new Set(started.map((r) => r.date.toDateString()))]
    .map((key) => new Date(key).getTime())
    .sort((a, b) => b - a);

  const values = started.map((result) => {
    const eventsAgo = eventDates.indexOf(
      new Date(result.date.toDateString()).getTime()
    );

    return {
      value: positionScore(result),
      weight:
        sessionWeight(result) *
        MODEL.FORM_EVENT_DECAY ** Math.max(eventsAgo, 0),
    };
  });

  const sampleSize = values.reduce((sum, item) => sum + item.weight, 0);

  const score = shrink(
    weightedMean(values),
    sampleSize,
    MODEL.FORM_PRIOR,
    MODEL.FORM_PRIOR_STRENGTH
  );

  const summary = summarize(started);

  return {
    races: summary.races,
    finishes: summary.finishes,
    wins: summary.wins,
    podiums: summary.podiums,
    averagePosition:
      summary.averagePosition !== null
        ? round(summary.averagePosition, 1)
        : null,
    score: round(score),
  };
}

/**
 * Historial del piloto en el circuito.
 *
 * - Media de puntuación ponderada por recencia (los años
 *   lejanos cuentan menos: cambian motos y pilotos).
 * - Consistencia: desviación típica del puesto final, con los
 *   abandonos contados como un puesto de cola. Ganar dos veces
 *   y abandonar o acabar decimoquinto el resto dispara esta
 *   desviación y recorta el índice.
 * - Credibilidad: cuántas carreras "efectivas" respaldan la
 *   media. Con pocas, la media se acerca a la forma actual.
 */
export function computeCircuit(
  circuitResults: RaceResultInput[],
  currentSeasonYear: number,
  formScore: number
): CircuitComponent {
  const started = circuitResults.filter(
    (result) =>
      didStart(result) &&
      currentSeasonYear - result.seasonYear <= MODEL.CIRCUIT_MAX_YEARS
  );

  const values = started.map((result) => {
    /*
     * La última edición disputada pesa 1; cada año anterior
     * se descuenta. La edición del propio año (si ya se corrió,
     * como en circuitos con dos GPs) también pesa 1.
     */
    const yearsAgo = Math.max(
      currentSeasonYear - 1 - result.seasonYear,
      0
    );

    return {
      value: positionScore(result),
      weight:
        sessionWeight(result) *
        MODEL.CIRCUIT_YEAR_DECAY ** yearsAgo,
    };
  });

  const sampleSize = values.reduce((sum, item) => sum + item.weight, 0);

  const rawMean = weightedMean(values);

  const positions = started.map((result, index) => ({
    value: didFinish(result)
      ? (result.position as number)
      : MODEL.DNF_POSITION,
    weight: values[index].weight,
  }));

  const positionSpread =
    positions.length >= 2 ? weightedStd(positions) : null;

  const consistency =
    positionSpread !== null
      ? clamp(1 - positionSpread / MODEL.CIRCUIT_MAX_POSITION_STD, 0, 1)
      : positions.length === 1
        ? 0.5
        : 0;

  const credibility =
    sampleSize / (sampleSize + MODEL.CIRCUIT_PRIOR_STRENGTH);

  const adjustedMean = shrink(
    rawMean,
    sampleSize,
    formScore,
    MODEL.CIRCUIT_PRIOR_STRENGTH
  );

  /*
   * La consistencia solo recorta lo que el piloto ha demostrado
   * aquí: la parte del índice que viene del prior (su forma) no
   * se penaliza por un historial corto.
   */
  const consistencyFactor =
    MODEL.CIRCUIT_CONSISTENCY_FLOOR +
    (1 - MODEL.CIRCUIT_CONSISTENCY_FLOOR) *
      (credibility * consistency + (1 - credibility));

  const summary = summarize(started);

  return {
    races: summary.races,
    finishes: summary.finishes,
    dnfs: summary.dnfs,
    wins: summary.wins,
    podiums: summary.podiums,
    bestPosition: summary.bestPosition,
    averagePosition:
      summary.averagePosition !== null
        ? round(summary.averagePosition, 1)
        : null,
    rawMean: round(rawMean),
    positionSpread:
      positionSpread !== null ? round(positionSpread, 1) : null,
    consistency: round(consistency),
    credibility: round(credibility),
    score: round(adjustedMean * consistencyFactor),
  };
}

/**
 * Tendencia: las últimas citas frente a la media de la
 * temporada. Positiva si el piloto va a más.
 */
export function computeTrend(
  seasonResults: RaceResultInput[]
): TrendComponent {
  const started = seasonResults
    .filter(didStart)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (started.length === 0) {
    return { delta: 0, score: 0.5 };
  }

  const eventKeys = [...new Set(started.map((r) => r.date.toDateString()))];

  const recentKeys = new Set(eventKeys.slice(0, MODEL.TREND_EVENTS));

  const toWeighted = (results: RaceResultInput[]) =>
    results.map((result) => ({
      value: positionScore(result),
      weight: sessionWeight(result),
    }));

  const recentMean = weightedMean(
    toWeighted(started.filter((r) => recentKeys.has(r.date.toDateString())))
  );

  const seasonMean = weightedMean(toWeighted(started));

  const delta = clamp(
    (recentMean - seasonMean) / MODEL.TREND_RANGE,
    -1,
    1
  );

  return {
    delta: round(delta),
    score: round(0.5 + delta / 2),
  };
}

/**
 * Fiabilidad: proporción de carreras terminadas en las últimas
 * temporadas, suavizada hacia la media del campeonato.
 */
export function computeReliability(
  recentResults: RaceResultInput[]
): ReliabilityComponent {
  const started = recentResults.filter(didStart);
  const finished = started.filter(didFinish);

  const finishRate =
    started.length > 0 ? finished.length / started.length : 0;

  const score = shrink(
    finishRate,
    started.length,
    MODEL.RELIABILITY_PRIOR,
    MODEL.RELIABILITY_PRIOR_STRENGTH
  );

  return {
    starts: started.length,
    finishes: finished.length,
    finishRate: round(finishRate),
    score: round(score),
  };
}

/**
 * Rendimiento de cada constructor en el circuito: media de la
 * puntuación de todos sus pilotos en las últimas ediciones,
 * normalizada para que el mejor constructor valga 1.
 */
export function computeBikeScores(
  circuitResults: RaceResultInput[]
): Map<string, number> {
  const byConstructor = new Map<string, WeightedValue[]>();

  for (const result of circuitResults) {
    if (!result.constructorName || !didStart(result)) {
      continue;
    }

    const group = byConstructor.get(result.constructorName) ?? [];

    group.push({
      value: positionScore(result),
      weight: sessionWeight(result),
    });

    byConstructor.set(result.constructorName, group);
  }

  const means = new Map<string, number>();

  for (const [constructorName, values] of byConstructor) {
    means.set(constructorName, weightedMean(values));
  }

  const best = Math.max(0, ...means.values());

  const scores = new Map<string, number>();

  for (const [constructorName, mean] of means) {
    scores.set(constructorName, best > 0 ? round(mean / best) : 0);
  }

  return scores;
}

/*
 * ------------------------------------------------------------
 * ÍNDICE FINAL
 * ------------------------------------------------------------
 */

export function computeFavorites(
  inputs: FavoriteInput[],
  currentSeasonYear: number,
  bikeScores: Map<string, number>
): FavoriteOutput[] {
  const scored = inputs.map((input) => {
    const form = computeForm(input.seasonResults);

    const circuit = computeCircuit(
      input.circuitResults,
      currentSeasonYear,
      form.score
    );

    const trend = computeTrend(input.seasonResults);

    const reliability = computeReliability(input.recentResults);

    const bike: BikeComponent = {
      constructorName: input.constructorName,
      score: input.constructorName
        ? (bikeScores.get(input.constructorName) ?? 0)
        : 0,
    };

    const index =
      MODEL_WEIGHTS.circuit * circuit.score +
      MODEL_WEIGHTS.form * form.score +
      MODEL_WEIGHTS.bike * bike.score +
      MODEL_WEIGHTS.reliability * reliability.score +
      MODEL_WEIGHTS.trend * trend.score;

    return {
      riderId: input.riderId,
      index: round(index),
      winProbability: 0,
      breakdown: { circuit, form, bike, reliability, trend },
    };
  });

  /*
   * Reparto de probabilidad de victoria: softmax sobre el
   * índice. La temperatura decide cuánto se separa el favorito
   * del resto.
   */
  const exponentials = scored.map((item) =>
    Math.exp(item.index / MODEL.PROBABILITY_TEMPERATURE)
  );

  const total = exponentials.reduce((sum, value) => sum + value, 0);

  scored.forEach((item, position) => {
    item.winProbability =
      total > 0 ? round(exponentials[position] / total, 4) : 0;
  });

  return scored.sort((a, b) => b.index - a.index);
}
