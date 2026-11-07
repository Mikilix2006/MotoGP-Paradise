import { describe, expect, it } from "vitest";
import {
  findProvisionalCorrector,
  isGhostDuplicate,
  toAbsoluteIso,
  toCalendarSessions,
  toCategoryLabel,
  toDateOnly,
  toInstantIso,
} from "./calendarModel";
import { wallClockToInstant } from "@/utils/date";
import {
  carreraReiniciada,
  duracionCero,
  eventRow,
  gpdayJpnAus,
  qatarProvisional,
  sessionRow,
  sinFecha,
  zonaInvalida,
} from "./__fixtures__/events";

const wall = (iso: string) => new Date(iso);

describe("toAbsoluteIso / wallClockToInstant en cambios de hora (CAL-13)", () => {
  it.each([
    // Madrid: fin del horario de verano el 2026-10-25 (03:00 CEST -> 02:00 CET)
    ["Europe/Madrid", "2026-10-24T23:00:00Z", "2026-10-24T21:00:00.000Z"], // CEST
    ["Europe/Madrid", "2026-10-25T01:00:00Z", "2026-10-24T23:00:00.000Z"], // CEST
    ["Europe/Madrid", "2026-10-25T04:00:00Z", "2026-10-25T03:00:00.000Z"], // CET
    // Madrid: inicio del horario de verano el 2026-03-29
    ["Europe/Madrid", "2026-03-29T01:00:00Z", "2026-03-29T00:00:00.000Z"], // CET
    ["Europe/Madrid", "2026-03-29T04:00:00Z", "2026-03-29T02:00:00.000Z"], // CEST
    // Chicago: 2026-03-08 empieza CDT y 2026-11-01 vuelve a CST
    ["America/Chicago", "2026-03-08T12:00:00Z", "2026-03-08T17:00:00.000Z"],
    ["America/Chicago", "2026-03-07T12:00:00Z", "2026-03-07T18:00:00.000Z"],
    ["America/Chicago", "2026-11-01T12:00:00Z", "2026-11-01T18:00:00.000Z"],
    // Sin horario de verano y zona en mayúsculas como llega de la BD
    ["ASIA/QATAR", "2026-11-07T15:00:00Z", "2026-11-07T12:00:00.000Z"],
    ["Asia/Kolkata", "2026-11-07T15:00:00Z", "2026-11-07T09:30:00.000Z"],
  ])("%s %s -> %s", (zona, reloj, esperado) => {
    expect(wallClockToInstant(wall(reloj), zona).toISOString()).toBe(esperado);
    expect(toAbsoluteIso(wall(reloj), zona)).toBe(esperado);
  });

  it("zona inválida, vacía o fecha nula -> null (no inventa nada)", () => {
    expect(toAbsoluteIso(wall("2026-05-01T10:00:00Z"), "NO/EXISTE")).toBeNull();
    expect(toAbsoluteIso(wall("2026-05-01T10:00:00Z"), null)).toBeNull();
    expect(toAbsoluteIso(null, "Europe/Madrid")).toBeNull();
  });

  it("zona inválida: wallClockToInstant lanza RangeError", () => {
    expect(() => wallClockToInstant(wall("2026-05-01T10:00:00Z"), "NO/EXISTE")).toThrow(RangeError);
  });
});

describe("toInstantIso / toDateOnly", () => {
  it("con zona válida usa la zona; sin ella cae a la lectura antigua (Madrid)", () => {
    const d = wall("2026-05-01T10:00:00Z");
    expect(toInstantIso(d, "Asia/Tokyo")).toBe("2026-05-01T01:00:00.000Z");
    expect(toInstantIso(d, "NO/EXISTE")).toBe("2026-05-01T08:00:00.000Z");
    expect(toInstantIso(d, null)).toBe("2026-05-01T08:00:00.000Z");
  });

  it("toDateOnly: AAAA-MM-DD o cadena vacía", () => {
    expect(toDateOnly(wall("2026-05-01T23:59:00Z"))).toBe("2026-05-01");
    expect(toDateOnly(null)).toBe("");
  });
});

