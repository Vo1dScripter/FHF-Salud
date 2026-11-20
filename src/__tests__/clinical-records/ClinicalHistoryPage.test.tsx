import { render, screen, within } from '@testing-library/react';

import { getClinicalRequestContext } from '@/lib/clinical-records/server';

import ClinicalHistoryPage, { metadata } from '@/app/pacientes/[id]/page';
import {
  ClinicalError,
  type ClinicalErrorCode,
  type ClinicalHistory,
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
  canRegister: false,
  patient: {
    active: true,
    birthDate: '1990-05-10',
    displayName: 'Paciente ficticio',
    id: patientId,
    sex: 'female',
  },
  record: {
    createdAt: '2026-11-19T00:00:00Z',
    currentRevision: 1,
    id: '99999999-9999-4999-8999-999999999999',
    patientId,
    updatedAt: '2026-11-19T01:00:00Z',
  },
  revisions: [
    {
      allergies: 'Alergia ficticia',
      allergiesStatus: 'reported',
      authorPhysicianId: actor.physicianId,
      background: 'Antecedente ficticio',
      changeReason: null,
      createdAt: '2026-11-19T00:00:00Z',
      diagnosis: 'Diagnóstico ficticio',
      id: '55555555-5555-4555-8555-555555555555',
      revisionNumber: 1,
      treatment: 'Tratamiento ficticio',
    },
  ],
};

const clinicalTerms = [
  'Paciente ficticio',
  'Antecedente ficticio',
  'Alergia ficticia',
  'Diagnóstico ficticio',
  'Tratamiento ficticio',
];

function renderPage() {
  return ClinicalHistoryPage({ params: Promise.resolve({ id: patientId }) });
}

beforeEach(() => jest.resetAllMocks());

it('declara el expediente como no indexable', () => {
  expect(metadata.robots).toEqual({ follow: false, index: false });
});

it('muestra el historial solo con la sesión médica verificada', async () => {
  context.mockResolvedValue({
    actor,
    service: {
      getHistory: jest.fn().mockResolvedValue(history),
    },
  } as unknown as Awaited<ReturnType<typeof getClinicalRequestContext>>);

  render(await renderPage());

  expect(
    screen.getByRole('heading', { name: 'Paciente ficticio' }),
  ).toBeVisible();
  const current = screen.getByRole('region', {
    name: 'Información clínica vigente',
  });
  expect(within(current).getByText('Antecedente ficticio')).toBeVisible();
  expect(within(current).getByText('Diagnóstico ficticio')).toBeVisible();
  expect(within(current).getByText('Tratamiento ficticio')).toBeVisible();
});

it.each([
  ['unauthenticated', 'Sesión requerida', '/citas/acceso'],
  ['forbidden', 'Acceso restringido', '/citas'],
  ['not_found', 'Expediente no disponible', '/pacientes'],
])(
  'la capa de servidor rechaza %s sin mostrar datos clínicos',
  async (code, title, href) => {
    context.mockRejectedValue(new ClinicalError(code as ClinicalErrorCode));

    render(await renderPage());

    expect(screen.getByRole('heading', { name: title })).toBeVisible();
    for (const term of clinicalTerms) {
      expect(screen.queryByText(term)).not.toBeInTheDocument();
    }
    if (href) {
      expect(
        screen.getByRole('link', {
          name: /iniciar sesión|volver a pacientes|ir a citas médicas/i,
        }),
      ).toHaveAttribute('href', href);
    }
  },
);

it('no convierte una falla del servicio en un expediente vacío', async () => {
  context.mockRejectedValue(new ClinicalError('unavailable'));

  render(await renderPage());

  expect(
    screen.getByRole('heading', {
      name: 'No se pudo consultar el expediente',
    }),
  ).toBeVisible();
  expect(
    screen.getByText(/No se pudo consultar el expediente clínico/),
  ).toBeVisible();
  for (const term of clinicalTerms) {
    expect(screen.queryByText(term)).not.toBeInTheDocument();
  }
});
