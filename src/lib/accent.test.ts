// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { applyAccent } from "./accentClient";
import {
  ACCENT_COOKIE,
  ACCENT_SCRIPT,
  ACCENT_STYLE_ID,
  accentCookieValue,
  accentCss,
  contrast,
  deriveAccent,
  parseHex,
  toHex,
  type Rgb,
} from "./accent";

const WHITE: Rgb = [255, 255, 255];
const LIGHT_BG: Rgb = [235, 235, 235];
const DARK_SURFACE: Rgb = [20, 20, 20];

describe("parseHex / toHex", () => {
  it("acepta #rrggbb con o sin # y rechaza lo demás", () => {
    expect(parseHex("#E10600")).toEqual([225, 6, 0]);
    expect(parseHex("e10600")).toEqual([225, 6, 0]);
    for (const bad of ["", "#fff", "#12345", "#12345g", "rgb(1,2,3)", "#1234567"]) expect(parseHex(bad)).toBeNull();
    expect(toHex([225, 6, 0])).toBe("#e10600");
  });
});

describe("deriveAccent: contraste en los dos temas", () => {
  // Colores límite (blanco, negro, grises) y una barrida de tonos con distinta saturación/luminosidad.
  const samples = ["#ffffff", "#000000", "#808080", "#ffff00", "#00ffff", "#0000ff", "#e10600", "#1e90ff", "#ff69b4"];
  for (let h = 0; h < 360; h += 30) for (const s of [30, 70, 100]) for (const l of [20, 50, 85]) samples.push(hslHex(h, s, l));

  it.each(samples)("%s cumple AA en claro (texto y fondo de botón) y en oscuro", (hex) => {
    const t = deriveAccent(hex)!;
    expect(contrast(t.light, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.light, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.dark, WHITE)).toBeGreaterThanOrEqual(4.5); // texto blanco sobre el botón
    expect(contrast(t.dark, DARK_SURFACE)).toBeGreaterThanOrEqual(3); // se distingue de la superficie
    expect(contrast(t.darkText, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5); // texto sobre oscuro
  });

  it("un color que ya cumple no se toca y uno inválido da null", () => {
    expect(deriveAccent("#c80500")!.light).toEqual([200, 5, 0]);
    expect(deriveAccent("rojo")).toBeNull();
  });

  it("conserva el tono al ajustar (un azul sigue siendo azul)", () => {
    const [r, g, b] = deriveAccent("#00aaff")!.light;
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });
});

describe("script del <head> y cookie", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.cookie = `${ACCENT_COOKIE}=; max-age=0; path=/`;
  });

  it("el script produce exactamente el mismo CSS que accentCss", () => {
    const t = deriveAccent("#1e90ff")!;
    document.cookie = `${ACCENT_COOKIE}=${accentCookieValue(t)}; path=/`;
    new Function(ACCENT_SCRIPT)();
    expect(document.getElementById(ACCENT_STYLE_ID)!.textContent).toBe(accentCss(t));
  });

  it("ignora una cookie manipulada (no inyecta CSS)", () => {
    const evil = encodeURIComponent(JSON.stringify({ l: ["0;}body{display:none", 0, 0], d: [1, 2, 3], t: [1, 2, 3] }));
    document.cookie = `${ACCENT_COOKIE}=${evil}; path=/`;
    new Function(ACCENT_SCRIPT)();
    expect(document.getElementById(ACCENT_STYLE_ID)).toBeNull();
    document.cookie = `${ACCENT_COOKIE}=%7Bno-json; path=/`;
    expect(() => new Function(ACCENT_SCRIPT)()).not.toThrow();
  });

  it("applyAccent pinta, recuerda y se deshace", () => {
    const t = deriveAccent("#1e90ff")!;
    applyAccent(t);
    expect(document.getElementById(ACCENT_STYLE_ID)!.textContent).toBe(accentCss(t));
    expect(document.cookie).toContain(`${ACCENT_COOKIE}=`);
    applyAccent(null);
    expect(document.getElementById(ACCENT_STYLE_ID)).toBeNull();
    expect(document.cookie).not.toContain(`${ACCENT_COOKIE}=`);
  });
});

function hslHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(c * 255);
  };
  return toHex([f(0), f(8), f(4)]);
}
