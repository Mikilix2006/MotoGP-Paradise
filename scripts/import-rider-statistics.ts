import { prisma } from "../src/lib/prisma";
import {
  importRiderStatistics,
} from "../src/services/importers/riderStatisticsImporter";

async function main() {
  console.log(
    "🏁 Iniciando importación de estadísticas históricas de pilotos..."
  );

  const result =
    await importRiderStatistics();

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