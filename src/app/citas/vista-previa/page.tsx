import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isAppointmentPreviewEnabled } from '@/lib/appointment-preview';

import AppointmentDetail from '@/app/components/appointments/AppointmentDetail';
import AppointmentForm from '@/app/components/appointments/AppointmentForm';
import AppointmentList from '@/app/components/appointments/AppointmentList';
import type { AppointmentListState } from '@/app/components/appointments/types';

export const metadata: Metadata = {
  title: 'Vista previa de desarrollo',
  robots: { index: false, follow: false },
};

export default async function AppointmentPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; id?: string }>;
}) {
  if (!isAppointmentPreviewEnabled()) notFound();
  const { estado = 'preparacion', id } = await searchParams;
  // El fixture solo se resuelve después de la barrera de desarrollo.
  const { appointmentPreviewRecords, appointmentPreviewDetail } =
    await import('@/features/appointments/__fixtures__/preview');
  const states: Record<string, AppointmentListState> = {
    preparacion: { kind: 'preparation' },
    cargando: { kind: 'loading' },
    poblado: { kind: 'populated', appointments: appointmentPreviewRecords },
    vacio: { kind: 'empty' },
    error: { kind: 'error' },
    sesion: { kind: 'unauthenticated' },
    permiso: { kind: 'forbidden' },
  };
  const formStates = {
    formulario: 'preparation',
    validacion: 'validation',
    enviando: 'submitting',
    exito: 'success',
  } as const;
  const formState = Object.hasOwn(formStates, estado)
    ? formStates[estado as keyof typeof formStates]
    : undefined;
  const listState = Object.hasOwn(states, estado) ? states[estado] : undefined;
  if (!listState && !formState && estado !== 'detalle') notFound();
  const selected = id
    ? appointmentPreviewRecords.find((record) => record.id === id)
    : appointmentPreviewDetail;
  if (estado === 'detalle' && !selected) notFound();
  return (
    <>
      {estado === 'poblado' ? (
        <div className='appointment-fixture-label'>
          <span>Datos sintéticos de propuesta</span>
        </div>
      ) : !formState && estado !== 'preparacion' ? (
        <p className='appointment-preview-notice'>
          Variante futura ·{' '}
          {estado === 'detalle'
            ? 'Datos sintéticos de propuesta'
            : 'Vista de propuesta, sin conexión real'}
        </p>
      ) : null}
      {formState ? (
        <AppointmentForm state={formState} />
      ) : estado === 'detalle' ? (
        <AppointmentDetail appointment={selected} />
      ) : (
        <AppointmentList
          detailHref={(id) =>
            `/citas/vista-previa?estado=detalle&id=${encodeURIComponent(id)}`
          }
          state={listState}
        />
      )}
    </>
  );
}
