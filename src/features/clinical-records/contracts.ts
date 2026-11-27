import type { AppointmentActor, AppointmentStatus } from '@/features/appointments/contracts';
import type { PatientReference } from '@/features/patients/types';

/** Estados de alergias persistidos; no son equivalentes entre sí. */
export const ALLERGY_STATUSES = [
  'not_recorded',
  'none_reported',
  'reported',
] as const;
export type AllergyStatus = (typeof ALLERGY_STATUSES)[number];

/** Valores permitidos por la restricción SQL de patients.sex. */
export const CLINICAL_SEXES = [
  'female',
  'male',
  'other',
  'unspecified',
] as const;
export type ClinicalSex = (typeof CLINICAL_SEXES)[number];

export type ClinicalRevisionId = string;

/** Datos personales mínimos que el expediente puede mostrar. */
export type ClinicalPatient = PatientReference & {
  active: boolean;
  birthDate: string | null;
  sex: ClinicalSex | null;
};

/** Cita relacionada visible para el médico de la sesión. */
export type ClinicalAppointment = {
  id: string;
  reason: string;
  scheduledAt: string;
  status: AppointmentStatus;
};

/** Cabecera del expediente único por paciente. */
export type ClinicalRecord = {
  createdAt: string;
  currentRevision: number;
  id: string;
  patientId: string;
  updatedAt: string;
};

/** Revisión inmutable: cada cambio conserva autoría y fecha del servidor. */
export type ClinicalRevision = {
  allergies: string | null;
  allergiesStatus: AllergyStatus;
  authorPhysicianId: string;
  background: string | null;
  changeReason: string | null;
  createdAt: string;
  diagnosis: string | null;
  id: ClinicalRevisionId;
  revisionNumber: number;
  treatment: string | null;
};

/** Lectura completa de RF-08 sin mezclar datos de ejemplo. */
export type ClinicalHistory = {
  appointments: ClinicalAppointment[];
  canRegister: boolean;
  patient: ClinicalPatient;
  record: ClinicalRecord | null;
  revisions: ClinicalRevision[];
};

/**
 * Entrada de RF-09/RF-11. No incluye paciente, médico, autor ni fecha: esos
 * valores salen de la URL, la sesión y el reloj del servidor.
 */
export type SaveClinicalRevisionInput = {
  allergies?: string | null;
  allergiesStatus: AllergyStatus;
  background?: string | null;
  changeReason?: string | null;
  diagnosis?: string | null;
  expectedRevision: number;
  treatment?: string | null;
};

export type SaveClinicalRevisionResult = {
  history: ClinicalHistory;
  revision: ClinicalRevision;
};

export type ClinicalActor = Extract<AppointmentActor, { role: 'physician' }>;

/** Límite de persistencia; la implementación real usa RPC y RLS. */
export interface ClinicalRepository {
  getHistory(patientId: string, physicianId: string): Promise<ClinicalHistory>;
  isActivePhysician(id: string): Promise<boolean>;
  saveRevision(
    patientId: string,
    input: SaveClinicalRevisionInput,
  ): Promise<ClinicalRevision>;
}
