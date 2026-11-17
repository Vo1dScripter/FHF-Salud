import {
  createPatientSchema,
  parsePatientQuery,
  PatientError,
  patientHttpStatus,
  patientIdSchema,
  type PatientRepository,
  PatientService,
} from '@/features/patients';

const physician = {
  role: 'physician' as const,
  userId: 'user',
  physicianId: '33333333-3333-4333-8333-333333333333',
};
const repository = (): jest.Mocked<PatientRepository> => ({
  isActivePhysician: jest.fn().mockResolvedValue(true),
  list: jest.fn().mockResolvedValue({ patients: [], hasMore: false }),
});
describe('contratos de pacientes', () => {
  it('conserva UUID de citas y valida el alta mínima confirmada', () => {
    expect(patientIdSchema.parse(physician.physicianId)).toBe(
      physician.physicianId,
    );
    expect(patientIdSchema.safeParse('123').success).toBe(false);
    expect(
      createPatientSchema.parse({ displayName: '  Paciente ficticio  ' }),
    ).toEqual({ displayName: 'Paciente ficticio' });
  });
  it.each(['', ' '.repeat(4), 'a'.repeat(201)])(
    'rechaza nombre inválido %p',
    (displayName) => {
      expect(createPatientSchema.safeParse({ displayName }).success).toBe(
        false,
      );
    },
  );
  it('no acepta identidad o rol del navegador', () => {
    expect(
      createPatientSchema.safeParse({ displayName: 'Paciente', role: 'admin' })
        .success,
    ).toBe(false);
    expect(
      createPatientSchema.safeParse({
        displayName: 'Paciente',
        physicianId: physician.physicianId,
      }).success,
    ).toBe(false);
  });
  it('normaliza búsqueda y página con valores predeterminados', () => {
    expect(parsePatientQuery({})).toEqual({ search: '', page: 1 });
    expect(
      parsePatientQuery({ search: "  María O'Connor  ", page: '2' }),
    ).toEqual({ search: "María O'Connor", page: 2 });
  });
  it.each([
    { page: 0 },
    { page: '1.5' },
    { page: 10001 },
    { search: '%' },
    { search: '_' },
    { search: 'a'.repeat(101) },
    { role: 'admin' },
  ])('rechaza consulta inválida %p', (query) => {
    expect(() => parsePatientQuery(query)).toThrow(PatientError);
  });
  it.each([
    'configuration',
    'unauthenticated',
    'forbidden',
    'validation',
    'unavailable',
  ] as const)('tiene respuesta segura para %s', (code) => {
    expect(patientHttpStatus(code)).toBeGreaterThanOrEqual(400);
    expect(new PatientError(code).message).not.toMatch(/SQL|password/);
  });
});
describe('acceso a pacientes', () => {
  it('rechaza anónimo sin consultar repositorio', async () => {
    const repo = repository();
    await expect(new PatientService(repo).list(null, {})).rejects.toMatchObject(
      { code: 'unauthenticated' },
    );
    expect(repo.isActivePhysician).not.toHaveBeenCalled();
    expect(repo.list).not.toHaveBeenCalled();
  });
  it.each(['admin', 'receptionist'] as const)(
    'rechaza %s antes de leer pacientes',
    async (role) => {
      const repo = repository();
      await expect(
        new PatientService(repo).list({ role, userId: 'user' }, {}),
      ).rejects.toMatchObject({ code: 'forbidden' });
      expect(repo.list).not.toHaveBeenCalled();
      expect(repo.isActivePhysician).not.toHaveBeenCalled();
    },
  );
  it('rechaza médico inactivo o no visible', async () => {
    const repo = repository();
    repo.isActivePhysician.mockResolvedValue(false);
    await expect(
      new PatientService(repo).list(physician, {}),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(repo.list).not.toHaveBeenCalled();
  });
  it('propaga fallo de BD en lugar de convertirlo en vacío', async () => {
    const repo = repository();
    repo.isActivePhysician.mockRejectedValue(new PatientError('unavailable'));
    await expect(
      new PatientService(repo).list(physician, {}),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(repo.list).not.toHaveBeenCalled();
  });
  it('entrega consulta validada al repositorio del usuario', async () => {
    const repo = repository();
    await expect(
      new PatientService(repo).list(physician, { search: ' Ana ', page: '2' }),
    ).resolves.toEqual({ patients: [], hasMore: false });
    expect(repo.isActivePhysician).toHaveBeenCalledWith(physician.physicianId);
    expect(repo.list).toHaveBeenCalledWith({ search: 'Ana', page: 2 });
  });
});
