import type { ReactNode } from 'react';

import AppointmentShell from '@/app/components/appointments/AppointmentShell';
import Footer from '@/app/components/index/Footer';
import Header from '@/app/components/index/Header';

export default function AppointmentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className='appointments-route'>
      <Header appointments />
      <AppointmentShell>{children}</AppointmentShell>
      <Footer />
    </div>
  );
}
