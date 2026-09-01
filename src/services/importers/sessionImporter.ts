import { prisma } from "@/lib/prisma";
import { fetchMotoGPResults } from "@/services/motogp/resultsClient";

interface MotoGPSessionApi {
  id: string | null;
  date: string | null;
  number: number | null;
  type: string | null;
  status: string | null;

  category?: {
    id: string | null;
    legacy_id?: number | null;
    name?: string | null;
  } | null;

  event?: {
    id?: string | null;
  } | null;

  condition?: {
    track?: string | null;
    air?: string | null;
    humidity?: string | null;
    ground?: string | null;
    weather?: string | null;
  } | null;
}

export interface SessionImportResult {
  eventCategoriesProcessed: number;
  sessionsProcessed: number;
  sessionsCreated: number;
  sessionsUpdated: number;
  eventsSkipped: number;
}

export async function importSessions(): Promise<SessionImportResult> {
  const eventCategories = await prisma.eventCategory.findMany({
    include: {
      event: true,
      category: true,
    },
    orderBy: {
      event: {
        dateStart: "asc",
      },
    },
  });

  let sessionsProcessed = 0;
  let sessionsCreated = 0;
  let sessionsUpdated = 0;
  let eventsSkipped = 0;

  for (const eventCategory of eventCategories) {
    const { event, category } = eventCategory;

    if (!event.resultsUuid || !category.motogpUuid) {
      console.warn(
        `⚠️ Saltando combinación sin UUID: ${event.name} / ${category.name}`
      );

      eventsSkipped++;
      continue;
    }

    console.log(
      `🏍️ ${event.name} → ${category.name}`
    );

    let sessions: MotoGPSessionApi[];

    try {
      sessions = await fetchMotoGPResults<MotoGPSessionApi[]>(
        `/sessions?eventUuid=${event.resultsUuid}&categoryUuid=${category.motogpUuid}`
      );
    } catch (error) {
      console.warn(
        `⚠️ No se pudieron obtener sesiones: ${event.name} / ${category.name}`
      );

      console.warn(error);

      eventsSkipped++;
      continue;
    }

    for (const apiSession of sessions) {
      sessionsProcessed++;

      if (!apiSession.id) {
        console.warn(
          `⚠️ Sesión sin UUID en ${event.name} / ${category.name}`
        );

        continue;
      }

      /*
       * Validación adicional:
       *
       * Aunque la API se consulta con eventUuid y categoryUuid,
       * si la respuesta trae category.id y no coincide,
       * se ignora para evitar relaciones incorrectas.
       */
      if (
        apiSession.category?.id &&
        apiSession.category.id !== category.motogpUuid
      ) {
        console.warn(
          `⚠️ Categoría de sesión no coincide en ${event.name}`
        );

        continue;
      }

      const existingSession = await prisma.session.findUnique({
        where: {
          resultsUuid: apiSession.id,
        },
      });

      await prisma.session.upsert({
        where: {
          resultsUuid: apiSession.id,
        },

        create: {
          resultsUuid: apiSession.id,

          eventId: event.id,
          categoryId: category.id,

          /*
           * El endpoint /results/sessions mostrado en el README
           * no proporciona estos campos.
           */
          shortname: null,
          name: null,
          kind: null,

          type: apiSession.type,
          status: apiSession.status,

          dateStart: apiSession.date
            ? new Date(apiSession.date)
            : null,

          dateEnd: null,

          numLaps: null,
          progressive: null,
          gpDay: null,
          timingId: null,

          hasTiming: null,
          hasLive: null,
          hasReport: null,
          hasResults: null,
          hasOnDemand: null,
          isLive: null,
          isLiveTiming: null,
        },

        update: {
          eventId: event.id,
          categoryId: category.id,

          type: apiSession.type,
          status: apiSession.status,

          dateStart: apiSession.date
            ? new Date(apiSession.date)
            : null,
        },
      });

      if (existingSession) {
        sessionsUpdated++;
      } else {
        sessionsCreated++;
      }
    }
  }

  return {
    eventCategoriesProcessed: eventCategories.length,
    sessionsProcessed,
    sessionsCreated,
    sessionsUpdated,
    eventsSkipped,
  };
}