import { describe, expect, it } from "vitest";
import type { CalendarSession } from "@/types/grandPrix";
import { getLiveSessionId, getSessionState, isSessionFinished } from "./sessionState";

function session(
  id: string,
  date_start: string | null,
  date_end: string | null,
  status = "NOT-STARTED"
): CalendarSession {
  return {
    id,
    shortname: id,
    name: id,
    type: id,
    status,
    date_start,
    date_end,
    weekday: null,
    category: "MotoGP",
    category_legacy_id: 3,
  };
}

const at = (iso: string) => new Date(iso).getTime();

function states(sessions: CalendarSession[], now: number) {
  const liveId = getLiveSessionId(sessions, now);
  return sessions.map((s) => getSessionState(s, liveId, now));
}

describe("isSessionFinished", () => {
  it("FINISHED de la BD manda aunque la hora no haya pasado", () => {
    expect(isSessionFinished(session("a", "2026-11-07T11:00:00Z", null, "FINISHED"), at("2026-11-07T10:00:00Z"))).toBe(true);
  });

  it("fin pasado sin FINISHED (watcher atrasado) cuenta como terminada", () => {
    expect(isSessionFinished(session("a", "2026-11-07T11:00:00Z", "2026-11-07T11:30:00Z"), at("2026-11-07T11:40:00Z"))).toBe(true);
  });

  // Qatar 2026 en producción: calendario provisional con el fin 2 días antes del inicio.
  it("fin anterior al inicio no marca terminada", () => {
    expect(isSessionFinished(session("a", "2026-11-07T11:00:00Z", "2026-11-05T12:30:00Z"), at("2026-11-07T10:00:00Z"))).toBe(false);
  });

  it("sprint/carrera con fin == inicio no se da por terminada al empezar", () => {
    expect(isSessionFinished(session("SPR", "2026-11-07T16:00:00Z", "2026-11-07T16:00:00Z"), at("2026-11-07T16:05:00Z"))).toBe(false);
  });
});

describe("solo una sesión en vivo", () => {
  // Qatar 2026 tras desplegar: date_end null y el watcher sin marcar FINISHED salían 3 EN VIVO.
  it("varias empezadas sin FINISHED: solo la última está en vivo y las anteriores terminadas", () => {
    const sessions = [
      session("FP2-Moto3", "2026-11-07T09:30:00Z", null),
      session("FP2-Moto2", "2026-11-07T10:15:00Z", null),
      session("FP2-MotoGP", "2026-11-07T11:00:00Z", null),
      session("Q1", "2026-11-07T11:40:00Z", null),
    ];
    const result = states(sessions, at("2026-11-07T11:10:00Z"));
    expect(result.filter((s) => s.live)).toHaveLength(1);
    expect(result).toEqual([
      { live: false, finished: true },
      { live: false, finished: true },
      { live: true, finished: false },
      { live: false, finished: false },
    ]);
  });

  it("si la última empezada está FINISHED no queda ninguna en vivo", () => {
    const sessions = [
      session("FP2", "2026-11-07T11:00:00Z", null, "FINISHED"),
      session("Q1", "2026-11-07T11:40:00Z", null),
    ];
    expect(getLiveSessionId(sessions, at("2026-11-07T11:35:00Z"))).toBeNull();
  });

  it("nunca hay más de una en vivo en ningún momento del fin de semana", () => {
    const sessions = [
      session("FP1", "2026-11-06T10:00:00Z", "2026-11-06T10:35:00Z"),
      session("PR", "2026-11-06T14:15:00Z", null),
      session("SPR", "2026-11-07T16:00:00Z", "2026-11-07T16:00:00Z"),
      session("RAC", "2026-11-08T16:00:00Z", "2026-11-08T16:00:00Z"),
    ];
    for (let t = at("2026-11-06T09:00:00Z"); t <= at("2026-11-08T20:00:00Z"); t += 15 * 60_000) {
      expect(states(sessions, t).filter((s) => s.live).length).toBeLessThanOrEqual(1);
    }
  });

  it("sin fecha de inicio nunca está en vivo ni terminada", () => {
    const sessions = [session("X", null, null)];
    expect(states(sessions, at("2026-11-07T12:00:00Z"))).toEqual([{ live: false, finished: false }]);
  });
});
