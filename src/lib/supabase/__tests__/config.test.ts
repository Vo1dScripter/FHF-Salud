import { getSupabaseConfig } from '../config';

describe('Public Supabase configuration boundary', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        'sb_publishable_fixture_public_key_only',
    };
  });
  afterEach(() => {
    process.env = originalEnv;
  });
  it('accepts only the public configuration without including values in errors', () => {
    expect(getSupabaseConfig().url).toBe('https://example.supabase.co');
  });
  it.each(['sb_secret_test_privileged', 'eyJlegacy_service_role', 'invalid'])(
    'rejects a non-public key without echoing it: %s',
    (key) => {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
      expect(() => getSupabaseConfig()).toThrow(
        'Usa exclusivamente una clave pública',
      );
    },
  );
  it.each([
    'http://example.supabase.co',
    'https://user:password@example.supabase.co',
    'https://example.supabase.co/rest/v1',
  ])('rejects an unsafe origin: %s', (url) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    expect(() => getSupabaseConfig()).toThrow();
  });
  it('reports missing configuration without exposing credentials', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getSupabaseConfig()).toThrow(
      'Configura NEXT_PUBLIC_SUPABASE_URL',
    );
  });
});
