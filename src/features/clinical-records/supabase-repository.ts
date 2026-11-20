import type { SupabaseClient } from '@supabase/supabase-js';

import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '@/features/appointments';

import {
  ALLERGY_STATUSES,
  type AllergyStatus,
  CLINICAL_SEXES,
  type ClinicalAppointment,
  type ClinicalHistory,
  type ClinicalPatient,
  type ClinicalRecord,
  type ClinicalRepository,
  type ClinicalRevision,
  type ClinicalSex,
  type SaveClinicalRevisionInput,
} from './contracts';
import { ClinicalError, mapClinicalDatabaseError } from './errors';

const patientColumns = 'id, display_name, active, birth_date, sex';
const recordColumns =
  'id, patient_id, current_revision, created_at, updated_at';
const revisionColumns =
  'id, revision_number, background, allergies_status, allergies, diagnosis, treatment, change_reason, author_physician_id, created_at';

type PatientRow = {
  active: boolean;
  birth_date: string | null;
  display_name: string;
  id: string;
  sex: string | null;
};

type AppointmentRow = {
  id: string;
  reason: string;
  starts_at: string;
  status: string;
};

type RecordRow = {
  created_at: string;
  current_revision: number;
  id: string;
  patient_id: string;
  updated_at: string;
};

type RevisionRow = {
  allergies: string | null;
  allergies_status: string;
  author_physician_id: string;
  background: string | null;
  change_reason: string | null;
  created_at: string;
  diagnosis: string | null;
  id: string;
  revision_number: number;
  treatment: string | null;
};

type OpenRecordRow = {
  out_record_id: string;
  out_patient_id: string;
  was_created: boolean;
};

/**
 * Adaptador Supabase/PostgREST. Usa exclusivamente la sesión SSR del médico:
 * las lecturas dependen de RLS y las escrituras de RPC SECURITY DEFINER.
 */
