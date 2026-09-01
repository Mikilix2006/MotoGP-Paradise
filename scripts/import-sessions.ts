import { importSessions } from "../src/services/importers/sessionImporter";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🏁 Iniciando importación de sesiones...");

  const result = await importSessions();

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