import { prisma } from "@/lib/prisma";

import { importSessions } from "./sessionImporter";
import { importSessionResults } from "./sessionResultImporter";
import { importEvents } from "./eventImporter";
import { importRiderStatistics } from "./riderStatisticsImporter";
import { importChampionshipStandings } from "./championshipStandingImporter";
import { importBmwAwardStandings } from "./bmwAwardImporter";
import { trackSyncRun } from "./syncTracking";

/*
 * ============================================================
 * SINCRONIZACIÓN EN VIVO DE SESIONES
 * ============================================================
 *
 * Mantiene la base de datos al día durante un fin de semana de
 * carreras sin recorrer el histórico:
 *
 *   1. Localiza los eventos "activos": los que están en curso
 *      según sus fechas (con un día de margen a cada lado).
 *   2. Refresca sus sesiones desde la API de resultados, que es
 *      quien marca cada sesión como FINISHED.
 *   3. Importa la clasificación de las sesiones terminadas que
 *      aún no tienen resultados (la API la publica unos minutos
 *      después de acabar) y vuelve a importar las terminadas
 *      hace poco por si hay correcciones (sanciones).
 *   4. Si ha entrado el resultado de una carrera o sprint,
 *      encadena lo que depende de ella: estado del evento,
 *      estadísticas de piloto, clasificación del campeonato y
 *      BMW Award, todo acotado a la temporada.
 *
 * Es idempotente: ejecutarla cuando no ha pasado nada no toca
 * la base de datos (solo refresca el estado de las sesiones).
 * Devuelve cuándo conviene volver a ejecutarla.
 */

/* Margen alrededor de las fechas del evento para considerarlo activo. */
const EVENT_ACTIVE_MARGIN_MS = 24 * 60 * 60 * 1000;

/*
 * Duración estimada por tipo de sesión cuando la API no da
 * hora de fin (en las carreras dateEnd == dateStart).
 */
const DEFAULT_DURATION_MINUTES: Record<string, number> = {
  RAC: 50,
  SPR: 30,
  Q: 15,
  FP: 60,
  PR: 60,
  WUP: 10,
};

const FALLBACK_DURATION_MINUTES = 60;

/* Espera tras el fin previsto antes de preguntar por resultados. */
const AFTER_SESSION_BUFFER_MS = 2 * 60 * 1000;

/* Cadencia mientras se espera la publicación de una clasificación. */
const POLL_INTERVAL_MS = 2 * 60 * 1000;

/*
 * Ventana tras el fin de una sesión durante la que se vuelve a
 * importar su clasificación aunque ya tenga resultados, para
 * recoger sanciones y correcciones.
 */
const REIMPORT_WINDOW_MS = 6 * 60 * 60 * 1000;

/*
 * Si una sesión debería haber acabado hace más de esto y la API
 * sigue sin marcarla FINISHED (cancelada, pospuesta), se deja de
 * esperar por ella.
 */
const GIVE_UP_AFTER_MS = 4 * 60 * 60 * 1000;

const RACE_TYPES = new Set(["RAC", "SPR"]);

export interface LiveSyncResult {
  seasonYear: number | null;
  activeEvents: string[];
  sessionsRefreshed: number;

  /** Sesiones cuya clasificación se ha importado en este ciclo. */
  sessionsImported: string[];

  /** Sesiones terminadas cuya clasificación aún no publica la API. */
  sessionsAwaitingResults: string[];

  /** Se ha ejecutado la cadena posterior a una carrera. */
  postRaceChainExecuted: boolean;

  /** Cuándo conviene volver a ejecutar la sincronización. */
  nextWakeAt: Date | null;

  /** Motivo del próximo despertar, para el log. */
  nextWakeReason: string;
}

/**
 * Convierte una hora de pared guardada como UTC (los dígitos de
 * la hora local del circuito) en el instante real, usando la
 * zona horaria del evento. Dos pasadas para resolver el offset
 * en la propia zona (cambios de horario).
 */
export function wallClockToInstant(
  wallClock: Date,
  timeZone: string | null
): Date {
  if (!timeZone) {
    return wallClock;
  }

  const offsetAt = (instant: Date): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(instant);

    const name =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";

    const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);

    if (!match) {
      return 0;
    }

    const minutes = Number(match[2]) * 60 + Number(match[3]);

    return match[1] === "+" ? minutes : -minutes;
  };

  let instant = new Date(wallClock.getTime() - offsetAt(wallClock) * 60_000);

  instant = new Date(wallClock.getTime() - offsetAt(instant) * 60_000);

  return instant;
}

