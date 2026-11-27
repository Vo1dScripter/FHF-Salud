// Ejecutar solo con una instancia local y cuentas desechables de médico y recepción.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const baseURL = process.env.PRY06_BASE_URL ?? 'http://127.0.0.1:3107';
assert.match(baseURL, /^http:\/\/127\.0\.0\.1:\d+$/);
const accounts = JSON.parse(
  await readFile(process.env.PRY06_E2E_ACCOUNTS, 'utf8'),
);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : 'playwright'
);
const output = process.env.PRY06_E2E_OUTPUT;
const browser = await chromium.launch({
  executablePath: process.env.PRY06_CHROMIUM_PATH,
});
const physicianId = process.env.PRY06_E2E_PHYSICIAN_ID;
assert.ok(physicianId);
const pass = (message) => process.stdout.write(message + '\n');

async function login(page, account) {
  await page.goto('/citas/acceso');
  await page.getByLabel('Correo electrónico').fill(account.email);
  await page.getByLabel('Contraseña').fill(account.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL('**/citas');
}

try {
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height },
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    await login(page, accounts.physician);
    await page.goto('/pacientes');
    const name = `Paciente Ficticio PRY06 ${width} ${Date.now()}`;
    const input = await page.getByLabel('Nombre completo para el alta');
    await input.fill(name);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/pacientes') && r.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Registrar paciente y expediente' })
      .click();
    const registration = await response;
    assert.equal(registration.status(), 201, 'Alta de paciente');
    const { patientId, recordId } = await registration.json();
    const recordPath = `/pacientes/${patientId}`;
    const api = `/api${recordPath}/expediente`;
    await page.waitForURL(`**${recordPath}`);
    await page.getByRole('heading', { name }).waitFor();
    const readHistory = async () => {
      const reply = await context.request.get(api);
      assert.equal(reply.status(), 200, 'Lectura de expediente');
      return (await reply.json()).history;
    };
    const initial = await readHistory();
    assert.equal(initial.record.id, recordId);
    assert.equal(initial.record.currentRevision, 0);
    pass(`PASS ${width} RF-07: alta UI y expediente persistido`);

    await page.goto('/pacientes');
    await page.getByLabel('Nombre del paciente').fill(name);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('link', { name: `Ver expediente de ${name}` }).click();
    await page.waitForURL(`**${recordPath}`);
    pass(`PASS ${width} RF-10: búsqueda UI y navegación al expediente`);

    await page
      .getByLabel('Antecedentes', { exact: true })
      .fill('Antecedente ficticio');
    await page.getByLabel('Alergias', { exact: true }).selectOption('reported');
    await page.locator('#clinical-allergies').fill('Alergia ficticia');
    await page
      .getByLabel('Diagnóstico', { exact: true })
      .fill('Diagnóstico ficticio');
    await page
      .getByLabel('Tratamiento', { exact: true })
      .fill('Tratamiento ficticio');
    const first = page.waitForResponse(
      (r) => r.url().endsWith(api) && r.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Registrar primera nota', exact: true })
      .click();
    assert.equal((await first).status(), 201, 'Primera nota clínica');
    await page.reload();
    const firstHistory = await readHistory();
    const note = firstHistory.revisions[0];
    assert.equal(note.background, 'Antecedente ficticio');
    assert.equal(note.allergies, 'Alergia ficticia');
    assert.equal(note.diagnosis, 'Diagnóstico ficticio');
    assert.equal(note.treatment, 'Tratamiento ficticio');
    assert.equal(note.authorPhysicianId, physicianId);
    assert.ok(Number.isFinite(Date.parse(note.createdAt)));
    await page
      .getByRole('heading', { name: 'Información clínica vigente' })
      .waitFor();
    pass(
      `PASS ${width} RF-08/09: nota, contenido y autor persisten tras recarga`,
    );

    await page
      .getByLabel('Tratamiento', { exact: true })
      .fill('Tratamiento ficticio actualizado');
    await page
      .getByLabel('Motivo de la nueva revisión')
      .fill('Ajuste de prueba');
    const revised = page.waitForResponse(
      (r) => r.url().endsWith(api) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Guardar nueva revisión' }).click();
    assert.equal((await revised).status(), 200, 'Revisión clínica');
    await page.reload();
    const secondHistory = await readHistory();
    assert.equal(secondHistory.record.currentRevision, 2);
    assert.ok(
      Date.parse(secondHistory.record.updatedAt) >
        Date.parse(firstHistory.record.updatedAt),
    );
    assert.equal(
      secondHistory.revisions.find((r) => r.revisionNumber === 2).treatment,
      'Tratamiento ficticio actualizado',
    );
    assert.equal(
      secondHistory.revisions.find((r) => r.revisionNumber === 1).treatment,
      'Tratamiento ficticio',
    );
    await page
      .getByText('Tratamiento ficticio actualizado', { exact: true })
      .first()
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (output) {
      await page.locator('#clinical-current-title').evaluate((title) => {
        title.scrollIntoView({ block: 'center' });
      });
      await page.screenshot({ path: `${output}/${width}-expediente.png` });
    }
    pass(
      `PASS ${width} RF-11: modificación, fecha y revisión anterior conservadas`,
    );

    const staff = await browser.newContext({
      baseURL,
      viewport: { width, height },
    });
    const staffPage = await staff.newPage();
    await login(staffPage, accounts.receptionist);
    assert.equal((await staff.request.get(api)).status(), 403);
    assert.equal((await staff.request.post(api, { data: {} })).status(), 403);
    const anonymous = await browser.newContext({ baseURL });
    assert.equal((await anonymous.request.get(api)).status(), 401);
    await anonymous.close();
    pass(
      `PASS ${width} RF-12: lectura y escritura de recepción denegadas y anónimo rechazado`,
    );

    await staffPage.goto('/citas/nueva');
    const select = staffPage.getByLabel('Paciente', { exact: true });
    await select.selectOption(patientId);
    await staffPage
      .getByLabel('Médico / Profesional')
      .selectOption(physicianId);
    await staffPage
      .getByLabel('Inicio (Fecha y Hora)')
      .fill(`2035-08-${width === 390 ? '11' : '10'}T09:00`);
    await staffPage.getByLabel('Duración estimada').selectOption('30');
    await staffPage
      .getByLabel('Motivo de la consulta')
      .fill('Cita ficticia PRY06');
    const booking = staffPage.waitForResponse(
      (r) => r.url().endsWith('/api/citas') && r.request().method() === 'POST',
    );
    await staffPage
      .getByRole('button', { name: 'Guardar cita', exact: true })
      .click();
    const created = await booking;
    assert.equal(created.status(), 201, 'Cita con paciente recién registrado');
    const { appointment } = await created.json();
    assert.equal(appointment.patientId, patientId);
    assert.ok(
      (await readHistory()).appointments.some(
        (item) => item.id === appointment.id,
      ),
    );
    await staffPage.goto('/citas');
    const row = staffPage.getByRole('row').filter({ hasText: name });
    await row.locator(`a[href="/citas/${appointment.id}"]`).click();
    await staffPage
      .getByRole('heading', { name: 'Detalle de la cita' })
      .waitFor();
    await staffPage.reload();
    await staffPage.getByText(name, { exact: true }).waitFor();
    const appointmentUrl = `/api/citas/${appointment.id}`;
    const readAppointment = async () => {
      const reply = await staff.request.get(appointmentUrl);
      assert.equal(reply.status(), 200);
      return (await reply.json()).appointment;
    };
    const reschedule = staffPage.waitForResponse(
      (r) =>
        r.url().endsWith(appointmentUrl) && r.request().method() === 'PATCH',
    );
    await staffPage
      .getByRole('button', { name: 'Reprogramar', exact: true })
      .click();
    await staffPage
      .getByLabel('Fecha y hora de inicio')
      .fill(`2035-08-${width === 390 ? '11' : '10'}T10:00`);
    await staffPage
      .getByRole('button', { name: 'Guardar cambios', exact: true })
      .click();
    assert.equal((await reschedule).status(), 200);
    const rescheduled = await readAppointment();
    assert.notEqual(rescheduled.scheduledAt, appointment.scheduledAt);
    const overlap = await staff.request.post('/api/citas', {
      data: {
        patientId,
        physicianId,
        scheduledAt: rescheduled.scheduledAt,
        durationMinutes: 30,
        reason: 'Traslape ficticio',
      },
    });
    assert.equal(overlap.status(), 409);
    const confirm = async (action, label, confirmation, expected) => {
      const reply = staffPage.waitForResponse(
        (r) =>
          r.url().endsWith(appointmentUrl) && r.request().method() === 'PATCH',
      );
      await staffPage.getByRole('button', { name: label, exact: true }).click();
      if (action === 'cancel')
        await staffPage
          .getByLabel('Motivo de cancelación')
          .fill('Cancelación ficticia');
      await staffPage
        .getByRole('button', { name: confirmation, exact: true })
        .click();
      assert.equal((await reply).status(), 200);
      await staffPage.reload();
      assert.equal((await readAppointment()).status, expected);
    };
    await confirm('confirm', 'Confirmar', 'Sí, confirmar cita', 'confirmed');
    await confirm('cancel', 'Cancelar cita', 'Sí, cancelar cita', 'cancelled');
    pass(
      `PASS ${width} RF-01 a RF-06: cita vinculada, agenda, reprogramación, traslape, confirmación y cancelación`,
    );
    await staff.close();
    await context.close();
  }
} finally {
  await browser.close();
}
