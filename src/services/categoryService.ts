import { motogpFetch } from "./motogpApi";

import type {
MotoGPEventCategory,
} from "@/types/category";

export async function getCategoriesByEvent(
eventUuid: string
): Promise<MotoGPEventCategory[]> {

return motogpFetch<MotoGPEventCategory[]>(
`/results/categories?eventUuid=${eventUuid}`
);
}

export function getMotoGPEventCategory(
categories: MotoGPEventCategory[]
): MotoGPEventCategory | null {

return (
categories.find(
(category) =>
category.legacy_id === 3
) ?? null
);
}
