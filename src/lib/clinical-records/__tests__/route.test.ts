/** @jest-environment node */
import { getClinicalRequestContext } from '@/lib/clinical-records/server';

import { GET, POST } from '@/app/api/pacientes/[id]/expediente/route';
import {
  ClinicalError,
  type ClinicalHistory,
  type ClinicalRevision,
} from '@/features/clinical-records';

jest.mock('@/lib/clinical-records/server', () => ({
  getClinicalRequestContext: jest.fn(),
}));

const context = jest.mocked(getClinicalRequestContext);
const patientId = '22222222-2222-4222-8222-222222222222';
const actor = {
  physicianId: '33333333-3333-4333-8333-333333333333',
  role: 'physician' as const,
  userId: '44444444-4444-4444-8444-444444444444',
};
const history: ClinicalHistory = {
  appointments: [],
  canRegister: true,
  patient: {
    active: true,
    birthDate: null,
    displayName: 'Paciente ficticio',
    id: patientId,
    sex: null,
  },
  record: null,
  revisions: [],
};
const revision: ClinicalRevision = {
  allergies: null,
  allergiesStatus: 'none_reported',
  authorPhysicianId: actor.physicianId,
  background: 'Antecedente ficticio',
  changeReason: null,
  createdAt: '2026-11-19T00:00:00Z',
  diagnosis: 'Diagnóstico ficticio',
  id: '55555555-5555-4555-8555-555555555555',
  revisionNumber: 1,
  treatment: 'Tratamiento ficticio',
};
const routeContext = { params: Promise.resolve({ id: patientId }) };

beforeEach(() => jest.resetAllMocks());

it.each([
  ['unauthenticated', 401],
  ['forbidden', 403],
  ['not_found', 404],
  ['validation', 400],
  ['stale', 409],
  ['configuration', 503],
  ['unavailable', 503],
] as const)('GET conserva %s con HTTP %s y no-store', async (code, status) => {
  context.mockRejectedValue(new ClinicalError(code));
  const response = await GET(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`),
    routeContext,
  );
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    error: { code, message: new ClinicalError(code).message },
  });
});

it('GET no filtra excepciones internas', async () => {
  context.mockRejectedValue(new Error('private SQL or credential'));
  const response = await GET(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`),
    routeContext,
  );
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toMatch(
    /private|SQL|credential/,
  );
});

it('GET usa la identidad del servidor y devuelve el historial real', async () => {
  const getHistory = jest.fn().mockResolvedValue(history);
  context.mockResolvedValue({
    actor,
    service: { getHistory },
  } as unknown as Awaited<ReturnType<typeof getClinicalRequestContext>>);

  const response = await GET(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`),
    routeContext,
  );

  expect(getHistory).toHaveBeenCalledWith(actor, patientId);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ history });
});

it('POST registra una revisión y responde 201 en la primera nota', async () => {
  const saveRevision = jest.fn().mockResolvedValue({ history, revision });
  context.mockResolvedValue({
    actor,
    service: { saveRevision },
  } as unknown as Awaited<ReturnType<typeof getClinicalRequestContext>>);
  const body = {
    allergiesStatus: 'none_reported',
    background: 'Antecedente ficticio',
    diagnosis: 'Diagnóstico ficticio',
    expectedRevision: 0,
    treatment: 'Tratamiento ficticio',
  };

  const response = await POST(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
    routeContext,
  );

  expect(saveRevision).toHaveBeenCalledWith(actor, patientId, body);
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ history, revision });
});

it('POST responde 200 al actualizar con una nueva revisión', async () => {
  const updated = { ...revision, revisionNumber: 2 };
  const saveRevision = jest.fn().mockResolvedValue({
    history: { ...history, revisions: [updated] },
    revision: updated,
  });
  context.mockResolvedValue({
    actor,
    service: { saveRevision },
  } as unknown as Awaited<ReturnType<typeof getClinicalRequestContext>>);

  const response = await POST(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`, {
      body: JSON.stringify({ expectedRevision: 1 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
    routeContext,
  );

  expect(response.status).toBe(200);
});

it('POST sin sesión responde 401 antes de interpretar el JSON', async () => {
  context.mockRejectedValue(new ClinicalError('unauthenticated'));
  const response = await POST(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`, {
      body: '{',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
    routeContext,
  );

  expect(response.status).toBe(401);
  expect(context).toHaveBeenCalledTimes(1);
  expect(await response.json()).toMatchObject({
    error: { code: 'unauthenticated' },
  });
});

it('POST rechaza JSON inválido después de verificar la sesión', async () => {
  context.mockResolvedValue({
    actor,
    service: { saveRevision: jest.fn() },
  } as unknown as Awaited<ReturnType<typeof getClinicalRequestContext>>);
  const response = await POST(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`, {
      body: '{',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
    routeContext,
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: 'validation' },
  });
});

it.each(['unauthenticated', 'forbidden', 'not_found'] as const)(
  'GET responde %s sin filtrar datos clínicos ni personales',
  async (code) => {
    context.mockRejectedValue(new ClinicalError(code));
    const response = await GET(
      new Request(`http://localhost/api/pacientes/${patientId}/expediente`),
      routeContext,
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(
      { forbidden: 403, not_found: 404, unauthenticated: 401 }[code],
    );
    for (const forbidden of [
      'Paciente ficticio',
      'Antecedente ficticio',
      'Diagnóstico ficticio',
      'Tratamiento ficticio',
      'Alergia ficticia',
      'background',
      'diagnosis',
      'treatment',
      'allergies',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  },
);

it('POST conserva 409 y errores por campo sin datos internos', async () => {
  context.mockResolvedValue({
    actor,
    service: {
      saveRevision: jest.fn().mockRejectedValue(
        new ClinicalError('stale', 'El expediente cambió.', {
          changeReason: 'Indica el motivo.',
        }),
      ),
    },
  } as unknown as Awaited<ReturnType<typeof getClinicalRequestContext>>);

  const response = await POST(
    new Request(`http://localhost/api/pacientes/${patientId}/expediente`, {
      body: JSON.stringify({ expectedRevision: 1 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }),
    routeContext,
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: {
      code: 'stale',
      fieldErrors: { changeReason: 'Indica el motivo.' },
      message: 'El expediente cambió.',
    },
  });
});
