/*
 * Forma de la respuesta de /api/next-gp/favorites.
 *
 * snake_case como el resto de respuestas del proyecto.
 */

export interface FavoriteRider {
  id: string;
  full_name: string;
  number: number;
  team_name: string;
  constructor_name: string;
  country_iso: string;
}

export interface FavoriteCircuitStats {
  races: number;
  finishes: number;
  dnfs: number;
  wins: number;
  podiums: number;
  best_position: number | null;
  average_position: number | null;

  /** Media ponderada de puntuación por puesto (0-1). */
  raw_mean: number;

  /** Desviación típica del puesto final (abandono = 20). */
  position_spread: number | null;

  /** 0 errático · 1 regular. */
  consistency: number;

  /** 0 sin muestra · 1 muestra sobrada. */
  credibility: number;

  score: number;
}

export interface FavoriteFormStats {
  races: number;
  finishes: number;
  wins: number;
  podiums: number;
  average_position: number | null;
  score: number;
}

export interface FavoriteBikeStats {
  constructor_name: string | null;
  score: number;
}

export interface FavoriteReliabilityStats {
  starts: number;
  finishes: number;
  finish_rate: number;
  score: number;
}

export interface FavoriteTrendStats {
  delta: number;
  score: number;
}

export interface FavoriteCircuitResult {
  season_year: number;
  event_short_name: string | null;
  session_type: "RAC" | "SPR";
  position: number | null;
  finished: boolean;
}

export interface Favorite {
  rank: number;
  rider: FavoriteRider;

  /** Índice de favorito, 0-100. */
  score: number;

  /** Probabilidad estimada de victoria, 0-100 (suma 100 entre todos). */
  win_probability: number;

  breakdown: {
    circuit: FavoriteCircuitStats;
    form: FavoriteFormStats;
    bike: FavoriteBikeStats;
    reliability: FavoriteReliabilityStats;
    trend: FavoriteTrendStats;
  };

  /** Últimos resultados del piloto en este circuito, del más reciente al más antiguo. */
  circuit_history: FavoriteCircuitResult[];
}

export interface FavoritesResponse {
  event: {
    id: string;
    name: string;
    short_name: string;
    date_start: string;
    circuit: {
      id: string;
      name: string;
      place: string;
    };
  };

  model: {
    weights: {
      circuit: number;
      form: number;
      bike: number;
      reliability: number;
      trend: number;
    };
  };

  favorites: Favorite[];
}
