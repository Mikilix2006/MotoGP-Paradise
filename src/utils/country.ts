/*
 * Nombre del país en español a partir de su código ISO (la API de MotoGP los da en inglés).
 * Si el código no es una región que Intl conozca (p. ej. «XX» o «RSM»), se conserva el nombre de la BD.
 */

const DISPLAY_NAMES = new Intl.DisplayNames(["es"], { type: "region" });

// Códigos históricos que Intl resuelve a su sucesor (YU → «Serbia»).
const HISTORICOS: Record<string, string> = { YU: "Yugoslavia" };

export function countryNameEs(iso: string | null | undefined, fallback: string): string {
  const code = iso?.trim().toUpperCase();
  if (!code) return fallback;
  if (HISTORICOS[code]) return HISTORICOS[code];
  try {
    const name = DISPLAY_NAMES.of(code);
    return name && name !== code ? name : fallback;
  } catch {
    return fallback;
  }
}

// Archivo local de la bandera: el nombre sale de `url`; "smr" (San Marino) -> sm;
// dos mayúsculas se respetan (hay eventos con SM o IN distintos del país); si no, `iso`.
export function flagSrc(url: string | null, iso: string): string {
  const file = url?.split("/").pop()?.replace(/\.svg$/, "") ?? "";
  const code = file === "smr" ? "sm" : /^[A-Z]{2}$/.test(file) ? file.toLowerCase() : iso.toLowerCase();
  return `/flags/${code}.svg`;
}