export class SupabaseClinicalRecordRepository implements ClinicalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async isActivePhysician(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('physicians')
      .select('id')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();
    if (error) throw mapClinicalDatabaseError(error);
    return data !== null;
  }

  async getHistory(
    patientId: string,
    physicianId: string,
  ): Promise<ClinicalHistory> {
    // La asociación explícita o una cita vigente autorizan la apertura. Si no
    // existe ninguna, se responde 404 sin consultar ni revelar datos del paciente.
    const linkResult = await this.client
      .from('patient_physicians')
      .select('patient_id')
      .eq('patient_id', patientId)
      .eq('physician_id', physicianId)
      .maybeSingle();
    if (linkResult.error) throw mapClinicalDatabaseError(linkResult.error);

    const appointmentsResult = await this.client
      .from('appointments')
      .select('id, starts_at, status, reason')
      .eq('patient_id', patientId)
      .eq('physician_id', physicianId)
      .order('starts_at', { ascending: false })
      .limit(5);
    if (appointmentsResult.error) {
      throw mapClinicalDatabaseError(appointmentsResult.error);
    }
    const appointmentRows = (appointmentsResult.data ??
      []) as unknown as AppointmentRow[];
    const hasActiveAppointment = appointmentRows.some(
      (row) => row.status !== 'cancelled',
    );
    if (!linkResult.data && !hasActiveAppointment) {
      throw new ClinicalError('not_found');
    }

    const patientResult = await this.client
      .from('patients')
      .select(patientColumns)
      .eq('id', patientId)
      .maybeSingle();
    if (patientResult.error) {
      throw mapClinicalDatabaseError(patientResult.error);
    }
    if (!patientResult.data) throw new ClinicalError('not_found');

    const recordResult = await this.client
      .from('clinical_records')
      .select(recordColumns)
      .eq('patient_id', patientId)
      .maybeSingle();
    if (recordResult.error) {
      throw mapClinicalDatabaseError(recordResult.error);
    }
    const record = recordResult.data
      ? this.mapRecord(recordResult.data as unknown as RecordRow)
      : null;

    let revisions: ClinicalRevision[] = [];
    if (record) {
      const revisionsResult = await this.client
        .from('clinical_record_revisions')
        .select(revisionColumns)
        .eq('record_id', record.id)
        .order('revision_number', { ascending: false })
        .limit(500);
      if (revisionsResult.error) {
        throw mapClinicalDatabaseError(revisionsResult.error);
      }
      revisions = ((revisionsResult.data ?? []) as unknown as RevisionRow[]).map(
        (row) => this.mapRevision(row),
      );
      if (revisions.length !== record.currentRevision) {
        throw new ClinicalError(
          'unavailable',
          'El expediente devolvió un historial inconsistente.',
        );
      }
    }

    return {
      appointments: appointmentRows.map((row) => this.mapAppointment(row)),
      canRegister: Boolean(record) || hasActiveAppointment,
      patient: this.mapPatient(patientResult.data as unknown as PatientRow),
      record,
      revisions,
    };
  }

  async saveRevision(
    patientId: string,
    input: SaveClinicalRevisionInput,
  ): Promise<ClinicalRevision> {
    const record = await this.ensureRecord(patientId);
    if (record.currentRevision !== input.expectedRevision) {
      throw new ClinicalError('stale');
    }

    const { data, error } = await this.client
      .rpc('save_clinical_revision', {
        p_allergies: input.allergiesStatus === 'reported' ? input.allergies : null,
        p_allergies_status: input.allergiesStatus,
        p_background: input.background,
        p_change_reason: input.changeReason,
        p_diagnosis: input.diagnosis,
        p_expected_revision: input.expectedRevision,
        p_patient_id: patientId,
        p_treatment: input.treatment,
      })
      .single();
    if (error) throw mapClinicalDatabaseError(error);
    if (!data) throw new ClinicalError('not_found');
    return this.mapRevision(data as unknown as RevisionRow);
  }

  /**
   * Abre el expediente de un paciente preexistente solo cuando aún no es
   * visible. La RPC es idempotente y valida cita vigente + médico de sesión.
   */
  private async ensureRecord(patientId: string): Promise<ClinicalRecord> {
    const existing = await this.client
      .from('clinical_records')
      .select(recordColumns)
      .eq('patient_id', patientId)
      .maybeSingle();
    if (existing.error) throw mapClinicalDatabaseError(existing.error);
    if (existing.data) {
      return this.mapRecord(existing.data as unknown as RecordRow);
    }

    const opened = await this.client
      .rpc('open_clinical_record', { p_patient_id: patientId })
      .single();
    if (opened.error) throw mapClinicalDatabaseError(opened.error);
    const recordId = (opened.data as unknown as OpenRecordRow | null)
      ?.out_record_id;
    if (!recordId) throw new ClinicalError('not_found');

    const created = await this.client
      .from('clinical_records')
      .select(recordColumns)
      .eq('id', recordId)
      .maybeSingle();
    if (created.error) throw mapClinicalDatabaseError(created.error);
    if (!created.data) throw new ClinicalError('not_found');
    return this.mapRecord(created.data as unknown as RecordRow);
  }

  private mapAppointment(row: AppointmentRow): ClinicalAppointment {
    if (!APPOINTMENT_STATUSES.includes(row.status as AppointmentStatus)) {
      throw new ClinicalError(
        'unavailable',
        'Una cita relacionada tiene un estado no reconocido.',
      );
    }
    return {
      id: row.id,
      reason: row.reason,
      scheduledAt: row.starts_at,
      status: row.status as AppointmentStatus,
    };
  }

  private mapPatient(row: PatientRow): ClinicalPatient {
    const sex =
      row.sex === null
        ? null
        : CLINICAL_SEXES.includes(row.sex as ClinicalSex)
          ? (row.sex as ClinicalSex)
          : undefined;
    if (sex === undefined) {
      throw new ClinicalError(
        'unavailable',
        'El paciente devolvió un dato personal no reconocido.',
      );
    }
    return {
      active: row.active,
      birthDate: row.birth_date,
      displayName: row.display_name,
      id: row.id,
      sex,
    };
  }

  private mapRecord(row: RecordRow): ClinicalRecord {
    return {
      createdAt: row.created_at,
      currentRevision: row.current_revision,
      id: row.id,
      patientId: row.patient_id,
      updatedAt: row.updated_at,
    };
  }

  private mapRevision(row: RevisionRow): ClinicalRevision {
    if (
      !ALLERGY_STATUSES.includes(row.allergies_status as AllergyStatus) ||
      !Number.isInteger(row.revision_number) ||
      row.revision_number < 1
    ) {
      throw new ClinicalError(
        'unavailable',
        'El expediente devolvió una revisión no reconocida.',
      );
    }
    return {
      allergies: row.allergies,
      allergiesStatus: row.allergies_status as AllergyStatus,
      authorPhysicianId: row.author_physician_id,
      background: row.background,
      changeReason: row.change_reason,
      createdAt: row.created_at,
      diagnosis: row.diagnosis,
      id: row.id,
      revisionNumber: row.revision_number,
      treatment: row.treatment,
    };
  }
}
