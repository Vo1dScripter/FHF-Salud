import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PATIENT_PAGE_SIZE,
  type PatientQuery,
  type PatientRepository,
} from './contracts';
import { PatientError } from './errors';
import { type CreatePatientInput, patientIdSchema } from './validation';

/** Cliente SSR del usuario: nunca service_role; RLS conserva el alcance por citas. */
export class SupabasePatientRepository implements PatientRepository {
  constructor(private readonly client: SupabaseClient) {}
  async isActivePhysician(id: string) {
    const { data, error } = await this.client
      .from('physicians')
      .select('id')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();
    if (error) throw new PatientError('unavailable');
    return data !== null;
  }
  async register({ displayName }: CreatePatientInput) {
    const { data, error } = await this.client
      .rpc('register_patient', { p_display_name: displayName })
      .single();
    if (error?.code === '42501') throw new PatientError('forbidden');
    if (error?.code === 'PT400')
      throw new PatientError('validation', 'Revisa el nombre del paciente.');
    const patientId = patientIdSchema.safeParse(
      (data as { new_patient_id?: unknown } | null)?.new_patient_id,
    );
    const recordId = patientIdSchema.safeParse(
      (data as { new_record_id?: unknown } | null)?.new_record_id,
    );
    if (error || !patientId.success || !recordId.success) {
      throw new PatientError(
        'unavailable',
        'No se pudo confirmar el alta del paciente.',
      );
    }
    return { patientId: patientId.data, recordId: recordId.data };
  }
  async list({ search, page }: PatientQuery) {
    const offset = (page - 1) * PATIENT_PAGE_SIZE;
    let query = this.client
      .from('patients')
      .select('id, display_name, active, created_at')
      .order('display_name')
      .order('id');
    if (search) query = query.ilike('display_name', `%${search}%`);
    const { data, error } = await query.range(
      offset,
      offset + PATIENT_PAGE_SIZE,
    );
    if (error || !data) throw new PatientError('unavailable');
    return {
      hasMore: data.length > PATIENT_PAGE_SIZE,
      patients: data.slice(0, PATIENT_PAGE_SIZE).map((row) => ({
        id: row.id as string,
        displayName: row.display_name as string,
        active: row.active as boolean,
        createdAt: row.created_at as string,
      })),
    };
  }
}
