import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabasePatientRepository } from '../supabase-repository';

function setup(data: unknown, error: unknown = null) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data, error }),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
  };
  const client = { from: jest.fn().mockReturnValue(query) };
  return {
    query,
    client,
    repo: new SupabasePatientRepository(client as unknown as SupabaseClient),
  };
}
it('consulta columnas existentes, orden estable y página con centinela', async () => {
  const rows = Array.from({ length: 26 }, (_, index) => ({
    id: String(index),
    display_name: 'Paciente ficticio',
    active: true,
    created_at: '2026-11-16T00:00:00Z',
  }));
  const { repo, query, client } = setup(rows);
  const result = await repo.list({ search: 'Ana', page: 2 });
  expect(client.from).toHaveBeenCalledWith('patients');
  expect(query.select).toHaveBeenCalledWith(
    'id, display_name, active, created_at',
  );
  expect(query.order.mock.calls).toEqual([['display_name'], ['id']]);
  expect(query.ilike).toHaveBeenCalledWith('display_name', '%Ana%');
  expect(query.range).toHaveBeenCalledWith(25, 50);
  expect(result.hasMore).toBe(true);
  expect(result.patients).toHaveLength(25);
  expect(result.patients[0]).toEqual({
    id: '0',
    displayName: 'Paciente ficticio',
    active: true,
    createdAt: '2026-11-16T00:00:00Z',
  });
});
it('distingue vacío de error sin filtrar detalles internos', async () => {
  const empty = setup([]);
  await expect(empty.repo.list({ search: '', page: 1 })).resolves.toEqual({
    patients: [],
    hasMore: false,
  });
  expect(empty.query.ilike).not.toHaveBeenCalled();
  await expect(
    setup(null, { message: 'private SQL' }).repo.list({ search: '', page: 1 }),
  ).rejects.toMatchObject({
    code: 'unavailable',
    message: 'No se pudo consultar pacientes. Inténtalo de nuevo.',
  });
});
it('verifica vínculo de médico activo usando sesión y RLS', async () => {
  const { repo, query, client } = setup({ id: 'id' });
  await expect(repo.isActivePhysician('id')).resolves.toBe(true);
  expect(client.from).toHaveBeenCalledWith('physicians');
  expect(query.eq.mock.calls).toEqual([
    ['id', 'id'],
    ['active', true],
  ]);
  await expect(setup(null).repo.isActivePhysician('id')).resolves.toBe(false);
  await expect(
    setup(null, {}).repo.isActivePhysician('id'),
  ).rejects.toMatchObject({ code: 'unavailable' });
});
