/*
 * Forma de la respuesta de /api/riders/points-progress.
 *
 * snake_case como el resto de respuestas del proyecto.
 *
 * Contrato de los nulos: `riders[].progress` tiene EXACTAMENTE un elemento por
 * cada elemento de `events`, en el mismo orden. En un GP donde el piloto no
 * tiene fila de resultados los puntos son `null` (nunca 0 inventado: no
 * puntuó 0, sencillamente no corrió). El acumulado se mantiene plano desde
 * la primera participación y es `null` antes de ella; el cliente no tiene
 * que rellenar nada.
 */

export interface PointsProgressEvent {
  id: string;
  /** Abreviatura del GP (Event.shortName), p. ej. "QAT". */
  short_name: string | null;
  name: string;
  circuit_name: string | null;
  country_iso: string | null;
  country_name: string | null;
  sequence: number | null;
}

export interface PointsProgressStep {
  event_id: string;
  /** Puntos del GP (sprint + carrera). `null` si el piloto no tiene fila ese GP. */
  points: number | null;
  /** Puntos de la sprint. `null` si no hubo sprint o el piloto no tiene fila en ella. */
  sprint_points: number | null;
  /** Puntos de la carrera. `null` si el piloto no tiene fila en ella. */
  race_points: number | null;
  /** Acumulado hasta este GP incluido; plano si no corrió; `null` antes de su primera participación. */
  cumulative: number | null;
}

export interface PointsProgressRider {
  id: string;
  full_name: string;
  number: number | null;
  team: { id: string; name: string; color: string | null } | null;
  constructor_name: string | null;
  /** Posición final del campeonato (ChampionshipStanding.position); `null` si no consta. */
  final_position: number | null;
  /** Puntos del campeonato según ChampionshipStanding (referencia para cruzar con `total_points`). */
  standing_points: number | null;
  /** Último acumulado (`null` si no corrió ningún GP de la lista). */
  total_points: number | null;
  progress: PointsProgressStep[];
}

export interface PointsProgress {
  season: number;
  category: number;
  events: PointsProgressEvent[];
  riders: PointsProgressRider[];
}
