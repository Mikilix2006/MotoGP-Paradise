import type { CalendarSession } from "@/types/grandPrix";

function toTime(date: string | null): number {
  return date ? new Date(date).getTime() : NaN;
}

function hasStarted(session: CalendarSession, now: number): boolean {
  const start = toTime(session.date_start);
  return !Number.isNaN(start) && start <= now;
}

// Terminada: estado FINISHED de la BD o, si va por detrás (el watcher tarda),
// fin de sesión (instante absoluto ya convertido desde la hora del circuito) pasado.
export function isSessionFinished(session: CalendarSession, now: number): boolean {
  if (session.status === "FINISHED") return true;
  const end = toTime(session.date_end);
  const start = toTime(session.date_start);
  // Sprint y carreras llegan con fin == inicio (sin duración real): la hora no
  // dice cuándo acaban, así que solo manda el estado FINISHED de la BD.
  if (!Number.isNaN(start) && end <= start) return false;
  return !Number.isNaN(end) && end < now;
}

// Las sesiones de un GP no se solapan: de las empezadas y no terminadas solo la
// última es la que está en vivo; las anteriores son retraso del watcher.
export function getLiveSessionId(
  sessions: CalendarSession[],
  now: number
): string | null {
  let live: CalendarSession | null = null;
  for (const session of sessions) {
    if (!hasStarted(session, now) || isSessionFinished(session, now)) continue;
    if (!live || toTime(session.date_start) > toTime(live.date_start)) live = session;
  }
  return live?.id ?? null;
}

export function getSessionState(
  session: CalendarSession,
  liveId: string | null,
  now: number
): { live: boolean; finished: boolean } {
  const live = session.id === liveId;
  // Empezada y no en vivo = ya la ha relevado otra sesión.
  const finished = !live && (isSessionFinished(session, now) || hasStarted(session, now));
  return { live, finished };
}
