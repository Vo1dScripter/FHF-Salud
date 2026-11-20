export {
  ALLERGY_STATUSES,
  type AllergyStatus,
  CLINICAL_SEXES,
  type ClinicalActor,
  type ClinicalAppointment,
  type ClinicalHistory,
  type ClinicalPatient,
  type ClinicalRecord,
  type ClinicalRepository,
  type ClinicalRevision,
  type ClinicalRevisionId,
  type ClinicalSex,
  type SaveClinicalRevisionInput,
  type SaveClinicalRevisionResult,
} from './contracts';
export {
  ClinicalError,
  type ClinicalErrorCode,
  clinicalHttpStatus,
  mapClinicalDatabaseError,
} from './errors';
export { clinicalRoutes } from './routes';
export { ClinicalRecordService, requireClinicalPhysician } from './service';
export type { ParsedClinicalRevisionInput } from './validation';
export {
  clinicalRevisionInputSchema,
  parseClinicalPatientId,
  parseClinicalRevisionInput,
} from './validation';