interface SessionWindow {
  id: string;
  label: string;
  type: string | null;
  status: string | null;
  startsAt: Date;
  endsAt: Date;
  resultsCount: number;
}

async function loadSessionWindows(
  eventIds: string[]
): Promise<SessionWindow[]> {
  const sessions = await prisma.session.findMany({
    where: {
      eventId: { in: eventIds },
      resultsUuid: { not: null },
      dateStart: { not: null },
    },

    select: {
      id: true,
      type: true,
      shortname: true,
      status: true,
      dateStart: true,
      dateEnd: true,

      category: { select: { name: true } },

      event: {
        select: { shortName: true, timeZone: true },
      },

      _count: { select: { results: true } },
    },

    orderBy: { dateStart: "asc" },
  });

  return sessions.map((session) => {
    const timeZone = session.event.timeZone;

    const startsAt = wallClockToInstant(
      session.dateStart as Date,
      timeZone
    );

    const hasRealEnd =
      session.dateEnd !== null &&
      session.dateEnd.getTime() > (session.dateStart as Date).getTime();

    const durationMinutes =
      DEFAULT_DURATION_MINUTES[session.type ?? ""] ??
      FALLBACK_DURATION_MINUTES;

    const endsAt = hasRealEnd
      ? wallClockToInstant(session.dateEnd as Date, timeZone)
      : new Date(startsAt.getTime() + durationMinutes * 60_000);

    return {
      id: session.id,
      label: `${session.event.shortName ?? "?"} ${session.category.name} ${
        session.shortname ?? session.type ?? "?"
      }`,
      type: session.type,
      status: session.status,
      startsAt,
      endsAt,
      resultsCount: session._count.results,
    };
  });
}

/**
 * Eventos cuyo fin de semana cubre el instante indicado.
 */
async function findActiveEvents(seasonId: string, now: Date) {
  const events = await prisma.event.findMany({
    where: {
      seasonId,
      isTest: false,
      dateStart: { not: null },
    },

    select: {
      id: true,
      shortName: true,
      dateStart: true,
      dateEnd: true,
    },

    orderBy: { dateStart: "asc" },
  });

  return events.filter((event) => {
    const start = (event.dateStart as Date).getTime() - EVENT_ACTIVE_MARGIN_MS;

    const end =
      (event.dateEnd ?? event.dateStart as Date).getTime() +
      EVENT_ACTIVE_MARGIN_MS * 2;

    return start <= now.getTime() && now.getTime() <= end;
  });
}

/**
 * Primer instante de sesión del siguiente evento de la temporada,
 * para dormir hasta entonces cuando no hay nada activo.
 */
async function findNextSessionStart(
  seasonId: string,
  now: Date
): Promise<{ at: Date; label: string } | null> {
  const upcoming = await prisma.event.findMany({
    where: {
      seasonId,
      isTest: false,
      dateStart: { gt: new Date(now.getTime() - EVENT_ACTIVE_MARGIN_MS) },
    },

    select: { id: true, shortName: true },

    orderBy: { dateStart: "asc" },

    take: 2,
  });

  for (const event of upcoming) {
    const windows = await loadSessionWindows([event.id]);

    const next = windows.find((window) => window.endsAt > now);

    if (next) {
      return {
        at: new Date(next.endsAt.getTime() + AFTER_SESSION_BUFFER_MS),
        label: next.label,
      };
    }
  }

  return null;
}

