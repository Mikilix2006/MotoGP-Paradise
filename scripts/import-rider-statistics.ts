import { prisma } from "../src/lib/prisma";

import { getSeasonYearArgument } from "../src/services/importers/cli";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";
import {
  importRiderStatistics,
} from "../src/services/importers/riderStatisticsImporter";

async function main() {
  const seasonYear = getSeasonYearArgument();

  console.log(
    "🏁 Iniciando importación de estadísticas históricas de pilotos..."
  );

  const result = await trackSyncRun(
    {
      source: "BROADCAST",
      endpoint: "/riders/{id}/statistics",

      getStats: (value) => ({
        processed: value.statisticsProcessed,
        created: value.statisticsCreated,
        updated: value.statisticsUpdated,
      }),
    },
    () => importRiderStatistics({ seasonYear })
  );

  console.log("\n✅ Importación completada");

  console.log(
    `Pilotos procesados: ${result.ridersProcessed}`
  );

  console.log(
    `Pilotos omitidos: ${result.ridersSkipped}`
  );

  console.log(
    `Estadísticas procesadas: ${result.statisticsProcessed}`
  );

  console.log(
    `Estadísticas creadas: ${result.statisticsCreated}`
  );

  console.log(
    `Estadísticas actualizadas: ${result.statisticsUpdated}`
  );

  console.log(
    `Estadísticas omitidas: ${result.statisticsSkipped}`
  );
}

main()
  .catch((error) => {
    console.error(
      "❌ Error durante la importación:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });