import { importSessions } from "../src/services/importers/sessionImporter";
import { prisma } from "../src/lib/prisma";

import { getSeasonYearArgument } from "../src/services/importers/cli";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";

async function main() {
  const seasonYear = getSeasonYearArgument();

  console.log("🏁 Iniciando importación de sesiones...");

  const result = await trackSyncRun(
    {
      source: "RESULTS",
      endpoint: "/sessions",

      getStats: (value) => ({
        processed: value.sessionsProcessed,
        created: value.sessionsCreated,
        updated: value.sessionsUpdated,
      }),
    },
    () => importSessions({ seasonYear })
  );

  console.log("\n✅ Importación completada");
  console.log(
    `EventCategory procesados: ${result.eventCategoriesProcessed}`
  );
  console.log(`Sesiones procesadas: ${result.sessionsProcessed}`);
  console.log(`Sesiones creadas: ${result.sessionsCreated}`);
  console.log(`Sesiones actualizadas: ${result.sessionsUpdated}`);
  console.log(`Eventos/categorías omitidos: ${result.eventsSkipped}`);
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