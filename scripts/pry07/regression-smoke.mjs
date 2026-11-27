import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const logs = [];
let child;

function record(stream, chunk) {
  logs.push(`${stream}: ${chunk}`);
  if (logs.length > 200) logs.shift();
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

function stop() {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

async function waitForServer(base, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev terminó con código ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`${base}/`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
    } catch {
      // El servidor todavía no está listo.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }
  throw new Error('Tiempo de espera agotado al iniciar Next dev.');
}

async function get(base, path) {
  const response = await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(30_000),
  });
  return { body: await response.text(), status: response.status };
}

function check(name, condition, detail = '') {
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
  }
  process.stdout.write(`PASS ${name}\n`);
}

try {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  child = spawn(
    process.execPath,
    [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(port)],
    {
      cwd: root,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        FHF_APPOINTMENT_PREVIEW: 'true',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(24)}`,
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => record('stdout', chunk.toString()));
  child.stderr.on('data', (chunk) => record('stderr', chunk.toString()));

  await waitForServer(base);

  const home = await get(base, '/');
  check('portada responde 200', home.status === 200);
  check('portada enlaza citas', home.body.includes('href="/citas"'));
  check('portada enlaza pacientes', home.body.includes('href="/pacientes"'));

  const preview = await get(base, '/citas/vista-previa?estado=poblado');
  check('vista previa poblada responde 200', preview.status === 200);
  check(
    'vista previa poblada usa datos sintéticos',
    preview.body.includes('Datos sintéticos de propuesta'),
  );
  check(
    'vista previa poblada enlaza su propio detalle',
    preview.body.includes('vista-previa?estado=detalle&amp;id=preview-1') ||
      preview.body.includes('vista-previa?estado=detalle&id=preview-1'),
  );
  check(
    'vista previa no cruza funciones al cliente',
    !preview.body.includes(
      'Functions cannot be passed directly to Client Components',
    ),
  );

  for (const [state, expected] of [
    ['vacio', 'Sin citas para estos filtros'],
    ['error', 'No se pudo consultar la agenda'],
    ['sesion', 'Inicia sesión para consultar la agenda'],
    ['permiso', 'Acceso restringido'],
    ['formulario', 'Nueva cita médica'],
    ['detalle', 'Detalle de la cita'],
  ]) {
    const page = await get(base, `/citas/vista-previa?estado=${state}`);
    check(`vista previa ${state} responde 200`, page.status === 200);
    check(`vista previa ${state} muestra ${expected}`, page.body.includes(expected));
  }

  const missing = await get(base, '/citas/vista-previa?estado=desconocido');
  check('vista previa desconocida responde 404', missing.status === 404);

  const access = await get(base, '/citas/acceso');
  check('acceso responde 200', access.status === 200);
  check('acceso muestra correo', access.body.includes('Correo electrónico'));
  check('acceso muestra contraseña', access.body.includes('Contraseña'));

  const agenda = await get(base, '/citas');
  check('agenda responde 200', agenda.status === 200);
  check('agenda muestra filtros', agenda.body.includes('Filtros de agenda'));
  check('agenda muestra estado de carga', agenda.body.includes('Cargando citas'));

  const patients = await get(base, '/pacientes');
  check('pacientes responde 200', patients.status === 200);
  check('pacientes muestra búsqueda', patients.body.includes('Buscar pacientes'));
  check(
    'pacientes muestra campo de nombre',
    patients.body.includes('Nombre del paciente'),
  );

  process.stdout.write('PRY07 SMOKE: PASS\n');
} catch (error) {
  process.stderr.write(
    `PRY07 SMOKE: FAIL (${error instanceof Error ? error.message : 'error desconocido'})\n`,
  );
  for (const line of logs.slice(-20)) process.stderr.write(`${line}\n`);
  process.exitCode = 1;
} finally {
  stop();
  await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
}
