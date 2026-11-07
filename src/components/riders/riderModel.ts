// Lógica pura de la ficha de pilotos (sin React): color de equipo, edad, textos y trayectoria.
import type { RiderCarouselItem, RiderTrajectoryStep } from "@/types/riderCarousel";

const NUMBER = new Intl.NumberFormat("es-ES");

// Color de equipo solo si es un hex válido y no es casi negro (#262626, el «sin color» de la API).
// Se mira el canal más alto y no la luminancia: rojos y azules oscuros (Ducati #ad0000, Yamaha #0a2d82) sí se ven.
export function visibleTeamColor(color: string | null | undefined): string | null {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return Math.max(r, g, b) < 64 ? null : color;
}

// Edad en años cumplidos a partir de yyyy-mm-dd (sin pasar por Date para evitar desfases de zona horaria).
export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

// Descripción de reserva cuando no hay biografía: dorsal, país, edad, ciudad, equipo y marca.
export function fallbackDescription(rider: RiderCarouselItem): string {
  const age = ageFrom(rider.birth_date);
  return [
    rider.number !== null ? `Dorsal #${rider.number}` : null,
    rider.country?.name ?? null,
    age !== null ? `${age} años` : null,
    rider.birth_city ? `Nacido en ${rider.birth_city}` : null,
    rider.team?.name ?? null,
    rider.constructor_name ? `Moto ${rider.constructor_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Los nombres de categoría llegan tal cual de la BD ("MotoGP™", "Moto2™"): sin la marca registrada.
export function cleanCategory(category: string): string {
  return category.replace(/™/g, "");
}

export function plural(n: number, one: string, many: string): string {
  return `${NUMBER.format(n)} ${n === 1 ? one : many}`;
}

// Clase reina primero (MotoGP, 500cc), luego Moto2/250cc y por último Moto3/125cc.
export function categoryRank(category: string): number {
  const name = cleanCategory(category).toLowerCase();
  if (name.includes("motogp") || name.includes("500")) return 0;
  if (name.includes("moto2") || name.includes("250")) return 1;
  if (name.includes("moto3") || name.includes("125")) return 2;
  return 3;
}

export interface TrajectoryGroup {
  from: number;
  to: number;
  step: RiderTrajectoryStep;
}

// Une temporadas consecutivas idénticas (misma categoría, equipo, marca y dorsal) en un solo tramo.
export function groupTrajectory(steps: RiderTrajectoryStep[]): TrajectoryGroup[] {
  const groups: TrajectoryGroup[] = [];
  for (const step of [...steps].sort((a, b) => a.year - b.year)) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.step.category === step.category &&
      last.step.team_name === step.team_name &&
      last.step.constructor_name === step.constructor_name &&
      last.step.number === step.number
    ) {
      last.to = step.year;
    } else {
      groups.push({ from: step.year, to: step.year, step });
    }
  }
  return groups;
}
