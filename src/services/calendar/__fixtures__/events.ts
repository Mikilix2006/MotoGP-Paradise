import type {
  CalendarEventWithDetails,
  CalendarSessionRow,
} from "@/services/db/nextGrandPrixRepository";

// Fixtures escritas a mano con solo los campos que lee calendarModel.
type SessionInit = {
  id: string;
  legacyId: 1 | 2 | 3;
  type?: string | null;
  shortname?: string | null;
  name?: string | null;
  start: string | null;
  end?: string | null;
  gpDay?: number | null;
  broadcastUuid?: string | null;
};

const CATEGORIES = {
  1: { id: 1, name: "Moto3™", acronym: "MT3", legacyId: 1 },
  2: { id: 2, name: "Moto2™", acronym: "MT2", legacyId: 2 },
  3: { id: 3, name: "MotoGP™", acronym: "MGP", legacyId: 3 },
};

export function sessionRow(init: SessionInit): CalendarSessionRow {
  return {
    id: init.id,
    resultsUuid: `r-${init.id}`,
    broadcastUuid: init.broadcastUuid === undefined ? `b-${init.id}` : init.broadcastUuid,
    type: init.type === undefined ? "RAC" : init.type,
    shortname: init.shortname === undefined ? init.type ?? "RAC" : init.shortname,
    name: init.name === undefined ? "Sesión" : init.name,
    status: "NOT-STARTED",
    dateStart: init.start ? new Date(init.start) : null,
    dateEnd: init.end ? new Date(init.end) : null,
    gpDay: init.gpDay === undefined ? null : init.gpDay,
    categoryId: init.legacyId,
    category: CATEGORIES[init.legacyId],
  } as unknown as CalendarSessionRow;
}

export function eventRow(init: {
  timeZone: string | null;
  start: string;
  end: string;
  sessions: CalendarSessionRow[];
  scheduleDays?: { gpDay: number; dateStart: string | null }[];
}): CalendarEventWithDetails {
  return {
    timeZone: init.timeZone,
    dateStart: new Date(init.start),
    dateEnd: new Date(init.end),
    sessions: init.sessions,
    scheduleDays: (init.scheduleDays ?? []).map((d) => ({
      gpDay: d.gpDay,
      dateStart: d.dateStart ? new Date(d.dateStart) : null,
    })),
  } as unknown as CalendarEventWithDetails;
}

/*
 * qatar-provisional: GP del 6 al 8 de noviembre de 2026 (Asia/Qatar, UTC+3).
 * Las sesiones vienen desplazadas varios días (fuera del evento) y con el fin
 * anterior al inicio; el horario real está en scheduleDays. El orden de
 * entrada es deliberadamente el inverso al esperado en el empate del viernes.
 */
export const qatarProvisional = eventRow({
  timeZone: "ASIA/QATAR",
  start: "2026-11-06",
  end: "2026-11-08",
  scheduleDays: [
    { gpDay: 1, dateStart: "2026-11-06T00:00:00Z" },
    { gpDay: 2, dateStart: "2026-11-07T00:00:00Z" },
    { gpDay: 3, dateStart: "2026-11-08T00:00:00Z" },
  ],
  sessions: [
    sessionRow({ id: "rac", legacyId: 3, type: "RAC", start: "2026-11-04T17:00:00Z", end: "2026-11-03T17:40:00Z", gpDay: 3 }),
    sessionRow({ id: "q2", legacyId: 3, type: "Q2", start: "2026-11-03T15:00:00Z", end: "2026-11-02T15:15:00Z", gpDay: 2 }),
    sessionRow({ id: "fp1-mgp", legacyId: 3, type: "FP1", start: "2026-11-02T10:00:00Z", end: "2026-11-01T10:45:00Z", gpDay: 1 }),
    sessionRow({ id: "fp1-m2", legacyId: 2, type: "FP1", start: "2026-11-02T10:00:00Z", end: "2026-11-01T10:40:00Z", gpDay: 1 }),
    sessionRow({ id: "fp1-m3", legacyId: 1, type: "FP1", start: "2026-11-02T10:00:00Z", end: "2026-11-01T10:35:00Z", gpDay: 1 }),
    // Sin gpDay: no se puede corregir y conserva su fecha cruda.
    sessionRow({ id: "sin-gpday", legacyId: 1, type: "PR", start: "2026-11-02T13:00:00Z", gpDay: null }),
  ],
});

