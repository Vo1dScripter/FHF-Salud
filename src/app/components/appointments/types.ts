import type { Appointment } from '@/features/appointments';
import type { PatientReference } from '@/features/patients';
import type { PhysicianReference } from '@/features/physicians';

/** Referencias autorizadas resueltas por la futura capa de lectura. */
export type AppointmentView = Appointment & {
  patient: PatientReference;
  physician: PhysicianReference;
};

export type AppointmentListState =
  | {
      kind:
        | 'preparation'
        | 'loading'
        | 'empty'
        | 'error'
        | 'unauthenticated'
        | 'forbidden';
    }
  | { kind: 'populated'; appointments: AppointmentView[] };

export type AppointmentFormState =
  | 'preparation'
  | 'validation'
  | 'submitting'
  | 'success';

export function formatAppointmentDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: 'short',
    timeZone: 'America/Mexico_City',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatAppointmentRange(iso: string, durationMinutes: number) {
  const end = new Date(new Date(iso).getTime() + durationMinutes * 60_000);
  const dateOnly = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'short',
  });
  const sameDay = dateOnly.format(new Date(iso)) === dateOnly.format(end);
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
