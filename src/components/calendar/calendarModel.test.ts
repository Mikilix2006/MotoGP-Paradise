import { describe, expect, it } from "vitest";
import {
  SESSION_LABELS,
  formatDate,
  formatSessionTime,
  getDayKey,
  getOffsetLabel,
  getScheduleColumns,
  getStatusConfig,
  validZone,
} from "./calendarModel";
import { cambioHorario, calSession, sinFecha } from "./__fixtures__/events";

describe("getStatusConfig (CAL-03)", () => {
  it.each([
    ["FINISHED", "Finalizado"],
    ["CURRENT", "En curso"],
    ["NOT-STARTED", "Próximamente"],
    ["CANCELLED", "Próximamente"],
    ["", "Próximamente"],
  ])("estado %j -> %s", (status, label) => {
    expect(getStatusConfig(status).label).toBe(label);
  });

  it("En curso se pinta en rojo y Finalizado apagado", () => {
    expect(getStatusConfig("CURRENT").style).toContain("text-red-400");
    expect(getStatusConfig("FINISHED").style).toContain("text-zinc-400");
  });
});

describe("formatDate (CAL-03)", () => {
  it("formatea AAAA-MM-DD en es-ES sin desfase de día", () => {
    expect(formatDate("2026-05-03")).toBe("3 may 2026");
    expect(formatDate("2026-12-31")).toBe("31 dic 2026");
  });
});

describe("validZone (CAL-05)", () => {
  it("acepta IANA en mayúsculas tal cual llega de la BD", () => {
    expect(validZone("ASIA/QATAR")).toBe("ASIA/QATAR");
    expect(validZone("Europe/Madrid")).toBe("Europe/Madrid");
  });

  it.each([null, undefined, "", "NO/EXISTE", "Atlantis"])("rechaza %j", (zone) => {
    expect(validZone(zone)).toBeNull();
  });
});

describe("getOffsetLabel (CAL-05)", () => {
  const verano = new Date("2026-07-01T12:00:00Z");
  const invierno = new Date("2026-01-15T12:00:00Z");

  it("enteros: UTC+2 en verano y UTC+1 en invierno (cambio de hora)", () => {
    expect(getOffsetLabel(verano, "Europe/Madrid")).toBe("UTC+2");
    expect(getOffsetLabel(invierno, "Europe/Madrid")).toBe("UTC+1");
  });

  it("medias horas: UTC+5:30", () => {
    expect(getOffsetLabel(verano, "Asia/Kolkata")).toBe("UTC+5:30");
  });

  it("signo negativo (el menos tipográfico de Intl también cuenta) y minutos", () => {
    expect(getOffsetLabel(verano, "America/Chicago")).toBe("UTC-5");
    expect(getOffsetLabel(invierno, "America/St_Johns")).toBe("UTC-3:30");
  });

  it("zona IANA en mayúsculas", () => {
    expect(getOffsetLabel(verano, "ASIA/QATAR")).toBe("UTC+3");
  });

  it("UTC (sin desfase en el texto) y zona indefinida usan el respaldo o la local", () => {
    expect(getOffsetLabel(verano, "UTC")).toBe("UTC+0");
    // TZ=Europe/Madrid en la configuración de Vitest
    expect(getOffsetLabel(verano, undefined)).toBe("UTC+2");
  });
});

describe("formatSessionTime (CAL-07)", () => {
  it("HH:mm en 24 h en la zona indicada", () => {
    expect(formatSessionTime("2026-05-01T08:00:00.000Z", "Europe/Madrid")).toBe("10:00");
    expect(formatSessionTime("2026-05-01T14:05:00.000Z", "Europe/Madrid")).toBe("16:05");
    expect(formatSessionTime("2026-05-01T14:05:00.000Z", "Asia/Tokyo")).toBe("23:05");
  });

  it("medianoche es 00:00, no 24:00", () => {
    expect(formatSessionTime("2026-05-01T22:00:00.000Z", "Europe/Madrid")).toBe("00:00");
  });

  it("sin fecha o fecha inválida devuelve —", () => {
    expect(formatSessionTime(null, "Europe/Madrid")).toBe("—");
    expect(formatSessionTime("no es fecha", "Europe/Madrid")).toBe("—");
  });
});

describe("SESSION_LABELS (CAL-08)", () => {
  it("nombres en español, RAC2 también es Carrera", () => {
    expect(SESSION_LABELS).toMatchObject({
      FP1: "FP1",
      FP2: "FP2",
      PR: "Práctica",
      Q1: "Q1",
      Q2: "Q2",
      SPR: "Sprint",
      WUP: "Warm Up",
      RAC: "Carrera",
      RAC2: "Carrera",
    });
  });
});

describe("getDayKey", () => {
  it("día AAAA-MM-DD en la zona dada", () => {
    const d = new Date("2026-10-02T00:00:00Z");
    expect(getDayKey(d, "Asia/Tokyo")).toBe("2026-10-02");
    expect(getDayKey(d, "America/Los_Angeles")).toBe("2026-10-01");
  });
});

describe("getScheduleColumns (CAL-06)", () => {
  it("una columna por día en la zona mostrada, ordenadas por fecha", () => {
    const desordenadas = [...cambioHorario].reverse();
    const columns = getScheduleColumns(desordenadas, "Asia/Tokyo");
    expect(columns.map((c) => [c.key, c.label])).toEqual([
      ["2026-10-02", "Viernes"],
      ["2026-10-03", "Sábado"],
      ["2026-10-04", "Domingo"],
    ]);
  });

  it("cambio-horario: la sesión del viernes del circuito cae en jueves en tu hora", () => {
    const columns = getScheduleColumns(cambioHorario, "America/Los_Angeles");
    expect(columns.map((c) => c.label)).toEqual(["Jueves", "Viernes", "Sábado"]);
    expect(columns[0].sessions.map((s) => s.id)).toEqual(["fp1"]);
  });

  it("sin fecha: sale como — bajo su día local (weekday), al final; sin fecha ni día no sale", () => {
    const columns = getScheduleColumns(sinFecha, "Europe/Madrid");
    expect(columns.map((c) => [c.key, c.label])).toEqual([
      ["2026-05-01", "Viernes"],
      ["sin-fecha-5", "Viernes"],
    ]);
    expect(columns[1].sessions.map((s) => s.id)).toEqual(["b"]);
    expect(columns.flatMap((c) => c.sessions).map((s) => s.id)).not.toContain("c");
  });

  it("varias sesiones del mismo día comparten columna y mantienen el orden de entrada", () => {
    const columns = getScheduleColumns(
      [
        calSession("a", "FP1", "2026-05-01T08:00:00.000Z"),
        calSession("b", "FP2", "2026-05-01T12:00:00.000Z"),
      ],
      "Europe/Madrid"
    );
    expect(columns).toHaveLength(1);
    expect(columns[0].sessions.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("sin sesiones, sin columnas", () => {
    expect(getScheduleColumns(undefined, "Europe/Madrid")).toEqual([]);
    expect(getScheduleColumns([], "Europe/Madrid")).toEqual([]);
  });
});
