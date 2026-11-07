// Color de los puntos del podio (oro, plata, bronce); resto de posiciones, color de texto.
const MEDAL_TEXT: Record<number, string> = {
  1: "text-[color:var(--gold)]",
  2: "text-[color:var(--silver)]",
  3: "text-[color:var(--bronze)]",
};

export function medalText(position: number): string {
  return MEDAL_TEXT[position] ?? "text-white";
}

// 0 = sin posición (la API la deja vacía y el repositorio pone 0): ni podio ni "00".
export function isPodium(position: number): boolean {
  return position >= 1 && position <= 3;
}

export function formatStandingPosition(position: number): string {
  return position >= 1 ? String(position).padStart(2, "0") : "—";
}

// La BD no guarda el país del constructor: mapa fijo por nombre (sin coincidencia, sin bandera).
const CONSTRUCTOR_COUNTRIES: Record<string, { iso: string; name: string }> = {
  aprilia: { iso: "IT", name: "Italia" },
  ducati: { iso: "IT", name: "Italia" },
  ktm: { iso: "AT", name: "Austria" },
  honda: { iso: "JP", name: "Japón" },
  yamaha: { iso: "JP", name: "Japón" },
  suzuki: { iso: "JP", name: "Japón" },
};

export function constructorCountry(name: string) {
  const key = name.toLowerCase();
  const match = Object.keys(CONSTRUCTOR_COUNTRIES).find((k) => key.includes(k));
  return match ? CONSTRUCTOR_COUNTRIES[match] : null;
}
