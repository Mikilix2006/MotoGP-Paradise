import { getCurrentSeason } from "./seasonService";
import { getCurrentGrandPrix } from "./grandPrixService";

import type { MotoGPEvent } from "@/types/grandPrix";

export async function getCurrentGrandPrixData(): Promise<MotoGPEvent | null> {
const currentSeason = await getCurrentSeason();

if (!currentSeason) {
throw new Error(
"No se encontró ninguna temporada marcada como actual"
);
}

return getCurrentGrandPrix(currentSeason.id);
}
