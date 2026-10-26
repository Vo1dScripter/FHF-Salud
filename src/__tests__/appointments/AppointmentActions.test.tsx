import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import AppointmentAgenda from '@/app/components/appointments/AppointmentAgenda';
import type { AppointmentView } from '@/features/appointments';

const patientId = '22222222-2222-4222-8222-222222222222';
const physicianId = '33333333-3333-4333-8333-333333333333';
const appointmentId = '55555555-5555-4555-8555-555555555555';

const patient = { displayName: 'Paciente Sintético', id: patientId };
const physician = { displayName: 'Dra. Prueba', id: physicianId };

const appointment: AppointmentView = {
  createdAt: '2026-10-24T12:00:00-06:00',
  durationMinutes: 30,
  id: appointmentId,
  patient,
  patientId,
  physician,
  physicianId,
  reason: 'Consulta sintética',
  scheduledAt: '2030-01-15T10:00:00-06:00',
  status: 'pending',
  updatedAt: '2026-10-24T12:00:00-06:00',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

function directoryResponse() {
  return jsonResponse({
    canCreate: true,
    canManage: true,
    patients: [patient],
    physicians: [physician],
  });
}

function installFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  const original = global.fetch;
  const mock = jest.fn(handler);
  global.fetch = mock as typeof fetch;
  return {
    mock,
    restore: () => {
      global.fetch = original;
    },
  };
}

