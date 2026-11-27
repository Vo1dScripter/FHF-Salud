import {
  ClinicalError,
  type ClinicalHistory,
  ClinicalRecordService,
  type ClinicalRepository,
} from '@/features/clinical-records';

const patientId = '22222222-2222-4222-8222-222222222222';
const physician = {
  physicianId: '33333333-3333-4333-8333-333333333333',
  role: 'physician' as const,
  userId: '44444444-4444-4444-8444-444444444444',
};

const emptyHistory: ClinicalHistory = {
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

const revision = {
  allergies: null,
  allergiesStatus: 'none_reported' as const,
  authorPhysicianId: physician.physicianId,
  background: 'Antecedente ficticio',
  changeReason: null,
  createdAt: '2026-11-19T00:00:00Z',
  diagnosis: 'Diagnóstico ficticio',
  id: '55555555-5555-4555-8555-555555555555',
  revisionNumber: 1,
  treatment: 'Tratamiento ficticio',
};

function repository(): jest.Mocked<ClinicalRepository> {
  return {
    getHistory: jest.fn().mockResolvedValue(emptyHistory),
    isActivePhysician: jest.fn().mockResolvedValue(true),
    saveRevision: jest.fn().mockResolvedValue(revision),
  };
}

const firstInput = {
  allergiesStatus: 'none_reported',
  background: 'Antecedente ficticio',
  diagnosis: 'Diagnóstico ficticio',
  expectedRevision: 0,
  treatment: 'Tratamiento ficticio',
};

describe('servicio del expediente clínico', () => {
  it('rechaza una sesión ausente antes de consultar el repositorio', async () => {
    const repo = repository();
    await expect(
      new ClinicalRecordService(repo).getHistory(null, patientId),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(
      new ClinicalRecordService(repo).saveRevision(null, patientId, firstInput),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(repo.getHistory).not.toHaveBeenCalled();
    expect(repo.saveRevision).not.toHaveBeenCalled();
  });

  it.each(['admin', 'receptionist'] as const)(
    'rechaza el rol %s sin leer ni escribir',
    async (role) => {
      const repo = repository();
      await expect(
        new ClinicalRecordService(repo).getHistory(
          { role, userId: 'user' },
          patientId,
        ),
      ).rejects.toMatchObject({ code: 'forbidden' });
      expect(repo.getHistory).not.toHaveBeenCalled();
      expect(repo.isActivePhysician).not.toHaveBeenCalled();
    },
  );

  it('rechaza un médico inactivo o no visible', async () => {
    const repo = repository();
    repo.isActivePhysician.mockResolvedValue(false);
    await expect(
      new ClinicalRecordService(repo).getHistory(physician, patientId),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(repo.getHistory).not.toHaveBeenCalled();
  });

  it('valida el UUID antes de consultar la persistencia', async () => {
    const repo = repository();
    await expect(
      new ClinicalRecordService(repo).getHistory(physician, '123'),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(repo.isActivePhysician).not.toHaveBeenCalled();
  });

  it('entrega al repositorio el paciente y el médico de la sesión', async () => {
    const repo = repository();
    await expect(
      new ClinicalRecordService(repo).getHistory(
        physician,
        patientId.toUpperCase(),
      ),
    ).resolves.toBe(emptyHistory);
    expect(repo.isActivePhysician).toHaveBeenCalledWith(
      physician.physicianId,
    );
    expect(repo.getHistory).toHaveBeenCalledWith(
      patientId,
      physician.physicianId,
    );
  });

  it('registra una revisión validada y devuelve el historial actualizado', async () => {
    const repo = repository();
    const history = { ...emptyHistory, revisions: [revision] };
    repo.getHistory.mockResolvedValue(history);
    await expect(
      new ClinicalRecordService(repo).saveRevision(physician, patientId, {
        ...firstInput,
        allergies: null,
        changeReason: null,
        expectedRevision: '0',
      }),
    ).resolves.toEqual({ history, revision });
    expect(repo.saveRevision).toHaveBeenCalledWith(patientId, {
      ...firstInput,
      allergies: null,
      changeReason: null,
    });
    expect(repo.getHistory).toHaveBeenCalledWith(
      patientId,
      physician.physicianId,
    );
  });

  it('rechaza campos de autor, fecha o médico antes de guardar', async () => {
    const repo = repository();
    await expect(
      new ClinicalRecordService(repo).saveRevision(physician, patientId, {
        ...firstInput,
        authorUserId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(repo.saveRevision).not.toHaveBeenCalled();
  });

  it('propaga conflicto de versión sin convertirlo en éxito', async () => {
    const repo = repository();
    repo.saveRevision.mockRejectedValue(new ClinicalError('stale'));
    await expect(
      new ClinicalRecordService(repo).saveRevision(physician, patientId, {
        ...firstInput,
        changeReason: 'Corrección',
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'stale' });
    expect(repo.getHistory).not.toHaveBeenCalled();
  });

  it('propaga indisponibilidad y no devuelve un expediente vacío', async () => {
    const repo = repository();
    repo.getHistory.mockRejectedValue(new ClinicalError('unavailable'));
    await expect(
      new ClinicalRecordService(repo).getHistory(physician, patientId),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });
});
