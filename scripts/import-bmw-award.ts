import { prisma } from "../src/lib/prisma";

import {
  importBmwAwardStandings,
} from "../src/services/importers/bmwAwardImporter";

async function main() {
  console.log(
    "🏁 Iniciando importación de BMW Award..."
  );

  const result =
    await importBmwAwardStandings();

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