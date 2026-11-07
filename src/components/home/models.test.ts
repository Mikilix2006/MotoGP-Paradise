import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateTimeRemaining, formatNumber } from "./countdownModel";
import { formatSprintDate, formatSprintTime, selectLeader } from "./championshipModel";
import { formatPercent, formatPosition, formatSigned } from "./favoritesViewModel";
import { formatDate, formatStatus } from "./nextGrandPrixModel";
import { constructorCountry, formatStandingPosition, isPodium, medalText } from "./standingsModel";

afterEach(() => vi.useRealTimers());

describe("nextGrandPrixModel", () => {
  it("formatDate da día, mes largo y año en español", () => {
    expect(formatDate("2026-03-06")).toBe("6 de marzo de 2026");
  });

  it("formatDate con fecha vacía o inválida devuelve null en vez de lanzar (INI-02)", () => {
    expect(formatDate("")).toBeNull();
    expect(formatDate("no-es-fecha")).toBeNull();
  });

  it("formatStatus traduce los estados y deja pasar los desconocidos", () => {
    expect(formatStatus("CURRENT")).toBe("En curso");
    expect(formatStatus("NOT-STARTED")).toBe("Próximamente");
    expect(formatStatus("FINISHED")).toBe("Finalizado");
    expect(formatStatus("CANCELLED")).toBe("CANCELLED");
  });
});

describe("countdownModel (INI-04)", () => {
  const ahora = new Date("2026-03-01T10:00:00Z");

  it("desglosa días, horas, minutos y segundos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    // 2 d 3 h 4 min 5 s
    const objetivo = new Date(ahora.getTime() + ((2 * 24 + 3) * 60 + 4) * 60_000 + 5000).toISOString();
    expect(calculateTimeRemaining(objetivo)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it("al llegar o pasarse se queda en cero, sin negativos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    const cero = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(calculateTimeRemaining(ahora.toISOString())).toEqual(cero);
    expect(calculateTimeRemaining("2020-01-01T00:00:00Z")).toEqual(cero);
  });

  it("formatNumber rellena a dos cifras y no recorta las de tres", () => {
    expect(formatNumber(0)).toBe("00");
    expect(formatNumber(7)).toBe("07");
    expect(formatNumber(123)).toBe("123");
  });
});

describe("championshipModel", () => {
  it("sin fecha de sprint: guion en fecha y hora", () => {
    expect(formatSprintDate(null)).toBe("—");
    expect(formatSprintTime(null)).toBe("—");
  });

  it("la hora peninsular es la de Madrid (CET en invierno)", () => {
    expect(formatSprintTime("2026-03-07T14:00:00.000Z")).toBe("15:00");
  });

  it("selectLeader elige al de más puntos y no muta la lista", () => {
    const lista = [{ n: "a", statistics: { points: 5 } }, { n: "b", statistics: { points: 9 } }];
    expect(selectLeader(lista).n).toBe("b");
    expect(lista[0].n).toBe("a");
  });

  it("con empate a puntos gana el primero en el orden de la API", () => {
    const lista = [
      { n: "a", statistics: { points: 9 } },
      { n: "b", statistics: { points: 9 } },
      { n: "c", statistics: { points: 1 } },
    ];
    expect(selectLeader(lista).n).toBe("a");
  });

  // INI-06: confirmada, el día usa la zona del navegador y la hora la de Madrid.
  it.fails("SOSPECHA: el día de la sprint concuerda con la hora peninsular cerca de medianoche (INI-06)", () => {
    const tz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const sprint = "2026-03-28T23:30:00.000Z"; // 00:30 del domingo 29 en Madrid
      expect(formatSprintTime(sprint)).toBe("00:30");
      expect(formatSprintDate(sprint)).toContain("29 de marzo");
    } finally {
      process.env.TZ = tz;
    }
  });
});

describe("standingsModel", () => {
  it("constructorCountry reconoce la marca dentro del nombre, sin distinguir mayúsculas", () => {
    expect(constructorCountry("Ducati Lenovo Team")).toEqual({ iso: "IT", name: "Italia" });
    expect(constructorCountry("red bull KTM factory")?.iso).toBe("AT");
    expect(constructorCountry("Yamaha")?.iso).toBe("JP");
  });

  it("constructorCountry devuelve null si no hay coincidencia", () => {
    expect(constructorCountry("Equipo Raro")).toBeNull();
    expect(constructorCountry("")).toBeNull();
  });

  it("podio: posiciones 1 a 3", () => {
    expect([1, 2, 3].every(isPodium)).toBe(true);
    expect(isPodium(4)).toBe(false);
  });

  // INI-09: confirmada, `0 <= 3` hace podio a un piloto sin posición.
  it("la posición 0 (sin posición) no es podio y se muestra '—' (INI-09)", () => {
    expect(isPodium(0)).toBe(false);
    expect(formatStandingPosition(0)).toBe("—");
  });

  it("formatStandingPosition rellena a dos cifras", () => {
    expect(formatStandingPosition(1)).toBe("01");
    expect(formatStandingPosition(22)).toBe("22");
  });

  it("medalText: oro, plata, bronce y color de texto para el resto", () => {
    expect(medalText(1)).toContain("--gold");
    expect(medalText(2)).toContain("--silver");
    expect(medalText(3)).toContain("--bronze");
    expect(medalText(4)).toBe("text-white");
  });
});

describe("favoritesViewModel", () => {
  it("formatPosition: ordinal o guion si es nulo", () => {
    expect(formatPosition(3)).toBe("3º");
    expect(formatPosition(null)).toBe("—");
  });

  it("formatPercent redondea", () => {
    expect(formatPercent(0.876)).toBe("88%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("formatSigned pone + solo a los positivos", () => {
    expect(formatSigned(2)).toBe("+2");
    expect(formatSigned(0)).toBe("0");
    expect(formatSigned(-1.5)).toBe("-1.5");
  });
});
