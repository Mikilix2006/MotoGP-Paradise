export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatStatus(status: string) {
  const statuses: Record<string, string> = {
    CURRENT: "En curso",
    "NOT-STARTED": "Próximamente",
    FINISHED: "Finalizado",
  };

  return statuses[status] ?? status;
}
