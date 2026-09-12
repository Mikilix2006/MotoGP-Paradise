import { prisma } from "@/lib/prisma";
import { fetchMotoGPResults } from "@/services/motogp/resultsClient";
import { findRider as findRiderRecord } from "@/services/importers/riderResolver";

interface ApiCountry {
  iso?: string | null;
  name?: string | null;
  region_iso?: string | null;
}

interface ApiRider {
  id?: string | null;
  full_name?: string | null;
  country?: ApiCountry | null;
  legacy_id?: number | null;
  riders_id?: string | null;
  riders_api_uuid?: string | null;
  number?: number | null;
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

interface ApiEvent {
  id?: string | null;
  name?: string | null;
}

interface ApiBmwAwardClassification {
  id?: string | null;
  position?: number | null;

  rider?: ApiRider | null;
  team?: ApiTeam | null;
  constructor?: ApiConstructor | null;

  countryShortName?: string | null;

  points?: number | null;

  event?: ApiEvent | null;
}

interface ApiBmwAwardResponse {
  file?: string | null;

  classification?: ApiBmwAwardClassification[] | null;
}

export interface BmwAwardImportResult {
  seasonsProcessed: number;
  seasonsSkipped: number;

  standingsProcessed: number;
  standingsCreated: number;
  standingsUpdated: number;
  standingsSkipped: number;
}

/*
 * La identidad del piloto se resuelve por legacy_id (ver
 * riderResolver.ts). Solo se enlaza con pilotos ya importados:
 * aquí no se crean.
 */
async function findRider(
  rider: ApiRider
): Promise<string | null> {
  const existingRider = await findRiderRecord({
    legacyId: rider.legacy_id ?? null,
    resultsUuid: rider.id ?? null,
    ridersApiUuid: rider.riders_api_uuid ?? null,
    ridersId: rider.riders_id ?? null,
  });

  return existingRider?.id ?? null;
}

async function findTeam(
  team: ApiTeam | null | undefined
): Promise<string | null> {
  if (!team) {
    return null;
  }

  if (team.id) {
    const existingTeam =
      await prisma.team.findFirst({
        where: {
          motogpUuid: team.id,
        },
      });

    if (existingTeam) {
      return existingTeam.id;
    }
  }

  if (
    team.legacy_id !== null &&
    team.legacy_id !== undefined
  ) {
    const existingTeam =
      await prisma.team.findFirst({
        where: {
          legacyId: team.legacy_id,
        },
      });

    if (existingTeam) {
      return existingTeam.id;
    }
  }

  return null;
}

async function findConstructor(
  constructor: ApiConstructor | null | undefined
): Promise<string | null> {
  if (!constructor) {
    return null;
  }

  if (constructor.id) {
    const existingConstructor =
      await prisma.constructor.findFirst({
        where: {
          motogpUuid: constructor.id,
        },
      });

    if (existingConstructor) {
      return existingConstructor.id;
    }
  }

  if (
    constructor.legacy_id !== null &&
    constructor.legacy_id !== undefined
  ) {
    const existingConstructor =
      await prisma.constructor.findFirst({
        where: {
          legacyId: constructor.legacy_id,
        },
      });

    if (existingConstructor) {
      return existingConstructor.id;
    }
  }

  return null;
}

async function findEvent(
  event: ApiEvent | null | undefined
): Promise<string | null> {
  if (!event?.id) {
    return null;
  }

  /*
   * El endpoint BMW Award devuelve el UUID del evento.
   *
   * En la base de datos debemos buscarlo en los UUID externos
   * disponibles en Event.
   */

  const existingEvent =
    await prisma.event.findFirst({
      where: {
        OR: [
          {
            resultsUuid: event.id,
          },
          {
            broadcastUuid: event.id,
          },
          {
            toadApiUuid: event.id,
          },
        ],
      },
    });

  return existingEvent?.id ?? null;
}

export interface ImportOptions {
  seasonYear?: number;
}

export async function importBmwAwardStandings(
  options: ImportOptions = {}
): Promise<BmwAwardImportResult> {
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

  let seasonsProcessed = 0;
  let seasonsSkipped = 0;

  let standingsProcessed = 0;
  let standingsCreated = 0;
  let standingsUpdated = 0;
  let standingsSkipped = 0;

  for (const season of seasons) {
    if (!season.motogpUuid) {
      seasonsSkipped++;
      continue;
    }

    console.log(
      `🏁 Importando BMW Award de la temporada ${season.year}...`
    );

    let response: ApiBmwAwardResponse;

    try {
      response =
        await fetchMotoGPResults<ApiBmwAwardResponse>(
          `/standings/bmwaward?seasonUuid=${season.motogpUuid}`
        );
    } catch (error) {
      console.warn(
        `⚠️ No se pudo obtener BMW Award de ${season.year}`
      );

      console.warn(error);

      seasonsSkipped++;
      continue;
    }

    seasonsProcessed++;

    const classification =
      response.classification ?? [];

    for (const standing of classification) {
      standingsProcessed++;

      if (!standing.rider) {
        console.warn(
          `⚠️ BMW Award sin piloto en temporada ${season.year}`
        );

        standingsSkipped++;
        continue;
      }

      /*
       * RIDER
       */

      const riderId =
        await findRider(standing.rider);

      if (!riderId) {
        console.warn(
          `⚠️ Piloto no encontrado para BMW Award: ${
            standing.rider.full_name ??
            standing.rider.legacy_id ??
            "desconocido"
          }`
        );

        standingsSkipped++;
        continue;
      }

      /*
       * TEAM
       */

      const teamId =
        await findTeam(standing.team);

      /*
       * CONSTRUCTOR
       */

      const constructorId =
        await findConstructor(
          standing.constructor
        );

      /*
       * EVENT
       */

      const eventId =
        await findEvent(standing.event);

      /*
       * Comprobamos si ya existía antes del upsert
       * para generar estadísticas del proceso.
       */

      const existing =
        await prisma.bmwAwardStanding.findUnique({
          where: {
            seasonId_riderId: {
              seasonId: season.id,
              riderId,
            },
          },
        });

      /*
       * UPSERT
       */

      await prisma.bmwAwardStanding.upsert({
        where: {
          seasonId_riderId: {
            seasonId: season.id,
            riderId,
          },
        },

        create: {
          seasonId: season.id,

          eventId,

          riderId,

          teamId,

          constructorId,

          position:
            standing.position ?? null,

          points:
            standing.points ?? null,

          fetchedAt: new Date(),
        },

        update: {
          eventId,

          teamId,

          constructorId,

          position:
            standing.position ?? null,

          points:
            standing.points ?? null,

          fetchedAt: new Date(),
        },
      });

      if (existing) {
        standingsUpdated++;
      } else {
        standingsCreated++;
      }
    }

    console.log(
      `✅ BMW Award ${season.year}: ${classification.length} posiciones procesadas`
    );
  }

  return {
    seasonsProcessed,
    seasonsSkipped,

    standingsProcessed,
    standingsCreated,
    standingsUpdated,
    standingsSkipped,
  };
}