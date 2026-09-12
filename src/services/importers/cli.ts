/**
 * Lee el argumento de temporada de un script de importación:
 *
 *   npm run import:sessions -- 2026
 *   npx tsx scripts/import-sessions.ts 2026
 *
 * Sin argumento el importador recorre todo el histórico.
 */
export function getSeasonYearArgument(): number | undefined {
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