export async function syncLiveSessions(
  now: Date = new Date()
): Promise<LiveSyncResult> {
  const season = await prisma.season.findFirst({
    where: { current: true },
  });

  if (!season) {
    return {
      seasonYear: null,
      activeEvents: [],
      sessionsRefreshed: 0,
      sessionsImported: [],
      sessionsAwaitingResults: [],
      postRaceChainExecuted: false,
      nextWakeAt: null,
      nextWakeReason: "no hay temporada actual",
    };
  }

  const activeEvents = await findActiveEvents(season.id, now);

  if (activeEvents.length === 0) {
    const next = await findNextSessionStart(season.id, now);

    return {
      seasonYear: season.year,
      activeEvents: [],
      sessionsRefreshed: 0,
      sessionsImported: [],
      sessionsAwaitingResults: [],
      postRaceChainExecuted: false,
      nextWakeAt: next?.at ?? null,
      nextWakeReason: next
        ? `fin previsto de ${next.label}`
        : "no quedan sesiones en la temporada",
    };
  }

  const eventIds = activeEvents.map((event) => event.id);

  /*
   * 1. Estado de las sesiones según la API (FINISHED / NOT-STARTED).
   */
  const sessionsResult = await importSessions({ eventIds });

  const windows = await loadSessionWindows(eventIds);

  /*
   * 2. Qué sesiones necesitan clasificación.
   */
  const pending = windows.filter((window) => {
    if (window.status !== "FINISHED") {
      return false;
    }

    if (window.resultsCount === 0) {
      return true;
    }

    return now.getTime() - window.endsAt.getTime() <= REIMPORT_WINDOW_MS;
  });

  const sessionsImported: string[] = [];
  const sessionsAwaitingResults: string[] = [];

  let raceResultsArrived = false;

  if (pending.length > 0) {
    await importSessionResults({
      sessionIds: pending.map((window) => window.id),
    });

    const counts = await prisma.sessionResult.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: pending.map((window) => window.id) } },
      _count: true,
    });

    const countBySession = new Map(
      counts.map((row) => [row.sessionId, row._count])
    );

    for (const window of pending) {
      const countNow = countBySession.get(window.id) ?? 0;

      if (countNow === 0) {
        sessionsAwaitingResults.push(window.label);
        continue;
      }

      sessionsImported.push(window.label);

      if (window.resultsCount === 0 && RACE_TYPES.has(window.type ?? "")) {
        raceResultsArrived = true;
      }
    }
  }

  /*
   * 3. Tras una carrera o sprint: todo lo que depende de ella.
   */
  let postRaceChainExecuted = false;

  if (raceResultsArrived) {
    await trackSyncRun(
      {
        source: "RESULTS",
        endpoint: "/live-sync/post-race",
        getStats: () => ({ processed: sessionsImported.length }),
      },
      async () => {
        await importEvents({ seasonYear: season.year });
        await importRiderStatistics({ seasonYear: season.year });
        await importChampionshipStandings({ seasonYear: season.year });
        await importBmwAwardStandings({ seasonYear: season.year });
      }
    );

    postRaceChainExecuted = true;
  } else if (sessionsImported.length > 0) {
    await trackSyncRun(
      {
        source: "RESULTS",
        endpoint: "/live-sync/sessions",
        getStats: () => ({ processed: sessionsImported.length }),
      },
      async () => undefined
    );
  }

  /*
   * 4. Cuándo volver. Se recargan las sesiones para planificar
   *    con los contadores posteriores a la importación.
   */
  const refreshedWindows =
    pending.length > 0 ? await loadSessionWindows(eventIds) : windows;

  let { nextWakeAt, nextWakeReason } = planNextWake(refreshedWindows, now);

  if (!nextWakeAt) {
    const next = await findNextSessionStart(season.id, now);

    if (next) {
      nextWakeAt = next.at;
      nextWakeReason = `fin previsto de ${next.label}`;
    }
  }

  return {
    seasonYear: season.year,
    activeEvents: activeEvents.map((event) => event.shortName ?? event.id),
    sessionsRefreshed: sessionsResult.sessionsProcessed,
    sessionsImported,
    sessionsAwaitingResults,
    postRaceChainExecuted,
    nextWakeAt,
    nextWakeReason,
  };
}

function planNextWake(
  windows: SessionWindow[],
  now: Date
): { nextWakeAt: Date | null; nextWakeReason: string } {
  /*
   * Sesiones terminadas sin clasificación, o que deberían haber
   * terminado y la API aún no marca: se pregunta cada poco.
   */
  const waiting = windows.find((window) => {
    const overdue =
      window.endsAt <= now &&
      now.getTime() - window.endsAt.getTime() <= GIVE_UP_AFTER_MS;

    if (!overdue) {
      return false;
    }

    return window.status !== "FINISHED" || window.resultsCount === 0;
  });

  if (waiting) {
    return {
      nextWakeAt: new Date(now.getTime() + POLL_INTERVAL_MS),
      nextWakeReason: `esperando resultados de ${waiting.label}`,
    };
  }

  const upcoming = windows
    .filter((window) => window.endsAt > now)
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())[0];

  if (upcoming) {
    return {
      nextWakeAt: new Date(upcoming.endsAt.getTime() + AFTER_SESSION_BUFFER_MS),
      nextWakeReason: `fin previsto de ${upcoming.label}`,
    };
  }

  return {
    nextWakeAt: null,
    nextWakeReason: "no quedan sesiones en los eventos activos",
  };
}
