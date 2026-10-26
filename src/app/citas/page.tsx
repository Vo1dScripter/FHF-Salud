import type { Metadata } from 'next';

import AppointmentList from '@/app/components/appointments/AppointmentList';

export const metadata: Metadata = { title: 'Citas médicas' };

export default function AppointmentsPage() {
  return <AppointmentList />;
}
