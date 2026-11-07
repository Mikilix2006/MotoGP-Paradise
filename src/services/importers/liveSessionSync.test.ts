import { describe, expect, it } from "vitest";

import {
  isRecentlyFinished,
  shouldRefreshEventDetails,
} from "./liveSessionSync";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T12:00:00Z");

describe("isRecentlyFinished", () => {
  it("acepta eventos terminados dentro de 14 días", () => {
    expect(isRecentlyFinished({ dateEnd: new Date(now.getTime() - 6 * DAY) }, now)).toBe(true);
    expect(isRecentlyFinished({ dateEnd: new Date(now.getTime() - 14 * DAY) }, now)).toBe(true);
  });

  it("rechaza antiguos, futuros y sin fecha", () => {
    expect(isRecentlyFinished({ dateEnd: new Date(now.getTime() - 15 * DAY) }, now)).toBe(false);
    expect(isRecentlyFinished({ dateEnd: new Date(now.getTime() + DAY) }, now)).toBe(false);
    expect(isRecentlyFinished({ dateEnd: null }, now)).toBe(false);
  });
});

describe("shouldRefreshEventDetails", () => {
  it("refresca si nunca se ejecutó o pasó una hora", () => {
    expect(shouldRefreshEventDetails(null, now)).toBe(true);
    expect(shouldRefreshEventDetails(new Date(now.getTime() - 60 * 60 * 1000), now)).toBe(true);
  });

  it("no refresca si fue hace menos de una hora", () => {
    expect(shouldRefreshEventDetails(new Date(now.getTime() - 59 * 60 * 1000), now)).toBe(false);
  });
});
