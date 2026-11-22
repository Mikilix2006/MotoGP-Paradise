import { describe, expect, it } from "vitest";

import { getMadridTimestamp, wallClockToInstant } from "./date";

const utc = (y: number, m: number, d: number, h = 0, min = 0) =>
  Date.UTC(y, m - 1, d, h, min);

describe("getMadridTimestamp (respaldo sin zona)", () => {
  it("ignora el offset de la API y lee la hora como Madrid en verano (CEST)", () => {
    expect(getMadridTimestamp("2026-08-30T14:00:00+00:00")).toBe(utc(2026, 8, 30, 12));
  });

  it("lee la hora como Madrid en invierno (CET)", () => {
    expect(getMadridTimestamp("2026-01-15T14:00:00+00:00")).toBe(utc(2026, 1, 15, 13));
  });

  it("aplica el horario vigente en los días de cambio de hora", () => {
    expect(getMadridTimestamp("2026-03-29T12:00:00+00:00")).toBe(utc(2026, 3, 29, 10));
    expect(getMadridTimestamp("2026-10-25T12:00:00+00:00")).toBe(utc(2026, 10, 25, 11));
  });

  it("si el formato no encaja, cae al Date normal", () => {
    expect(getMadridTimestamp("2026-08-30")).toBe(utc(2026, 8, 30));
    expect(getMadridTimestamp("no es una fecha")).toBeNaN();
  });
});

describe("wallClockToInstant (reloj local del circuito)", () => {
  // Los campos UTC de la fecha de entrada son el reloj de pared, tal como se guarda Session.dateStart.
  const pared = (y: number, m: number, d: number, h: number, min = 0) =>
    new Date(utc(y, m, d, h, min));

  it("España 14:00 en verano es CEST (12:00 UTC)", () => {
    expect(wallClockToInstant(pared(2026, 8, 30, 14), "Europe/Madrid").getTime()).toBe(
      utc(2026, 8, 30, 12)
    );
  });

  it("Chicago 15:00 en verano es CDT (20:00 UTC)", () => {
    expect(wallClockToInstant(pared(2026, 8, 30, 15), "America/Chicago").getTime()).toBe(
      utc(2026, 8, 30, 20)
    );
  });

  it("Melbourne 14:00 en enero es AEDT (03:00 UTC)", () => {
    expect(wallClockToInstant(pared(2026, 1, 15, 14), "Australia/Melbourne").getTime()).toBe(
      utc(2026, 1, 15, 3)
    );
  });

  it("una zona sin horario de verano usa siempre el mismo desfase (Tokio, +9)", () => {
    expect(wallClockToInstant(pared(2026, 8, 30, 14), "Asia/Tokyo").getTime()).toBe(
      utc(2026, 8, 30, 5)
    );
    expect(wallClockToInstant(pared(2026, 1, 15, 14), "Asia/Tokyo").getTime()).toBe(
      utc(2026, 1, 15, 5)
    );
  });

  it("en los días de cambio de hora usa el desfase vigente a esa hora", () => {
    expect(wallClockToInstant(pared(2026, 3, 29, 12), "Europe/Madrid").getTime()).toBe(
      utc(2026, 3, 29, 10)
    );
    expect(wallClockToInstant(pared(2026, 10, 25, 12), "Europe/Madrid").getTime()).toBe(
      utc(2026, 10, 25, 11)
    );
  });

  it("conserva los minutos", () => {
    expect(wallClockToInstant(pared(2026, 8, 30, 9, 45), "Europe/Madrid").getTime()).toBe(
      utc(2026, 8, 30, 7, 45)
    );
  });

  it("una zona inválida lanza RangeError", () => {
    expect(() => wallClockToInstant(pared(2026, 8, 30, 14), "Mars/Olympus")).toThrow(RangeError);
  });
});
