/** E2E contra app y Supabase REALES. Sin mocks ni claves administrativas.
 * Credenciales ficticias provisionadas por Auth Admin, archivo privado 0600.
 * PLAYWRIGHT_MODULE_PATH permite usar el runtime de @playwright/cli existente.
 */
import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { loadEnvConfig } = nextEnv;
import { createClient } from '@supabase/supabase-js';
loadEnvConfig(process.cwd());
const credentialPath = process.env.TAR05_E2E_CREDENTIALS_FILE;
if (!credentialPath) {
  process.stderr.write(
    'Falta TAR05_E2E_CREDENTIALS_FILE; no se ejecutaron pruebas ni escrituras.\n',
  );
  process.exit(2);
}
const fixture = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
const baseURL =
  process.env.TAR05_E2E_BASE_URL || 'https://fhf-salud.vercel.app';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(
  new URL(url).hostname,
  `${fixture.projectRef}.supabase.co`,
  'Destino distinto al fixture autorizado',
);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'
);
const directory = path.resolve(
  process.env.TAR05_E2E_OUTPUT || `evidencias/TAR05/e2e-${fixture.runId}`,
);
fs.mkdirSync(directory, { recursive: true });
const result = {
  runId: fixture.runId,
  baseURL,
  projectRef: fixture.projectRef,
  startedAt: new Date().toISOString(),
  checks: [],
  appointmentIds: [],
  blockIds: [],
  otherPhysicianAppointmentIds: [],
  complete: false,
  cleanupRequired: true,
};
let phase = 'inicio';
let browser;
let lastPage;
const reason = `TAR05 E2E ${fixture.runId}`;
function save() {
  fs.writeFileSync(
    path.join(directory, 'resultados.json'),
    JSON.stringify(result, null, 2),
  );
}
function pass(name, extra = {}) {
  result.checks.push({ name, status: 'PASS', ...extra });
  save();
}
async function api(context, method, route, data) {
  const response = await context.request[method](route, data ? { data } : {});
  return { status: response.status(), body: await response.json() };
}
async function detail(context, id) {
  const response = await api(context, 'get', `/api/citas/${id}`);
  assert.equal(response.status, 200);
  return response.body.appointment;
}
async function login(page, role) {
  lastPage = page;
  await page.goto('/citas/acceso', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    const key =
      form && Object.keys(form).find((k) => k.startsWith('__reactProps$'));
    return Boolean(key && form[key]?.onSubmit);
  });
  await page.waitForTimeout(2500);
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill(fixture.users[role].email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill(fixture.users[role].password);
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click();
  await page.waitForURL('**/citas', {
    timeout: 60000,
    waitUntil: 'domcontentloaded',
  });
}
function remember(appointment) {
  if (appointment?.id && !result.appointmentIds.includes(appointment.id)) {
    result.appointmentIds.push(appointment.id);
    save();
  }
}
async function screenshot(page, filename) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(directory, filename),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  assert.equal(overflow, false, 'Desbordamiento horizontal');
}
(async () => {
  browser = await chromium.launch({ headless: true });
  for (const [index, viewport] of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ].entries()) {
    const context = await browser.newContext({
      baseURL,
      viewport,
      reducedMotion: index ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    phase = `login-staff-${viewport.width}`;
    await login(page, 'staff');
    const references = await api(context, 'get', '/api/citas/referencias');
    assert.equal(references.status, 200);
    pass(`login real y referencias ${viewport.width}`);
    phase = `RF01-${viewport.width}`;
    await page.goto('/citas/nueva', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page
      .getByLabel('Paciente', { exact: true })
      .selectOption(fixture.patientId);
    await page
      .getByLabel('Médico / Profesional', { exact: true })
      .selectOption(fixture.physicianId);
    const localTime = `2035-08-${10 + index}T09:00`;
    await page
      .getByLabel('Inicio (Fecha y Hora)', { exact: true })
      .fill(localTime);
    await page
      .getByLabel('Duración estimada', { exact: true })
      .selectOption('30');
    await page
      .getByLabel('Motivo de la consulta', { exact: true })
      .fill(`${reason} UI ${viewport.width}`);
    const createdResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/citas') && r.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Guardar cita', exact: true })
      .click();
    const created = await createdResponse;
    assert.equal(created.status(), 201);
    const appointment = (await created.json()).appointment;
    remember(appointment);
    await page
      .getByRole('link', { name: 'Ver detalle', exact: true })
      .waitFor();
    await screenshot(page, `${viewport.width}-01-registro.png`);
    pass(`RF01 registro UI ${viewport.width}`, { id: appointment.id });
    phase = `RF02-${viewport.width}`;
    await page.getByRole('link', { name: 'Ver detalle', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Detalle de la cita', exact: true })
      .waitFor();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal((await detail(context, appointment.id)).status, 'pending');
    await page.getByText(fixture.patientName, { exact: true }).waitFor();
    await screenshot(page, `${viewport.width}-02-detalle-recargado.png`);
    pass(`RF02 lectura persistida y recarga ${viewport.width}`);
    phase = `RF03-${viewport.width}`;
    await page
      .getByRole('button', { name: 'Reprogramar', exact: true })
      .click();
    await page
      .getByLabel('Fecha y hora de inicio', { exact: true })
      .fill(`2035-08-${10 + index}T10:00`);
    const updatedResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/citas/${appointment.id}`) &&
        r.request().method() === 'PATCH',
    );
    await page
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    assert.equal((await updatedResponse).status(), 200);
    let current = await detail(context, appointment.id);
    assert.match(current.scheduledAt, /16:00:00/);
    await screenshot(page, `${viewport.width}-03-reprogramada.png`);
    pass(`RF03 reprogramacion UI ${viewport.width}`);
    phase = `RF06-${viewport.width}`;
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    const confirmation = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/citas/${appointment.id}`) &&
        r.request().method() === 'PATCH',
    );
    await page
      .getByRole('button', { name: 'Sí, confirmar cita', exact: true })
      .click();
    assert.equal((await confirmation).status(), 200);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    current = await detail(context, appointment.id);
    assert.equal(current.status, 'confirmed');
    assert.ok(current.confirmedAt);
    await screenshot(page, `${viewport.width}-04-confirmada-recargada.png`);
    pass(`RF06 confirmacion UI persistida ${viewport.width}`);
    phase = `RF05-${viewport.width}`;
    const duplicate = await api(context, 'post', '/api/citas', {
      patientId: fixture.patientId,
      physicianId: fixture.physicianId,
      scheduledAt: current.scheduledAt,
      durationMinutes: 30,
      reason,
    });
    assert.equal(duplicate.status, 409);
    pass(`RF05 traslape API rechazado ${viewport.width}`);
    phase = `RF04-${viewport.width}`;
    await page
      .getByRole('button', { name: 'Cancelar cita', exact: true })
      .click();
    await page
      .getByLabel('Motivo de cancelación', { exact: true })
      .fill(`${reason} cancelar prueba`);
    const cancellation = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/citas/${appointment.id}`) &&
        r.request().method() === 'PATCH',
    );
    await page
      .getByRole('button', { name: 'Sí, cancelar cita', exact: true })
      .click();
    assert.equal((await cancellation).status(), 200);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    current = await detail(context, appointment.id);
    assert.equal(current.status, 'cancelled');
    const impossible = await api(
      context,
      'patch',
      `/api/citas/${appointment.id}`,
      { action: 'confirm', expectedUpdatedAt: current.updatedAt },
    );
    assert.equal(impossible.status, 400);
    const replacement = await api(context, 'post', '/api/citas', {
      patientId: fixture.patientId,
      physicianId: fixture.physicianId,
      scheduledAt: current.scheduledAt,
      durationMinutes: 30,
      reason: `${reason} reutilizar`,
    });
    assert.equal(replacement.status, 201);
    remember(replacement.body.appointment);
    await screenshot(page, `${viewport.width}-05-cancelada-conservada.png`);
    pass(
      `RF04 cancelar, conservar, liberar; confirmar cancelada rechazado ${viewport.width}`,
    );
    if (index) {
      assert.equal(
        await page.evaluate(
          () => matchMedia('(prefers-reduced-motion: reduce)').matches,
        ),
        true,
      );
      pass('recorrido movil con movimiento reducido');
    }
    await context.close();
  }
  phase = 'concurrencia-remota';
  const staff = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signIn = await staff.auth.signInWithPassword(fixture.users.staff);
  assert.equal(
    signIn.error,
    null,
    'No se pudo autenticar usuario normal staff',
  );
  for (let round = 0; round < 5; round++) {
    const row = {
      patient_id: fixture.patientId,
      physician_id: fixture.physicianId,
      starts_at: `2035-09-${10 + round}T15:00:00Z`,
      duration_minutes: 30,
      reason: `${reason} carrera ${round}`,
      status: 'pending',
    };
    const write = () =>
      staff.from('appointments').insert(row).select('id').single();
    const responses = await Promise.all([write(), write()]);
    responses.forEach((r) => remember(r.data));
    assert.equal(
      responses.filter((r) => !r.error).length,
      1,
      'Dos reservas concurrentes no pueden coexistir',
    );
    assert.equal(responses.find((r) => r.error).error.code, '23P01');
    const simultaneous = await staff
      .from('appointments')
      .insert({ ...row, physician_id: fixture.otherPhysicianId })
      .select('id')
      .single();
    assert.equal(simultaneous.error, null);
    remember(simultaneous.data);
    result.otherPhysicianAppointmentIds.push(simultaneous.data.id);
    save();
    pass(
      `concurrencia REST normal ${round + 1}: un ganador, EXCLUDE; otro medico aceptado`,
    );
  }
  phase = 'concurrencia-bloqueo-reserva-remota';
  const raceTime = '2035-10-10T15:00:00Z';
  const [blockResult, appointmentResult] = await Promise.all([
    staff
      .from('physician_schedule_blocks')
      .insert({
        physician_id: fixture.physicianId,
        starts_at: raceTime,
        ends_at: '2035-10-10T16:00:00Z',
        reason: `${reason} bloqueo concurrente`,
      })
      .select('id')
      .single(),
    staff
      .from('appointments')
      .insert({
        patient_id: fixture.patientId,
        physician_id: fixture.physicianId,
        starts_at: raceTime,
        duration_minutes: 30,
        reason: `${reason} reserva contra bloqueo`,
        status: 'pending',
      })
      .select('id')
      .single(),
  ]);
  remember(appointmentResult.data);
  if (blockResult.data) {
    result.blockIds.push(blockResult.data.id);
    save();
  }
  assert.equal(
    [blockResult, appointmentResult].filter((r) => !r.error).length,
    1,
  );
  assert.equal(
    [blockResult, appointmentResult].find((r) => r.error).error.code,
    '23P01',
  );
  pass(
    'concurrencia remota bloqueo/reserva con usuario normal: un solo ganador',
  );
  phase = 'historial-remoto';
  const events = await staff
    .from('appointment_events')
    .select('appointment_id,event_type')
    .in('appointment_id', result.appointmentIds);
  assert.equal(events.error, null);
  assert.equal(
    events.data.filter((e) => e.event_type === 'cancelled').length,
    2,
  );
  pass('historial remoto conserva dos cancelaciones UI');
  const directUpdate = await staff
    .from('appointments')
    .update({ reason: 'Cambio no autorizado' })
    .eq('id', result.appointmentIds[0]);
  assert.ok(directUpdate.error, 'No se permite UPDATE directo');
  pass('escritura directa no autorizada rechazada incluso para staff');
  await staff.auth.signOut();
  for (const role of ['physician', 'noRole']) {
    phase = `permisos-${role}`;
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await login(page, role);
    const response = await api(context, 'get', '/api/citas');
    if (role === 'physician') {
      assert.equal(response.status, 200);
      assert.ok(response.body.appointments.length > 0);
      assert.ok(
        response.body.appointments.every(
          (a) => a.physicianId === fixture.physicianId,
        ),
      );
      const mutate = await api(
        context,
        'patch',
        `/api/citas/${result.appointmentIds[0]}`,
        { action: 'confirm', expectedUpdatedAt: new Date().toISOString() },
      );
      assert.equal(mutate.status, 403);
      const other = result.otherPhysicianAppointmentIds[0];
      assert.equal(
        (await api(context, 'get', `/api/citas/${other}`)).status,
        404,
      );
    } else assert.equal(response.status, 403);
    await screenshot(page, `permisos-${role}.png`);
    pass(`sesion normal ${role}: limites de lectura y escritura`);
    await context.close();
  }
  phase = 'RLS-usuario-normal-sin-rol';
  const noRole = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const normalSession = await noRole.auth.signInWithPassword(
    fixture.users.noRole,
  );
  assert.equal(normalSession.error, null);
  const unauthorizedRows = await noRole.from('appointments').select('id');
  assert.equal(unauthorizedRows.error, null);
  assert.equal(unauthorizedRows.data.length, 0);
  const rpc = await noRole.rpc('confirm_appointment', {
    p_appointment_id: result.appointmentIds[0],
    p_expected_updated_at: new Date().toISOString(),
  });
  assert.equal(rpc.error?.code, '42501');
  await noRole.auth.signOut();
  pass('RLS y RPC probados con JWT normal sin rol: cero filas y 42501');
  result.complete = true;
  result.completedAt = new Date().toISOString();
  save();
  process.stdout.write(
    `PASS E2E: ${result.checks.length} comprobaciones reales. Evidencia: ${directory}\n`,
  );
})()
  .catch(async (error) => {
    if (lastPage) {
      result.failurePage = {
        url: lastPage.url(),
        alerts: await lastPage
          .getByRole('alert')
          .allTextContents()
          .catch(() => []),
        button: await lastPage
          .getByRole('button')
          .allTextContents()
          .catch(() => []),
      };
    }
    result.checks.push({
      name: phase,
      status: 'FAIL',
      diagnostic: String(error.message).split('Call log:')[0].slice(0, 350),
    });
    save();
    process.stderr.write(
      `E2E FALLIDO en ${phase}. No se imprimieron credenciales. Revisar resultados y datos ficticios pendientes de limpieza.\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
