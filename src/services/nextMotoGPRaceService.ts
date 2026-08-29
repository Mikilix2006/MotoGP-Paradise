import { getCurrentSeason } from "./seasonService";

import {
getEventsBySeason,
} from "./grandPrixService";

import {
getCategoriesByEvent,
getMotoGPEventCategory,
} from "./categoryService";

import {
getSessionsByEvent,
getMainRaceSession,
} from "./sessionService";

export interface NextMotoGPRaceData {
seasonUuid: string;
eventUuid: string;
categoryUuid: string;
sessionUuid: string;

nextMotoGPRace: string;
}

export async function getNextMotoGPRace():
Promise<NextMotoGPRaceData | null> {

/*

* 1. Obtener temporada actual.
     */
     const season =
     await getCurrentSeason();

if (!season) {
return null;
}

const seasonUuid =
season.id;

/*

* 2. Obtener eventos de la temporada.
  */
  const events =
  await getEventsBySeason(
  seasonUuid
  );

const currentEvent =
events.find(
(event) =>
event.status === "CURRENT"
);

if (!currentEvent) {
return null;
}

const eventUuid =
currentEvent.id;

/*

* 3. Obtener categorías del evento.
  */
  const categories =
  await getCategoriesByEvent(
  eventUuid
  );

const motoGPCategory =
getMotoGPEventCategory(
categories
);

if (!motoGPCategory) {
return null;
}

const categoryUuid =
motoGPCategory.id;

/*

* 4. Obtener sesiones de MotoGP.
  */
  const sessions =
  await getSessionsByEvent(
  eventUuid,
  categoryUuid
  );

/*

* 5. Buscar la carrera principal.
  */
  const mainRace =
  getMainRaceSession(
  sessions,
  categoryUuid
  );

if (!mainRace) {
return null;
}

const sessionUuid =
mainRace.id;

const nextMotoGPRace =
mainRace.date;

/*

* 6. Devolver todos los IDs
* y la fecha exacta.
  */
  return {
  seasonUuid,
  eventUuid,
  categoryUuid,
  sessionUuid,
  nextMotoGPRace,
  };
  }
