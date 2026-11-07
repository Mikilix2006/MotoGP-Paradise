// null si la fecha falta o no es válida (la API manda "" cuando la BD no la tiene):
// formatear un Invalid Date lanza RangeError y rompía toda la tarjeta.
export function formatDate(date: string): string | null {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function formatStatus(status: string) {
  const statuses: Record<string, string> = {
    CURRENT: "En curso",
    "NOT-STARTED": "Próximamente",
    FINISHED: "Finalizado",
  };

  return statuses[status] ?? status;
}
