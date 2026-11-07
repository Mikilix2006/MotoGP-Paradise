// Fixtures escritos a mano: pilotos del carrusel con todos los huecos que admite el contrato.
import type { RiderCarouselItem, RiderCarouselResponse, RiderTrajectoryStep } from "@/types/riderCarousel";

export const piloto = (o: Partial<RiderCarouselItem> = {}): RiderCarouselItem => ({
  id: "r1",
  legacy_id: 1,
  full_name: "Piloto Uno",
  number: 93,
  country: { iso: "ES", name: "España", flag_url: null },
  team: { name: "Equipo Rojo", color: "#ad0000", text_color: null },
  constructor_name: "Ducati",
  birth_date: "1993-02-17",
  birth_city: "Cervera",
  image_url: "https://photos.motogp.com/uno.png",
  biography: "Biografía corta.",
  season_stats: { position: 1, points: 300, wins: 5, podiums: 10, poles: 3, sprint_wins: 4 },
  career: { starts: 200, wins: 50, podiums: 100, poles: 60, titles: [] },
  motogp: { wins: 40, poles: 50, premier_wins: 40, premier_poles: 50, sprint_wins: 10 },
  trajectory: [],
  ...o,
});

export const respuesta = (riders: RiderCarouselItem[], category: "MotoGP" | "Moto2" | "Moto3" = "MotoGP"): RiderCarouselResponse => ({
  season: 2026,
  category,
  riders,
});

export const paso = (year: number, o: Partial<RiderTrajectoryStep> = {}): RiderTrajectoryStep => ({
  year,
  category: "Moto2™",
  team_name: "Equipo A",
  constructor_name: "Kalex",
  number: 10,
  ...o,
});
