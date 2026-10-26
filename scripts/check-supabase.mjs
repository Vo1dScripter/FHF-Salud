import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key?.startsWith('sb_publishable_')) {
  process.stderr.write(
    'Configura la URL y la clave pública publicable de Supabase en .env.local.\n',
  );
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(new URL('/auth/v1/settings', url), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('unavailable');
    process.stdout.write(
      'Supabase Auth: conexión pública verificada (HTTP 200). No se leyeron ni escribieron registros médicos.\n',
    );
  } catch {
    process.stderr.write(
      'No se pudo verificar Supabase. Comprueba URL, clave pública y disponibilidad del proyecto.\n',
    );
    process.exitCode = 1;
  }
}
