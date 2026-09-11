import { prisma } from "@/lib/prisma";
import { fetchMotoGPResults } from "@/services/motogp/resultsClient";

interface MotoGPCountryApi {
  iso: string;
  name: string | null;
  region_iso: string | null;
}

interface MotoGPCircuitApi {
  id: string;
  name: string;
  legacy_id: number | null;
  place: string | null;
  nation: string | null;
  events_id: string | null;
}

interface MotoGPEventLegacyIdApi {
  categoryId: number;
  eventId: number;
}

interface MotoGPEventFileApi {
  url: string | null;
  menu_position: number | null;
}

interface MotoGPEventApi {
  id: string;

  name: string;
  sponsored_name: string | null;
  additional_name: string | null;
  short_name: string | null;

  date_start: string | null;
  date_end: string | null;

  status: string | null;
  test: boolean;

  country: MotoGPCountryApi | null;
  circuit: MotoGPCircuitApi | null;

  legacy_id: MotoGPEventLegacyIdApi[];

  toad_api_uuid: string | null;

  /*
   * Documentos PDF del evento, indexados por tipo:
   * circuit_information, podiums, pole_positions...
   */
  event_files: Record<string, MotoGPEventFileApi> | null;
}

export interface EventImportResult {
  seasonsProcessed: number;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  circuitsCreated: number;
  circuitsUpdated: number;
  documentsProcessed: number;
}

export async function importEvents(): Promise<EventImportResult> {
  const seasons = await prisma.season.findMany({
    orderBy: {
      year: "asc",
    },
  });

  let eventsProcessed = 0;
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let circuitsCreated = 0;
  let circuitsUpdated = 0;
  let documentsProcessed = 0;

  for (const season of seasons) {
    console.log(
      `📅 Importando eventos de la temporada ${season.year}...`
    );

    if (!season.motogpUuid) {
      console.warn(
        `⚠️ La temporada ${season.year} no tiene motogpUuid. Se omite.`
      );

      continue;
    }

    const events = await fetchMotoGPResults<MotoGPEventApi[]>(
      `/events?seasonUuid=${season.motogpUuid}`
    );

    for (const event of events) {
      eventsProcessed++;

      /*
       * ============================================================
       * COUNTRY
       * ============================================================
       */

      let countryId: string | null = null;

      if (event.country?.iso) {
        const countryName =
            event.country.name?.trim() ||
            event.country.iso;

        if (!event.country.name?.trim()) {
            console.warn(
            `⚠️ País sin nombre: ${event.country.iso} en "${event.name}". Usando ISO como nombre temporal.`
            );
        }

        const country = await prisma.country.upsert({
            where: {
            iso: event.country.iso,
            },
            create: {
            iso: event.country.iso,
            name: countryName,
            regionIso: event.country.region_iso || null,
            },
            update: {
            name: countryName,
            regionIso: event.country.region_iso || null,
            },
        });

        countryId = country.id;
      }

      /*
       * ============================================================
       * CIRCUIT
       * ============================================================
       */

      let circuitId: string | null = null;

      if (event.circuit?.id) {
        const existingCircuit = await prisma.circuit.findUnique({
          where: {
            motogpUuid: event.circuit.id,
          },
        });

        const circuit = await prisma.circuit.upsert({
          where: {
            motogpUuid: event.circuit.id,
          },

          create: {
            motogpUuid: event.circuit.id,
            legacyId: event.circuit.legacy_id,
            name: event.circuit.name,
            place: event.circuit.place,
            nation: event.circuit.nation,
            countryId,
          },

          update: {
            legacyId: event.circuit.legacy_id,
            name: event.circuit.name,
            place: event.circuit.place,
            nation: event.circuit.nation,
            countryId,
          },
        });

        circuitId = circuit.id;

        if (existingCircuit) {
          circuitsUpdated++;
        } else {
          circuitsCreated++;
        }
      }

      /*
       * ============================================================
       * EVENT
       * ============================================================
       */

      const existingEvent = await prisma.event.findUnique({
        where: {
          resultsUuid: event.id,
        },
      });

      const databaseEvent = await prisma.event.upsert({
        where: {
          resultsUuid: event.id,
        },

        create: {
          resultsUuid: event.id,

          seasonId: season.id,
          circuitId,
          countryId,

          name: event.name,
          sponsoredName: event.sponsored_name,
          additionalName: event.additional_name,
          shortName: event.short_name,

          dateStart: event.date_start
            ? new Date(event.date_start)
            : null,

          dateEnd: event.date_end
            ? new Date(event.date_end)
            : null,

          status: event.status,
          isTest: event.test,

          toadApiUuid: event.toad_api_uuid,
        },

        update: {
          seasonId: season.id,
          circuitId,
          countryId,

          name: event.name,
          sponsoredName: event.sponsored_name,
          additionalName: event.additional_name,
          shortName: event.short_name,

          dateStart: event.date_start
            ? new Date(event.date_start)
            : null,

          dateEnd: event.date_end
            ? new Date(event.date_end)
            : null,

          status: event.status,
          isTest: event.test,

          toadApiUuid: event.toad_api_uuid,
        },
      });

      if (existingEvent) {
        eventsUpdated++;
      } else {
        eventsCreated++;
      }

      /*
       * ============================================================
       * LEGACY MAPPINGS
       * ============================================================
       */

      for (const legacyMapping of event.legacy_id ?? []) {
        await prisma.eventLegacyMapping.upsert({
          where: {
            eventId_categoryLegacyId: {
              eventId: databaseEvent.id,
              categoryLegacyId: legacyMapping.categoryId,
            },
          },

          create: {
            eventId: databaseEvent.id,
            categoryLegacyId: legacyMapping.categoryId,
            eventLegacyId: legacyMapping.eventId,
          },

          update: {
            eventLegacyId: legacyMapping.eventId,
          },
        });
      }

      /*
       * ============================================================
       * EVENT DOCUMENTS
       * ============================================================
       *
       * event_files llega como un objeto cuyas claves son el tipo
       * de documento. Las entradas con url vacía se descartan.
       */

      for (const [type, file] of Object.entries(
        event.event_files ?? {}
      )) {
        const url = file?.url?.trim();

        if (!url) {
          continue;
        }

        await prisma.eventDocument.upsert({
          where: {
            eventId_type: {
              eventId: databaseEvent.id,
              type,
            },
          },

          create: {
            eventId: databaseEvent.id,
            type,
            url,
            menuPosition: file.menu_position ?? null,
          },

          update: {
            url,
            menuPosition: file.menu_position ?? null,
          },
        });

        documentsProcessed++;
      }
    }

    console.log(
      `✅ Temporada ${season.year}: ${events.length} eventos procesados`
    );
  }

  return {
    seasonsProcessed: seasons.length,
    eventsProcessed,
    eventsCreated,
    eventsUpdated,
    circuitsCreated,
    circuitsUpdated,
    documentsProcessed,
  };
}