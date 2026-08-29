import { motogpFetch } from "./motogpApi";
import type { MotoGPEvent } from "@/types/grandPrix";

export async function getEventsBySeason(
seasonId: string
): Promise<MotoGPEvent[]> {
return motogpFetch<MotoGPEvent[]>(
`/results/events?seasonUuid=${seasonId}`
);
}

export async function getCurrentGrandPrix(
seasonId: string
): Promise<MotoGPEvent | null> {
const events = await getEventsBySeason(seasonId);

return (
events.find((event) => event.status === "CURRENT") ??
null
);
}
