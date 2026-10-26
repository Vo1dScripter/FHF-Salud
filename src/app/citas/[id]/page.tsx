import type { Metadata } from 'next';

import { getAppointmentRequestContext } from '@/lib/appointments/server';

import AppointmentDetail from '@/app/components/appointments/AppointmentDetail';
import AppointmentState from '@/app/components/appointments/AppointmentState';
import {
  type AppointmentActor,
  AppointmentError,
  appointmentRoutes,
  type AppointmentView,
} from '@/features/appointments';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Detalle de cita' };

type AppointmentPageResult =
  | {
      actor: AppointmentActor;
      appointment: AppointmentView | null;
      kind: 'ready';
    }
  | { error: unknown; kind: 'failed' };

async function loadAppointmentPage(id: string): Promise<AppointmentPageResult> {
  try {
    const { actor, service } = await getAppointmentRequestContext();
    return {
      actor,
      appointment: await service.getById(actor, id),
      kind: 'ready',
    };
  } catch (error) {
    return { error, kind: 'failed' };
  }
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadAppointmentPage(id);

  if (result.kind === 'failed') {
    if (result.error instanceof AppointmentError) {
      if (result.error.code === 'unauthenticated') {
        return (
          <AppointmentState
            actionHref={appointmentRoutes.access}
            kind='unauthenticated'
          />
        );
      }
      if (result.error.code === 'forbidden') {
        return <AppointmentState kind='forbidden' />;
      }
      if (
        result.error.code === 'not_found' ||
        result.error.code === 'validation'
      ) {
        return (
          <AppointmentState
            actionHref={appointmentRoutes.list}
            actionLabel='Volver a la agenda'
            kind='not_found'
          />
        );
      }
      return (
        <AppointmentState description={result.error.message} kind='error' />
      );
    }
    return <AppointmentState kind='error' />;
  }

  if (!result.appointment) {
    return (
      <AppointmentState
        actionHref={appointmentRoutes.list}
        actionLabel='Volver a la agenda'
        kind='not_found'
      />
    );
  }

  return (
    <AppointmentDetail
      appointment={result.appointment}
      canManage={
        result.actor.role === 'admin' || result.actor.role === 'receptionist'
      }
    />
  );
}
