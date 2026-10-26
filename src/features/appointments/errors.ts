export type AppointmentErrorCode =
  | 'configuration'
  | 'conflict'
  | 'forbidden'
  | 'not_found'
  | 'unauthenticated'
  | 'unavailable'
  | 'validation';

const defaultMessages: Record<AppointmentErrorCode, string> = {
  configuration:
    'La conexión con Supabase no está configurada. Falta la URL o la clave pública.',
  conflict: 'El horario seleccionado ya está ocupado para este médico.',
  forbidden: 'No tienes permiso para realizar esta operación.',
  not_found: 'La cita no existe o no está disponible para tu cuenta.',
  unauthenticated: 'Inicia sesión para consultar o registrar citas.',
  unavailable:
    'No se pudo conectar con el servicio de citas. Inténtalo de nuevo.',
  validation: 'Revisa los datos de la cita.',
};

export class AppointmentError extends Error {
  readonly code: AppointmentErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: AppointmentErrorCode,
    message = defaultMessages[code],
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppointmentError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function appointmentHttpStatus(code: AppointmentErrorCode): number {
  switch (code) {
    case 'validation':
      return 400;
    case 'unauthenticated':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
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
 * Traduce errores del proveedor sin reenviar detalles de SQL, nombres de tablas
 * ni mensajes internos al navegador.
 */
export function mapDatabaseError(error: unknown): AppointmentError {
  if (error instanceof AppointmentError) return error;

  switch (errorCodeOf(error)) {
    case '23P01':
      return new AppointmentError('conflict');
    case '23503':
      return new AppointmentError(
        'validation',
        'El paciente o el médico seleccionado ya no está disponible.',
        {
          patientId: 'Selecciona una referencia existente.',
          physicianId: 'Selecciona una referencia existente.',
        },
      );
    case '23502':
    case '23514':
    case '22007':
    case '22008':
    case '22P02':
      return new AppointmentError('validation');
    case '42501':
      return new AppointmentError('forbidden');
    case 'PGRST116':
      return new AppointmentError('not_found');
    case 'PGRST301':
    case 'PGRST302':
      return new AppointmentError('unauthenticated');
    default:
      return new AppointmentError('unavailable');
  }
}
