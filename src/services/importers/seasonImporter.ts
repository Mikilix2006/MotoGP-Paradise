import { prisma } from "@/lib/prisma";
import { fetchMotoGPResults } from "@/services/motogp/resultsClient";

interface MotoGPSeasonApi {
  id: string;
  name: string | null;
  year: number;
  current: boolean;
}

export interface SeasonImportResult {
  processed: number;
  created: number;
  updated: number;
}

export async function importSeasons(): Promise<SeasonImportResult> {
  const seasons =
    await fetchMotoGPResults<MotoGPSeasonApi[]>("/seasons");

  let created = 0;
  let updated = 0;

  for (const season of seasons) {
    const existingSeason = await prisma.season.findUnique({
      where: {
        year: season.year,
      },
    });

    await prisma.season.upsert({
      where: {
        year: season.year,
      },
      create: {
        motogpUuid: season.id,
        year: season.year,
        name: season.name,
        current: season.current,
      },
      update: {
        motogpUuid: season.id,
        name: season.name,
        current: season.current,
      },
    });

    if (existingSeason) {
      updated++;
    } else {
      created++;
    }
  }

  return {
    processed: seasons.length,
    created,
    updated,
  };
}