import {
  ClinicalError,
  parseClinicalPatientId,
  parseClinicalRevisionInput,
} from '@/features/clinical-records';

const patientId = '22222222-2222-4222-8222-222222222222';

const firstRevision = {
  allergies: null,
  allergiesStatus: 'not_recorded',
  background: 'Antecedente ficticio',
  changeReason: null,
  diagnosis: 'Diagnóstico ficticio',
  expectedRevision: 0,
  treatment: 'Tratamiento ficticio',
};

describe('validación del expediente clínico', () => {
  it('normaliza la primera revisión y conserva solo campos permitidos', () => {
    expect(
      parseClinicalRevisionInput({
        ...firstRevision,
        background: '  Antecedente ficticio  ',
        expectedRevision: '0',
      }),
    ).toEqual(firstRevision);
  });

  it('exige motivo al actualizar una revisión existente', () => {
    expect(
      parseClinicalRevisionInput({
        ...firstRevision,
        changeReason: '  Corrección ficticia  ',
        expectedRevision: 1,
      }),
    ).toEqual({
      ...firstRevision,
      changeReason: 'Corrección ficticia',
      expectedRevision: 1,
    });
    expect(() =>
      parseClinicalRevisionInput({ ...firstRevision, expectedRevision: 1 }),
    ).toThrow(ClinicalError);
  });

  it('distingue niega alergias de alergias reportadas', () => {
    expect(
      parseClinicalRevisionInput({
        ...firstRevision,
        allergies: '  Penicilina ficticia  ',
        allergiesStatus: 'reported',
      }),
    ).toEqual({
      ...firstRevision,
      allergies: 'Penicilina ficticia',
      allergiesStatus: 'reported',
    });
    expect(() =>
      parseClinicalRevisionInput({
        ...firstRevision,
        allergiesStatus: 'reported',
      }),
    ).toThrow(ClinicalError);
    expect(() =>
      parseClinicalRevisionInput({
        ...firstRevision,
        allergies: 'Texto que no corresponde',
        allergiesStatus: 'none_reported',
      }),
    ).toThrow(ClinicalError);
  });

  it.each([
    { ...firstRevision, background: null, diagnosis: null, treatment: null },
    { ...firstRevision, allergiesStatus: 'invalid' },
    { ...firstRevision, expectedRevision: -1 },
    { ...firstRevision, expectedRevision: '1.5' },
    { ...firstRevision, background: 'a'.repeat(4001) },
    { ...firstRevision, changeReason: 'a'.repeat(501), expectedRevision: 1 },
    { ...firstRevision, allergiesStatus: 'reported', allergies: null },
  ])('rechaza entrada inválida %p', (input) => {
    expect(() => parseClinicalRevisionInput(input)).toThrow(ClinicalError);
  });

  it('no acepta identidad, rol, fecha ni médico enviados por el navegador', () => {
    for (const extra of [
      { authorUserId: '00000000-0000-4000-8000-000000000001' },
      { authorPhysicianId: '33333333-3333-4333-8333-333333333333' },
      { createdAt: '2026-11-19T00:00:00Z' },
      { patientId },
      { physicianId: '33333333-3333-4333-8333-333333333333' },
      { role: 'admin' },
    ]) {
      expect(() =>
        parseClinicalRevisionInput({ ...firstRevision, ...extra }),
      ).toThrow(ClinicalError);
    }
  });

  it('expone errores por campo sin filtrar detalles internos', () => {
    try {
      parseClinicalRevisionInput({ ...firstRevision, expectedRevision: 1 });
      throw new Error('La prueba debió fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(ClinicalError);
      expect((error as ClinicalError).code).toBe('validation');
      expect((error as ClinicalError).fieldErrors).toHaveProperty(
        'changeReason',
      );
      expect((error as ClinicalError).message).not.toMatch(/SQL|password/);
    }
  });

  it('valida y normaliza el UUID del paciente', () => {
    expect(parseClinicalPatientId(patientId.toUpperCase())).toBe(patientId);
    expect(() => parseClinicalPatientId('123')).toThrow(ClinicalError);
    expect(() => parseClinicalPatientId(null)).toThrow(ClinicalError);
  });
});
