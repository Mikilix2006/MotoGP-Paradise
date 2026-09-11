import { prisma } from "@/lib/prisma";
import { fetchMotoGPApi } from "@/services/motogp/apiClient";

interface ApiRiderStatistic {
  season?: string | number | null;
  category?: string | null;
  rider?: string | null;
  constructor?: string | null;

  starts?: number | null;
  first_position?: number | null;
  second_position?: number | null;
  third_position?: number | null;
  podiums?: number | null;
  poles?: number | null;
  points?: number | null;
  position?: number | null;
}

export interface RiderStatisticsImportResult {
  ridersProcessed: number;
  ridersSkipped: number;
  statisticsProcessed: number;
  statisticsCreated: number;
  statisticsUpdated: number;
  statisticsSkipped: number;
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace("™", "")
    .replace(/\s+/g, " ");
}

export async function importRiderStatistics(): Promise<RiderStatisticsImportResult> {
  const riders = await prisma.rider.findMany({
    where: {
      legacyId: {
        not: null,
      },
    },

    orderBy: {
      legacyId: "asc",
    },
  });

  let ridersProcessed = 0;
  let ridersSkipped = 0;
  let statisticsProcessed = 0;
  let statisticsCreated = 0;
  let statisticsUpdated = 0;
  let statisticsSkipped = 0;

  /*
   * Cargamos temporadas, categorías y constructores una sola vez.
   * Esto evita hacer búsquedas repetidas en cada estadística.
   */
  const seasons = await prisma.season.findMany();

  const categories = await prisma.category.findMany();

  const constructors = await prisma.constructor.findMany();

  const seasonsByYear = new Map(
    seasons.map((season) => [
      season.year,
      season,
    ])
  );

  const categoriesByName = new Map(
    categories.map((category) => [
      normalizeName(category.name),
      category,
    ])
  );

  const constructorsByName = new Map(
    constructors.map((constructor) => [
      normalizeName(constructor.name),
      constructor,
    ])
  );

  for (const rider of riders) {
    if (rider.legacyId === null) {
      ridersSkipped++;
      continue;
    }

    console.log(
      `🏍️ Importando estadísticas de: ${
        rider.fullName ?? `Rider ${rider.legacyId}`
      } (${rider.legacyId})`
    );

    let statistics: ApiRiderStatistic[];

    try {
      statistics =
        await fetchMotoGPApi<ApiRiderStatistic[]>(
            `/riders/${rider.legacyId}/statistics`
        );
    } catch (error) {
      console.warn(
        `⚠️ No se pudieron obtener estadísticas del piloto ${rider.legacyId}`
      );

      console.warn(error);

      ridersSkipped++;
      continue;
    }

    ridersProcessed++;

    for (const item of statistics) {
      statisticsProcessed++;

      /*
       * ============================================================
       * SEASON
       * ============================================================
       */

      const seasonYear = Number(item.season);

      if (!Number.isFinite(seasonYear)) {
        console.warn(
          `⚠️ Temporada inválida para ${rider.fullName}: ${item.season}`
        );

        statisticsSkipped++;
        continue;
      }

      const season = seasonsByYear.get(seasonYear);

      if (!season) {
        console.warn(
          `⚠️ Temporada ${seasonYear} no encontrada en la base de datos`
        );

        statisticsSkipped++;
        continue;
      }

      /*
       * ============================================================
       * CATEGORY
       * ============================================================
       */

      if (!item.category) {
        console.warn(
          `⚠️ Estadística sin categoría para ${rider.fullName} (${seasonYear})`
        );

        statisticsSkipped++;
        continue;
      }

      const normalizedCategory =
        normalizeName(item.category);

      const category =
        categoriesByName.get(normalizedCategory);

      if (!category) {
        console.warn(
          `⚠️ Categoría no encontrada: ${item.category} (${seasonYear})`
        );

        statisticsSkipped++;
        continue;
      }

      /*
       * ============================================================
       * CONSTRUCTOR
       * ============================================================
       *
       * La API solo proporciona el nombre.
       */

      let constructorId: string | null = null;

      if (item.constructor) {
        const constructor =
          constructorsByName.get(
            normalizeName(item.constructor)
          );

        if (constructor) {
          constructorId = constructor.id;
        } else {
          console.warn(
            `⚠️ Constructor no encontrado: ${item.constructor}`
          );
        }
      }

      /*
       * ============================================================
       * RIDER SEASON STATISTICS
       * ============================================================
       */

      const existingStatistic =
        await prisma.riderSeasonStatistics.findUnique({
          where: {
            riderId_seasonId_categoryId: {
              riderId: rider.id,
              seasonId: season.id,
              categoryId: category.id,
            },
          },
        });

      const statisticsData = {
        constructorId,

        starts: item.starts ?? null,

        wins:
          item.first_position ?? null,

        secondPlaces:
          item.second_position ?? null,

        thirdPlaces:
          item.third_position ?? null,

        podiums:
          item.podiums ?? null,

        poles:
          item.poles ?? null,

        points:
          item.points ?? null,

        championshipPosition:
          item.position ?? null,
      };

      await prisma.riderSeasonStatistics.upsert({
        where: {
          riderId_seasonId_categoryId: {
            riderId: rider.id,
            seasonId: season.id,
            categoryId: category.id,
          },
        },

        create: {
          riderId: rider.id,
          seasonId: season.id,
          categoryId: category.id,
          ...statisticsData,
        },

        update: statisticsData,
      });

      if (existingStatistic) {
        statisticsUpdated++;
      } else {
        statisticsCreated++;
      }
    }
  }

  return {
    ridersProcessed,
    ridersSkipped,
    statisticsProcessed,
    statisticsCreated,
    statisticsUpdated,
    statisticsSkipped,
  };
}