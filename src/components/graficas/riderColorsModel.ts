// Colores y trazos de la gráfica de puntos (lógica pura, sin React).
// Un color por piloto y temporada: marca (constructor) -> tono base; equipos de la misma marca
// (oficial y satélites) = mismo tono con luminosidad distinta; compañeros = mismo color con
// trazo continuo/discontinuo y marcador distinto, según el orden de dorsal dentro del equipo.
import { visibleTeamColor } from "@/components/riders/riderModel";

export type MarkerShape = "circle" | "square" | "diamond";

export interface SeriesStyle {
  color: string;
  /** `stroke-dasharray`; `null` = trazo continuo. */
  dash: string | null;
  marker: MarkerShape;
}

export interface StyleRider {
  id: string;
  number: number | null;
  team: { id: string; name: string; color: string | null } | null;
  constructor_name: string | null;
}

// Tono (hue) y saturación base por marca, más los pasos [desplazamiento de tono, luminosidad HSL]
// de sus equipos: el oficial va primero (L50) y los satélites cambian tono Y luminosidad, dentro
// de ~40-62 para que se vean sobre fondo claro y oscuro. Pasos elegidos con una búsqueda que
// maximiza la distancia entre equipos de la parrilla MotoGP 2026 (ver el test de GRA-U13).
// Aprilia morado como en RiderStandings; Honda carmesí (335) para no confundirse con Ducati (2).
type Step = [shift: number, lightness: number];
const BRANDS: { key: string; hue: number; sat: number; steps: Step[] }[] = [
  { key: "ducati", hue: 2, sat: 88, steps: [[0, 50], [20, 40], [16, 62]] },
  { key: "aprilia", hue: 272, sat: 68, steps: [[0, 50], [20, 56]] },
  { key: "ktm", hue: 28, sat: 100, steps: [[0, 50], [20, 40]] },
  { key: "honda", hue: 335, sat: 80, steps: [[0, 50], [-24, 44]] },
  { key: "yamaha", hue: 218, sat: 82, steps: [[0, 50], [-24, 48]] },
  { key: "suzuki", hue: 195, sat: 85, steps: [[0, 50], [16, 58], [-16, 42]] },
];
// Equipos de una marca más allá de sus pasos propios (Moto2/Moto3): se reutilizan estos y se
// desplaza el tono un poco más en cada vuelta.
const EXTRA_STEPS: Step[] = [[12, 60], [-12, 42], [24, 56], [-24, 46]];

const FALLBACK_PALETTE = ["#14b8a6", "#16a34a", "#06b6d4", "#f472b6", "#6366f1", "#b45309", "#65a30d", "#0ea5e9", "#d946ef"];

const DASHES: (string | null)[] = [null, "7 4", "2 3"];
const MARKERS: MarkerShape[] = ["circle", "square", "diamond"];

const FACTORY = /factory|hrc|lenovo|aprilia racing|monster energy yamaha/i;

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const v = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s * 100, l * 100];
}

/** Acerca un color de equipo a una luminosidad que se vea sobre fondo claro y oscuro. */
export function clampVisible(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(62, Math.max(40, l)));
}

/** Luminancia relativa WCAG de un `#rrggbb`. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG entre un color y blanco (`white`) o negro. */
export function contrastWith(hex: string, background: "white" | "black"): number {
  const l = luminance(hex);
  return background === "white" ? 1.05 / (l + 0.05) : (l + 0.05) / 0.05;
}

const byNumber = (a: StyleRider, b: StyleRider) =>
  (a.number ?? Infinity) - (b.number ?? Infinity) || a.id.localeCompare(b.id);

export function buildRiderStyles(riders: StyleRider[]): Record<string, SeriesStyle> {
  const groups = new Map<string, StyleRider[]>();
  for (const rider of riders) {
    const key = rider.team?.id ?? `piloto:${rider.id}`;
    groups.set(key, [...(groups.get(key) ?? []), rider]);
  }
  const teamName = (members: StyleRider[]) => members[0].team?.name ?? "";
  const brandOf = (members: StyleRider[]) =>
    BRANDS.find((b) => members.some((m) => (m.constructor_name ?? "").toLowerCase().includes(b.key)));

  const teamColor = new Map<string, string>();
  const byBrand = new Map<string, StyleRider[][]>();
  const others: StyleRider[][] = [];
  for (const members of groups.values()) {
    members.sort(byNumber);
    const brand = brandOf(members);
    if (brand) byBrand.set(brand.key, [...(byBrand.get(brand.key) ?? []), members]);
    else others.push(members);
  }

  for (const [key, teams] of byBrand) {
    const brand = BRANDS.find((b) => b.key === key)!;
    teams.sort(
      (a, b) =>
        Number(FACTORY.test(teamName(b))) - Number(FACTORY.test(teamName(a))) ||
        teamName(a).localeCompare(teamName(b)) ||
        a[0].id.localeCompare(b[0].id)
    );
    teams.forEach((members, i) => {
      const extra = i - brand.steps.length;
      const [shift, light] =
        extra < 0 ? brand.steps[i] : EXTRA_STEPS[extra % EXTRA_STEPS.length];
      const turn = extra < 0 ? 0 : 8 * Math.floor(extra / EXTRA_STEPS.length);
      teamColor.set(members[0].id, hslToHex(brand.hue + shift + turn, brand.sat, light));
    });
  }

  // Sin marca conocida: color del equipo si es visible y no repetido; si no, paleta fija.
  const used = new Set<string>();
  let paletteIndex = 0;
  others.sort((a, b) => teamName(a).localeCompare(teamName(b)) || a[0].id.localeCompare(b[0].id));
  for (const members of others) {
    const own = visibleTeamColor(members[0].team?.color);
    let color = own ? clampVisible(own) : null;
    if (!color || used.has(color)) {
      do color = FALLBACK_PALETTE[paletteIndex++ % FALLBACK_PALETTE.length];
      while (used.has(color) && paletteIndex < FALLBACK_PALETTE.length * 2);
    }
    used.add(color);
    teamColor.set(members[0].id, color);
  }

  const styles: Record<string, SeriesStyle> = {};
  for (const members of groups.values()) {
    const color = teamColor.get(members[0].id)!;
    members.forEach((m, i) => {
      styles[m.id] = { color, dash: DASHES[i % DASHES.length], marker: MARKERS[i % MARKERS.length] };
    });
  }
  return styles;
}
