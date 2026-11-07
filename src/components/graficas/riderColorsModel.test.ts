import { describe, expect, it } from "vitest";

import { buildRiderStyles, clampVisible, contrastWith, hslToHex, type StyleRider } from "./riderColorsModel";

let n = 0;
const r = (num: number | null, team: string, brand: string | null, color: string | null = null): StyleRider => ({
  id: `r${++n}`,
  number: num,
  team: { id: team, name: team, color },
  constructor_name: brand,
});

// MotoGP 2026 (equipos y marcas reales).
const GRID_2026 = [
  r(93, "Ducati Lenovo Team", "Ducati", "#ad0000"),
  r(63, "Ducati Lenovo Team", "Ducati", "#ad0000"),
  r(73, "BK8 Gresini Racing MotoGP", "Ducati", "#9baee4"),
  r(54, "BK8 Gresini Racing MotoGP", "Ducati", "#9baee4"),
  r(49, "Pertamina Enduro VR46 Racing Team", "Ducati", "#262626"),
  r(21, "Pertamina Enduro VR46 Racing Team", "Ducati", "#262626"),
  r(89, "Aprilia Racing", "Aprilia", "#5f259f"),
  r(72, "Aprilia Racing", "Aprilia", "#5f259f"),
  r(79, "SuperFile Trackhouse MotoGP Team", "Aprilia", "#262626"),
  r(25, "SuperFile Trackhouse MotoGP Team", "Aprilia", "#262626"),
  r(37, "Red Bull KTM Factory Racing", "KTM", "#ff7e27"),
  r(33, "Red Bull KTM Factory Racing", "KTM", "#ff7e27"),
  r(23, "Red Bull KTM Tech3", "KTM", "#262626"),
  r(12, "Red Bull KTM Tech3", "KTM", "#262626"),
  r(10, "Honda HRC Castrol", "Honda", "#e50000"),
  r(36, "Honda HRC Castrol", "Honda", "#e50000"),
  r(11, "Honda LCR", "Honda", "#fafafa"),
  r(5, "Honda LCR", "Honda", "#fafafa"),
  r(20, "Monster Energy Yamaha MotoGP", "Yamaha", "#0a2d82"),
  r(42, "Monster Energy Yamaha MotoGP", "Yamaha", "#0a2d82"),
  r(43, "Prima Pramac Yamaha MotoGP", "Yamaha", "#262626"),
  r(7, "Prima Pramac Yamaha MotoGP", "Yamaha", "#262626"),
];

const MIN_DIST = 60; // distancia RGB mínima entre equipos distintos
const dist = (a: string, b: string) =>
  Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));

describe("colores por marca y equipo (GRA-U13)", () => {
  const styles = buildRiderStyles(GRID_2026);
  const byNumber = (num: number) => styles[GRID_2026.find((x) => x.number === num)!.id];

  it("el equipo oficial lleva el color base de su marca", () => {
    expect(byNumber(93).color).toBe(hslToHex(2, 88, 50)); // Ducati rojo
    expect(byNumber(89).color).toBe(hslToHex(272, 68, 50)); // Aprilia morado
    expect(byNumber(37).color).toBe(hslToHex(28, 100, 50)); // KTM naranja
    expect(byNumber(10).color).toBe(hslToHex(335, 80, 50)); // Honda carmesí
    expect(byNumber(20).color).toBe(hslToHex(218, 82, 50)); // Yamaha azul
  });

  it("los satélites comparten tono con su marca pero cambian la luminosidad", () => {
    const factory = byNumber(93).color;
    expect(byNumber(73).color).not.toBe(factory);
    expect(byNumber(49).color).not.toBe(byNumber(73).color);
    expect(byNumber(79).color).not.toBe(byNumber(89).color);
  });

  it("compañeros: mismo color, trazo y marcador distintos por orden de dorsal", () => {
    // Dorsal menor primero: 63 continuo, 93 discontinuo.
    expect(byNumber(63)).toMatchObject({ dash: null, marker: "circle" });
    expect(byNumber(93)).toMatchObject({ dash: "7 4", marker: "square" });
    expect(byNumber(63).color).toBe(byNumber(93).color);
  });

  it("ningún equipo repite color y los colores se ven en claro y en oscuro", () => {
    const perTeam = new Map(GRID_2026.map((x) => [x.team!.id, styles[x.id].color]));
    const colors = [...perTeam.values()];
    expect(new Set(colors).size).toBe(colors.length);
    for (const c of colors) {
      expect(contrastWith(c, "white")).toBeGreaterThan(2.2);
      expect(contrastWith(c, "black")).toBeGreaterThan(3.2);
    }
  });

  it("los colores de equipos distintos se distinguen entre sí", () => {
    const colors = [...new Set(GRID_2026.map((x) => styles[x.id].color))];
    for (let i = 0; i < colors.length; i++)
      for (let j = i + 1; j < colors.length; j++) expect(dist(colors[i], colors[j])).toBeGreaterThan(MIN_DIST);
  });

  it("una marca con muchos equipos (Moto3) no repite color ni se acerca a otro equipo", () => {
    const teams = Array.from({ length: 8 }, (_, i) => r(10 + i, `KTM Moto3 ${i}`, "KTM"));
    const colors = Object.values(buildRiderStyles(teams)).map((x) => x.color);
    expect(new Set(colors).size).toBe(8);
    for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) expect(dist(colors[i], colors[j])).toBeGreaterThan(20);
  });

  it("es estable: no depende del orden de entrada", () => {
    const shuffled = buildRiderStyles([...GRID_2026].reverse());
    for (const x of GRID_2026) expect(shuffled[x.id]).toEqual(styles[x.id]);
  });
});

describe("respaldo sin marca conocida (GRA-U14)", () => {
  it("usa el color del equipo (ajustado) y, si falta o se repite, la paleta fija", () => {
    const riders = [
      r(1, "Kalex A", "Kalex", "#00aa44"),
      r(2, "Kalex B", "Kalex", "#00aa44"),
      r(3, "Kalex C", "Kalex", "#262626"),
      r(4, "Kalex D", null, null),
    ];
    const s = buildRiderStyles(riders);
    expect(s[riders[0].id].color).toBe(clampVisible("#00aa44"));
    const all = riders.map((x) => s[x.id].color);
    expect(new Set(all).size).toBe(4);
  });

  it("piloto sin equipo recibe estilo propio; un tercer compañero rota trazo", () => {
    const solo: StyleRider = { id: "x", number: 1, team: null, constructor_name: null };
    expect(buildRiderStyles([solo]).x).toMatchObject({ dash: null, marker: "circle" });
    const trio = [r(1, "T", "Ducati"), r(2, "T", "Ducati"), r(3, "T", "Ducati")];
    const s = buildRiderStyles(trio);
    expect(trio.map((x) => s[x.id].dash)).toEqual([null, "7 4", "2 3"]);
  });
});
