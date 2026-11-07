import type { Favorite, FavoritesResponse } from "@/types/favorites";

// Favorito con desglose completo; `over` permite ajustar circuito, moto, tendencia o historial.
export function favorito(rank: number, over: Partial<Favorite> = {}): Favorite {
  return {
    rank,
    rider: {
      id: `r${rank}`,
      full_name: `Piloto ${rank}`,
      number: rank,
      team_name: `Equipo ${rank}`,
      constructor_name: "Ducati",
      country_iso: "ES",
    },
    score: 80 - rank,
    win_probability: 20 - rank,
    breakdown: {
      circuit: {
        races: 4, finishes: 3, dnfs: 1, wins: 1, podiums: 2,
        best_position: 1, average_position: 4.5, raw_mean: 0.6,
        position_spread: 3.2, consistency: 0.6, credibility: 0.5, score: 0.55,
      },
      form: { races: 5, finishes: 5, wins: 1, podiums: 3, average_position: 3.2, score: 0.7 },
      bike: {
        constructor_name: "Ducati", riders: 4, season_median_position: 3,
        previous_median_position: 5, improvement: 2, same_rider_improvement: 1,
        circuit_median_position: 4, season_strength: 1, circuit_strength: 0.9,
        improvement_score: 0.75, score: 0.9,
      },
      reliability: { starts: 40, finishes: 36, finish_rate: 0.9, score: 0.88 },
      trend: { delta: 0.4, score: 0.7 },
    },
    circuit_history: [
      { season_year: 2025, event_short_name: "QAT", session_type: "RAC", position: 2, finished: true },
      { season_year: 2025, event_short_name: "QAT", session_type: "SPR", position: 5, finished: true },
      { season_year: 2024, event_short_name: "QAT", session_type: "RAC", position: null, finished: false },
    ],
    ...over,
  };
}

function respuesta(favorites: Favorite[]): FavoritesResponse {
  return {
    event: {
      id: "evt-qat",
      name: "Qatar",
      short_name: "QAT",
      date_start: "2026-03-06",
      circuit: { id: "lusail", name: "Lusail International Circuit", place: "Lusail" },
    },
    model: { weights: { circuit: 0.35, form: 0.3, bike: 0.2, reliability: 0.1, trend: 0.05 } },
    favorites,
  };
}

// Siete pilotos: solo se ven cinco hasta pulsar "Ver toda la parrilla".
export const favoritosMuchos = respuesta([1, 2, 3, 4, 5, 6, 7].map((n) => favorito(n)));

// Tres pilotos: no hay botón de parrilla.
export const favoritosPocos = respuesta([1, 2, 3].map((n) => favorito(n)));

export const favoritosVacios = respuesta([]);

// Primer piloto sin carreras en el circuito, sin historial, sin constructor y sin tendencia.
export const favoritosSinHistorial = respuesta([
  favorito(1, {
    circuit_history: [],
    breakdown: {
      ...favorito(1).breakdown,
      circuit: { ...favorito(1).breakdown.circuit, races: 0, finishes: 0, dnfs: 0, wins: 0, podiums: 0, best_position: null, average_position: null, position_spread: null },
      bike: { ...favorito(1).breakdown.bike, constructor_name: null },
      trend: { delta: 0, score: 0.5 },
    },
  }),
  favorito(2, {
    breakdown: { ...favorito(2).breakdown, trend: { delta: -0.4, score: 0.3 } },
  }),
]);
