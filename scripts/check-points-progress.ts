/*
 * Cruce de la gráfica de puntos: el último acumulado de cada titular coincide con
 * ChampionshipStanding.points. Solo lectura, contra la base de DATABASE_URL.
 *
 * Uso: npx tsx scripts/check-points-progress.ts [año] [categoría]
 * Sin argumentos recorre 2014..año actual y las categorías 1, 2 y 3. Sale con
 * código 1 si hay diferencias fuera de KNOWN_GAPS.
 *
 * Antes de 2014 hay carreras sin filas de resultados en la BD (CZE 2005, MAL 2006,
 * JPN y RSM 2009, POR 2010...) y por eso no se recorren por defecto.
 */
import { prisma } from "../src/lib/prisma";
import { getPointsProgress } from "../src/services/db/pointsProgressRepository";

// Diferencias conocidas de la fuente: la clasificación aplica medios puntos (.5) y los resultados traen los completos.
const KNOWN_GAPS = new Set(["2022:2"]);

async function main() {
  const [yearArg, catArg] = process.argv.slice(2).map(Number);
  const years = yearArg ? [yearArg] : Array.from({ length: new Date().getFullYear() - 2013 }, (_, i) => 2014 + i);
  const categories = catArg ? [catArg] : [1, 2, 3];
  let bad = 0, checked = 0, noReference = 0;

  for (const year of years) {
    for (const cat of categories) {
      const data = await getPointsProgress(year, cat);
      if (!data || data.events.length === 0) continue;
      noReference += data.riders.filter((r) => r.standing_points === null).length;
      const diffs = data.riders.filter(
        (r) => r.standing_points !== null && Math.abs((r.total_points ?? 0) - r.standing_points) > 0.001
      );
      const known = KNOWN_GAPS.has(`${year}:${cat}`);
      checked += data.riders.length;
      if (!known) bad += diffs.length;
      console.log(`${year} cat ${cat}: ${data.events.length} GP, ${data.riders.length} pilotos, ${diffs.length} difieren${known ? " (conocido)" : ""}`);
      for (const r of diffs.slice(0, 5)) console.log(`   ${r.full_name}: acumulado ${r.total_points} vs clasificación ${r.standing_points}`);
    }
  }
  console.log(`\nTotal: ${checked} pilotos, ${bad} difieren, ${noReference} sin puntos de clasificación`);
  process.exitCode = bad > 0 ? 1 : 0;
}
main().finally(() => prisma.$disconnect());
