import type { Metadata } from 'next';

import AppointmentForm from '@/app/components/appointments/AppointmentForm';

export const metadata: Metadata = { title: 'Nueva cita · Preparación' };

export default function NewAppointmentPage() {
  return <AppointmentForm />;
}
