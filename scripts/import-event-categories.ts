import { importEventCategories } from "../src/services/importers/eventCategoryImporter";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🏁 Iniciando importación de categorías por evento...");

  const result = await importEventCategories();

  console.log("\n✅ Importación completada");
  console.log(`Eventos procesados: ${result.eventsProcessed}`);
  console.log(`Categorías procesadas: ${result.categoriesProcessed}`);
  console.log(`Categorías creadas: ${result.categoriesCreated}`);
  console.log(`Categorías actualizadas: ${result.categoriesUpdated}`);
  console.log(
    `Relaciones EventCategory creadas: ${result.eventCategoriesCreated}`
  );
  console.log(
    `Relaciones EventCategory actualizadas: ${result.eventCategoriesUpdated}`
  );
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