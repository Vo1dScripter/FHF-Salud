import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseClinicalRecordRepository } from '../supabase-repository';

const patientId = '22222222-2222-4222-8222-222222222222';
const physicianId = '33333333-3333-4333-8333-333333333333';
const recordId = '55555555-5555-4555-8555-555555555555';

type Result = { data: unknown; error?: unknown };

function chain(result: Result) {
  const promise = Promise.resolve(result);
  const query = {
    eq: jest.fn(),
    limit: jest.fn(() => promise),
    maybeSingle: jest.fn(() => promise),
    order: jest.fn(),
    select: jest.fn(),
    single: jest.fn(() => promise),
    then: promise.then.bind(promise),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}

function setup(
  tables: Record<string, Result[]>,
  rpcResults: Record<string, Result[]> = {},
) {
  const tableQueues = Object.fromEntries(
    Object.entries(tables).map(([table, results]) => [table, [...results]]),
  );
  const rpcQueues = Object.fromEntries(
    Object.entries(rpcResults).map(([name, results]) => [name, [...results]]),
  );
  const from = jest.fn((table: string) => {
    const queue = tableQueues[table] ?? [];
    return chain(queue.shift() ?? { data: null, error: null });
  });
  const rpc = jest.fn(
    (name: string, _parameters?: Record<string, unknown>) => {
      const queue = rpcQueues[name] ?? [];
      const result = queue.shift() ?? { data: null, error: null };
      return {
        maybeSingle: jest.fn().mockResolvedValue(result),
        single: jest.fn().mockResolvedValue(result),
      };
    },
  );
  const client = { from, rpc } as unknown as SupabaseClient;
  return {
    client,
    from,
    repo: new SupabaseClinicalRecordRepository(client),
    rpc,
  };
}

function queryAt(from: jest.Mock, index: number) {
  return from.mock.results[index].value as ReturnType<typeof chain>;
}

const patientRow = {
  active: true,
  birth_date: '1990-05-10',
  display_name: 'Paciente ficticio',
  id: patientId,
  sex: 'female',
};

const recordRow = {
  created_at: '2026-11-19T00:00:00Z',
  current_revision: 2,
  id: recordId,
  patient_id: patientId,
  updated_at: '2026-11-19T01:00:00Z',
};

const revisionRows = [
  {
    allergies: null,
    allergies_status: 'none_reported',
    author_physician_id: physicianId,
    background: 'Antecedente vigente',
    change_reason: 'Corrección ficticia',
    created_at: '2026-11-19T01:00:00Z',
    diagnosis: 'Diagnóstico vigente',
    id: '66666666-6666-4666-8666-666666666666',
    revision_number: 2,
    treatment: 'Tratamiento vigente',
  },
  {
    allergies: 'Alergia ficticia',
    allergies_status: 'reported',
    author_physician_id: physicianId,
    background: 'Antecedente original',
    change_reason: null,
    created_at: '2026-11-19T00:00:00Z',
    diagnosis: 'Diagnóstico original',
    id: '77777777-7777-4777-8777-777777777777',
    revision_number: 1,
    treatment: 'Tratamiento original',
  },
];

const appointmentRow = {
  id: '88888888-8888-4888-8888-888888888888',
  reason: 'Consulta ficticia',
  starts_at: '2026-11-20T15:00:00Z',
  status: 'confirmed',
};

describe('repositorio Supabase del expediente', () => {
  it('lee paciente, expediente, revisiones y citas relacionadas', async () => {
    const { from, repo } = setup({
      appointments: [{ data: [appointmentRow] }],
      clinical_record_revisions: [{ data: revisionRows }],
      clinical_records: [{ data: recordRow }],
      patient_physicians: [{ data: { patient_id: patientId } }],
      patients: [{ data: patientRow }],
    });

    const history = await repo.getHistory(patientId, physicianId);

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'patient_physicians',
      'appointments',
      'patients',
      'clinical_records',
      'clinical_record_revisions',
    ]);
    expect(queryAt(from, 0).select).toHaveBeenCalledWith('patient_id');
    expect(queryAt(from, 0).eq.mock.calls).toEqual([
      ['patient_id', patientId],
      ['physician_id', physicianId],
    ]);
    expect(queryAt(from, 1).order).toHaveBeenCalledWith('starts_at', {
      ascending: false,
    });
    expect(queryAt(from, 1).limit).toHaveBeenCalledWith(5);
    expect(queryAt(from, 4).order).toHaveBeenCalledWith('revision_number', {
      ascending: false,
    });
    expect(history).toMatchObject({
      canRegister: true,
      patient: {
        active: true,
        birthDate: '1990-05-10',
        displayName: 'Paciente ficticio',
        id: patientId,
        sex: 'female',
      },
      record: {
        currentRevision: 2,
        id: recordId,
        patientId,
        updatedAt: '2026-11-19T01:00:00Z',
      },
    });
    expect(history.revisions).toHaveLength(2);
    expect(history.revisions[0]).toMatchObject({
      allergiesStatus: 'none_reported',
      authorPhysicianId: physicianId,
      revisionNumber: 2,
    });
    expect(history.appointments).toEqual([
      {
        id: appointmentRow.id,
        reason: appointmentRow.reason,
        scheduledAt: appointmentRow.starts_at,
        status: 'confirmed',
      },
    ]);
  });

  it('responde 404 sin consultar al paciente cuando no hay vínculo ni cita vigente', async () => {
    const { from, repo } = setup({
      appointments: [{ data: [{ ...appointmentRow, status: 'cancelled' }] }],
      patient_physicians: [{ data: null }],
    });

    await expect(repo.getHistory(patientId, physicianId)).rejects.toMatchObject(
      { code: 'not_found' },
    );
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'patient_physicians',
      'appointments',
    ]);
  });

  it('permite un expediente vacío cuando existe una cita vigente', async () => {
    const { repo } = setup({
      appointments: [{ data: [appointmentRow] }],
      clinical_records: [{ data: null }],
      patient_physicians: [{ data: null }],
      patients: [{ data: patientRow }],
    });

    await expect(
      repo.getHistory(patientId, physicianId),
    ).resolves.toMatchObject({
      canRegister: true,
      record: null,
      revisions: [],
    });
  });

  it('no convierte un historial inconsistente en una lectura vacía', async () => {
    const { repo } = setup({
      appointments: [{ data: [appointmentRow] }],
      clinical_record_revisions: [{ data: [revisionRows[0]] }],
      clinical_records: [{ data: recordRow }],
      patient_physicians: [{ data: { patient_id: patientId } }],
      patients: [{ data: patientRow }],
    });

    await expect(repo.getHistory(patientId, physicianId)).rejects.toMatchObject(
      { code: 'unavailable' },
    );
  });

  it('no filtra errores internos de la base', async () => {
    const { repo } = setup({
      patient_physicians: [{ data: null, error: { message: 'private SQL' } }],
    });

    await expect(
      repo.getHistory(patientId, physicianId),
    ).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.not.stringMatching(/private|SQL/),
    });
  });

  it('verifica el médico activo con la sesión y RLS', async () => {
    const active = setup({ physicians: [{ data: { id: physicianId } }] });
    await expect(active.repo.isActivePhysician(physicianId)).resolves.toBe(
      true,
    );
    expect(active.from).toHaveBeenCalledWith('physicians');
    expect(queryAt(active.from, 0).eq.mock.calls).toEqual([
      ['id', physicianId],
      ['active', true],
    ]);

    const inactive = setup({ physicians: [{ data: null }] });
    await expect(
      inactive.repo.isActivePhysician(physicianId),
    ).resolves.toBe(false);

    const failed = setup({ physicians: [{ data: null, error: {} }] });
    await expect(
      failed.repo.isActivePhysician(physicianId),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('guarda una revisión existente con parámetros del servidor y sin autor del cliente', async () => {
    const { repo, rpc } = setup(
      { clinical_records: [{ data: recordRow }] },
      {
        save_clinical_revision: [{ data: revisionRows[0] }],
      },
    );

    await expect(
      repo.saveRevision(patientId, {
        allergiesStatus: 'none_reported',
        background: 'Antecedente vigente',
        changeReason: 'Corrección ficticia',
        diagnosis: 'Diagnóstico vigente',
        expectedRevision: 2,
        treatment: 'Tratamiento vigente',
      }),
    ).resolves.toMatchObject({ revisionNumber: 2 });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('save_clinical_revision', {
      p_allergies: null,
      p_allergies_status: 'none_reported',
      p_background: 'Antecedente vigente',
      p_change_reason: 'Corrección ficticia',
      p_diagnosis: 'Diagnóstico vigente',
      p_expected_revision: 2,
      p_patient_id: patientId,
      p_treatment: 'Tratamiento vigente',
    });
    const parameters = (rpc.mock.calls[0][1] ?? {}) as Record<string, unknown>;
    expect(parameters).not.toHaveProperty('p_author_user_id');
    expect(parameters).not.toHaveProperty('p_author_physician_id');
    expect(parameters).not.toHaveProperty('p_created_at');
  });

  it('abre el expediente de un paciente preexistente solo si aún no es visible', async () => {
    const { repo, rpc } = setup(
      {
        clinical_records: [
          { data: null },
          {
            data: {
              ...recordRow,
              current_revision: 0,
            },
          },
        ],
      },
      {
        open_clinical_record: [
          {
            data: {
              out_patient_id: patientId,
              out_record_id: recordId,
              was_created: true,
            },
          },
        ],
        save_clinical_revision: [
          {
            data: {
              ...revisionRows[0],
              change_reason: null,
              revision_number: 1,
            },
          },
        ],
      },
    );

    await expect(
      repo.saveRevision(patientId, {
        allergiesStatus: 'none_reported',
        background: 'Primera nota',
        expectedRevision: 0,
        treatment: null,
      }),
    ).resolves.toMatchObject({ revisionNumber: 1 });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'open_clinical_record',
      'save_clinical_revision',
    ]);
    expect(rpc).toHaveBeenNthCalledWith(1, 'open_clinical_record', {
      p_patient_id: patientId,
    });
  });

  it('rechaza una versión obsoleta sin llamar a la RPC de guardado', async () => {
    const { repo, rpc } = setup({
      clinical_records: [{ data: recordRow }],
    });

    await expect(
      repo.saveRevision(patientId, {
        allergiesStatus: 'none_reported',
        background: 'Texto',
        changeReason: 'Cambio',
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: 'stale' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('traduce el rechazo de apertura y los errores de concurrencia', async () => {
    const denied = setup(
      { clinical_records: [{ data: null }] },
      { open_clinical_record: [{ data: null, error: { code: '42501' } }] },
    );
    await expect(
      denied.repo.saveRevision(patientId, {
        allergiesStatus: 'none_reported',
        background: 'Texto',
        expectedRevision: 0,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });

    const stale = setup(
      { clinical_records: [{ data: recordRow }] },
      {
        save_clinical_revision: [{ data: null, error: { code: 'PT409' } }],
      },
    );
    await expect(
      stale.repo.saveRevision(patientId, {
        allergiesStatus: 'none_reported',
        background: 'Texto',
        changeReason: 'Cambio',
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: 'stale' });
  });

  it('rechaza valores persistidos no reconocidos en lugar de mostrarlos', async () => {
    const invalidAppointment = setup({
      appointments: [{ data: [{ ...appointmentRow, status: 'unknown' }] }],
      patient_physicians: [{ data: { patient_id: patientId } }],
      patients: [{ data: patientRow }],
      clinical_records: [{ data: null }],
    });
    await expect(
      invalidAppointment.repo.getHistory(patientId, physicianId),
    ).rejects.toMatchObject({ code: 'unavailable' });

    const invalidPatient = setup({
      appointments: [{ data: [appointmentRow] }],
      patient_physicians: [{ data: { patient_id: patientId } }],
      patients: [{ data: { ...patientRow, sex: 'invalid' } }],
      clinical_records: [{ data: null }],
    });
    await expect(
      invalidPatient.repo.getHistory(patientId, physicianId),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });
});
