import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PatientDirectory from '@/app/components/patients/PatientDirectory';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const original = global.fetch;
afterEach(() => {
  global.fetch = original;
});
const patient = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Paciente ficticio',
  active: true,
  createdAt: '2026-11-16T00:00:00Z',
};
function reply(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}
it('carga, busca y pagina sin sustituir los registros recibidos', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValue(reply({ patients: [patient], hasMore: true }));
  global.fetch = fetchMock;
  render(<PatientDirectory />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando');
  expect(await screen.findByText(patient.displayName)).toBeVisible();
  expect(
    screen.getByRole('link', {
      name: `Ver expediente de ${patient.displayName}`,
    }),
  ).toHaveAttribute('href', `/pacientes/${patient.id}`);
  fireEvent.change(screen.getByLabelText('Nombre del paciente'), {
    target: { value: ' Ana ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/pacientes?search=Ana&page=1',
      expect.objectContaining({ cache: 'no-store' }),
    ),
  );
  await screen.findByText(patient.displayName);
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/pacientes?search=Ana&page=2',
      expect.anything(),
    ),
  );
});
it.each(['forbidden', 'unauthenticated', 'unavailable', 'validation'])(
  'muestra %s y no datos clínicos',
  async (code) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        reply({ error: { code, message: 'Mensaje seguro' } }, false),
      );
    render(<PatientDirectory />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mensaje seguro',
    );
    expect(screen.queryByText(patient.displayName)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ver expediente' }),
    ).not.toBeInTheDocument();
    if (code === 'unauthenticated')
      expect(
        screen.getByRole('link', { name: 'Iniciar sesión' }),
      ).toHaveAttribute('href', '/citas/acceso');
    if (code === 'forbidden')
      expect(
        screen.queryByRole('button', { name: 'Reintentar' }),
      ).not.toBeInTheDocument();
  },
);
it('vacío conserva búsqueda y vínculo hacia citas', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(reply({ patients: [], hasMore: false }));
  render(<PatientDirectory />);
  expect(await screen.findByText('Sin pacientes visibles')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  expect(
    screen.getByRole('link', { name: 'Ir a Citas médicas' }),
  ).toHaveAttribute('href', '/citas');
});
it('no presenta una respuesta inválida como éxito ni como vacío', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(reply({ patients: 'no-es-una-lista', hasMore: 'no' }));
  render(<PatientDirectory />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'La respuesta de pacientes no es válida',
  );
  expect(screen.queryByText('Sin pacientes visibles')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Ver expediente' }),
  ).not.toBeInTheDocument();
});

it('permite reintentar tras fallo de transporte', async () => {
  const fetchMock = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(reply({ patients: [patient], hasMore: false }));
  global.fetch = fetchMock;
  render(<PatientDirectory />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(patient.displayName)).toBeVisible();
});

it('retira resultados durante la búsqueda e ignora una respuesta anterior', async () => {
  let resolveOld!: (value: Response) => void;
  const oldResponse = new Promise<Response>((resolve) => {
    resolveOld = resolve;
  });
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(reply({ patients: [patient], hasMore: true }))
    .mockReturnValueOnce(oldResponse)
    .mockResolvedValueOnce(reply({ patients: [], hasMore: false }));
  global.fetch = fetchMock;
  render(<PatientDirectory />);
  await screen.findByText(patient.displayName);
  fireEvent.change(screen.getByLabelText('Nombre del paciente'), {
    target: { value: 'Anterior' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  expect(screen.queryByText(patient.displayName)).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Cargando');
  fireEvent.change(screen.getByLabelText('Nombre del paciente'), {
    target: { value: 'Actual' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByText('Sin pacientes visibles');
  resolveOld(reply({ patients: [patient], hasMore: true }));
  await waitFor(() =>
    expect(screen.getByText('Sin pacientes visibles')).toBeVisible(),
  );
  expect(screen.queryByText(patient.displayName)).not.toBeInTheDocument();
});

it('abre el expediente solo después de confirmar el alta', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(reply({ patients: [], hasMore: false }))
    .mockResolvedValueOnce({
      ...reply({ patientId: patient.id }),
      status: 201,
    });
  global.fetch = fetchMock;
  render(<PatientDirectory />);
  fireEvent.change(
    await screen.findByLabelText('Nombre completo para el alta'),
    {
      target: { value: patient.displayName },
    },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Registrar paciente y expediente' }),
  );
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(`/pacientes/${patient.id}`),
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    '/api/pacientes',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ displayName: patient.displayName }),
    }),
  );
});
