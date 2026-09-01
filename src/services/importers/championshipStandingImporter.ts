import { prisma } from "@/lib/prisma";
import { fetchMotoGPResults } from "@/services/motogp/resultsClient";

import { saveApiSnapshot } from "./syncTracking";

/*
 * ============================================================
 * IMPORTADOR DE CLASIFICACIONES DEL CAMPEONATO
 * ============================================================
 *
 * Fuente: /standings?seasonUuid={uuid}&categoryUuid={uuid}
 *
 * Las categorías se recorren a partir de las que realmente
 * están asociadas a los eventos de cada temporada, porque el
 * UUID de categoría de la API de resultados no es el mismo en
 * todas las temporadas.
 *
 * La clasificación no viene ligada a un evento concreto: es la
 * foto del campeonato en el momento de la consulta, por lo que
 * eventId queda a null y la fecha se guarda en snapshotAt.
 */

interface ApiRider {
  id?: string | null;
  full_name?: string | null;
  legacy_id?: number | null;
}

interface ApiTeam {
  id?: string | null;
  name?: string | null;
  legacy_id?: number | null;
}

interface ApiConstructor {
  id?: string | null;
  name?: string | null;
  legacy_id?: number | null;
}

interface ApiStandingItem {
  id?: string | null;
  position?: number | null;
  points?: number | null;

  rider?: ApiRider | null;
  team?: ApiTeam | null;
  constructor?: ApiConstructor | null;
}

interface ApiStandingsResponse {
  classification?: ApiStandingItem[] | null;
}

export interface ChampionshipStandingImportResult {
  seasonsProcessed: number;
  combinationsProcessed: number;
  combinationsSkipped: number;

  standingsProcessed: number;
  standingsCreated: number;
  standingsUpdated: number;
  standingsSkipped: number;
}

async function findRiderId(
  rider: ApiRider
): Promise<string | null> {
  if (rider.id) {
    const byUuid = await prisma.rider.findFirst({
      where: {
        motogpUuid: rider.id,
      },
    });

    if (byUuid) {
      return byUuid.id;
    }
  }

  if (rider.legacy_id !== null && rider.legacy_id !== undefined) {
    const byLegacyId = await prisma.rider.findFirst({
      where: {
        legacyId: rider.legacy_id,
      },
    });

    if (byLegacyId) {
      return byLegacyId.id;
    }
  }

  return null;
}

async function findTeamId(
  team: ApiTeam | null | undefined
): Promise<string | null> {
  if (!team) {
    return null;
  }

  if (team.id) {
    const byUuid = await prisma.team.findFirst({
      where: {
        motogpUuid: team.id,
      },
    });

    if (byUuid) {
      return byUuid.id;
    }
  }

  if (team.legacy_id !== null && team.legacy_id !== undefined) {
    const byLegacyId = await prisma.team.findFirst({
      where: {
        legacyId: team.legacy_id,
      },
    });

    if (byLegacyId) {
      return byLegacyId.id;
    }
  }

  return null;
}

async function findConstructorId(
  constructor: ApiConstructor | null | undefined
): Promise<string | null> {
  if (!constructor) {
    return null;
  }

  if (constructor.id) {
    const byUuid = await prisma.constructor.findFirst({
      where: {
        motogpUuid: constructor.id,
      },
    });

    if (byUuid) {
      return byUuid.id;
    }
  }

  if (
    constructor.legacy_id !== null &&
    constructor.legacy_id !== undefined
  ) {
    const byLegacyId = await prisma.constructor.findFirst({
      where: {
        legacyId: constructor.legacy_id,
      },
    });

    if (byLegacyId) {
      return byLegacyId.id;
    }
  }

  return null;
}

export interface ImportOptions {
  seasonYear?: number;
}

export async function importChampionshipStandings(
  options: ImportOptions = {}
): Promise<ChampionshipStandingImportResult> {
  const result: ChampionshipStandingImportResult = {
    seasonsProcessed: 0,
    combinationsProcessed: 0,
    combinationsSkipped: 0,
    standingsProcessed: 0,
    standingsCreated: 0,
    standingsUpdated: 0,
    standingsSkipped: 0,
  };

  const seasons = await prisma.season.findMany({
    where: {
      motogpUuid: {
        not: null,
      },

      ...(options.seasonYear !== undefined
        ? { year: options.seasonYear }
        : {}),
    },

    orderBy: {
      year: "asc",
    },
  });

  for (const season of seasons) {
    if (!season.motogpUuid) {
      continue;
    }

    /*
     * Categorías realmente presentes en la temporada.
     */
    const eventCategories = await prisma.eventCategory.findMany({
      where: {
        event: {
          seasonId: season.id,
        },
      },

      include: {
        category: true,
      },

      distinct: ["categoryId"],
    });

    if (eventCategories.length === 0) {
      continue;
    }

    result.seasonsProcessed++;

    console.log(
      `🏆 Clasificaciones de ${season.year} (${eventCategories.length} categorías)...`
    );

    for (const eventCategory of eventCategories) {
      const category = eventCategory.category;

      if (!category.motogpUuid) {
        result.combinationsSkipped++;
        continue;
      }

      let response: ApiStandingsResponse;

      try {
        response = await fetchMotoGPResults<ApiStandingsResponse>(
          `/standings?seasonUuid=${season.motogpUuid}&categoryUuid=${category.motogpUuid}`
        );
      } catch (error) {
        console.warn(
          `⚠️ Sin clasificación para ${season.year} / ${category.name}`
        );

        console.warn(error);

        result.combinationsSkipped++;
        continue;
      }

      result.combinationsProcessed++;

      const classification = response.classification ?? [];

      await saveApiSnapshot({
        source: "RESULTS",
        endpoint: "/standings",

        requestParameters: {
          seasonUuid: season.motogpUuid,
          categoryUuid: category.motogpUuid,
        },

        entityType: "ChampionshipStanding",
        entityExternalId: `${season.motogpUuid}:${category.motogpUuid}`,

        payload: response,
      });

      const snapshotAt = new Date();

      for (const item of classification) {
        result.standingsProcessed++;

        if (!item.rider) {
          result.standingsSkipped++;
          continue;
        }

        const riderId = await findRiderId(item.rider);

        if (!riderId) {
          console.warn(
            `⚠️ Piloto no encontrado: ${
              item.rider.full_name ??
              item.rider.legacy_id ??
              "desconocido"
            }`
          );

          result.standingsSkipped++;
          continue;
        }

        const teamId = await findTeamId(item.team);

        const constructorId = await findConstructorId(
          item.constructor
        );

        const standingData = {
          teamId,
          constructorId,
          position: item.position ?? null,
          points: item.points ?? null,
          snapshotAt,
        };

        const existing =
          await prisma.championshipStanding.findUnique({
            where: {
              seasonId_categoryId_riderId: {
                seasonId: season.id,
                categoryId: category.id,
                riderId,
              },
            },
          });

        await prisma.championshipStanding.upsert({
          where: {
            seasonId_categoryId_riderId: {
              seasonId: season.id,
              categoryId: category.id,
              riderId,
            },
          },

          create: {
            seasonId: season.id,
            categoryId: category.id,
            riderId,
            ...standingData,
          },

          update: standingData,
        });

        if (existing) {
          result.standingsUpdated++;
        } else {
          result.standingsCreated++;
        }
      }

      console.log(
        `   ✅ ${category.name}: ${classification.length} posiciones`
      );
    }
  }

  return result;
}
