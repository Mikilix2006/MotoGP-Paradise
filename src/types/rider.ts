export interface RiderCountry {
  iso: string;
  name: string;
}

export interface RiderTeam {
  id: string;
  name: string;
  legacy_id: number;
}

export interface RiderStatistics {
  constructor: string;
  starts: number;
  first_position: number;
  second_position: number;
  third_position: number;
  podiums: number;
  poles: number;
  points: number;
  position: number;
}

export interface MotoGPRider {
  id: string;
  full_name: string;

  country: RiderCountry;

  legacy_id: number;
  riders_id: string;
  number: number;

  team: RiderTeam;

  statistics: RiderStatistics;
}

/**
 * Estructura original recibida desde
 * /results/standings/bmwaward
 */
export interface BMWAwardRider {
  id: string;

  position: number;

  rider: {
    id: string;
    full_name: string;

    country: {
      iso: string;
      name: string;
      region_iso?: string;
    };

    legacy_id: number;
    riders_id: string;
    number: number;
  };

  team: {
    id: string;
    name: string;
    legacy_id: number;
  };

  constructor: {
    id: string;
    name: string;
    legacy_id: number;
  };

  points: number;
}

/**
 * Respuesta individual de
 * /riders/{legacy_id}/statistics
 */
export interface RiderStatisticsApiResponse {
  season: string;
  category: string;
  rider: string;
  constructor: string;

  starts: number;

  first_position: number;
  second_position: number;
  third_position: number;

  podiums: number;
  poles: number;

  points: number;
  position: number;
}