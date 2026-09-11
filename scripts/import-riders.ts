import { prisma } from "../src/lib/prisma";

import {
  importRiders,
} from "../src/services/importers/riderImporter";

import {
  trackSyncRun,
} from "../src/services/importers/syncTracking";

/*
 * Permite acotar la importación a una temporada:
 *
 *   npm run import:riders -- 2024
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
    "🏍️ Iniciando importación de pilotos..."
  );

  const result = await trackSyncRun(
    {
      source: "BROADCAST",
      endpoint: "/riders",

      getStats: (value) => ({
        processed: value.ridersProcessed,
        created: value.entriesCreated,
        updated: value.entriesUpdated,
      }),
    },
    () => importRiders({ seasonYear })
  );

  console.log("\n=================================");
  console.log("🏍️ IMPORTACIÓN DE PILOTOS COMPLETADA");
  console.log("=================================\n");

  console.log(
    `Temporadas consultadas: ${result.seasonsProcessed}`
  );

  console.log(
    `Pilotos encontrados: ${result.ridersFound}`
  );

  console.log(
    `Pilotos procesados: ${result.ridersProcessed}`
  );

  console.log(
    `Pilotos omitidos: ${result.ridersSkipped}`
  );

  console.log(
    `Entradas creadas: ${result.entriesCreated}`
  );

  console.log(
    `Entradas actualizadas: ${result.entriesUpdated}`
  );

  console.log(
    `Entradas omitidas: ${result.entriesSkipped}`
  );

  console.log(
    `Imágenes procesadas: ${result.imagesProcessed}`
  );

  console.log(
    `Equipos procesados: ${result.teamsProcessed}`
  );

  console.log(
    `Constructores procesados: ${result.constructorsProcessed}`
  );
}

main()
  .catch((error) => {
    console.error(
      "\n❌ Error durante la importación de pilotos:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
