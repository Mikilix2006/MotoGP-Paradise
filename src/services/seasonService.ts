import { motogpFetch } from "./motogpApi";

import type { MotoGPSeason } from "@/types/season";

const SEASONS_ENDPOINT = "/results/seasons";

export async function getCurrentSeason(): Promise<MotoGPSeason | null> {
  const seasons = await motogpFetch<MotoGPSeason[]>(
    SEASONS_ENDPOINT
  );

  return (
    seasons.find((season) => season.current === true) ?? null
  );
}