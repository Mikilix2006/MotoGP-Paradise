export type ResultsSection = "season" | "tests";

export interface ResultsEventOption {
  id: string;
  label: string;
}

export interface ResultsCategoryOption {
  legacy_id: number;
  label: string;
}

export interface ResultsSessionOption {
  shortname: string;
  label: string;
}

export interface ResultsSelected {
  year: number;
  event: string;
  category: number;
  session: string;
}

export interface ResultRow {
  position: number | null;
  rider_name: string;
  number: number | null;
  team_name: string | null;
  status: string | null;
  time: string | null;
  gap: string | null;
  fastest_lap: string | null;
  points: number | null;
  laps_completed: number | null;
}

export interface ResultsPayload {
  section: ResultsSection;
  years: number[];
  events: ResultsEventOption[];
  categories: ResultsCategoryOption[];
  sessions: ResultsSessionOption[];
  selected: ResultsSelected;
  is_race: boolean;
  rows: ResultRow[];
}
