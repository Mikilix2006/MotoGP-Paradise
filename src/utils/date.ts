/**
 * Obtiene el desfase horario de Madrid para una fecha concreta.
 *
 * Esto permite tener en cuenta automáticamente:
 * - Horario de invierno (UTC+1)
 * - Horario de verano (UTC+2)
 */
function getMadridOffset(date: Date): number {
  const madridDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "longOffset",
  }).formatToParts(date);

  const offsetPart = madridDate.find(
    (part) => part.type === "timeZoneName"
  )?.value;

  if (!offsetPart || offsetPart === "GMT") {
    return 0;
  }

  const match = offsetPart.match(
    /GMT([+-])(\d{2}):(\d{2})/
  );

  if (!match) {
    return 0;
  }

  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  const offset = hours * 60 + minutes;

  return match[1] === "+" ? offset : -offset;
}

/**
 * Convierte una fecha procedente de la API de MotoGP
 * interpretando su hora como hora de España peninsular.
 *
 * Ejemplo:
 *
 * API:
 * 2026-08-30T14:00:00+00:00
 *
 * Se interpreta como:
 * 30/08/2026 14:00 Europe/Madrid
 */
export function getMadridTimestamp(apiDate: string): number {
  // Extraemos fecha y hora ignorando el offset de la API.
  const match = apiDate.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  );

  // Si el formato no coincide, usamos el comportamiento normal.
  if (!match) {
    return new Date(apiDate).getTime();
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
  ] = match;

  // Interpretamos temporalmente los valores como UTC.
  const provisionalUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  // Obtenemos el desfase horario de Madrid para esa fecha.
  const offsetMinutes = getMadridOffset(
    new Date(provisionalUtc)
  );

  // Convertimos la hora peninsular al timestamp absoluto correcto.
  return provisionalUtc - offsetMinutes * 60 * 1000;
}

/**
 * Desfase (en ms) de una zona IANA en un instante concreto,
 * incluido el horario de verano de esa zona. Solo usa Intl.
 */
function getZoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));

  const value = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value);

  const localAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );

  // Se descartan los milisegundos: Intl no los devuelve aquí.
  return localAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Interpreta los campos UTC de `date` como hora de pared en la zona
 * IANA `timeZone` (p. ej. "Asia/Tokyo") y devuelve el instante
 * absoluto correcto. Lanza RangeError si la zona no es válida.
 *
 * Regla validada con datos reales de 2026 (BD frente a `broadcasts`
 * de la API general, que trae offset): la hora guardada en
 * Session.dateStart es el reloj local del circuito CON horario de
 * verano (España 14:00 = CEST, Chicago 15:00 = CDT, Melbourne
 * 14:00 = AEDT), no la hora estándar. Por eso basta con convertir
 * el reloj de pared usando el desfase vigente de la zona.
 *
 * No sustituye a getMadridTimestamp (deuda conocida, no se toca).
 */
export function wallClockToInstant(
  date: Date,
  timeZone: string
): Date {
  const wallClockAsUtc = date.getTime();

  // Dos pasadas: la segunda corrige los días de cambio de hora.
  const firstGuess =
    wallClockAsUtc - getZoneOffsetMs(wallClockAsUtc, timeZone);

  return new Date(
    wallClockAsUtc - getZoneOffsetMs(firstGuess, timeZone)
  );
}
