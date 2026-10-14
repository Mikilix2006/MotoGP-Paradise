/*
 * Forma de la respuesta de /api/riders/carousel?category=MotoGP|Moto2|Moto3.
 *
 * Contrato entre frontend-guardian (repositorio y ruta) y ui-designer (carrusel).
 * snake_case como el resto de respuestas del proyecto. Todo campo que pueda faltar
 * en los datos históricos es nullable: la interfaz debe aguantar cada null.
 */

export type CarouselCategory = "MotoGP" | "Moto2" | "Moto3";

export interface RiderCarouselResponse {
  season: number;
  category: CarouselCategory;
  riders: RiderCarouselItem[];
}

export interface RiderTitle {
  /** Nombre de categoría tal como está en la BD: "500cc", "MotoGP™", "Moto2™", "125cc"... */
  category: string;
  years: number[];
}

export interface RiderTrajectoryStep {
  year: number;
  category: string;
  team_name: string | null;
  constructor_name: string | null;
  number: number | null;
}

export interface RiderCarouselItem {
  id: string;
  legacy_id: number | null;
  full_name: string;
  number: number | null;
  country: { iso: string; name: string; flag_url: string | null } | null;
  team: { name: string; color: string | null; text_color: string | null } | null;
  constructor_name: string | null;
  birth_date: string | null; // ISO yyyy-mm-dd
  birth_city: string | null;

  /** Imagen PROFILE de la temporada actual; null si no existe (la interfaz avisa y lo registra en el log). */
  image_url: string | null;

  /** Biografía oficial en español, ya en texto plano (párrafos separados por "\n\n"); null si no hay. */
  biography: string | null;

  /** Temporada actual en la categoría del carrusel; null si aún no tiene datos. */
  season_stats: {
    position: number | null;
    points: number | null;
    wins: number;
    podiums: number;
    poles: number;
    /** Solo MotoGP; null en Moto2 y Moto3. */
    sprint_wins: number | null;
  } | null;

  /** Totales de toda la carrera, todas las categorías. Excluyen sprints. */
  career: {
    starts: number;
    wins: number;
    podiums: number;
    poles: number;
    /** Mundiales ganados (excluye la temporada en curso). */
    titles: RiderTitle[];
  };

  /**
   * Solo para pilotos del carrusel de MotoGP; null en Moto2 y Moto3 (no muestran
   * sprints ni victorias/poles de MotoGP). "premier" = 500cc + MotoGP (clase reina).
   */
  motogp: {
    wins: number;
    poles: number;
    premier_wins: number;
    premier_poles: number;
    sprint_wins: number;
  } | null;

  /** Un paso por temporada y categoría, de la más antigua a la más reciente. */
  trajectory: RiderTrajectoryStep[];
}
