import { getCurrentSeason } from "./seasonService";

import {
  getCurrentGrandPrix,
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
   * 1. Obtener la temporada actual.
   */
  const season = await getCurrentSeason();

  if (!season) {
    return null;
  }

  const seasonUuid = season.id;

  /*
   * 2. Obtener el GP actual.
   *
   * Si no existe CURRENT,
   * getCurrentGrandPrix buscará el primer NOT-STARTED.
   */
  const selectedEvent =
    await getCurrentGrandPrix(
      seasonUuid
    );

  if (!selectedEvent) {
    return null;
  }

  const eventUuid =
    selectedEvent.id;

  /*
   * 3. Obtener las categorías del evento.
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
   * 4. Obtener las sesiones de MotoGP.
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
   * 6. Devolver la información completa.
   */
  return {
    seasonUuid,
    eventUuid,
    categoryUuid,
    sessionUuid,
    nextMotoGPRace,
  };
}