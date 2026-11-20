export type ClinicalErrorCode =
  | 'configuration'
  | 'forbidden'
  | 'not_found'
  | 'stale'
  | 'unauthenticated'
  | 'unavailable'
  | 'validation';

const defaultMessages: Record<ClinicalErrorCode, string> = {
  configuration:
    'La conexión con el expediente clínico no está configurada.',
  forbidden: 'No tienes acceso al expediente de este paciente.',
  not_found:
    'El paciente o su expediente no está disponible para tu cuenta.',
  stale:
    'El expediente cambió mientras editabas. Recarga el historial y vuelve a intentarlo.',
  unauthenticated: 'Inicia sesión para consultar el expediente clínico.',
  unavailable:
    'No se pudo consultar el expediente clínico. Inténtalo de nuevo.',
  validation: 'Revisa la información clínica capturada.',
};

export class ClinicalError extends Error {
  readonly code: ClinicalErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: ClinicalErrorCode,
    message = defaultMessages[code],
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ClinicalError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function clinicalHttpStatus(code: ClinicalErrorCode): number {
  switch (code) {
    case 'validation':
      return 400;
    case 'unauthenticated':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'stale':
      return 409;
    case 'configuration':
    case 'unavailable':
      return 503;
  }
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Traduce errores de PostgREST/PostgreSQL sin reenviar SQL, tablas ni detalles
 * internos al navegador.
 */
export function mapClinicalDatabaseError(error: unknown): ClinicalError {
  if (error instanceof ClinicalError) return error;

  switch (errorCodeOf(error)) {
    case '42501':
      return new ClinicalError('forbidden');
    case 'PT400':
    case '23514':
    case '22007':
    case '22008':
    case '22P02':
      return new ClinicalError('validation');
    case 'PT404':
    case '23503':
    case 'PGRST116':
    case 'P0002':
      return new ClinicalError('not_found');
    case 'PT409':
    case '23505':
      return new ClinicalError('stale');
    case 'PGRST301':
    case 'PGRST302':
      return new ClinicalError('unauthenticated');
    default:
      return new ClinicalError('unavailable');
  }
}
