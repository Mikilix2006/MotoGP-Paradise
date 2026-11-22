import { afterEach, describe, expect, it, vi } from "vitest";

import { registroAbierto } from "./registro";

describe("registroAbierto (interruptor de cuentas)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("está apagado si la variable no existe", () => {
    vi.stubEnv("REGISTRO_ABIERTO", undefined);
    expect(registroAbierto()).toBe(false);
  });

  it("solo el texto exacto «true» lo enciende", () => {
    vi.stubEnv("REGISTRO_ABIERTO", "true");
    expect(registroAbierto()).toBe(true);
    for (const valor of ["false", "", "1", "TRUE", "True", " true"]) {
      vi.stubEnv("REGISTRO_ABIERTO", valor);
      expect(registroAbierto(), `«${valor}»`).toBe(false);
    }
  });

  it("se lee en cada llamada, no al importar el módulo", () => {
    vi.stubEnv("REGISTRO_ABIERTO", "false");
    expect(registroAbierto()).toBe(false);
    vi.stubEnv("REGISTRO_ABIERTO", "true");
    expect(registroAbierto()).toBe(true);
  });
});
