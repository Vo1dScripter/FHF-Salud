import type { Metadata } from 'next';

import AppointmentAccessForm from '@/app/components/appointments/AppointmentAccessForm';

export const metadata: Metadata = {
  title: 'Acceso a la agenda',
  robots: { follow: false, index: false },
};

export default function AppointmentAccessPage() {
  return <AppointmentAccessForm />;
}
