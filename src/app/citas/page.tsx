import type { Metadata } from 'next';

import AppointmentAgenda from '@/app/components/appointments/AppointmentAgenda';

export const metadata: Metadata = { title: 'Citas médicas' };

export default function AppointmentsPage() {
  return <AppointmentAgenda />;
}
