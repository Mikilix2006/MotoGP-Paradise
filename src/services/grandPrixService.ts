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

const currentEvent = events.find(
  (event) => event.status === "CURRENT"
);

const nextEvent = events.find(
  (event) => event.status === "NOT-STARTED"
);

const selectedEvent = currentEvent ?? nextEvent;

if (!selectedEvent) {
  throw new Error(
    "No se encontró ningún Gran Premio actual ni próximo"
  );
}

return selectedEvent;
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
