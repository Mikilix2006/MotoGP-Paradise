import { importEvents } from "../src/services/importers/eventImporter";
import { prisma } from "../src/lib/prisma";

import { getSeasonYearArgument } from "../src/services/importers/cli";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";

async function main() {
  const seasonYear = getSeasonYearArgument();

  console.log("🏁 Iniciando importación de eventos...");

  const result = await trackSyncRun(
    {
      source: "RESULTS",
      endpoint: "/events",

      getStats: (value) => ({
        processed: value.eventsProcessed,
        created: value.eventsCreated,
        updated: value.eventsUpdated,
      }),
    },
    () => importEvents({ seasonYear })
  );

  console.log("\n✅ Importación completada");
  console.log(`Temporadas procesadas: ${result.seasonsProcessed}`);
  console.log(`Eventos procesados: ${result.eventsProcessed}`);
  console.log(`Eventos creados: ${result.eventsCreated}`);
  console.log(`Eventos actualizados: ${result.eventsUpdated}`);
  console.log(`Circuitos creados: ${result.circuitsCreated}`);
  console.log(`Circuitos actualizados: ${result.circuitsUpdated}`);
  console.log(`Documentos del evento: ${result.documentsProcessed}`);
}

main()
  .catch((error) => {
    console.error("❌ Error durante la importación:");
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });