import { motogpFetch } from "./motogpApi";
import type { MotoGPEvent } from "@/types/grandPrix";

export async function getEventsBySeason(
seasonUuid: string
): Promise<MotoGPEvent[]> {

return motogpFetch<MotoGPEvent[]>(
`/results/events?seasonUuid=${seasonUuid}`
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

export function findEventByCircuitId(
events: MotoGPEvent[],
circuitId: string
): MotoGPEvent | null {

return (
events.find(
(event) =>
event.circuit.id === circuitId
) ?? null
);
}
