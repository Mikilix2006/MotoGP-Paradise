export interface Country {
iso: string;
name: string;
region_iso: string;
}

export interface EventFile {
url: string;
menu_position: number;
}

export interface EventFiles {
circuit_information: EventFile;
podiums: EventFile;
pole_positions: EventFile;
nations_statistics: EventFile;
riders_all_time: EventFile;
}

export interface Circuit {
id: string;
name: string;
legacy_id: number;
place: string;
nation: string;
events_id: string | null;
}

export interface LegacyEventId {
categoryId: number;
eventId: number;
}

export interface EventSeason {
id: string;
year: number;
current: boolean;
}

export type EventStatus =
| "FINISHED"
| "CURRENT"
| "NOT-STARTED";

export interface MotoGPEvent {
id: string;

country: Country;
circuit: Circuit;

sponsored_name: string;
additional_name: string;
name: string;
short_name: string;

date_start: string;
date_end: string;

legacy_id: LegacyEventId[];

status: string;
}
