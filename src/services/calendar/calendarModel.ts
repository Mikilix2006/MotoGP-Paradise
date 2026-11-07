import type { CalendarSession } from "@/types/grandPrix";
import { getMadridTimestamp, wallClockToInstant } from "@/utils/date";
// Solo tipos: este módulo no debe cargar Prisma para poder probarse aislado.
import type {
  CalendarEventWithDetails,
  CalendarSessionRow,
} from "@/services/db/nextGrandPrixRepository";

export const MOTOGP_CATEGORY_LEGACY_ID = 3;

/**
 * Convierte la hora de pared guardada (hora local del circuito
 * etiquetada como UTC) al instante absoluto correcto. Sin zona
 * horaria válida no se inventa nada: devuelve null.
 */
export function toAbsoluteIso(
  dateStart: Date | null,
  timeZone: string | null
): string | null {
  if (!dateStart || !timeZone) {
    return null;
  }

  try {
    return wallClockToInstant(dateStart, timeZone).toISOString();
  } catch {
    // Zona IANA no reconocida por Intl.
    return null;
  }
}

/*
 * La API de resultados publica para los últimos GP (aún NOT-STARTED)
 * un calendario provisional con las sesiones desplazadas varios días
 * (la hora es correcta, el día no). El horario de la API general, que
 * está en EventScheduleDay, sí es el real.
 *
 * Se detecta el calendario provisional a nivel de evento: alguna
 * sesión cae fuera de [Event.dateStart, Event.dateEnd], que son
 * correctos. Solo entonces se toma el día de EventScheduleDay (por
 * gpDay) y la hora de la propia sesión. No se aplica siempre porque
 * en otros eventos (JPN, AUS) el gpDay de sesiones y horario no
 * encaja con la numeración y corregiría de más.
 */

export function toLocalDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function findProvisionalCorrector(
  event: CalendarEventWithDetails
): ((session: CalendarSessionRow) => Date | null) | null {
  if (!event.timeZone || !event.dateStart || !event.dateEnd) {
    return null;
  }

  const first = toLocalDateKey(event.dateStart);
  const last = toLocalDateKey(event.dateEnd);

  /*
   * La decisión se toma solo con las sesiones de MotoGP (como antes de
   * añadir Moto2/Moto3): el calendario provisional desplaza a todas las
   * categorías por igual y así un dato suelto de otra categoría no
   * puede activar la corrección en un evento correcto.
   */
  const isProvisional = event.sessions.some(
    (session) =>
      session.category.legacyId === MOTOGP_CATEGORY_LEGACY_ID &&
      session.dateStart !== null &&
      (toLocalDateKey(session.dateStart) < first ||
        toLocalDateKey(session.dateStart) > last)
  );

  if (!isProvisional) {
    return null;
  }

  return (session) => {
    if (!session.dateStart || !session.gpDay) {
      return null;
    }

    const matches = event.scheduleDays.filter(
      (day) => day.gpDay === session.gpDay && day.dateStart !== null
    );

    // Sin día único para ese gpDay no se inventa nada.
    if (matches.length !== 1 || !matches[0].dateStart) {
      return null;
    }

    const day = matches[0].dateStart;
    const time = session.dateStart;

    // Fecha del horario real + hora de reloj de la sesión.
    const corrected = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        time.getUTCHours(),
        time.getUTCMinutes(),
        time.getUTCSeconds(),
        time.getUTCMilliseconds()
      )
    );

    const key = toLocalDateKey(corrected);

    // La fecha corregida debe caer dentro del fin de semana del GP.
    return key >= first && key <= last ? corrected : null;
  };
}

/** Nombre de categoría para mostrar: el de la BD sin el símbolo ™. */
export function toCategoryLabel(category: CalendarSessionRow["category"]): string {
  const label = category.name.replace(/™/g, "").trim();

  return label || category.acronym || "";
}

/*
 * En las carreras reiniciadas la API de resultados añade un duplicado
 * "basura" de la carrera: sin shortname ni name, sin broadcastUuid ni
 * gpDay, junto a la sesión real (RAC2). Se descarta solo si existe otra
 * sesión de la misma categoría y tipo; nada más se filtra.
 */
export function isGhostDuplicate(
  session: CalendarSessionRow,
  all: CalendarSessionRow[]
): boolean {
  return (
    session.shortname === null &&
    session.name === null &&
    session.broadcastUuid === null &&
    session.gpDay === null &&
    all.some(
      (other) =>
        other.id !== session.id &&
        other.categoryId === session.categoryId &&
        other.type === session.type
    )
  );
}

export function toCalendarSessions(
  event: CalendarEventWithDetails
): CalendarSession[] {
  const correct = findProvisionalCorrector(event);

  const visible = event.sessions.filter(
    (session) => !isGhostDuplicate(session, event.sessions)
  );

  const sessions = visible.map((session) => {
    // Reloj de pared del circuito (corregido si el calendario es provisional).
    const wallClock = correct?.(session) ?? session.dateStart;

    const calendarSession: CalendarSession = {
      id: session.resultsUuid ?? session.broadcastUuid ?? session.id,
      shortname: session.shortname ?? session.type ?? "",
      name: session.name ?? session.shortname ?? "",
      type: session.type ?? "",
      status: session.status ?? "",
      date_start: toAbsoluteIso(wallClock, event.timeZone),
      // Misma duración sobre el inicio ya corregido (reloj de pared, misma trampa horaria).
      date_end:
        // Fin <= inicio es dato inválido (calendario provisional: el fin no se desplazó con el inicio).
        wallClock && session.dateStart && session.dateEnd &&
        session.dateEnd.getTime() > session.dateStart.getTime()
          ? toAbsoluteIso(
              new Date(
                wallClock.getTime() +
                  session.dateEnd.getTime() -
                  session.dateStart.getTime()
              ),
              event.timeZone
            )
          : null,

      // Día local del circuito: los campos UTC son su reloj de pared.
      weekday: wallClock ? wallClock.getUTCDay() : null,

      category: toCategoryLabel(session.category),
      category_legacy_id: session.category.legacyId ?? 0,
    };

    return calendarSession;
  });

  /*
   * Línea temporal mezclando categorías: por instante ya corregido
   * (no por Session.dateStart crudo). Sin fecha, al final. Desempate
   * determinista: categoría (Moto3, Moto2, MotoGP) y después id.
   */
  return sessions.sort((a, b) => {
    if (a.date_start !== b.date_start) {
      if (a.date_start === null) return 1;
      if (b.date_start === null) return -1;

      return (
        new Date(a.date_start).getTime() -
        new Date(b.date_start).getTime()
      );
    }

    return (
      a.category_legacy_id - b.category_legacy_id ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
  });
}


/**
 * Instante absoluto (ISO) de una hora de pared del circuito guardada
 * como UTC. Sin zona válida, se mantiene la lectura antigua (Madrid).
 */
export function toInstantIso(dateStart: Date, timeZone: string | null): string {
  return (
    toAbsoluteIso(dateStart, timeZone) ??
    new Date(getMadridTimestamp(dateStart.toISOString())).toISOString()
  );
}

export function toDateOnly(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}
