/** @jest-environment node */
import { getPatientRequestContext } from '@/lib/patients/server';

import { GET, POST } from '@/app/api/pacientes/route';
import { PatientError } from '@/features/patients';

jest.mock('@/lib/patients/server', () => ({
  getPatientRequestContext: jest.fn(),
}));
const context = jest.mocked(getPatientRequestContext);
beforeEach(() => jest.resetAllMocks());
it.each([
  ['unauthenticated', 401],
  ['forbidden', 403],
  ['configuration', 503],
  ['validation', 400],
  ['unavailable', 503],
] as const)('API conserva %s con HTTP %s y no-store', async (code, status) => {
  context.mockRejectedValue(new PatientError(code));
  const response = await GET(new Request('http://localhost/api/pacientes'));
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    error: { code, message: new PatientError(code).message },
  });
});
it('API no filtra excepciones internas', async () => {
  context.mockRejectedValue(new Error('private SQL or credential'));
  const response = await GET(new Request('http://localhost/api/pacientes'));
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toMatch(
    /private|SQL|credential/,
  );
});
it('API usa actor del servidor y contrato paginado', async () => {
  const actor = {
    role: 'physician' as const,
    physicianId: 'id',
    userId: 'user',
  };
  const list = jest.fn().mockResolvedValue({ patients: [], hasMore: false });
  context.mockResolvedValue({ actor, service: { list } } as unknown as Awaited<
    ReturnType<typeof getPatientRequestContext>
  >);
  const response = await GET(
    new Request('http://localhost/api/pacientes?search=Ana&page=2'),
  );
  expect(list).toHaveBeenCalledWith(actor, { search: 'Ana', page: '2' });
  expect(await response.json()).toEqual({ patients: [], hasMore: false });
});

it('POST rechaza el rol de recepción antes de invocar el alta', async () => {
  const register = jest.fn();
  context.mockResolvedValue({
    actor: { role: 'receptionist', userId: 'user' },
    service: { register },
  } as unknown as Awaited<ReturnType<typeof getPatientRequestContext>>);
  const response = await POST(
    new Request('http://localhost/api/pacientes', { method: 'POST' }),
  );
  expect(response.status).toBe(403);
  expect(register).not.toHaveBeenCalled();
});

it('POST devuelve los identificadores confirmados y conserva no-store', async () => {
  const actor = { role: 'physician', physicianId: 'id', userId: 'user' };
  const result = { patientId: 'patient', recordId: 'record' };
  const register = jest.fn().mockResolvedValue(result);
  context.mockResolvedValue({
    actor,
    service: { register },
  } as unknown as Awaited<ReturnType<typeof getPatientRequestContext>>);
  const body = { displayName: 'Paciente ficticio' };
  const response = await POST(
    new Request('http://localhost/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  expect(response.status).toBe(201);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(register).toHaveBeenCalledWith(actor, body);
  expect(await response.json()).toEqual(result);
});
