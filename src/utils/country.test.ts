import { describe, expect, it } from "vitest";

import { countryNameEs, flagSrc } from "./country";

describe("countryNameEs (PIL-07)", () => {
  it("traduce al español, sin importar mayúsculas ni espacios", () => {
    expect(countryNameEs("ES", "Spain")).toBe("España");
    expect(countryNameEs(" it ", "Italy")).toBe("Italia");
  });

  it("YU es Yugoslavia, no Serbia", () => {
    expect(countryNameEs("YU", "Yugoslavia")).toBe("Yugoslavia");
    expect(countryNameEs("yu", "x")).toBe("Yugoslavia");
  });

  it("código desconocido, no válido para Intl o ausente: conserva el nombre de la BD", () => {
    expect(countryNameEs("XX", "Nombre BD")).toBe("Nombre BD");
    expect(countryNameEs("RSM", "San Marino")).toBe("San Marino");
    expect(countryNameEs("", "Nombre BD")).toBe("Nombre BD");
    expect(countryNameEs(null, "Nombre BD")).toBe("Nombre BD");
    expect(countryNameEs(undefined, "Nombre BD")).toBe("Nombre BD");
  });
});

describe("flagSrc (CountryFlag)", () => {
  it("usa el nombre del archivo de la url si son dos mayúsculas", () => {
    expect(flagSrc("https://photos.motogp.com/flags/IN.svg", "ES")).toBe("/flags/in.svg");
  });

  it("smr es San Marino (sm)", () => {
    expect(flagSrc("https://photos.motogp.com/flags/smr.svg", "SM")).toBe("/flags/sm.svg");
  });

  it("sin url o con un nombre que no son dos mayúsculas, usa el iso", () => {
    expect(flagSrc(null, "ES")).toBe("/flags/es.svg");
    expect(flagSrc("https://photos.motogp.com/flags/spain.svg", "ES")).toBe("/flags/es.svg");
    expect(flagSrc("https://photos.motogp.com/flags/es.svg", "IT")).toBe("/flags/it.svg");
  });
});
