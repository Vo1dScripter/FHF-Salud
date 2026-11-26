import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const baseURL = process.env.PRY07_BASE_URL;
assert.match(baseURL ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
const output = process.env.PRY07_E2E_OUTPUT;
const fixture = JSON.parse(await readFile(process.env.PRY07_FIXTURES, 'utf8'));
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : 'playwright'
);
const results = [];
let phase = 'inicio de Chromium';

async function login(page, account) {
  await page.goto('/citas/acceso', { waitUntil: 'load' });
  await page.getByLabel('Correo electrónico').fill(account.email);
  await page.getByLabel('Contraseña').fill(account.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL('**/citas');
}

async function check(name, operation) {
  phase = name;
  await operation();
  results.push({ name, status: 'PASS' });
  process.stdout.write(`PASS ${name}\n`);
}

let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PRY07_CHROMIUM_PATH,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    let appointment;
    const reason = `Cita ficticia PRY07 ${width}`;
    await check(
      `${width}px RF-01: registro autenticado mediante la interfaz`,
      async () => {
        await login(page, fixture.accounts.receptionist);
        await page.goto('/citas/nueva');
        await page
          .getByLabel('Paciente', { exact: true })
          .selectOption(fixture.patientId);
        await page
          .getByLabel('Médico / Profesional')
          .selectOption(fixture.physicianId);
        await page
          .getByLabel('Inicio (Fecha y Hora)')
          .fill(`2035-08-${width === 390 ? '11' : '10'}T09:00`);
        await page.getByLabel('Duración estimada').selectOption('30');
        await page.getByLabel('Motivo de la consulta').fill(reason);
        const created = page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/citas') && r.request().method() === 'POST',
        );
        await page
          .getByRole('button', { name: 'Guardar cita', exact: true })
          .click();
        const reply = await created;
        assert.equal(reply.status(), 201);
        ({ appointment } = await reply.json());
        assert.ok(appointment.id);
        assert.equal(appointment.patientId, fixture.patientId);
        assert.equal(appointment.physicianId, fixture.physicianId);
      },
    );

    await check(
      `${width}px RF-02: agenda y detalle persistidos tras recargar`,
      async () => {
        await page.goto('/citas');
        const row = page.getByRole('row').filter({ hasText: reason });
        await row.locator(`a[href="/citas/${appointment.id}"]`).click();
        await page.waitForURL(`**/citas/${appointment.id}`);
        await page.reload();
        await page
          .getByRole('heading', { name: 'Detalle de la cita' })
          .waitFor();
        await page.getByText(reason, { exact: true }).waitFor();
        const reply = await context.request.get(`/api/citas/${appointment.id}`);
        assert.equal(reply.status(), 200);
        const stored = (await reply.json()).appointment;
        assert.equal(stored.id, appointment.id);
        assert.equal(stored.scheduledAt, appointment.scheduledAt);
        assert.equal(stored.reason, reason);
        assert.equal(stored.status, 'pending');
        await page.screenshot({ path: join(output, `${width}-detalle.png`) });
      },
    );

    const references = await context.request.get('/api/citas');
    assert.equal(references.status(), 200);
    const count = (await references.json()).appointments.length;
    const duplicate = {
      patientId: fixture.patientId,
      physicianId: fixture.physicianId,
      scheduledAt: appointment.scheduledAt,
      durationMinutes: 30,
      reason,
    };
    await check(
      `${width}px RF-05: traslape rechazado sin registro adicional`,
      async () => {
        assert.equal(
          (
            await context.request.post('/api/citas', { data: duplicate })
          ).status(),
          409,
        );
        const reply = await context.request.get('/api/citas');
        assert.equal(reply.status(), 200);
        assert.equal((await reply.json()).appointments.length, count);
      },
    );

    await check(
      `${width}px permisos: 401 anónimo y 403 con sesión sin rol`,
      async () => {
        const anonymous = await browser.newContext({ baseURL });
        const endpoint = `/api/citas/${appointment.id}`;
        assert.equal((await anonymous.request.get(endpoint)).status(), 401);
        assert.equal(
          (
            await anonymous.request.post('/api/citas', { data: duplicate })
          ).status(),
          401,
        );
        await anonymous.close();
        const unassigned = await browser.newContext({ baseURL });
        const unassignedPage = await unassigned.newPage();
        await login(unassignedPage, fixture.accounts.unassigned);
        assert.equal((await unassigned.request.get(endpoint)).status(), 403);
        assert.equal(
          (
            await unassigned.request.post('/api/citas', { data: duplicate })
          ).status(),
          403,
        );
        await unassigned.close();
        const reply = await context.request.get('/api/citas');
        assert.equal(reply.status(), 200);
        assert.equal((await reply.json()).appointments.length, count);
      },
    );
