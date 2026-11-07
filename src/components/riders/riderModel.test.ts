import { afterEach, describe, expect, it, vi } from "vitest";

import { ageFrom, categoryRank, cleanCategory, fallbackDescription, groupTrajectory, plural, visibleTeamColor } from "./riderModel";
import { paso, piloto } from "./__fixtures__/pilotos";

afterEach(() => vi.useRealTimers());

describe("visibleTeamColor (PIL-04)", () => {
  it("color válido y visible se conserva", () => {
    expect(visibleTeamColor("#ad0000")).toBe("#ad0000");
    expect(visibleTeamColor("#0a2d82")).toBe("#0a2d82");
    expect(visibleTeamColor("#FFFFFF")).toBe("#FFFFFF");
  });

  it("casi negro (#262626) se ignora; el límite es 64 en el canal más alto", () => {
    expect(visibleTeamColor("#262626")).toBeNull();
    expect(visibleTeamColor("#3f3f3f")).toBeNull();
    expect(visibleTeamColor("#404040")).toBe("#404040");
  });

  it("nulo, vacío o no hexadecimal de 6 cifras se ignora", () => {
    expect(visibleTeamColor(null)).toBeNull();
    expect(visibleTeamColor(undefined)).toBeNull();
    expect(visibleTeamColor("")).toBeNull();
    expect(visibleTeamColor("red")).toBeNull();
    expect(visibleTeamColor("#fff")).toBeNull();
    expect(visibleTeamColor("ad0000")).toBeNull();
  });
});

describe("ageFrom (PIL-04)", () => {
  // Mediodía local: no depende de la zona del PC.
  const hoy = () => vi.useFakeTimers().setSystemTime(new Date(2026, 10, 7, 12));

  it("el día del cumpleaños ya cuenta el año; el día anterior no", () => {
    hoy();
    expect(ageFrom("2000-11-07")).toBe(26);
    expect(ageFrom("2000-11-08")).toBe(25);
    expect(ageFrom("2000-11-06")).toBe(26);
  });

  it("mes posterior o anterior", () => {
    hoy();
    expect(ageFrom("2000-12-01")).toBe(25);
    expect(ageFrom("2000-01-31")).toBe(26);
  });

  it("acepta una fecha ISO con hora", () => {
    hoy();
    expect(ageFrom("2000-11-07T00:00:00.000Z")).toBe(26);
  });

  it("nulo, malformado, futuro o inverosímil dan null", () => {
    hoy();
    expect(ageFrom(null)).toBeNull();
    expect(ageFrom("")).toBeNull();
    expect(ageFrom("no-fecha")).toBeNull();
    expect(ageFrom("2030-01-01")).toBeNull();
    expect(ageFrom("1850-01-01")).toBeNull();
  });
});

describe("fallbackDescription (PIL-04)", () => {
  it("une dorsal, país, edad, ciudad, equipo y marca", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 10, 7, 12));
    expect(fallbackDescription(piloto())).toBe(
      "Dorsal #93 · España · 33 años · Nacido en Cervera · Equipo Rojo · Moto Ducati"
    );
  });

  it("omite lo que falta y puede quedar vacía", () => {
    const vacio = piloto({ number: null, country: null, birth_date: null, birth_city: null, team: null, constructor_name: null });
    expect(fallbackDescription(vacio)).toBe("");
    expect(fallbackDescription(piloto({ ...vacio, number: 0 }))).toBe("Dorsal #0");
  });
});

describe("cleanCategory, plural y categoryRank (PIL-05)", () => {
  it("cleanCategory quita todas las ™", () => {
    expect(cleanCategory("MotoGP™")).toBe("MotoGP");
    expect(cleanCategory("500cc")).toBe("500cc");
  });

  it("plural: singular solo con 1; el 0 va en plural; miles en es-ES", () => {
    expect(plural(1, "título", "títulos")).toBe("1 título");
    expect(plural(0, "punto", "puntos")).toBe("0 puntos");
    expect(plural(2, "punto", "puntos")).toBe("2 puntos");
    expect(plural(12345, "punto", "puntos")).toBe("12.345 puntos");
  });

  it("categoryRank: clase reina, intermedia, pequeña y desconocida", () => {
    expect(categoryRank("MotoGP™")).toBe(0);
    expect(categoryRank("500cc")).toBe(0);
    expect(categoryRank("Moto2™")).toBe(1);
    expect(categoryRank("250cc")).toBe(1);
    expect(categoryRank("Moto3™")).toBe(2);
    expect(categoryRank("125cc")).toBe(2);
    expect(categoryRank("MotoE")).toBe(3);
  });
});

describe("groupTrajectory (PIL-05, PIL-06)", () => {
  it("une temporadas consecutivas idénticas y ordena de antigua a reciente", () => {
    const g = groupTrajectory([paso(2018), paso(2016), paso(2017)]);
    expect(g).toHaveLength(1);
    expect([g[0].from, g[0].to]).toEqual([2016, 2018]);
  });

  it("cualquier cambio de categoría, equipo, marca o dorsal abre un tramo nuevo", () => {
    const g = groupTrajectory([
      paso(2016),
      paso(2017, { category: "MotoGP™" }),
      paso(2018, { category: "MotoGP™", team_name: "Equipo B" }),
      paso(2019, { category: "MotoGP™", team_name: "Equipo B", constructor_name: "Honda" }),
      paso(2020, { category: "MotoGP™", team_name: "Equipo B", constructor_name: "Honda", number: 99 }),
    ]);
    expect(g.map((x) => [x.from, x.to])).toEqual([[2016, 2016], [2017, 2017], [2018, 2018], [2019, 2019], [2020, 2020]]);
  });

  it("sin pasos no hay tramos y no se muta la entrada", () => {
    expect(groupTrajectory([])).toEqual([]);
    const pasos = [paso(2018), paso(2016)];
    groupTrajectory(pasos);
    expect(pasos.map((p) => p.year)).toEqual([2018, 2016]);
  });

  // 2016 falta: el tramo 2015–2017 afirma que corrió también en 2016.
  it.fails("SOSPECHA 5: no junta temporadas no consecutivas con los mismos datos", () => {
    const g = groupTrajectory([paso(2015), paso(2017)]);
    expect(g.map((x) => [x.from, x.to])).toEqual([[2015, 2015], [2017, 2017]]);
  });
});
