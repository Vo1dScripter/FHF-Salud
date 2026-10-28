import type {
  PatientId,
  PatientReference,
} from '@/features/patients/types';
import type {
  PhysicianId,
  PhysicianReference,
} from '@/features/physicians/types';

export type AppointmentId = string;

/** Valores serializados como ISO 8601 con zona horaria. */
export type IsoDateTime = string;

/**
 * Estados autorizados para una cita. El alta siempre crea en `pending`;
 * confirmar, reprogramar y cancelar pertenecen a RF-03/RF-04.
 */
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';

/** Duraciones previstas por la especificación funcional del proyecto. */
export type AppointmentDurationMinutes = 15 | 30 | 45 | 60;

/** Registro que entrega la persistencia al módulo de citas. */
export type Appointment = {
  /**
   * Motivo conservado al cancelar. Es distinto del motivo de consulta y solo
   * existe para las citas canceladas.
   */
  cancelReason?: string | null;
  cancelledAt?: IsoDateTime | null;
  /** Momento de la última confirmación, si la cita llegó a confirmarse. */
  confirmedAt?: IsoDateTime | null;
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

/** Registro de agenda con las referencias mínimas ya resueltas para la interfaz. */
export type AppointmentView = Appointment & {
  patient: PatientReference;
  physician: PhysicianReference;
};

/**
 * Identidad de aplicación. Los roles se leen de app_metadata del JWT firmado;
 * nunca de un encabezado, formulario o selector del navegador.
 *
 * El módulo actual es operado por personal: administración/recepción puede
 * consultar y registrar; un médico solo consulta su propia agenda.
 */
export type AppointmentActor =
  | {
      role: 'admin' | 'receptionist';
      userId: string;
    }
  | {
      physicianId: PhysicianId;
      role: 'physician';
      userId: string;
    };

/**
 * Catálogo mínimo autorizado para construir la agenda y el formulario.
 * `canCreate` es una pista de presentación; la autorización real se vuelve a
 * comprobar en el servicio y en RLS. Un médico recibe solo su propia
 * referencia y ningún paciente.
 */
export type AppointmentDirectory = {
  canCreate: boolean;
  /** Pista de presentación para confirmar, reprogramar o cancelar. */
  canManage: boolean;
  patients: PatientReference[];
  physicians: PhysicianReference[];
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
 * Límite de persistencia del módulo. La implementación de producción usa
 * Supabase/PostgREST y RLS en `supabase-repository.ts`; las pruebas usan dobles.
 */
export interface AppointmentRepository {
  create(input: CreateAppointmentInput): Promise<Appointment>;
  /**
   * Devuelve citas activas del mismo médico que se superponen con el intervalo.
   * `excludeAppointmentId` evita que una reprogramación choque consigo misma.
   * Es una comprobación de UX; la restricción de exclusión de PostgreSQL sigue
   * siendo la garantía ante solicitudes concurrentes.
   */
  findConflicts(
    physicianId: PhysicianId,
    startsAt: IsoDateTime,
    endsAt: IsoDateTime,
    excludeAppointmentId?: AppointmentId,
  ): Promise<Appointment[]>;
  findById(id: AppointmentId): Promise<Appointment | null>;
  list(query?: AppointmentQuery): Promise<Appointment[]>;
  /**
   * Las mutaciones reciben `expectedUpdatedAt` para rechazar cambios basados en
   * una versión desactualizada. La implementación de producción las ejecuta en
   * una función transaccional de PostgreSQL.
   */
  cancel(
    id: AppointmentId,
    input: CancelAppointmentInput,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<Appointment>;
  confirm(
    id: AppointmentId,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<Appointment>;
  reschedule(
    id: AppointmentId,
    input: RescheduleAppointmentInput,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<Appointment>;
}

/** Lectura de agenda con nombres resueltos; puede aplicar RLS en el proveedor. */
export interface AppointmentReader {
  findByIdView(id: AppointmentId): Promise<AppointmentView | null>;
  listView(query?: AppointmentQuery): Promise<AppointmentView[]>;
}

/** Catálogo de referencias activas para el formulario. */
export interface AppointmentDirectoryRepository {
  findPatient(id: PatientId): Promise<PatientReference | null>;
  findPhysician(id: PhysicianId): Promise<PhysicianReference | null>;
  listPatients(): Promise<PatientReference[]>;
  listPhysicians(): Promise<PhysicianReference[]>;
}

/**
 * Operaciones implementadas por el servicio de aplicación. Todas reciben la
 * identidad ya verificada en servidor; las mutaciones devuelven la vista con
 * referencias resueltas para reflejar el cambio de inmediato.
 */
export interface AppointmentAgendaService {
  cancel(
    actor: AppointmentActor,
    id: AppointmentId,
    input: CancelAppointmentInput,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<AppointmentView>;
  confirm(
    actor: AppointmentActor,
    id: AppointmentId,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<AppointmentView>;
  create(
    actor: AppointmentActor,
    input: CreateAppointmentInput,
  ): Promise<Appointment>;
  getById(
    actor: AppointmentActor,
    id: AppointmentId,
  ): Promise<AppointmentView | null>;
  list(
    actor: AppointmentActor,
    query?: AppointmentQuery,
  ): Promise<AppointmentView[]>;
  listReferences(actor: AppointmentActor): Promise<AppointmentDirectory>;
  reschedule(
    actor: AppointmentActor,
    id: AppointmentId,
    input: RescheduleAppointmentInput,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<AppointmentView>;
}

/**
 * Alias conservado para consumidores que ya importaban este contrato. La
 * implementación real es `DefaultAppointmentAgendaService`.
 */
export type AppointmentService = AppointmentAgendaService;
