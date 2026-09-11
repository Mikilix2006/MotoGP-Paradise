import { prisma } from "@/lib/prisma";
import { fetchMotoGPApi } from "@/services/motogp/apiClient";
import { upsertRider } from "@/services/importers/riderResolver";

/*
 * ============================================================
 * IMPORTADOR DE PILOTOS
 * ============================================================
 *
 * Fuentes:
 *
 *   /riders?seasonUuid={uuid}   listado de pilotos por temporada
 *   /riders/{uuid}              ficha completa + career[]
 *
 * El listado por temporada solo sirve para saber qué pilotos
 * participaron: su current_career_step siempre corresponde a la
 * temporada actual, no a la consultada. El histórico real está
 * en career[] de la ficha individual.
 *
 * Rellena: Rider, Team, Constructor, RiderSeasonEntry y
 * RiderSeasonImage.
 */

interface ApiCountry {
  iso?: string | null;
  name?: string | null;
}

interface ApiCategoryRef {
  id?: string | null;
  name?: string | null;
  legacy_id?: number | null;
}

interface ApiConstructorRef {
  id?: string | null;
  name?: string | null;
  legacy_id?: number | null;
}

interface ApiTeamRef {
  id?: string | null;
  name?: string | null;
  legacy_id?: number | null;
  type?: string | null;
  color?: string | null;
  text_color?: string | null;
  background_picture?: string | null;
  picture?: string | null;
  constructor?: ApiConstructorRef | null;
  category?: ApiCategoryRef | null;
}

interface ApiPicturePair {
  main?: string | null;
  secondary?: string | null;
}

interface ApiPictures {
  profile?: ApiPicturePair | null;
  bike?: ApiPicturePair | null;
  helmet?: ApiPicturePair | null;
  number?: string | ApiPicturePair | null;
  portrait?: string | ApiPicturePair | null;
}

interface ApiCareerStep {
  id?: string | null;
  season?: number | null;
  number?: number | null;
  sponsored_team?: string | null;
  team?: ApiTeamRef | null;
  category?: ApiCategoryRef | null;
  in_grid?: boolean | null;
  short_nickname?: string | null;
  current?: boolean | null;
  pictures?: ApiPictures | null;
  type?: string | null;
}

interface ApiRiderListItem {
  id?: string | null;
  legacy_id?: number | null;
}

interface ApiRiderDetail {
  id?: string | null;
  legacy_id?: number | null;

  name?: string | null;
  surname?: string | null;
  nickname?: string | null;

  birth_date?: string | null;
  birth_city?: string | null;
  start_year?: number | null;
  legend?: boolean | null;

  country?: ApiCountry | null;

  career?: ApiCareerStep[] | null;
}

export interface RiderImportResult {
  seasonsProcessed: number;
  ridersFound: number;
  ridersProcessed: number;
  ridersSkipped: number;

  entriesCreated: number;
  entriesUpdated: number;
  entriesSkipped: number;

  imagesProcessed: number;
  teamsProcessed: number;
  constructorsProcessed: number;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toPicturePair(
  value: string | ApiPicturePair | null | undefined
): ApiPicturePair | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      main: value,
      secondary: null,
    };
  }

  return value;
}

export interface ImportOptions {
  /*
   * Limita el listado de pilotos a una temporada concreta.
   * La ficha individual sigue trayendo todo su historial.
   */
  seasonYear?: number;
}

