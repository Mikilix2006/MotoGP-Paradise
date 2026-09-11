import { prisma } from "../src/lib/prisma";

import {
  importChampionshipStandings,
} from "../src/services/importers/championshipStandingImporter";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";

/*
 * Permite acotar la importación a una temporada:
 *
 *   npm run import:championship-standings -- 2024
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
    "🏆 Iniciando importación de clasificaciones del campeonato..."
  );

  const result = await trackSyncRun(
    {
      source: "RESULTS",
      endpoint: "/standings",

      getStats: (value) => ({
        processed: value.standingsProcessed,
        created: value.standingsCreated,
        updated: value.standingsUpdated,
      }),
    },
    () => importChampionshipStandings({ seasonYear })
  );

  console.log("\n=================================");
  console.log("🏆 CLASIFICACIONES COMPLETADAS");
  console.log("=================================\n");

  console.log(
    `Temporadas procesadas: ${result.seasonsProcessed}`
  );

  console.log(
    `Combinaciones procesadas: ${result.combinationsProcessed}`
  );

  console.log(
    `Combinaciones omitidas: ${result.combinationsSkipped}`
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
      "\n❌ Error durante la importación de clasificaciones:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
