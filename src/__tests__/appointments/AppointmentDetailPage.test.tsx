import { render, screen } from '@testing-library/react';

import { getAppointmentRequestContext } from '@/lib/appointments/server';

import AppointmentDetailPage from '@/app/citas/[id]/page';
import type {
  AppointmentActor,
  AppointmentView,
} from '@/features/appointments';

jest.mock('@/lib/appointments/server', () => ({
  getAppointmentRequestContext: jest.fn(),
}));

const context = jest.mocked(getAppointmentRequestContext);
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

function mockSession(actor: AppointmentActor) {
  context.mockResolvedValue({
    actor,
    service: { getById: jest.fn().mockResolvedValue(appointment) },
  } as unknown as Awaited<ReturnType<typeof getAppointmentRequestContext>>);
}

function renderPage() {
  return AppointmentDetailPage({
    params: Promise.resolve({ id: appointment.id }),
  });
}

beforeEach(() => jest.resetAllMocks());

it('enlaza el detalle de la cita con el expediente para una sesión médica', async () => {
  mockSession({
    physicianId: appointment.physicianId,
    role: 'physician',
    userId: '44444444-4444-4444-8444-444444444444',
  });

  render(await renderPage());

  expect(
    screen.getByRole('link', { name: 'Ver expediente del paciente' }),
  ).toHaveAttribute('href', `/pacientes/${patientId}`);
});

it.each(['admin', 'receptionist'] as const)(
  'no expone la navegación clínica a %s',
  async (role) => {
    mockSession({ role, userId: '44444444-4444-4444-8444-444444444444' });

    render(await renderPage());

    expect(
      screen.getByRole('heading', { name: 'Detalle de la cita' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Ver expediente del paciente' }),
    ).not.toBeInTheDocument();
  },
);
