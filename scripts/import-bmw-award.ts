import { prisma } from "../src/lib/prisma";

import { getSeasonYearArgument } from "../src/services/importers/cli";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";

import {
  importBmwAwardStandings,
} from "../src/services/importers/bmwAwardImporter";

async function main() {
  const seasonYear = getSeasonYearArgument();

  console.log(
    "🏁 Iniciando importación de BMW Award..."
  );

  const result = await trackSyncRun(
    {
      source: "RESULTS",
      endpoint: "/standings/bmwaward",

      getStats: (value) => ({
        processed: value.standingsProcessed,
        created: value.standingsCreated,
        updated: value.standingsUpdated,
      }),
    },
    () => importBmwAwardStandings({ seasonYear })
  );

  console.log("\n=================================");
  console.log("🏆 IMPORTACIÓN BMW AWARD COMPLETADA");
  console.log("=================================\n");

  console.log(
    `Temporadas procesadas: ${result.seasonsProcessed}`
  );

  console.log(
    `Temporadas omitidas: ${result.seasonsSkipped}`
  );

  console.log(
    `Clasificaciones procesadas: ${result.standingsProcessed}`
  );

  console.log(
    `Clasificaciones creadas: ${result.standingsCreated}`
  );

  console.log(
    `Clasificaciones actualizadas: ${result.standingsUpdated}`
  );

  console.log(
    `Clasificaciones omitidas: ${result.standingsSkipped}`
  );
}

main()
  .catch((error) => {
    console.error(
      "\n❌ Error durante la importación BMW Award:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });