export type PatientErrorCode =
  | 'configuration'
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'unavailable';
const messages: Record<PatientErrorCode, string> = {
  configuration: 'La conexión con pacientes no está configurada.',
  unauthenticated: 'Inicia sesión para consultar pacientes.',
  forbidden: 'Se requiere una cuenta de médico activo y verificada.',
  validation: 'Revisa la búsqueda y el número de página.',
  unavailable: 'No se pudo consultar pacientes. Inténtalo de nuevo.',
};
export class PatientError extends Error {
  constructor(
    readonly code: PatientErrorCode,
    message = messages[code],
  ) {
    super(message);
    this.name = 'PatientError';
  }
}
export function patientHttpStatus(code: PatientErrorCode): number {
  return {
    configuration: 503,
    unauthenticated: 401,
    forbidden: 403,
    validation: 400,
    unavailable: 503,
  }[code];
}