async function updateAppointment(button, submit, status, prepare) {
      await page.getByRole('button', {
        name: button,
        exact: true,
      }).click();

      const dialog = page.getByRole('dialog');

      if (prepare) await prepare(dialog);

      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/citas/${appointment.id}`) &&
          r.request().method() === 'PATCH',
      );

      await dialog.getByRole('button', {
        name: submit,
        exact: true,
      }).click();

      const reply = await response;
      assert.equal(reply.status(), 200);

      const updated = (await reply.json()).appointment;
      assert.equal(updated.id, appointment.id);
      assert.equal(updated.status, status);

      await dialog.waitFor({ state: 'hidden' });
      await page.reload();

      const persisted = await context.request.get(
        `/api/citas/${appointment.id}`,
      );

      assert.equal(persisted.status(), 200);

      const stored = (await persisted.json()).appointment;

      assert.equal(stored.id, updated.id);
      assert.equal(stored.status, status);
      assert.equal(stored.scheduledAt, updated.scheduledAt);
      assert.equal(stored.durationMinutes, updated.durationMinutes);

      appointment = stored;
    }

    await check(
      `${width}px reprogramacion persistente`,
      async () => {
        const previous = appointment.scheduledAt;

        await updateAppointment(
          'Reprogramar',
          'Guardar cambios',
          'pending',
          async (dialog) => {
            await dialog.getByLabel('Fecha y hora de inicio')
              .fill(`2035-08-${width === 390 ? '11' : '10'}T11:00`);
          },
        );

        assert.notEqual(appointment.scheduledAt, previous);

        await page.screenshot({
          path: join(output, `${width}-reprogramada.png`),
        });
      },
    );

    await check(
      `${width}px confirmacion persistente`,
      async () => {
        await updateAppointment(
          'Confirmar',
          'Si, confirmar cita'.replace('Si', 'Sí'),
          'confirmed',
        );

        await page.screenshot({
          path: join(output, `${width}-confirmada.png`),
        });
      },
    );

    await check(
      `${width}px reprogramacion de cita confirmada`,
      async () => {
        const previous = appointment.scheduledAt;

        await updateAppointment(
          'Reprogramar',
          'Guardar cambios',
          'pending',
          async (dialog) => {
            await dialog.getByLabel('Fecha y hora de inicio')
              .fill(`2035-08-${width === 390 ? '11' : '10'}T13:00`);
          },
        );

        assert.notEqual(appointment.scheduledAt, previous);
      },
    );

    await check(
      `${width}px motivo de cancelacion obligatorio`,
      async () => {
        await page.getByRole('button', {
          name: 'Cancelar cita',
          exact: true,
        }).click();

        const dialog = page.getByRole('dialog');

        await dialog.getByRole('button', {
          name: 'Sí, cancelar cita',
          exact: true,
        }).click();

        await dialog.getByText(
          'Indica el motivo de la cancelación.',
          { exact: true },
        ).waitFor();

        await dialog.getByRole('button', {
          name: 'Volver',
          exact: true,
        }).click();

        await dialog.waitFor({ state: 'hidden' });

        const reply = await context.request.get(
          `/api/citas/${appointment.id}`,
        );

        assert.equal(reply.status(), 200);
        assert.equal(
          (await reply.json()).appointment.status,
          'pending',
        );
      },
    );

    await check(
      `${width}px cancelacion persistente y bloqueo de acciones`,
      async () => {
        await updateAppointment(
          'Cancelar cita',
          'Sí, cancelar cita',
          'cancelled',
          async (dialog) => {
            await dialog.getByLabel('Motivo de cancelación')
              .fill('Cancelacion ficticia de prueba PRY07');
          },
        );

        for (const name of [
          'Confirmar',
          'Reprogramar',
          'Cancelar cita',
        ]) {
          const button = page.getByRole('button', {
            name,
            exact: true,
          });

          await button.waitFor();
          assert.equal(await button.isDisabled(), true);
        }

        await page.screenshot({
          path: join(output, `${width}-cancelada.png`),
        });
      },
    );
    await context.close();
  }
} catch (error) {
  // Playwright call logs can include filled values. Keep credentials out of artifacts.
  results.push({ name: phase, status: 'FAIL', type: error.name });
  process.stderr.write(`FAIL ${phase} (${error.name})\n`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(
    join(output, 'resultados.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
}
