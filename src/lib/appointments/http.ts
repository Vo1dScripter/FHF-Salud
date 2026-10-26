import { NextResponse } from 'next/server';

import {
  AppointmentError,
  appointmentHttpStatus,
} from '@/features/appointments';

export type AppointmentApiErrorBody = {
  error: {
    code: string;
    fieldErrors?: Record<string, string>;
    message: string;
  };
};

export function appointmentErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppointmentError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          fieldErrors: error.fieldErrors,
          message: error.message,
        },
      } satisfies AppointmentApiErrorBody,
      {
        headers: { 'Cache-Control': 'no-store' },
        status: appointmentHttpStatus(error.code),
      },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: 'unavailable',
        message:
          'No se pudo conectar con el servicio de citas. Inténtalo de nuevo.',
      },
    } satisfies AppointmentApiErrorBody,
    {
      headers: { 'Cache-Control': 'no-store' },
      status: 503,
    },
  );
}

export function appointmentJsonResponse(
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  });
}
