import {
  appointmentErrorResponse,
  appointmentJsonResponse,
} from '@/lib/appointments/http';
import { getAppointmentRequestContext } from '@/lib/appointments/server';

import {
  AppointmentError,
  type CancelAppointmentInput,
  parseExpectedUpdatedAt,
  type RescheduleAppointmentInput,
} from '@/features/appointments';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MutationBody = Partial<RescheduleAppointmentInput> &
  Partial<CancelAppointmentInput> & {
    action?: unknown;
    expectedUpdatedAt?: unknown;
  };

async function readBody(request: Request): Promise<MutationBody> {
  try {
    const body = (await request.json()) as unknown;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Error('invalid body');
    }
    return body as MutationBody;
  } catch {
    throw new AppointmentError(
      'validation',
      'El cuerpo de la solicitud no es un JSON válido.',
    );
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { actor, service } = await getAppointmentRequestContext();
    const appointment = await service.getById(actor, id);
    if (!appointment) throw new AppointmentError('not_found');
    return appointmentJsonResponse({ appointment });
  } catch (error) {
    return appointmentErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readBody(request);
    const expectedUpdatedAt = parseExpectedUpdatedAt(body.expectedUpdatedAt);
    const { actor, service } = await getAppointmentRequestContext();

    switch (body.action) {
      case 'confirm': {
        const appointment = await service.confirm(
          actor,
          id,
          expectedUpdatedAt,
        );
        return appointmentJsonResponse({ appointment });
      }
      case 'reschedule': {
        const appointment = await service.reschedule(
          actor,
          id,
          {
            durationMinutes:
              body.durationMinutes as RescheduleAppointmentInput['durationMinutes'],
            scheduledAt: body.scheduledAt as RescheduleAppointmentInput['scheduledAt'],
          },
          expectedUpdatedAt,
        );
        return appointmentJsonResponse({ appointment });
      }
      case 'cancel': {
        const appointment = await service.cancel(
          actor,
          id,
          { reason: body.reason as CancelAppointmentInput['reason'] },
          expectedUpdatedAt,
        );
        return appointmentJsonResponse({ appointment });
      }
      default:
        throw new AppointmentError(
          'validation',
          'La acción solicitada no es válida.',
          { action: 'Usa confirm, reschedule o cancel.' },
        );
    }
  } catch (error) {
    return appointmentErrorResponse(error);
  }
}
