/*
 * Color de acento personalizado. El usuario elige cualquier #rrggbb; aquí se ajusta su
 * LUMINOSIDAD (no el tono) para que siga siendo legible en los dos temas:
 *   - claro:  sirve de fondo de botón (texto blanco) y de color de texto sobre el fondo gris claro.
 *   - oscuro: `dark` es el fondo de botón (texto blanco, visible sobre #141414) y
 *             `darkText` el color de texto sobre fondo oscuro.
 * Las constantes de abajo son las del tema (globals.css).
 */

export type Rgb = [number, number, number];

export interface AccentTokens {
  light: Rgb;
  dark: Rgb;
  darkText: Rgb;
}

const LIGHT_BG: Rgb = [235, 235, 235];
const DARK_SURFACE: Rgb = [20, 20, 20];
const WHITE: Rgb = [255, 255, 255];
const MIN_TEXT = 4.6; // WCAG AA (4.5) con un poco de margen
const MIN_UI = 3.2; // elementos gráficos (barras, bordes): AA pide 3

export const DEFAULT_ACCENT_HEX = "#e10600";

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function luminance([r, g, b]: Rgb): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Mismo tono y saturación, con la luminosidad llevada al intervalo [min, max] (luminancia WCAG). */
export function clampLuminance(rgb: Rgb, min: number, max: number): Rgb {
  const lum = luminance(rgb);
  if (lum >= min && lum <= max) return rgb;
  const target = lum < min ? min : max;
  const [h, s] = toHsl(rgb);
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(fromHsl(h, s, mid)) < target) lo = mid;
    else hi = mid;
  }
  // Redondear a 8 bits puede dejarlo un pelo fuera: se empuja hacia dentro del intervalo.
  const out = fromHsl(h, s, lum < min ? hi : lo);
  return out;
}

// Luminancia máxima para contrastar MIN_TEXT con el fondo claro, y mínima para contrastar con la superficie oscura.
const MAX_LIGHT = (luminance(LIGHT_BG) + 0.05) / MIN_TEXT - 0.05;
const MAX_DARK_BUTTON = (luminance(WHITE) + 0.05) / MIN_TEXT - 0.05; // texto blanco encima
const MIN_DARK_BUTTON = MIN_UI * (luminance(DARK_SURFACE) + 0.05) - 0.05; // visible sobre la superficie
const MIN_DARK_TEXT = MIN_TEXT * (luminance(DARK_SURFACE) + 0.05) - 0.05;

/** `null` si no es un #rrggbb válido. */
export function deriveAccent(hex: string): AccentTokens | null {
  const base = parseHex(hex);
  if (!base) return null;
  return {
    light: clampLuminance(base, 0, MAX_LIGHT),
    dark: clampLuminance(base, MIN_DARK_BUTTON, MAX_DARK_BUTTON),
    darkText: clampLuminance(base, MIN_DARK_TEXT, 1),
  };
}

const triplet = (c: Rgb) => c.join(" ");
const grad = (c: Rgb) =>
  `linear-gradient(135deg,color-mix(in srgb,rgb(${triplet(c)}) 88%,#fff),color-mix(in srgb,rgb(${triplet(c)}) 80%,#000))`;

/** CSS que sobreescribe las variables de acento en los dos temas (más específico que globals.css). */
export function accentCss({ light, dark, darkText }: AccentTokens): string {
  return (
    `html:root{--accent-rgb:${triplet(light)};--accent-text-rgb:${triplet(light)};--accent:${toHex(light)};--accent-grad:${grad(light)}}` +
    `html[data-theme="dark"]{--accent-rgb:${triplet(dark)};--accent-text-rgb:${triplet(darkText)};--accent:${toHex(dark)};--accent-grad:${grad(dark)}}`
  );
}

// --- Cookie funcional `acento` (tokens ya calculados: el script del <head> no recalcula nada) ---

export const ACCENT_COOKIE = "acento";
export const ACCENT_STYLE_ID = "acento-usuario";

export function accentCookieValue(t: AccentTokens): string {
  return encodeURIComponent(JSON.stringify({ l: t.light, d: t.dark, t: t.darkText }));
}

/**
 * Script en línea para el <head>: pinta el acento del usuario antes del primer pintado (sin parpadeo).
 * Solo admite tres tripletes de enteros 0-255: lo que no cuadra se ignora, así que una cookie
 * manipulada no puede inyectar CSS. Debe producir lo mismo que `accentCss` (hay un test que lo comprueba).
 */
export const ACCENT_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )${ACCENT_COOKIE}=([^;]*)/);if(m){var c=JSON.parse(decodeURIComponent(m[1])),ok=function(a){return Array.isArray(a)&&a.length===3&&a.every(function(n){return Number.isInteger(n)&&n>=0&&n<=255})};if(ok(c.l)&&ok(c.d)&&ok(c.t)){var t=function(a){return a.join(" ")},h=function(a){return"#"+a.map(function(n){return(n<16?"0":"")+n.toString(16)}).join("")},g=function(a){return"linear-gradient(135deg,color-mix(in srgb,rgb("+t(a)+") 88%,#fff),color-mix(in srgb,rgb("+t(a)+") 80%,#000))"},s=document.createElement("style");s.id="${ACCENT_STYLE_ID}";s.textContent="html:root{--accent-rgb:"+t(c.l)+";--accent-text-rgb:"+t(c.l)+";--accent:"+h(c.l)+";--accent-grad:"+g(c.l)+"}html[data-theme=\\"dark\\"]{--accent-rgb:"+t(c.d)+";--accent-text-rgb:"+t(c.t)+";--accent:"+h(c.d)+";--accent-grad:"+g(c.d)+"}";document.head.appendChild(s)}}}catch(e){}`;
