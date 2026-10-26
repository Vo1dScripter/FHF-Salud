import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  Appointment,
  AppointmentDirectoryRepository,
  AppointmentDurationMinutes,
  AppointmentId,
  AppointmentQuery,
  AppointmentReader,
  AppointmentRepository,
  AppointmentStatus,
  AppointmentView,
  CancelAppointmentInput,
  CreateAppointmentInput,
  IsoDateTime,
  RescheduleAppointmentInput,
} from './contracts';
import { AppointmentError, mapDatabaseError } from './errors';
import {
  APPOINTMENT_DURATIONS,
  APPOINTMENT_STATUSES,
} from './validation';

const appointmentColumns =
  'id, patient_id, physician_id, starts_at, duration_minutes, reason, status, cancellation_reason, cancelled_at, confirmed_at, created_at, updated_at';

const appointmentViewColumns = `${appointmentColumns}, patient:patients!appointments_patient_id_fkey(id, display_name), physician:physicians!appointments_physician_id_fkey(id, display_name)`;

type ReferenceRow = {
  display_name: string;
  id: string;
};

type AppointmentRow = {
  cancellation_reason: string | null;
  cancelled_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  duration_minutes: number;
  id: string;
  patient_id: string;
  physician_id: string;
  reason: string;
  starts_at: string;
  status: string;
  updated_at: string;
};

type AppointmentViewRow = AppointmentRow & {
  patient: ReferenceRow | ReferenceRow[] | null;
  physician: ReferenceRow | ReferenceRow[] | null;
};

function firstReference(
  value: ReferenceRow | ReferenceRow[] | null,
): ReferenceRow | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Adaptador de Supabase/PostgREST. No usa service_role ni credenciales
 * privilegiadas: hereda la sesión del cliente SSR y depende de RLS.
 */
