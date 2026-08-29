import {
  getSessionsByEvent,
  getMainRaceSession,
} from "./sessionService";

import type {
MotoGPEvent,
} from "@/types/grandPrix";

import type {
MotoGPSession,
} from "@/types/session";

export interface MainRaceData {
eventUuid: string;
sessionUuid: string;

session: MotoGPSession;
}

export async function getMainRaceData(
event: MotoGPEvent,
categoryUuid: string
): Promise<MainRaceData | null> {

const eventUuid = event.id;

const sessions =
await getSessionsByEvent(
eventUuid,
categoryUuid
);

const mainRace = getMainRaceSession(
  sessions,
  categoryUuid
);

if (!mainRace) {
return null;
}

return {
eventUuid,
sessionUuid: mainRace.id,
session: mainRace,
};
}
