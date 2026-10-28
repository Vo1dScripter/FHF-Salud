export const APPOINTMENT_TIME_ZONE = 'America/Mexico_City';

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const wallClockAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return wallClockAsUtc - date.getTime();
}

/**
 * Convierte el valor de <input type="datetime-local"> interpretado en la zona
 * de la agenda a ISO 8601 con offset. Se repite el cálculo una vez para cubrir
 * cambios de offset estacionales.
 */
export function localDateTimeToIso(
  value: string,
  timeZone = APPOINTMENT_TIME_ZONE,
): string {
  const match = localDateTimePattern.exec(value);
  if (!match) throw new Error('La fecha y hora local no tiene un formato válido.');
  const [, year, month, day, hour, minute, second = '00'] = match;
  const utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let instant = new Date(utcGuess);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = new Date(utcGuess - timeZoneOffsetMs(instant, timeZone));
  }
  return instant.toISOString();
}

export function dateInTimeZone(
  date: Date = new Date(),
  timeZone = APPOINTMENT_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function localDateTimeInputValue(
  date: Date = new Date(),
  timeZone = APPOINTMENT_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

/** Rango semiabierto [inicio del día, inicio del día siguiente). */
export function dayRangeInTimeZone(
  date: string,
  timeZone = APPOINTMENT_TIME_ZONE,
): { from: string; to: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('La fecha del filtro no tiene un formato válido.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = nextDay.toISOString().slice(0, 10);
  return {
    from: localDateTimeToIso(`${date}T00:00`, timeZone),
    to: localDateTimeToIso(`${nextDate}T00:00`, timeZone),
  };
}
