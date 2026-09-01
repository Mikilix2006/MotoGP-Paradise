import { prisma } from "../src/lib/prisma";
import {
  importSessionResults,
} from "../src/services/importers/sessionResultImporter";

async function main() {
  console.log(
    "🏁 Iniciando importación de pilotos y resultados..."
  );

  const result = await importSessionResults();

  console.log("\n✅ Importación completada");

  console.log(
    `Sesiones procesadas: ${result.sessionsProcessed}`
  );

  console.log(
    `Sesiones omitidas: ${result.sessionsSkipped}`
  );

  console.log(
    `Resultados procesados: ${result.resultsProcessed}`
  );

  console.log(
    `Resultados creados: ${result.resultsCreated}`
  );

  console.log(
    `Resultados actualizados: ${result.resultsUpdated}`
  );

  console.log(
    `Pilotos nuevos: ${result.ridersCreated}`
  );

  console.log(
    `Equipos nuevos: ${result.teamsCreated}`
  );

  console.log(
    `Constructores nuevos: ${result.constructorsCreated}`
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