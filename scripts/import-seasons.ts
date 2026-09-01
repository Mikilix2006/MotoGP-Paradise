import { importSeasons } from "../src/services/importers/seasonImporter";
import { prisma } from "../src/lib/prisma";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";

async function main() {
  console.log("🏁 Iniciando importación de temporadas...");

  const result = await trackSyncRun(
    {
      source: "RESULTS",
      endpoint: "/seasons",

      getStats: (value) => ({
        processed: value.processed,
        created: value.created,
        updated: value.updated,
      }),
    },
    importSeasons
  );

  console.log("✅ Importación completada");
  console.log(`Procesadas: ${result.processed}`);
  console.log(`Creadas: ${result.created}`);
  console.log(`Actualizadas: ${result.updated}`);
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