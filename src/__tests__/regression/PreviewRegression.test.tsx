import { render, screen } from '@testing-library/react';

import AppointmentPreviewPage from '@/app/citas/vista-previa/page';
import AppointmentList from '@/app/components/appointments/AppointmentList';
import type { AppointmentView } from '@/features/appointments';

jest.mock('@/lib/appointment-preview', () => ({
  isAppointmentPreviewEnabled: () => true,
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
}));

const appointment: AppointmentView = {
  createdAt: '2026-10-14T12:00:00-06:00',
  durationMinutes: 30,
  id: 'preview-1',
  patient: { displayName: 'Paciente Sintético', id: 'preview-patient-1' },
  patientId: 'preview-patient-1',
  physician: {
    displayName: 'Dra. Prueba',
    id: 'preview-physician-1',
  },
  physicianId: 'preview-physician-1',
  reason: 'Consulta sintética',
  scheduledAt: '2026-10-15T09:30:00-06:00',
  status: 'confirmed',
  updatedAt: '2026-10-14T12:30:00-06:00',
};

it('genera enlaces de detalle con un prefijo serializable', () => {
  render(
    <AppointmentList
      detailHrefPrefix='/citas/vista-previa?estado=detalle&id='
      state={{ appointments: [appointment], kind: 'populated' }}
    />,
  );

  expect(
    screen.getByRole('link', {
      name: `Detalles de la cita de ${appointment.patient.displayName}`,
    }),
  ).toHaveAttribute(
    'href',
    '/citas/vista-previa?estado=detalle&id=preview-1',
  );
});

it('la vista previa poblada se renderiza sin cruzar funciones al cliente', async () => {
  const page = await AppointmentPreviewPage({
    searchParams: Promise.resolve({ estado: 'poblado' }),
  });

  render(page);

  expect(screen.getByText('Datos sintéticos de propuesta')).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'Agenda médica' }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('link', { name: /Detalles de la cita de/ })[0],
  ).toHaveAttribute(
    'href',
    '/citas/vista-previa?estado=detalle&id=preview-1',
  );
});
