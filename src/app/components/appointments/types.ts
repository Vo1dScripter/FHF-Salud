import type { AppointmentView as AppointmentViewContract } from '@/features/appointments';

/** Referencias autorizadas resueltas por la capa de lectura. */
export type AppointmentView = AppointmentViewContract;

export type AppointmentListState =
  | {
      kind:
        | 'preparation'
        | 'loading'
        | 'empty'
        | 'unauthenticated'
        | 'forbidden'
        | 'not_found';
    }
  | { kind: 'error'; message?: string }
  | { kind: 'populated'; appointments: AppointmentView[] };

export type AppointmentFormState =
  | 'preparation'
  | 'validation'
  | 'submitting'
  | 'success';

export function formatAppointmentDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: 'short',
    timeZone: 'America/Mexico_City',
    year: 'numeric',
  }).format(date);
}

export function formatAppointmentRange(iso: string, durationMinutes: number) {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 'Horario no disponible';
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const dateOnly = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'short',
  });
  const sameDay = dateOnly.format(start) === dateOnly.format(end);
  const endLabel = sameDay
    ? new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(end)
    : formatAppointmentDate(end.toISOString());
  return `${formatAppointmentDate(iso)}–${endLabel} · UTC−06:00 · ${durationMinutes} minutos`;
}