async function renderAgenda(record: AppointmentView = appointment) {
  const fetchState = installFetch(async (input, init) => {
    const url = String(input);
    if (url.includes('/api/citas/referencias')) return directoryResponse();
    if (url.includes('/api/citas?')) {
      return jsonResponse({ appointments: [record] });
    }
    if (
      url.includes(`/api/citas/${appointmentId}`) &&
      init?.method === 'PATCH'
    ) {
      throw new Error('PATCH must be supplied by each test');
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<AppointmentAgenda />);
  await screen.findByText(record.patient.displayName);
  return fetchState;
}

describe('appointment list actions', () => {
  it('confirma una cita pendiente y actualiza la agenda de inmediato', async () => {
    const updated = {
      ...appointment,
      status: 'confirmed' as const,
      updatedAt: '2026-10-26T12:00:00-06:00',
    };
    const fetchState = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return directoryResponse();
      if (url.includes('/api/citas?')) {
        return jsonResponse({ appointments: [appointment] });
      }
      if (url.includes(`/api/citas/${appointmentId}`)) {
        return jsonResponse({ appointment: updated });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentAgenda />);
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Confirmar la cita de Paciente Sintético',
        }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Confirmar cita' });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Sí, confirmar cita' }),
      );

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      const row = screen.getByRole('row', { name: /Paciente Sintético/ });
      expect(within(row).getByText('Confirmada')).toBeInTheDocument();
      expect(
        screen.getByText('Cambio guardado y reflejado en la agenda.'),
      ).toBeInTheDocument();
      const patchCall = fetchState.mock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/api/citas/${appointmentId}`) &&
          init?.method === 'PATCH',
      );
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        action: 'confirm',
        expectedUpdatedAt: appointment.updatedAt,
      });
    } finally {
      fetchState.restore();
    }
  });

  it('muestra una confirmación y conserva la fila al cancelar', async () => {
    const updated = {
      ...appointment,
      cancelReason: 'Paciente no puede asistir',
      cancelledAt: '2026-10-26T12:05:00-06:00',
      status: 'cancelled' as const,
      updatedAt: '2026-10-26T12:05:00-06:00',
    };
    const fetchState = installFetch(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return directoryResponse();
      if (url.includes('/api/citas?')) {
        return jsonResponse({ appointments: [appointment] });
      }
      if (url.includes(`/api/citas/${appointmentId}`)) {
        expect(init?.method).toBe('PATCH');
        return jsonResponse({ appointment: updated });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentAgenda />);
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Cancelar la cita de Paciente Sintético',
        }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Cancelar cita' });
      expect(
        within(dialog).getByText(/La cita no se eliminará/),
      ).toBeInTheDocument();
      fireEvent.change(
        within(dialog).getByLabelText('Motivo de cancelación'),
        { target: { value: 'Paciente no puede asistir' } },
      );
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Sí, cancelar cita' }),
      );

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      const row = screen.getByRole('row', { name: /Paciente Sintético/ });
      expect(within(row).getByText('Cancelada')).toBeInTheDocument();
      expect(
        within(row).getByText('Cancelación: Paciente no puede asistir'),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole('button', {
          name: 'Cancelar la cita de Paciente Sintético',
        }),
      ).toBeDisabled();
      expect(fetchState.mock).toHaveBeenCalledWith(
        `/api/citas/${appointmentId}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(
        fetchState.mock.mock.calls.some(
          ([, init]) => init?.method === 'DELETE',
        ),
      ).toBe(false);
    } finally {
      fetchState.restore();
    }
  });

  it('modifica la cita a un horario libre y refleja fecha y duración', async () => {
    const updated = {
      ...appointment,
      durationMinutes: 45 as const,
      scheduledAt: '2030-01-16T11:00:00-06:00',
      updatedAt: '2026-10-26T12:10:00-06:00',
    };
    const fetchState = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return directoryResponse();
      if (url.includes('/api/citas?')) {
        return jsonResponse({ appointments: [appointment] });
      }
      if (url.includes(`/api/citas/${appointmentId}`)) {
        return jsonResponse({ appointment: updated });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentAgenda />);
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Editar la cita de Paciente Sintético',
        }),
      );
      const dialog = screen.getByRole('dialog', {
        name: 'Editar horario de la cita',
      });
      fireEvent.change(within(dialog).getByLabelText('Fecha y hora de inicio'), {
        target: { value: '2030-01-16T11:00' },
      });
      fireEvent.change(within(dialog).getByLabelText('Duración'), {
        target: { value: '45' },
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Guardar cambios' }),
      );

      expect(await screen.findByText('45 min · GMT-6 (CDMX)')).toBeInTheDocument();
      expect(screen.getByText(/16 ene 2030/)).toBeInTheDocument();
      expect(
        screen.getByText('Cambio guardado y reflejado en la agenda.'),
      ).toBeInTheDocument();
      const patchCall = fetchState.mock.mock.calls.find(
        ([url, init]) =>
          String(url).includes(`/api/citas/${appointmentId}`) &&
          init?.method === 'PATCH',
      );
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        action: 'reschedule',
        durationMinutes: 45,
        expectedUpdatedAt: appointment.updatedAt,
        scheduledAt: '2030-01-16T17:00:00.000Z',
      });
    } finally {
      fetchState.restore();
    }
  });

  it('no muestra guardado cuando el servidor rechaza un horario ocupado', async () => {
    const fetchState = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return directoryResponse();
      if (url.includes('/api/citas?')) {
        return jsonResponse({ appointments: [appointment] });
      }
      if (url.includes(`/api/citas/${appointmentId}`)) {
        return jsonResponse(
          {
            error: {
              code: 'conflict',
              fieldErrors: { scheduledAt: 'Selecciona otro horario disponible.' },
              message: 'El nuevo horario ya está ocupado para este médico.',
            },
          },
          409,
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentAgenda />);
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Editar la cita de Paciente Sintético',
        }),
      );
      const dialog = screen.getByRole('dialog', {
        name: 'Editar horario de la cita',
      });
      fireEvent.change(within(dialog).getByLabelText('Fecha y hora de inicio'), {
        target: { value: '2030-01-16T11:00' },
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Guardar cambios' }),
      );

      expect(
        await within(dialog).findByText(
          /El nuevo horario ya está ocupado para este médico/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Cambio guardado y reflejado en la agenda.'),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/15 ene 2030/)).toBeInTheDocument();
    } finally {
      fetchState.restore();
    }
  });

  it('no muestra guardado si falla la conexión durante la mutación', async () => {
    const fetchState = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return directoryResponse();
      if (url.includes('/api/citas?')) {
        return jsonResponse({ appointments: [appointment] });
      }
      if (url.includes(`/api/citas/${appointmentId}`)) {
        throw new Error('network down');
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentAgenda />);
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Editar la cita de Paciente Sintético',
        }),
      );
      const dialog = screen.getByRole('dialog', {
        name: 'Editar horario de la cita',
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Guardar cambios' }),
      );

      expect(
        await within(dialog).findByText(/No se pudo conectar con el servicio/),
      ).toBeInTheDocument();
      expect(dialog).toBeInTheDocument();
      expect(
        screen.queryByText('Cambio guardado y reflejado en la agenda.'),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/15 ene 2030/)).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Guardar cambios' }),
      ).toBeEnabled();
    } finally {
      fetchState.restore();
    }
  });

  it('deshabilita las acciones incompatibles de una cita cancelada', async () => {
    const cancelled: AppointmentView = {
      ...appointment,
      status: 'cancelled',
    };
    const fetchState = await renderAgenda(cancelled);

    try {
      expect(
        screen.getByRole('button', {
          name: 'Confirmar la cita de Paciente Sintético',
        }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', {
          name: 'Editar la cita de Paciente Sintético',
        }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', {
          name: 'Cancelar la cita de Paciente Sintético',
        }),
      ).toBeDisabled();
    } finally {
      fetchState.restore();
    }
  });
});
