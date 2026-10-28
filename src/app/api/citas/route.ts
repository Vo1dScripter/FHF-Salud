import {
  appointmentErrorResponse,
  appointmentJsonResponse,
} from '@/lib/appointments/http';
import { getAppointmentRequestContext } from '@/lib/appointments/server';

import {
  AppointmentError,
  type CreateAppointmentInput,
} from '@/features/appointments';
import { parseAppointmentQuery } from '@/features/appointments/validation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { actor, service } = await getAppointmentRequestContext();
    const params = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    const query = parseAppointmentQuery(params);
    const appointments = await service.list(actor, query);
    return appointmentJsonResponse({ appointments });
  } catch (error) {
    return appointmentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppointmentError(
        'validation',
        'El cuerpo de la solicitud no es un JSON válido.',
      );
    }
    const { actor, service } = await getAppointmentRequestContext();
    const appointment = await service.create(
      actor,
      body as CreateAppointmentInput,
    );
    return appointmentJsonResponse({ appointment }, 201);
  } catch (error) {
    return appointmentErrorResponse(error);
  }
}
