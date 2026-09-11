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
