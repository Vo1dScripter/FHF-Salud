import type { AppointmentActor } from '@/features/appointments/contracts';

import type { PatientReference } from './types';

/** Solo columnas confirmadas de public.patients; id conserva la FK de citas. */
export type PatientSummary = PatientReference & {
  active: boolean;
  createdAt: string;
};
export type PatientQuery = { search: string; page: number };
export type PatientPage = { patients: PatientSummary[]; hasMore: boolean };
export type PatientActor = Extract<AppointmentActor, { role: 'physician' }>;
export interface PatientRepository {
  isActivePhysician(id: string): Promise<boolean>;
  list(query: PatientQuery): Promise<PatientPage>;
}
export const PATIENT_PAGE_SIZE = 25;
