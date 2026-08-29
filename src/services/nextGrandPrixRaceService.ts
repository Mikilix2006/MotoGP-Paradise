import {
getEventsBySeason,
findEventByCircuitId,
} from "./grandPrixService";

import {
getSessionsByEvent,
getMainRaceSession,
} from "./sessionService";

import type {
MotoGPSeason,
} from "@/types/season";

import type {
Circuit,
} from "@/types/grandPrix";

import type {
MotoGPSession,
} from "@/types/session";

export interface NextGrandPrixRace {
eventUuid: string;
sessionUuid: string;

race: MotoGPSession;
}

export async function getNextGrandPrixRace(
season: MotoGPSeason,
circuit: Circuit,
categoryUuid: string
): Promise<NextGrandPrixRace | null> {

/*

* 1. Obtener todos los eventos
* de la temporada actual.
  */
  const events =
  await getEventsBySeason(season.id);

/*

* 2. Encontrar el evento cuyo circuito
* coincide con el circuito actual.
  */
  const event =
  findEventByCircuitId(
  events,
  circuit.id
  );

if (!event) {
return null;
}

/*

* 3. Obtener el UUID del evento.
  */
  const eventUuid =
  event.id;

/*

* 4. Obtener todas las sesiones
* para ese evento y categoría.
  */
  const sessions =
  await getSessionsByEvent(
  eventUuid,
  categoryUuid
  );

/*

* 5. Encontrar la carrera principal.
  */
  const mainRace =
  getMainRaceSession(
  sessions,
  categoryUuid
);

if (!mainRace) {
return null;
}

/*

* 6. Devolver información reutilizable.
  */
  return {
  eventUuid,
  sessionUuid: mainRace.id,
  race: mainRace,
  };
  }
