export type AppointmentClientError = {
  code: string;
  fieldErrors?: Record<string, string>;
  message: string;
};

const fallback: AppointmentClientError = {
  code: 'unavailable',
  message:
    'No se pudo conectar con el servicio de citas. Inténtalo de nuevo.',
};

export async function readAppointmentClientError(
  response: Response,
): Promise<AppointmentClientError> {
  try {
    const body = (await response.json()) as {
      error?: Partial<AppointmentClientError>;
    };
    if (body.error?.message) {
      return {
        code: body.error.code ?? 'unavailable',
        fieldErrors: body.error.fieldErrors,
        message: body.error.message,
      };
    }
  } catch {
    // La respuesta no era JSON; se usa el mensaje seguro por defecto.
  }
  return fallback;
}
