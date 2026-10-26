import type { Metadata } from 'next';

import AppointmentDetail from '@/app/components/appointments/AppointmentDetail';

export const metadata: Metadata = { title: 'Detalle de cita · Preparación' };

/** El ID no autoriza ni consulta registros hasta integrar sesión y servicio. */
export default function AppointmentDetailPage() {
  return <AppointmentDetail />;
}
