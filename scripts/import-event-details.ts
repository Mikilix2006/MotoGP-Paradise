import { prisma } from "../src/lib/prisma";

import {
  importEventDetails,
} from "../src/services/importers/eventDetailsImporter";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";

/*
 * Permite acotar la importación a una temporada:
 *
 *   npm run import:event-details -- 2024
 */
function getSeasonYear(): number | undefined {
  const argument = process.argv[2];

  if (!argument) {
    return undefined;
  }

  const year = Number(argument);

  if (!Number.isInteger(year)) {
    throw new Error(
      `Temporada no válida: ${argument}`
    );
  }

  return year;
}

async function main() {
  const seasonYear = getSeasonYear();

  console.log(
    "🗺️ Iniciando importación de detalles de eventos..."
  );

  const result = await trackSyncRun(
    {
      source: "BROADCAST",
      endpoint: "/events?seasonYear",

      getStats: (value) => ({
        processed: value.eventsMatched,
        updated:
          value.circuitsUpdated + value.sessionsUpdated,
        created: value.sessionsCreated,
      }),
    },
    () => importEventDetails({ seasonYear })
  );

  console.log("\n=================================");
  console.log("🗺️ DETALLES DE EVENTOS COMPLETADOS");
  console.log("=================================\n");

  console.log(
    `Temporadas procesadas: ${result.seasonsProcessed}`
  );

  console.log(
    `Eventos localizados: ${result.eventsMatched}`
  );

  console.log(
    `Eventos sin correspondencia: ${result.eventsNotFound}`
  );

  console.log(
    `Circuitos actualizados: ${result.circuitsUpdated}`
  );

  console.log(
    `Trazados procesados: ${result.tracksProcessed}`
  );

  console.log(
    `Imágenes de circuito: ${result.assetsProcessed}`
  );

  console.log(
    `Descripciones de circuito: ${result.descriptionsProcessed}`
  );

  console.log(
    `Días de horario: ${result.scheduleDaysProcessed}`
  );

  console.log(
    `Enlaces de evento: ${result.urlsProcessed}`
  );

  console.log(
    `Categorías enriquecidas: ${result.categoriesEnriched}`
  );

  console.log(
    `Sesiones actualizadas: ${result.sessionsUpdated}`
  );

  console.log(
    `Sesiones creadas: ${result.sessionsCreated}`
  );
}

main()
  .catch((error) => {
    console.error(
      "\n❌ Error durante la importación de detalles:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
