import type { PatientId } from '@/features/patients/types';
import type { PhysicianId } from '@/features/physicians/types';

export type AppointmentId = string;

/** Valores serializados como ISO 8601 con zona horaria. */
export type IsoDateTime = string;

/**
 * Estados autorizados para una cita. Las transiciones y permisos se validarán
 * en la capa de aplicación cuando se implemente el módulo.
 */
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';

/** Duraciones previstas por la especificación funcional del proyecto. */
export type AppointmentDurationMinutes = 15 | 30 | 45 | 60;

/** Registro que una futura fuente de datos debe entregar al módulo de citas. */
export type Appointment = {
  createdAt: IsoDateTime;
  durationMinutes: AppointmentDurationMinutes;
  id: AppointmentId;
  patientId: PatientId;
  physicianId: PhysicianId;
  reason: string;
  scheduledAt: IsoDateTime;
  status: AppointmentStatus;
  updatedAt: IsoDateTime;
};

/** Datos necesarios para solicitar el registro de una cita. */
export type CreateAppointmentInput = {
  durationMinutes: AppointmentDurationMinutes;
  patientId: PatientId;
  physicianId: PhysicianId;
  reason: string;
  scheduledAt: IsoDateTime;
};

/** Datos que pueden cambiarse al reprogramar una cita. */
export type RescheduleAppointmentInput = {
  durationMinutes: AppointmentDurationMinutes;
  scheduledAt: IsoDateTime;
};

/** Datos mínimos para conservar el motivo de una cancelación. */
export type CancelAppointmentInput = {
  reason: string;
};

/** Filtros de lectura para agenda o historial, sin decisiones de UI. */
export type AppointmentQuery = {
  from?: IsoDateTime;
  patientId?: PatientId;
  physicianId?: PhysicianId;
  status?: AppointmentStatus;
  to?: IsoDateTime;
};

/**
 * Límite de persistencia del módulo. No presupone base de datos ni proveedor.
 * La implementación concreta vivirá en infraestructura cuando ésta se decida.
 */
export interface AppointmentRepository {
  create(input: CreateAppointmentInput): Promise<Appointment>;
  findById(id: AppointmentId): Promise<Appointment | null>;
  list(query?: AppointmentQuery): Promise<Appointment[]>;
  update(id: AppointmentId, appointment: Appointment): Promise<Appointment>;
}

/**
 * Operaciones de aplicación previstas, todavía sin implementación.
 * Cada método debe verificar sesión y autorización en servidor antes de leer
 * o escribir. El frontend nunca entrega un rol como prueba de permiso.
 * Fallos del proveedor deben notificarse como error, nunca como lista vacía.
 */
export interface AppointmentService {
  cancel(
    id: AppointmentId,
    input: CancelAppointmentInput,
  ): Promise<Appointment>;
  confirm(id: AppointmentId): Promise<Appointment>;
  create(input: CreateAppointmentInput): Promise<Appointment>;
  getById(id: AppointmentId): Promise<Appointment | null>;
  list(query?: AppointmentQuery): Promise<Appointment[]>;
  reschedule(
    id: AppointmentId,
    input: RescheduleAppointmentInput,
  ): Promise<Appointment>;
}