describe("toCategoryLabel (CAL-08)", () => {
  it("quita el ™ y usa el acrónimo si queda vacío", () => {
    const cat = (name: string, acronym: string | null) =>
      ({ name, acronym }) as Parameters<typeof toCategoryLabel>[0];
    expect(toCategoryLabel(cat("MotoGP™", "MGP"))).toBe("MotoGP");
    expect(toCategoryLabel(cat(" Moto2™ ", "MT2"))).toBe("Moto2");
    expect(toCategoryLabel(cat("™", "MT3"))).toBe("MT3");
    expect(toCategoryLabel(cat("", null))).toBe("");
  });
});

describe("findProvisionalCorrector (CAL-12)", () => {
  it("qatar-provisional: devuelve corrector y las sesiones caen en el fin de semana", () => {
    const correct = findProvisionalCorrector(qatarProvisional);
    expect(correct).not.toBeNull();
    const byId = (id: string) => qatarProvisional.sessions.find((s) => s.id === id)!;
    // Mismo reloj de pared (hora), día del horario real.
    expect(correct!(byId("fp1-mgp"))?.toISOString()).toBe("2026-11-06T10:00:00.000Z");
    expect(correct!(byId("q2"))?.toISOString()).toBe("2026-11-07T15:00:00.000Z");
    expect(correct!(byId("rac"))?.toISOString()).toBe("2026-11-08T17:00:00.000Z");
  });

  it("sin gpDay no se corrige", () => {
    const correct = findProvisionalCorrector(qatarProvisional)!;
    expect(correct(qatarProvisional.sessions.find((s) => s.id === "sin-gpday")!)).toBeNull();
  });

  it("gpday-jpn-aus: evento no provisional, no se corrige", () => {
    expect(findProvisionalCorrector(gpdayJpnAus)).toBeNull();
  });

  it("sin zona horaria no se corrige", () => {
    const sinZona = eventRow({
      timeZone: null,
      start: "2026-11-06",
      end: "2026-11-08",
      sessions: qatarProvisional.sessions,
    });
    expect(findProvisionalCorrector(sinZona)).toBeNull();
  });

  it("solo decide MotoGP: una sesión suelta de Moto3 fuera de fechas no activa la corrección", () => {
    const evento = eventRow({
      timeZone: "Europe/Madrid",
      start: "2026-05-01",
      end: "2026-05-03",
      sessions: [
        sessionRow({ id: "a", legacyId: 3, start: "2026-05-02T10:00:00Z", gpDay: 1 }),
        sessionRow({ id: "b", legacyId: 1, start: "2026-04-20T10:00:00Z", gpDay: 1 }),
      ],
    });
    expect(findProvisionalCorrector(evento)).toBeNull();
  });

  it("gpDay repetido en el horario o fecha corregida fuera del fin de semana -> null", () => {
    const fuera = eventRow({
      timeZone: "Europe/Madrid",
      start: "2026-05-01",
      end: "2026-05-03",
      scheduleDays: [
        { gpDay: 1, dateStart: "2026-05-10T00:00:00Z" },
        { gpDay: 2, dateStart: "2026-05-02T00:00:00Z" },
        { gpDay: 2, dateStart: "2026-05-03T00:00:00Z" },
      ],
      sessions: [
        sessionRow({ id: "fuera", legacyId: 3, start: "2026-04-28T10:00:00Z", gpDay: 1 }),
        sessionRow({ id: "dup", legacyId: 3, start: "2026-04-29T10:00:00Z", gpDay: 2 }),
      ],
    });
    const correct = findProvisionalCorrector(fuera)!;
    expect(correct(fuera.sessions[0])).toBeNull();
    expect(correct(fuera.sessions[1])).toBeNull();
  });
});

