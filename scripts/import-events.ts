import { importEvents } from "../src/services/importers/eventImporter";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🏁 Iniciando importación de eventos...");

  const result = await importEvents();

  console.log("\n✅ Importación completada");
  console.log(`Temporadas procesadas: ${result.seasonsProcessed}`);
  console.log(`Eventos procesados: ${result.eventsProcessed}`);
  console.log(`Eventos creados: ${result.eventsCreated}`);
  console.log(`Eventos actualizados: ${result.eventsUpdated}`);
  console.log(`Circuitos creados: ${result.circuitsCreated}`);
  console.log(`Circuitos actualizados: ${result.circuitsUpdated}`);
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