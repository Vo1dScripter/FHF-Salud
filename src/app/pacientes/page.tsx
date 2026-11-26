import type { Metadata } from 'next';

import PatientDirectory from '@/app/components/patients/PatientDirectory';

export const metadata: Metadata = { title: 'Pacientes' };
export default function PatientsPage() {
  return <PatientDirectory />;
}