describe("isGhostDuplicate (CAL-12)", () => {
  const fantasma = carreraReiniciada.sessions.find((s) => s.id === "fantasma")!;
  const fantasmaSolo = carreraReiniciada.sessions.find((s) => s.id === "fantasma-solo")!;
  const rac2 = carreraReiniciada.sessions.find((s) => s.id === "rac2")!;

  it("el fantasma junto a RAC2 de su categoría y tipo se descarta", () => {
    expect(isGhostDuplicate(fantasma, carreraReiniciada.sessions)).toBe(true);
  });

  it("la sesión real no se descarta", () => {
    expect(isGhostDuplicate(rac2, carreraReiniciada.sessions)).toBe(false);
  });

  it("un fantasma sin otra sesión de su categoría y tipo se conserva", () => {
    expect(isGhostDuplicate(fantasmaSolo, carreraReiniciada.sessions)).toBe(false);
  });
});

describe("toCalendarSessions (CAL-12)", () => {
  it("qatar-provisional: sesiones dentro del fin de semana, día real y misma hora", () => {
    const sessions = toCalendarSessions(qatarProvisional);
    const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
    // Qatar es UTC+3 sin horario de verano: 10:00 locales = 07:00Z.
    expect(byId["r-fp1-mgp"].date_start).toBe("2026-11-06T07:00:00.000Z");
    expect(byId["r-q2"].date_start).toBe("2026-11-07T12:00:00.000Z");
    expect(byId["r-rac"].date_start).toBe("2026-11-08T14:00:00.000Z");
    expect(byId["r-fp1-mgp"].weekday).toBe(5);
    expect(byId["r-q2"].weekday).toBe(6);
    expect(byId["r-rac"].weekday).toBe(0);
  });

  it("qatar-provisional: fin anterior al inicio -> date_end null", () => {
    for (const s of toCalendarSessions(qatarProvisional)) {
      expect(s.date_end).toBeNull();
    }
  });

  it("orden por instante con desempate Moto3, Moto2, MotoGP", () => {
    const ids = toCalendarSessions(qatarProvisional).map((s) => s.id);
    expect(ids).toEqual([
      "r-sin-gpday", // sin corregir: conserva su fecha cruda (2 nov)
      "r-fp1-m3",
      "r-fp1-m2",
      "r-fp1-mgp",
      "r-q2",
      "r-rac",
    ]);
  });

  it("etiquetas de categoría sin ™", () => {
    const cats = toCalendarSessions(qatarProvisional).map((s) => s.category);
    expect(new Set(cats)).toEqual(new Set(["Moto3", "Moto2", "MotoGP"]));
  });

  it("gpday-jpn-aus: no se corrige; la hora de pared de Tokio pasa a instante", () => {
    const [fp1, rac] = toCalendarSessions(gpdayJpnAus);
    expect(fp1.date_start).toBe("2026-10-02T00:00:00.000Z"); // 09:00 JST
    expect(rac.date_start).toBe("2026-10-04T06:00:00.000Z"); // 15:00 JST
    expect(fp1.date_end).toBe("2026-10-02T00:45:00.000Z");
  });

  it("duracion-cero: SPR y RAC con fin == inicio -> date_end null; FP1 conserva su fin", () => {
    const byId = Object.fromEntries(toCalendarSessions(duracionCero).map((s) => [s.id, s]));
    expect(byId["r-spr"].date_end).toBeNull();
    expect(byId["r-rac"].date_end).toBeNull();
    expect(byId["r-fp1"].date_end).toBe("2026-05-01T08:45:00.000Z");
  });

  it("carrera-reiniciada: descarta el fantasma, RAC2 se queda y el fantasma solitario también", () => {
    const sessions = toCalendarSessions(carreraReiniciada);
    expect(sessions.map((s) => s.id)).toEqual(["r-fantasma-solo", "r-rac2"]);
    expect(sessions[1].shortname).toBe("RAC2");
  });

  it("sin-fecha: sin date_start ni weekday y al final de la lista", () => {
    const sessions = toCalendarSessions(sinFecha);
    expect(sessions.map((s) => s.id)).toEqual(["r-con-fecha", "r-sin-fecha"]);
    expect(sessions[1]).toMatchObject({ date_start: null, date_end: null, weekday: null });
  });

  it("zona-invalida: no inventa instantes (date_start null)", () => {
    const [fp1] = toCalendarSessions(zonaInvalida);
    expect(fp1.date_start).toBeNull();
    expect(fp1.date_end).toBeNull();
  });
});