export class SupabaseAppointmentRepository
  implements
    AppointmentRepository,
    AppointmentReader,
    AppointmentDirectoryRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const { data, error } = await this.client
      .from('appointments')
      .insert({
        duration_minutes: input.durationMinutes,
        patient_id: input.patientId,
        physician_id: input.physicianId,
        reason: input.reason,
        starts_at: input.scheduledAt,
        status: 'pending',
      })
      .select(appointmentColumns)
      .single();
    if (error) throw mapDatabaseError(error);
    return this.mapAppointment(data as unknown as AppointmentRow);
  }

  async findConflicts(
    physicianId: string,
    startsAt: string,
    endsAt: string,
    excludeAppointmentId?: string,
  ): Promise<Appointment[]> {
    let request = this.client
      .from('appointments')
      .select(appointmentColumns)
      .eq('physician_id', physicianId)
      .neq('status', 'cancelled')
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt);
    if (excludeAppointmentId) {
      request = request.neq('id', excludeAppointmentId);
    }
    const { data, error } = await request;
    if (error) throw mapDatabaseError(error);
    return ((data ?? []) as unknown as AppointmentRow[]).map((row) =>
      this.mapAppointment(row),
    );
  }

  async findById(id: AppointmentId): Promise<Appointment | null> {
    const { data, error } = await this.client
      .from('appointments')
      .select(appointmentColumns)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapDatabaseError(error);
    return data
      ? this.mapAppointment(data as unknown as AppointmentRow)
      : null;
  }

  async list(query: AppointmentQuery = {}): Promise<Appointment[]> {
    const { data, error } = await this.filteredAppointments(
      appointmentColumns,
      query,
    );
    if (error) throw mapDatabaseError(error);
    return ((data ?? []) as unknown as AppointmentRow[]).map((row) =>
      this.mapAppointment(row),
    );
  }

  async confirm(
    id: AppointmentId,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<Appointment> {
    return this.runMutation('confirm_appointment', {
      p_appointment_id: id,
      p_expected_updated_at: expectedUpdatedAt,
    });
  }

  async reschedule(
    id: AppointmentId,
    input: RescheduleAppointmentInput,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<Appointment> {
    return this.runMutation('reschedule_appointment', {
      p_appointment_id: id,
      p_duration_minutes: input.durationMinutes,
      p_expected_updated_at: expectedUpdatedAt,
      p_starts_at: input.scheduledAt,
    });
  }

  async cancel(
    id: AppointmentId,
    input: CancelAppointmentInput,
    expectedUpdatedAt: IsoDateTime,
  ): Promise<Appointment> {
    return this.runMutation('cancel_appointment', {
      p_appointment_id: id,
      p_expected_updated_at: expectedUpdatedAt,
      p_reason: input.reason,
    });
  }

  async findByIdWithReferences(
    id: AppointmentId,
  ): Promise<AppointmentView | null> {
    const { data, error } = await this.client
      .from('appointments')
      .select(appointmentViewColumns)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapDatabaseError(error);
    return data
      ? this.mapView(data as unknown as AppointmentViewRow)
      : null;
  }

  async listWithReferences(
    query: AppointmentQuery = {},
  ): Promise<AppointmentView[]> {
    const { data, error } = await this.filteredAppointments(
      appointmentViewColumns,
      query,
    );
    if (error) throw mapDatabaseError(error);
    return ((data ?? []) as unknown as AppointmentViewRow[]).map((row) =>
      this.mapView(row),
    );
  }

  async findPatient(id: string) {
    const { data, error } = await this.client
      .from('patients')
      .select('id, display_name')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();
    if (error) throw mapDatabaseError(error);
    return data ? this.mapReference(data as unknown as ReferenceRow) : null;
  }

  async findPhysician(id: string) {
    const { data, error } = await this.client
      .from('physicians')
      .select('id, display_name')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();
    if (error) throw mapDatabaseError(error);
    return data ? this.mapReference(data as unknown as ReferenceRow) : null;
  }

  async listPatients() {
    const { data, error } = await this.client
      .from('patients')
      .select('id, display_name')
      .eq('active', true)
      .order('display_name');
    if (error) throw mapDatabaseError(error);
    return ((data ?? []) as unknown as ReferenceRow[]).map((row) =>
      this.mapReference(row),
    );
  }

  async listPhysicians() {
    const { data, error } = await this.client
      .from('physicians')
      .select('id, display_name')
      .eq('active', true)
      .order('display_name');
    if (error) throw mapDatabaseError(error);
    return ((data ?? []) as unknown as ReferenceRow[]).map((row) =>
      this.mapReference(row),
    );
  }

  // Alias con el nombre que exige AppointmentReader.
  async findByIdView(id: AppointmentId): Promise<AppointmentView | null> {
    return this.findByIdWithReferences(id);
  }

  async listView(query: AppointmentQuery = {}): Promise<AppointmentView[]> {
    return this.listWithReferences(query);
  }

  /**
   * Las funciones de PostgreSQL bloquean la fila, revalidan la versión y el
   * estado, y aplican la actualización dentro de la misma transacción. La
   * restricción de exclusión sigue siendo la garantía final de disponibilidad.
   */
  private async runMutation(
    functionName:
      | 'cancel_appointment'
      | 'confirm_appointment'
      | 'reschedule_appointment',
    parameters: Record<string, string | number>,
  ): Promise<Appointment> {
    const { data, error } = await this.client
      .rpc(functionName, parameters)
      .maybeSingle();
    if (error) throw mapDatabaseError(error);
    if (!data) throw new AppointmentError('not_found');
    return this.mapAppointment(data as unknown as AppointmentRow);
  }

  private async filteredAppointments(
    columns: string,
    query: AppointmentQuery,
  ) {
    let request = this.client
      .from('appointments')
      .select(columns)
      .order('starts_at', { ascending: true });
    if (query.from) request = request.gte('starts_at', query.from);
    if (query.to) request = request.lt('starts_at', query.to);
    if (query.patientId) request = request.eq('patient_id', query.patientId);
    if (query.physicianId) {
      request = request.eq('physician_id', query.physicianId);
    }
    if (query.status) request = request.eq('status', query.status);
    return request;
  }

  private mapAppointment(row: AppointmentRow): Appointment {
    if (
      !APPOINTMENT_STATUSES.includes(row.status as AppointmentStatus) ||
      !APPOINTMENT_DURATIONS.includes(
        row.duration_minutes as AppointmentDurationMinutes,
      )
    ) {
      throw new AppointmentError(
        'unavailable',
        'La agenda devolvió un registro con un formato no reconocido.',
      );
    }
    return {
      cancelReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      confirmedAt: row.confirmed_at,
      createdAt: row.created_at,
      durationMinutes: row.duration_minutes as AppointmentDurationMinutes,
      id: row.id,
      patientId: row.patient_id,
      physicianId: row.physician_id,
      reason: row.reason,
      scheduledAt: row.starts_at,
      status: row.status as AppointmentStatus,
      updatedAt: row.updated_at,
    };
  }

  private mapView(row: AppointmentViewRow): AppointmentView {
    const patient = firstReference(row.patient);
    const physician = firstReference(row.physician);
    if (!patient || !physician) {
      throw new AppointmentError(
        'unavailable',
        'No se pudieron resolver las referencias de la cita.',
      );
    }
    return {
      ...this.mapAppointment(row),
      patient: this.mapReference(patient),
      physician: this.mapReference(physician),
    };
  }

  private mapReference(row: ReferenceRow) {
    return { displayName: row.display_name, id: row.id };
  }
}
