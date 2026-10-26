'use client';

import AppointmentState from '@/app/components/appointments/AppointmentState';

export default function AppointmentError({ reset }: { reset: () => void }) {
  return <AppointmentState kind='error' onRetry={reset} />;
}
