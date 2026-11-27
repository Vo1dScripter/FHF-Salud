import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import ClinicalHistory from '@/app/components/clinical-records/ClinicalHistory';
import type { ClinicalHistory as ClinicalHistoryContract } from '@/features/clinical-records';

const patientId = '22222222-2222-4222-8222-222222222222';
const physicianId = '33333333-3333-4333-8333-333333333333';
const revisionId = '55555555-5555-4555-8555-555555555555';
const appointmentId = '88888888-8888-4888-8888-888888888888';

const patient = {
  active: true,
  birthDate: '1990-05-10',
  displayName: 'Paciente ficticio',
  id: patientId,
  sex: 'female' as const,
};

const revision = {
  allergies: null,
  allergiesStatus: 'none_reported' as const,
  authorPhysicianId: physicianId,
  background: 'Antecedente ficticio',
  changeReason: null,
  createdAt: '2026-11-19T00:00:00Z',
  diagnosis: 'Diagnóstico ficticio',
  id: revisionId,
  revisionNumber: 1,
  treatment: 'Tratamiento ficticio',
};

const history: ClinicalHistoryContract = {
  appointments: [
    {
      id: appointmentId,
      reason: 'Consulta ficticia',
      scheduledAt: '2026-11-20T15:00:00Z',
      status: 'confirmed',
    },
  ],
  canRegister: true,
  patient,
  record: {
    createdAt: '2026-11-19T00:00:00Z',
    currentRevision: 1,
    id: '99999999-9999-4999-8999-999999999999',
    patientId,
    updatedAt: '2026-11-19T01:00:00Z',
  },
  revisions: [revision],
};

