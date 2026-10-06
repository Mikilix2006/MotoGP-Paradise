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

/** URL de la bandera oficial del GP; null en temporadas sin importar. */
flag_url: string | null;

date_start: string;
date_end: string;

legacy_id: LegacyEventId[];

status: string;
}

/**
 * Sesión (Moto3, Moto2 o MotoGP) dentro del calendario. `date_start` es el
 * instante absoluto correcto (ISO UTC) ya convertido desde la hora
 * local del circuito; null si el evento no tiene zona horaria o la
 * sesión no tiene fecha. `weekday` es el día de la semana LOCAL del
 * circuito (0 = domingo ... 6 = sábado), para agrupar por días
 * Viernes/Sábado/Domingo sin depender de la zona del usuario.
 */
export interface CalendarSession {
id: string;
shortname: string;
name: string;
type: string;
status: string;
date_start: string | null;
weekday: number | null;
/** Categoría para mostrar tal cual: "MotoGP", "Moto2" o "Moto3". */
category: string;
/** Id legacy de la categoría: 1 = Moto3, 2 = Moto2, 3 = MotoGP. */
category_legacy_id: number;
}
