import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';

import AppointmentAgenda from '@/app/components/appointments/AppointmentAgenda';
import AppointmentForm from '@/app/components/appointments/AppointmentForm';
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

function mockReferences() {
  return jsonResponse({
    canCreate: true,
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
  return () => {
    global.fetch = original;
  };
}

async function fillForm() {
  fireEvent.change(await screen.findByLabelText('Paciente'), {
    target: { value: patientId },
  });
  fireEvent.change(screen.getByLabelText('Médico / Profesional'), {
    target: { value: physicianId },
  });
  fireEvent.change(screen.getByLabelText('Inicio (Fecha y Hora)'), {
    target: { value: '2030-01-15T10:00' },
  });
  fireEvent.change(screen.getByLabelText('Motivo de la consulta'), {
    target: { value: 'Consulta sintética' },
  });
}

describe('functional appointment UI', () => {
  it('registra una cita y muestra la confirmación del servidor', async () => {
    const restore = installFetch(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return mockReferences();
      if (url.includes('/api/citas') && init?.method === 'POST') {
        return jsonResponse({ appointment }, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentForm />);
      await fillForm();
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }));

      expect(
        await screen.findByText(/Cita registrada correctamente/),
      ).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/citas',
        expect.objectContaining({
          body: expect.stringContaining(
            '"scheduledAt":"2030-01-15T16:00:00.000Z"',
          ),
          method: 'POST',
        }),
      );
    } finally {
      restore();
    }
  });

  it('muestra un mensaje claro cuando el horario está ocupado', async () => {
    const restore = installFetch(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return mockReferences();
      if (url.includes('/api/citas') && init?.method === 'POST') {
        return jsonResponse(
          {
            error: {
              code: 'conflict',
              message: 'El horario seleccionado ya está ocupado para este médico.',
            },
          },
          409,
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentForm />);
      await fillForm();
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }));

      expect(
        (await screen.findAllByText(/horario seleccionado ya está ocupado/i))
          .length,
      ).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it('distingue un error de conexión de una agenda vacía', async () => {
    const restore = installFetch(async () => {
      throw new Error('network down');
    });

    try {
      render(<AppointmentForm />);
      expect(
        await screen.findByRole('heading', {
          name: 'No se pudo consultar la agenda',
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Sin citas para estos filtros'),
      ).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('muestra el mensaje de configuración devuelto por el servidor', async () => {
    const restore = installFetch(async () =>
      jsonResponse(
        {
          error: {
            code: 'configuration',
            message:
              'La conexión con Supabase no está configurada. Falta la URL o la clave pública.',
          },
        },
        503,
      ),
    );

    try {
      render(<AppointmentForm />);
      expect(
        await screen.findByText(/La conexión con Supabase no está configurada/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Sin citas para estos filtros'),
      ).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('consulta la agenda real y muestra paciente, médico, duración y estado', async () => {
    const restore = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return mockReferences();
      if (url.includes('/api/citas?')) {
        return jsonResponse({ appointments: [appointment] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentAgenda />);
      expect(await screen.findByText('Paciente Sintético')).toBeInTheDocument();
      const table = screen.getByRole('table');
      expect(within(table).getByText('Dra. Prueba')).toBeInTheDocument();
      expect(
        within(table).getByText('30 min · GMT-6 (CDMX)'),
      ).toBeInTheDocument();
      expect(within(table).getByText('Pendiente')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Agenda médica' }),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('no muestra el formulario cuando la cuenta no puede registrar citas', async () => {
    const restore = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) {
        return jsonResponse({
          canCreate: false,
          patients: [],
          physicians: [physician],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentForm />);
      expect(
        await screen.findByRole('heading', { name: 'Acceso restringido' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Guardar cita' }),
      ).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('muestra el acceso requerido cuando la API responde 401', async () => {
    const restore = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) {
        return jsonResponse(
          { error: { code: 'unauthenticated', message: 'Inicia sesión.' } },
          401,
        );
      }
      return jsonResponse(
        { error: { code: 'unauthenticated', message: 'Inicia sesión.' } },
        401,
      );
    });

    try {
      render(<AppointmentForm />);
      expect(
        await screen.findByRole('heading', {
          name: 'Inicia sesión para consultar la agenda',
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
        'href',
        '/citas/acceso',
      );
    } finally {
      restore();
    }
  });

  it('muestra el estado vacío solo después de una consulta exitosa', async () => {
    const restore = installFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/citas/referencias')) return mockReferences();
      if (url.includes('/api/citas?')) {
        return jsonResponse({ appointments: [] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    try {
      render(<AppointmentAgenda />);
      expect(
        await screen.findByRole('heading', {
          name: 'Sin citas para estos filtros',
        }),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