function reply(body: unknown, ok = true) {
  return { json: async () => body, ok } as Response;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

it('muestra paciente, revisión vigente, autoría, historial y citas reales', () => {
  render(<ClinicalHistory initialHistory={history} />);

  expect(
    screen.getByRole('heading', { name: patient.displayName }),
  ).toBeVisible();
  const current = screen.getByRole('region', {
    name: 'Información clínica vigente',
  });
  expect(within(current).getByText('Antecedente ficticio')).toBeVisible();
  expect(within(current).getByText('Diagnóstico ficticio')).toBeVisible();
  expect(within(current).getByText('Tratamiento ficticio')).toBeVisible();
  expect(within(current).getByText('Niega alergias')).toBeVisible();
  expect(within(current).getByText(physicianId)).toBeVisible();
  expect(within(current).getByText(/Revisión 1 de 1/)).toBeVisible();
  expect(screen.getByText('Consulta ficticia')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Ver cita' })).toHaveAttribute(
    'href',
    `/citas/${appointmentId}`,
  );
  expect(screen.getByText('Historial de revisiones')).toBeVisible();
});

it('muestra un vacío honesto y permite registrar la primera nota', () => {
  render(
    <ClinicalHistory
      initialHistory={{
        appointments: [],
        canRegister: true,
        patient,
        record: null,
        revisions: [],
      }}
    />,
  );

  expect(
    screen.getByRole('heading', { name: 'Sin información clínica registrada' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Registrar primera nota' }),
  ).toBeEnabled();
  expect(screen.getByText(/No hay citas visibles/)).toBeVisible();
});

it('envía solo contenido clínico y deja fecha, autor y médico al servidor', async () => {
  const updated = {
    ...history,
    record: { ...history.record!, currentRevision: 1 },
  };
  const fetchMock = jest.fn().mockResolvedValue(
    reply({
      history: updated,
      revision,
    }),
  );
  global.fetch = fetchMock;

  render(
    <ClinicalHistory
      initialHistory={{
        appointments: [],
        canRegister: true,
        patient,
        record: null,
        revisions: [],
      }}
    />,
  );

  fireEvent.change(screen.getByLabelText('Antecedentes'), {
    target: { value: 'Antecedente capturado' },
  });
  fireEvent.change(screen.getByLabelText('Diagnóstico'), {
    target: { value: 'Diagnóstico capturado' },
  });
  fireEvent.change(screen.getByLabelText('Tratamiento'), {
    target: { value: 'Tratamiento capturado' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Registrar primera nota' }),
  );

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  const payload = JSON.parse(init.body as string) as Record<string, unknown>;
  expect(url).toBe(`/api/pacientes/${patientId}/expediente`);
  expect(init).toMatchObject({
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  expect(payload).toEqual({
    allergies: null,
    allergiesStatus: 'not_recorded',
    background: 'Antecedente capturado',
    changeReason: '',
    diagnosis: 'Diagnóstico capturado',
    expectedRevision: 0,
    treatment: 'Tratamiento capturado',
  });
  expect(payload).not.toHaveProperty('physicianId');
  expect(payload).not.toHaveProperty('authorUserId');
  expect(payload).not.toHaveProperty('createdAt');
  expect(
    await screen.findByText('La primera nota clínica se registró correctamente.'),
  ).toBeVisible();
});

it('exige motivo y conserva la versión esperada al actualizar', async () => {
  const fetchMock = jest.fn().mockResolvedValue(
    reply({
      history: {
        ...history,
        record: { ...history.record!, currentRevision: 2 },
        revisions: [
          { ...revision, changeReason: 'Corrección ficticia', revisionNumber: 2 },
          revision,
        ],
      },
      revision: {
        ...revision,
        changeReason: 'Corrección ficticia',
        revisionNumber: 2,
      },
    }),
  );
  global.fetch = fetchMock;

  render(<ClinicalHistory initialHistory={history} />);

  fireEvent.change(screen.getByLabelText('Motivo de la nueva revisión'), {
    target: { value: 'Corrección ficticia' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Guardar nueva revisión' }),
  );

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const payload = JSON.parse(
    fetchMock.mock.calls[0][1].body as string,
  ) as Record<string, unknown>;
  expect(payload.expectedRevision).toBe(1);
  expect(payload.changeReason).toBe('Corrección ficticia');
  expect(
    await screen.findByText('La nueva revisión clínica se guardó correctamente.'),
  ).toBeVisible();
});

it('mantiene el estado ante 409 y permite recargar sin sobrescribir', async () => {
  const reloaded = {
    ...history,
    record: { ...history.record!, currentRevision: 2 },
    revisions: [
      { ...revision, background: 'Nota más reciente', revisionNumber: 2 },
      revision,
    ],
  };
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(
      reply(
        {
          error: {
            code: 'stale',
            message:
              'El expediente cambió mientras editabas. Recarga el historial y vuelve a intentarlo.',
          },
        },
        false,
      ),
    )
    .mockResolvedValueOnce(reply({ history: reloaded }));
  global.fetch = fetchMock;

  render(<ClinicalHistory initialHistory={history} />);
  fireEvent.change(screen.getByLabelText('Motivo de la nueva revisión'), {
    target: { value: 'Intento con versión obsoleta' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Guardar nueva revisión' }),
  );

  expect(
    await screen.findByText(/El expediente cambió mientras editabas/),
  ).toBeVisible();
  expect(screen.getByText(/Revisión 1 de 1/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Recargar expediente' }));

  await waitFor(() =>
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/pacientes/${patientId}/expediente`,
      { cache: 'no-store' },
    ),
  );
  expect(await screen.findByText(/Revisión 2 de 2/)).toBeVisible();
  const currentAfterReload = screen.getByRole('region', {
    name: 'Información clínica vigente',
  });
  expect(within(currentAfterReload).getByText('Nota más reciente')).toBeVisible();
});

it('muestra el rechazo de acceso sin datos clínicos ni éxito falso', async () => {
  global.fetch = jest.fn().mockResolvedValue(
    reply(
      {
        error: {
          code: 'forbidden',
          message: 'No tienes acceso al expediente de este paciente.',
        },
      },
      false,
    ),
  );

  render(<ClinicalHistory initialHistory={history} />);
  fireEvent.change(screen.getByLabelText('Motivo de la nueva revisión'), {
    target: { value: 'Intento no autorizado' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Guardar nueva revisión' }),
  );

  expect(
    await screen.findByText(
      'No tienes acceso al expediente de este paciente.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByText('La nueva revisión clínica se guardó correctamente.'),
  ).not.toBeInTheDocument();
});
