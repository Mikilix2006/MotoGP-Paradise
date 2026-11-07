// Día y hora de la sprint en la zona del visitante ("Tu hora", como el calendario):
// así el día y la hora nunca se contradicen cerca de medianoche (INI-06).
export function formatSprintDate(date: string | null): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

export function formatSprintTime(date: string | null): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

// Líder = el piloto con más puntos; con empate se mantiene el orden de la API (sort estable).
export function selectLeader<T extends { statistics: { points: number } }>(
  riders: T[]
): T {
  return [...riders].sort(
    (a, b) => b.statistics.points - a.statistics.points
  )[0];
}