export async function importRiders(
  options: ImportOptions = {}
): Promise<RiderImportResult> {
  const result: RiderImportResult = {
    seasonsProcessed: 0,
    ridersFound: 0,
    ridersProcessed: 0,
    ridersSkipped: 0,
    entriesCreated: 0,
    entriesUpdated: 0,
    entriesSkipped: 0,
    imagesProcessed: 0,
    teamsProcessed: 0,
    constructorsProcessed: 0,
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

  /*
   * 1. Recopilar los UUID de piloto de todas las temporadas.
   */
  const riderUuids = new Set<string>();

  for (const season of seasons) {
    if (!season.motogpUuid) {
      continue;
    }

    let riders: ApiRiderListItem[];

    try {
      riders = await fetchMotoGPApi<ApiRiderListItem[]>(
        `/riders?seasonUuid=${season.motogpUuid}`
      );
    } catch (error) {
      console.warn(
        `⚠️ No se pudo obtener el listado de pilotos de ${season.year}`
      );

      console.warn(error);

      continue;
    }

    result.seasonsProcessed++;

    for (const rider of riders) {
      if (rider.id) {
        riderUuids.add(rider.id);
      }
    }

    console.log(
      `📅 ${season.year}: ${riders.length} pilotos`
    );
  }

  result.ridersFound = riderUuids.size;

  /*
   * 2. Cachear temporadas y categorías para resolver
   *    las relaciones sin repetir consultas.
   *
   * El mapa se construye con TODAS las temporadas, no solo con
   * las filtradas: aunque se acote el listado de pilotos a una
   * temporada, su ficha trae el historial completo y esas
   * entradas también deben poder guardarse.
   */
  const allSeasons = await prisma.season.findMany();

  const seasonsByYear = new Map(
    allSeasons.map((season) => [season.year, season])
  );

  const categories = await prisma.category.findMany();

  const categoriesByLegacyId = new Map(
    categories
      .filter((category) => category.legacyId !== null)
      .map((category) => [
        category.legacyId as number,
        category,
      ])
  );

  /*
   * 3. Ficha completa de cada piloto.
   */
  for (const riderUuid of riderUuids) {
    let detail: ApiRiderDetail;

    try {
      detail = await fetchMotoGPApi<ApiRiderDetail>(
        `/riders/${riderUuid}`
      );
    } catch (error) {
      console.warn(
        `⚠️ No se pudo obtener la ficha del piloto ${riderUuid}`
      );

      console.warn(error);

      result.ridersSkipped++;
      continue;
    }

    if (!detail.id) {
      result.ridersSkipped++;
      continue;
    }

    /*
     * PAÍS
     */
    let countryId: string | null = null;

    if (detail.country?.iso) {
      const iso = detail.country.iso.trim();

      const country = await prisma.country.upsert({
        where: {
          iso,
        },

        create: {
          iso,
          name: detail.country.name?.trim() || iso,
        },

        update: {
          name: detail.country.name?.trim() || iso,
        },
      });

      countryId = country.id;
    }

    /*
     * PILOTO
     */
    const fullName =
      detail.name && detail.surname
        ? `${detail.name} ${detail.surname}`
        : detail.surname ?? detail.name ?? null;

    /*
     * El id de esta API es el riders_api_uuid de la API de
     * resultados, no su rider.id: la identidad se resuelve por
     * legacy_id para no crear una segunda fila del mismo piloto
     * (ver riderResolver.ts).
     */
    const { rider } = await upsertRider(
      {
        legacyId: detail.legacy_id ?? null,
        ridersApiUuid: detail.id,
      },
      {
        fullName,
        firstName: detail.name ?? null,
        lastName: detail.surname ?? null,
        birthDate: toDate(detail.birth_date),
        birthCity: detail.birth_city ?? null,
        startYear: detail.start_year ?? null,
        legend: detail.legend ?? null,
        countryId,
      }
    );

    result.ridersProcessed++;

    console.log(
      `🏍️ ${fullName ?? detail.id} (${detail.career?.length ?? 0} temporadas)`
    );

    /*
     * ENTRADAS POR TEMPORADA
     */
    for (const step of detail.career ?? []) {
      const season =
        step.season !== null && step.season !== undefined
          ? seasonsByYear.get(step.season)
          : undefined;

      const categoryLegacyId =
        step.category?.legacy_id ??
        step.team?.category?.legacy_id ??
        null;

      const category =
        categoryLegacyId !== null
          ? categoriesByLegacyId.get(categoryLegacyId)
          : undefined;

      /*
       * Sin temporada o categoría en la base de datos no se
       * puede crear la entrada, ya que ambas son obligatorias.
       */
      if (!season || !category) {
        result.entriesSkipped++;
        continue;
      }

      /*
       * EQUIPO
       */
      let teamId: string | null = null;

      const apiTeam = step.team;

      if (apiTeam?.id && apiTeam.name) {
        const teamData = {
          legacyId: apiTeam.legacy_id ?? null,
          name: apiTeam.name,
          type: apiTeam.type ?? null,
          color: apiTeam.color ?? null,
          textColor: apiTeam.text_color ?? null,
          backgroundPicture: apiTeam.background_picture ?? null,
          picture: apiTeam.picture ?? null,
        };

        const team = await prisma.team.upsert({
          where: {
            motogpUuid: apiTeam.id,
          },

          create: {
            motogpUuid: apiTeam.id,
            ...teamData,
          },

          update: teamData,
        });

        teamId = team.id;
        result.teamsProcessed++;
      }

      /*
       * CONSTRUCTOR
       */
      let constructorId: string | null = null;

      const apiConstructor = apiTeam?.constructor;

      if (apiConstructor?.id && apiConstructor.name) {
        /*
         * Los constructores ya pueden existir importados desde la
         * API de resultados con OTRO uuid, pero el legacy_id sí
         * coincide entre ambas APIs. Se busca primero por él para
         * no duplicar la misma marca.
         */
        const existingConstructor =
          apiConstructor.legacy_id !== null &&
          apiConstructor.legacy_id !== undefined
            ? await prisma.constructor.findFirst({
                where: {
                  legacyId: apiConstructor.legacy_id,
                },

                orderBy: {
                  createdAt: "asc",
                },
              })
            : null;

        const constructor = existingConstructor
          ? await prisma.constructor.update({
              where: {
                id: existingConstructor.id,
              },

              data: {
                name: apiConstructor.name,
              },
            })
          : await prisma.constructor.upsert({
              where: {
                motogpUuid: apiConstructor.id,
              },

              create: {
                motogpUuid: apiConstructor.id,
                legacyId: apiConstructor.legacy_id ?? null,
                name: apiConstructor.name,
              },

              update: {
                legacyId: apiConstructor.legacy_id ?? null,
                name: apiConstructor.name,
              },
            });

        constructorId = constructor.id;
        result.constructorsProcessed++;
      }

      /*
       * ENTRADA
       */
      const entryData = {
        motogpUuid: step.id ?? null,
        teamId,
        constructorId,
        number: step.number ?? null,
        sponsoredTeam: step.sponsored_team ?? null,
        inGrid: step.in_grid ?? null,
        current: step.current ?? false,
        shortNickname: step.short_nickname ?? null,
        type: step.type ?? null,
      };

      const existingEntry =
        await prisma.riderSeasonEntry.findUnique({
          where: {
            riderId_seasonId_categoryId: {
              riderId: rider.id,
              seasonId: season.id,
              categoryId: category.id,
            },
          },
        });

      const entry = await prisma.riderSeasonEntry.upsert({
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
          ...entryData,
        },

        update: entryData,
      });

      if (existingEntry) {
        result.entriesUpdated++;
      } else {
        result.entriesCreated++;
      }

      /*
       * IMÁGENES DE LA ENTRADA
       */
      const pictures = step.pictures;

      if (pictures) {
        const imageTypes: Array<[string, ApiPicturePair | null]> = [
          ["PROFILE", toPicturePair(pictures.profile)],
          ["BIKE", toPicturePair(pictures.bike)],
          ["HELMET", toPicturePair(pictures.helmet)],
          ["NUMBER", toPicturePair(pictures.number)],
          ["PORTRAIT", toPicturePair(pictures.portrait)],
        ];

        for (const [type, pair] of imageTypes) {
          if (!pair?.main && !pair?.secondary) {
            continue;
          }

          await prisma.riderSeasonImage.upsert({
            where: {
              riderSeasonEntryId_type: {
                riderSeasonEntryId: entry.id,
                type,
              },
            },

            create: {
              riderSeasonEntryId: entry.id,
              type,
              mainUrl: pair.main ?? null,
              secondaryUrl: pair.secondary ?? null,
            },

            update: {
              mainUrl: pair.main ?? null,
              secondaryUrl: pair.secondary ?? null,
            },
          });

          result.imagesProcessed++;
        }
      }
    }
  }

  return result;
}
