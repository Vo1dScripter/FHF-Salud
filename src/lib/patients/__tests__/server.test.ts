/** @jest-environment node */
import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import { getPatientRequestContext } from '../server';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const create = jest.mocked(createClient);
const id = '33333333-3333-4333-8333-333333333333';
function mockUser(user: Partial<User> | null, error: unknown = null) {
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error }) },
  };
  create.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return client;
}
beforeEach(() => jest.resetAllMocks());
it('verifica usuario en Auth, normaliza médico y no confía en user_metadata', async () => {
  const client = mockUser({
    id,
    app_metadata: {
      appointment_role: 'physician',
      physician_id: id.toUpperCase(),
    },
    user_metadata: { appointment_role: 'admin' },
  });
  expect((await getPatientRequestContext()).actor).toEqual({
    role: 'physician',
    physicianId: id.toLowerCase(),
    userId: id,
  });
  expect(client.auth.getUser).toHaveBeenCalledTimes(1);
});
it('rechaza rol solo presente en user_metadata', async () => {
  mockUser({
    id,
    app_metadata: {},
    user_metadata: { appointment_role: 'physician', physician_id: id },
  });
  await expect(getPatientRequestContext()).rejects.toMatchObject({
    code: 'forbidden',
  });
});
it.each([
  null,
  { id, app_metadata: { appointment_role: 'physician', physician_id: 'bad' } },
])('rechaza identidad inválida %p', async (user) => {
  mockUser(user);
  await expect(getPatientRequestContext()).rejects.toMatchObject({
    code: user ? 'forbidden' : 'unauthenticated',
  });
});
it('distingue configuración, indisponibilidad y sesión inválida', async () => {
  create.mockRejectedValueOnce(new Error('private config'));
  await expect(getPatientRequestContext()).rejects.toMatchObject({
    code: 'configuration',
  });
  mockUser(null, { status: 503 });
  await expect(getPatientRequestContext()).rejects.toMatchObject({
    code: 'unavailable',
  });
  mockUser(null, { status: 401 });
  await expect(getPatientRequestContext()).rejects.toMatchObject({
    code: 'unauthenticated',
  });
});
