import { z } from 'zod';

import type {
  AppointmentDurationMinutes,
  AppointmentQuery,
  AppointmentStatus,
  CancelAppointmentInput,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from './contracts';
import { AppointmentError } from './errors';

export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
] as const satisfies readonly AppointmentStatus[];

export const APPOINTMENT_DURATIONS = [
  15, 30, 45, 60,
] as const satisfies readonly AppointmentDurationMinutes[];

const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isIsoDateTime(value: string): boolean {
  return (
    isoDateTimePattern.test(value) && !Number.isNaN(new Date(value).getTime())
  );
}

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const appointmentDurationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
  z.literal(60),
]);

const uuidSchema = z.string().uuid('Selecciona una referencia válida.');

const isoDateTimeSchema = z
  .string()
  .refine(isIsoDateTime, 'La fecha debe incluir una zona horaria válida.');

export const createAppointmentSchema = z.object({
  durationMinutes: appointmentDurationSchema,
  patientId: uuidSchema,
  physicianId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(1, 'El motivo de consulta es obligatorio.')
    .max(500, 'El motivo no puede superar 500 caracteres.'),
  scheduledAt: isoDateTimeSchema,
});

export const appointmentQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  patientId: uuidSchema.optional(),
  physicianId: uuidSchema.optional(),
  status: appointmentStatusSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

export const rescheduleAppointmentSchema = z.object({
  durationMinutes: appointmentDurationSchema,
  scheduledAt: isoDateTimeSchema,
});

export const cancelAppointmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Indica el motivo de la cancelación.')
    .max(500, 'El motivo de cancelación no puede superar 500 caracteres.'),
});

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || 'form';
    if (!fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

export function parseCreateAppointmentInput(
  input: unknown,
): CreateAppointmentInput {
  const result = createAppointmentSchema.safeParse(input);
  if (!result.success) {
    throw new AppointmentError(
      'validation',
      'Revisa los campos obligatorios de la cita.',
      fieldErrorsFromZod(result.error),
    );
  }
  return result.data;
}

export function parseRescheduleAppointmentInput(
  input: unknown,
): RescheduleAppointmentInput {
  const result = rescheduleAppointmentSchema.safeParse(input);
  if (!result.success) {
    throw new AppointmentError(
      'validation',
      'Revisa la nueva fecha, hora y duración de la cita.',
      fieldErrorsFromZod(result.error),
    );
  }
  return result.data;
}

export function parseCancelAppointmentInput(
  input: unknown,
): CancelAppointmentInput {
  const result = cancelAppointmentSchema.safeParse(input);
  if (!result.success) {
    throw new AppointmentError(
      'validation',
      'Revisa el motivo de cancelación.',
      fieldErrorsFromZod(result.error),
    );
  }
  return result.data;
}

export function parseExpectedUpdatedAt(
  value: unknown,
): string {
  const result = isoDateTimeSchema.safeParse(value);
  if (!result.success) {
    throw new AppointmentError(
      'validation',
      'No se recibió la versión de la cita. Recarga la agenda e inténtalo de nuevo.',
      { expectedUpdatedAt: 'Recarga la cita antes de modificarla.' },
    );
  }
  return result.data;
}

export function parseAppointmentQuery(
  input: Record<string, string | undefined>,
): AppointmentQuery {
  const cleaned = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = appointmentQuerySchema.safeParse(cleaned);
  if (!result.success) {
    throw new AppointmentError(
      'validation',
      'Los filtros de agenda no son válidos.',
      fieldErrorsFromZod(result.error),
    );
  }
  if (
    result.data.from &&
    result.data.to &&
    new Date(result.data.from).getTime() >= new Date(result.data.to).getTime()
  ) {
    throw new AppointmentError(
      'validation',
      'El rango de fechas no es válido.',
      { to: 'La fecha final debe ser posterior al inicio.' },
    );
  }
  return result.data;
}

export function appointmentEndIso(
  scheduledAt: string,
  durationMinutes: AppointmentDurationMinutes,
): string {
  return new Date(
    new Date(scheduledAt).getTime() + durationMinutes * 60_000,
  ).toISOString();
}

/**
 * No existe una regla de horario de atención aprobada. Solo se rechaza un
 * inicio claramente pasado; la comprobación de disponibilidad queda en RF-05.
 */
export function assertScheduledAtNotPast(
  scheduledAt: string,
  now: Date = new Date(),
): void {
  const toleranceMs = 60_000;
  if (new Date(scheduledAt).getTime() < now.getTime() - toleranceMs) {
    throw new AppointmentError(
      'validation',
      'La cita no puede registrarse en el pasado.',
      { scheduledAt: 'Selecciona una fecha y hora futuras.' },
    );
  }
}