/* duracion-cero: sprint y carrera con fin == inicio (dato inválido, sin fin). */
export const duracionCero = eventRow({
  timeZone: "Europe/Madrid",
  start: "2026-05-01",
  end: "2026-05-03",
  sessions: [
    sessionRow({ id: "spr", legacyId: 3, type: "SPR", start: "2026-05-02T15:00:00Z", end: "2026-05-02T15:00:00Z", gpDay: 2 }),
    sessionRow({ id: "rac", legacyId: 3, type: "RAC", start: "2026-05-03T14:00:00Z", end: "2026-05-03T14:00:00Z", gpDay: 3 }),
    sessionRow({ id: "fp1", legacyId: 3, type: "FP1", start: "2026-05-01T10:00:00Z", end: "2026-05-01T10:45:00Z", gpDay: 1 }),
  ],
});

/* carrera-reiniciada: duplicado fantasma de RAC junto a la RAC2 real. */
const fantasma = (id: string, legacyId: 1 | 2 | 3) =>
  sessionRow({ id, legacyId, type: "RAC", shortname: null, name: null, broadcastUuid: null, gpDay: null, start: "2026-05-03T12:00:00Z" });

export const carreraReiniciada = eventRow({
  timeZone: "Europe/Madrid",
  start: "2026-05-01",
  end: "2026-05-03",
  sessions: [
    fantasma("fantasma", 3),
    sessionRow({ id: "rac2", legacyId: 3, type: "RAC", shortname: "RAC2", name: "Race 2", start: "2026-05-03T13:00:00Z", end: "2026-05-03T13:40:00Z", gpDay: 3 }),
    // Fantasma sin ninguna otra sesión de su categoría y tipo: se conserva.
    fantasma("fantasma-solo", 2),
  ],
});

/* sin-fecha: sesiones sin date_start (con y sin gpDay). */
export const sinFecha = eventRow({
  timeZone: "Europe/Madrid",
  start: "2026-05-01",
  end: "2026-05-03",
  sessions: [
    sessionRow({ id: "con-fecha", legacyId: 3, type: "FP1", start: "2026-05-01T10:00:00Z", gpDay: 1 }),
    sessionRow({ id: "sin-fecha", legacyId: 3, type: "FP2", start: null, gpDay: 1 }),
  ],
});

/*
 * gpday-jpn-aus: evento NO provisional (todas las sesiones dentro del fin de
 * semana) cuyo gpDay no encaja con el horario: no debe corregirse.
 */
export const gpdayJpnAus = eventRow({
  timeZone: "Asia/Tokyo",
  start: "2026-10-02",
  end: "2026-10-04",
  scheduleDays: [
    { gpDay: 1, dateStart: "2026-10-03T00:00:00Z" },
    { gpDay: 2, dateStart: "2026-10-04T00:00:00Z" },
  ],
  sessions: [
    sessionRow({ id: "fp1", legacyId: 3, type: "FP1", start: "2026-10-02T09:00:00Z", end: "2026-10-02T09:45:00Z", gpDay: 1 }),
    sessionRow({ id: "rac", legacyId: 3, type: "RAC", start: "2026-10-04T15:00:00Z", end: "2026-10-04T15:40:00Z", gpDay: 2 }),
  ],
});

/* zona-invalida: evento con una zona que Intl no reconoce. */
export const zonaInvalida = eventRow({
  timeZone: "NO/EXISTE",
  start: "2026-05-01",
  end: "2026-05-03",
  sessions: [sessionRow({ id: "fp1", legacyId: 3, type: "FP1", start: "2026-05-01T10:00:00Z", gpDay: 1 })],
});
