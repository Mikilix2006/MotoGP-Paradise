import { prisma } from "@/lib/prisma";
import { fetchMotoGPResults } from "@/services/motogp/resultsClient";

interface MotoGPCategoryApi {
  id: string | null;
  legacy_id: number | null;
  name: string | null;

  acronym?: string | null;
  timing_id?: string | null;
  priority?: number | null;

  // Datos específicos del evento
  num_laps?: number | null;
  sprint_num_laps?: number | null;
  distance?: number | null;
  distance_km?: number | null;
  red_flag_laps?: number | null;
  sprint_red_flag_laps?: number | null;
  sequence?: number | null;
}

export interface EventCategoryImportResult {
  eventsProcessed: number;
  categoriesProcessed: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  eventCategoriesCreated: number;
  eventCategoriesUpdated: number;
}

/* Nombre de la categoría legacy_id 3 desde 2002 (hasta 2001 la API la llama «500cc»). */
const MOTOGP_CATEGORY_NAME = "MotoGP™";

export interface ImportOptions {
  seasonYear?: number;
}

export async function importEventCategories(
  options: ImportOptions = {}
): Promise<EventCategoryImportResult> {
  const events = await prisma.event.findMany({
    where: {
      resultsUuid: {
        not: null,
      },

      ...(options.seasonYear !== undefined
        ? { season: { year: options.seasonYear } }
        : {}),
    },

    orderBy: {
      dateStart: "asc",
    },
  });

  let categoriesProcessed = 0;
  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let eventCategoriesCreated = 0;
  let eventCategoriesUpdated = 0;

  for (const event of events) {
    if (!event.resultsUuid) {
      continue;
    }

    console.log(
      `🏍️ Importando categorías del evento: ${event.name}`
    );

    let categories: MotoGPCategoryApi[];

    try {
      categories = await fetchMotoGPResults<MotoGPCategoryApi[]>(
        `/categories?eventUuid=${event.resultsUuid}`
      );
    } catch (error) {
      console.warn(
        `⚠️ No se pudieron obtener categorías para: ${event.name}`
      );

      console.warn(error);

      continue;
    }

    for (const apiCategory of categories) {
      categoriesProcessed++;

      /*
       * ============================================================
       * VALIDACIÓN MÍNIMA
       * ============================================================
       */

      if (!apiCategory.id) {
        console.warn(
          `⚠️ Categoría sin UUID en el evento: ${event.name}`
        );

        continue;
      }

      const categoryName =
        apiCategory.name?.trim() ||
        `Unknown Category ${apiCategory.id}`;

      /*
       * ============================================================
       * CATEGORY
       * ============================================================
       */

      const existingCategory = await prisma.category.findUnique({
        where: {
          motogpUuid: apiCategory.id,
        },
      });

      /*
       * Hasta 2001 la API de resultados llama «500cc» a la clase
       * reina con el MISMO uuid y legacy_id 3 que MotoGP. Si se
       * procesara tal cual, renombraría la fila MotoGP a «500cc» (y
       * vaciaría acronym/timing_id, que esos eventos no traen),
       * rompiendo la búsqueda por nombre de riderStatisticsImporter.
       * La fila «500cc» real (legacy_id -1) es otra y la siembra una
       * migración; aquí solo se conserva la fila existente. Si la fila
       * aún no existe (BD vacía cuyo primer evento es anterior a 2002),
       * se crea con el nombre de MotoGP; los eventos posteriores
       * completan acronym/timing_id/priority.
       */
      const isLegacy500cc =
        apiCategory.legacy_id === 3 &&
        categoryName.toLowerCase() === "500cc";

      const category = await prisma.category.upsert({
        where: {
          motogpUuid: apiCategory.id,
        },

        create: {
          motogpUuid: apiCategory.id,
          legacyId: apiCategory.legacy_id,
          name: isLegacy500cc ? MOTOGP_CATEGORY_NAME : categoryName,
          acronym: apiCategory.acronym || null,
          timingId: apiCategory.timing_id || null,
          priority: apiCategory.priority ?? null,
          active: true,
        },

        update: isLegacy500cc
          ? { legacyId: apiCategory.legacy_id }
          : {
              legacyId: apiCategory.legacy_id,
              name: categoryName,
              acronym: apiCategory.acronym || null,
              timingId: apiCategory.timing_id || null,
              priority: apiCategory.priority ?? null,
            },
      });

      if (existingCategory) {
        categoriesUpdated++;
      } else {
        categoriesCreated++;
      }

      /*
       * ============================================================
       * EVENT CATEGORY
       * ============================================================
       */

      const existingEventCategory =
        await prisma.eventCategory.findUnique({
          where: {
            eventId_categoryId: {
              eventId: event.id,
              categoryId: category.id,
            },
          },
        });

      await prisma.eventCategory.upsert({
        where: {
          eventId_categoryId: {
            eventId: event.id,
            categoryId: category.id,
          },
        },

        create: {
          eventId: event.id,
          categoryId: category.id,

          numLaps: apiCategory.num_laps ?? null,
          sprintNumLaps:
            apiCategory.sprint_num_laps ?? null,

          distanceMeters:
            apiCategory.distance ?? null,

          distanceKm:
            apiCategory.distance_km ?? null,

          redFlagLaps:
            apiCategory.red_flag_laps ?? null,

          sprintRedFlagLaps:
            apiCategory.sprint_red_flag_laps ?? null,

          sequence:
            apiCategory.sequence ?? null,
        },

        update: {
          numLaps: apiCategory.num_laps ?? null,

          sprintNumLaps:
            apiCategory.sprint_num_laps ?? null,

          distanceMeters:
            apiCategory.distance ?? null,

          distanceKm:
            apiCategory.distance_km ?? null,

          redFlagLaps:
            apiCategory.red_flag_laps ?? null,

          sprintRedFlagLaps:
            apiCategory.sprint_red_flag_laps ?? null,

          sequence:
            apiCategory.sequence ?? null,
        },
      });

      if (existingEventCategory) {
        eventCategoriesUpdated++;
      } else {
        eventCategoriesCreated++;
      }
    }
  }

  return {
    eventsProcessed: events.length,
    categoriesProcessed,
    categoriesCreated,
    categoriesUpdated,
    eventCategoriesCreated,
    eventCategoriesUpdated,
  };
}