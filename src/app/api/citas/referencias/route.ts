import {
  appointmentErrorResponse,
  appointmentJsonResponse,
} from '@/lib/appointments/http';
import { getAppointmentRequestContext } from '@/lib/appointments/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { actor, service } = await getAppointmentRequestContext();
    const references = await service.listReferences(actor);
    return appointmentJsonResponse(references);
  } catch (error) {
    return appointmentErrorResponse(error);
  }
}
