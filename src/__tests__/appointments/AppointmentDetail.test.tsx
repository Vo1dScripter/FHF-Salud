import { render, screen } from '@testing-library/react';

import AppointmentDetail from '@/app/components/appointments/AppointmentDetail';
import type { AppointmentView } from '@/features/appointments';

const patientId = '22222222-2222-4222-8222-222222222222';
const appointment: AppointmentView = {
  createdAt: '2026-10-24T12:00:00-06:00',
  durationMinutes: 30,
  id: '55555555-5555-4555-8555-555555555555',
  patient: { displayName: 'Paciente Sintético', id: patientId },
  patientId,
  physician: {
    displayName: 'Dra. Prueba',
    id: '33333333-3333-4333-8333-333333333333',
  },
  physicianId: '33333333-3333-4333-8333-333333333333',
  reason: 'Consulta sintética',
  scheduledAt: '2030-01-15T10:00:00-06:00',
  status: 'confirmed',
  updatedAt: '2026-10-24T12:00:00-06:00',
};

describe('navegación cita → expediente', () => {
  it('muestra el enlace de historial cuando la sesión médica lo permite', () => {
    render(
      <AppointmentDetail
        appointment={appointment}
        patientRecordHref={`/pacientes/${patientId}`}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Ver expediente del paciente' }),
    ).toHaveAttribute('href', `/pacientes/${patientId}`);
  });

  it('no anuncia historial para roles sin acceso clínico', () => {
    render(<AppointmentDetail appointment={appointment} />);

    expect(
      screen.queryByRole('link', { name: 'Ver expediente del paciente' }),
    ).not.toBeInTheDocument();
  });
});
