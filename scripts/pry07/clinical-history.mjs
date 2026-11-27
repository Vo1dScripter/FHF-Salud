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

function endpointFor(patientId) {
  return `/api/pacientes/${patientId}/expediente`;
}

function waitForSave(page, patientId) {
  return page.waitForResponse(
    (response) =>
      response.url().endsWith(endpointFor(patientId)) &&
      response.request().method() === 'POST'
  );
}

async function fillRevision(page, data) {
  await page.getByLabel('Antecedentes').fill(data.background);
  await page
    .getByLabel('Alergias', { exact: true })
    .selectOption(data.allergiesStatus);
  if (data.allergiesStatus === 'reported') {
    await page.getByLabel('Alergias reportadas').fill(data.allergies);
  }
  await page.getByLabel('Diagnóstico').fill(data.diagnosis);
  await page.getByLabel('Tratamiento').fill(data.treatment);
  if (data.changeReason) {
    await page
      .getByLabel('Motivo de la nueva revisión')
      .fill(data.changeReason);
  }
}

async function readHistory(context, patientId, expectedRevision) {
  const reply = await context.request.get(endpointFor(patientId));
  assert.equal(reply.status(), 200);
  const history = (await reply.json()).history;
  assert.equal(history.patient.id, patientId);
  assert.equal(history.record.patientId, patientId);
  assert.equal(history.record.currentRevision, expectedRevision);
  assert.equal(history.revisions.length, expectedRevision);
  return history;
}

function deniedBody(marker) {
  return {
    allergies: null,
    allergiesStatus: 'not_recorded',
    background: `Intento denegado ficticio ${marker}`,
    changeReason: `Intento denegado ficticio ${marker}`,
    diagnosis: `DENEGADO ${marker}`,
    expectedRevision: 4,
    treatment: `Intento denegado ficticio ${marker}`,
  };
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
    const clinical = fixture.clinical[String(width)];
    const texts = clinical.texts;
    const endpoint = endpointFor(clinical.patientId);

    await check(
      `${width}px RF-07: médico autorizado localiza y abre el expediente`,
      async () => {
        await login(page, fixture.accounts.physician);
        await page.goto('/pacientes');
        await page
          .getByLabel('Nombre del paciente')
          .fill(clinical.patientName);
        await page.getByRole('button', { name: 'Buscar', exact: true }).click();
        const row = page
          .getByRole('row')
          .filter({ hasText: clinical.patientName });
        await row.waitFor();
        await row
          .getByRole('link', {
            name: `Ver expediente de ${clinical.patientName}`,
          })
          .click();
        await page.waitForURL(`**/pacientes/${clinical.patientId}`);
        await page
          .getByRole('heading', { name: clinical.patientName })
          .waitFor();
        await page
          .getByText('Sin expediente abierto para tu cuenta', { exact: true })
          .waitFor();
        await page
          .getByRole('button', { name: 'Registrar primera nota', exact: true })
          .waitFor();
        await page.screenshot({
          path: join(output, `${width}-expediente-abierto.png`),
        });
      }
    );

    await check(
      `${width}px RF-09: primera nota persistida con autoría y fecha del servidor`,
      async () => {
        await fillRevision(page, texts.first);
        const saved = waitForSave(page, clinical.patientId);
        await page
          .getByRole('button', { name: 'Registrar primera nota', exact: true })
          .click();
        const reply = await saved;
        assert.equal(reply.status(), 201);
        const body = await reply.json();
        assert.equal(body.revision.revisionNumber, 1);
        assert.equal(body.revision.authorPhysicianId, fixture.physicianId);
        assert.equal(body.history.record.currentRevision, 1);
        assert.equal(body.history.patient.id, clinical.patientId);
        await page
          .getByRole('status')
          .filter({
            hasText: 'La primera nota clínica se registró correctamente.',
          })
          .waitFor();
        await page.getByText(/Revisión vigente 1/).waitFor();
        await page
          .getByText(texts.first.diagnosis, { exact: true })
          .first()
          .waitFor();
        await page.screenshot({
          path: join(output, `${width}-expediente-primera-nota.png`),
        });
      }
    );

    await check(
      `${width}px RF-08: recarga conserva la primera revisión y su asociación`,
      async () => {
        await page.reload();
        await page
          .getByRole('heading', { name: clinical.patientName })
          .waitFor();
        await page.getByText(/Revisión vigente 1/).waitFor();
        await page
          .getByText(texts.first.diagnosis, { exact: true })
          .first()
          .waitFor();
        assert.equal(await page.locator('summary').count(), 1);
        const history = await readHistory(context, clinical.patientId, 1);
        assert.equal(history.revisions[0].diagnosis, texts.first.diagnosis);
        assert.equal(
          history.revisions[0].authorPhysicianId,
          fixture.physicianId
        );
        assert.ok(history.revisions[0].createdAt);
      }
    );

    await check(
      `${width}px RF-11: segunda revisión conserva la primera sin sobrescribir`,
      async () => {
        await fillRevision(page, texts.second);
        const saved = waitForSave(page, clinical.patientId);
        await page
          .getByRole('button', { name: 'Guardar nueva revisión', exact: true })
          .click();
        const reply = await saved;
        assert.equal(reply.status(), 200);
        const body = await reply.json();
        assert.equal(body.revision.revisionNumber, 2);
        assert.equal(body.revision.changeReason, texts.second.changeReason);
        await page
          .getByRole('status')
          .filter({
            hasText: 'La nueva revisión clínica se guardó correctamente.',
          })
          .waitFor();
        await page.getByText('Revisión 2 de 2.', { exact: false }).waitFor();
        assert.equal(await page.locator('summary').count(), 2);
        const history = await readHistory(context, clinical.patientId, 2);
        assert.equal(
          history.revisions.find((item) => item.revisionNumber === 1).diagnosis,
          texts.first.diagnosis
        );
        assert.equal(
          history.revisions.find((item) => item.revisionNumber === 2).diagnosis,
          texts.second.diagnosis
        );
        await page.screenshot({
          path: join(output, `${width}-expediente-revision-2.png`),
        });
      }
    );

    await check(
      `${width}px RF-11: conflicto 409 ante escritura concurrente y recarga`,
      async () => {
        const concurrent = await context.request.post(endpoint, {
          data: { ...texts.concurrent, expectedRevision: 2 },
        });
        assert.equal(concurrent.status(), 200);
        const concurrentBody = await concurrent.json();
        assert.equal(concurrentBody.revision.revisionNumber, 3);

        // La pestaña sigue mostrando la revisión 2: su envío debe ser rechazado.
        await page.getByLabel('Diagnóstico').fill(texts.stale.diagnosis);
        await page
          .getByLabel('Motivo de la nueva revisión')
          .fill(texts.stale.changeReason);
        const stale = waitForSave(page, clinical.patientId);
        await page
          .getByRole('button', { name: 'Guardar nueva revisión', exact: true })
          .click();
        const reply = await stale;
        assert.equal(reply.status(), 409);
        assert.equal((await reply.json()).error.code, 'stale');
        await page
          .getByRole('alert')
          .filter({ hasText: /El expediente cambió mientras/ })
          .waitFor();
        await page
          .getByRole('button', { name: 'Recargar expediente', exact: true })
          .waitFor();
        await page.screenshot({
          path: join(output, `${width}-conflicto-409.png`),
        });
        const history = await readHistory(context, clinical.patientId, 3);
        assert.equal(
          history.revisions.some(
            (item) => item.diagnosis === texts.stale.diagnosis
          ),
          false
        );
      }
    );

    await check(
      `${width}px RF-11: recarga tras conflicto y revisión final persistida`,
      async () => {
        await page
          .getByRole('button', { name: 'Recargar expediente', exact: true })
          .click();
        await page.getByText('Revisión 3 de 3.', { exact: false }).waitFor();
        await page
          .getByText(texts.concurrent.diagnosis, { exact: true })
          .first()
          .waitFor();
        await fillRevision(page, texts.final);
        const saved = waitForSave(page, clinical.patientId);
        await page
          .getByRole('button', { name: 'Guardar nueva revisión', exact: true })
          .click();
        const reply = await saved;
        assert.equal(reply.status(), 200);
        assert.equal((await reply.json()).revision.revisionNumber, 4);
        await page.getByText('Revisión 4 de 4.', { exact: false }).waitFor();
        await page.reload();
        await page.getByText(/Revisión vigente 4/).waitFor();
        await page
          .getByText(texts.final.diagnosis, { exact: true })
          .first()
          .waitFor();
        assert.equal(await page.locator('summary').count(), 4);
        const history = await readHistory(context, clinical.patientId, 4);
        assert.equal(
          history.revisions.find((item) => item.revisionNumber === 1).diagnosis,
          texts.first.diagnosis
        );
        assert.equal(
          history.revisions.find((item) => item.revisionNumber === 2).diagnosis,
          texts.second.diagnosis
        );
        assert.equal(
          history.revisions.find((item) => item.revisionNumber === 3).diagnosis,
          texts.concurrent.diagnosis
        );
        assert.equal(
          history.revisions.find((item) => item.revisionNumber === 4).diagnosis,
          texts.final.diagnosis
        );
        await page.screenshot({
          path: join(output, `${width}-expediente-final.png`),
        });
      }
    );

    await context.close();
  }

  const primary = fixture.clinical['1440'];
  const primaryEndpoint = endpointFor(primary.patientId);
  const primaryPage = `/pacientes/${primary.patientId}`;

  await check('RF-12: anónimo recibe 401 y no ve datos clínicos', async () => {
    const anonymous = await browser.newContext({ baseURL });
    const page = await anonymous.newPage();
    await page.goto(primaryPage);
    await page.getByRole('heading', { name: 'Sesión requerida' }).waitFor();
    assert.equal(
      await page.getByText(primary.patientName, { exact: true }).count(),
      0
    );
    await page.screenshot({
      path: join(output, '1440-sesion-requerida.png'),
    });
    assert.equal((await anonymous.request.get(primaryEndpoint)).status(), 401);
    assert.equal(
      (
        await anonymous.request.post(primaryEndpoint, {
          data: deniedBody('anonimo'),
        })
      ).status(),
      401
    );
    assert.equal(
      (
        await anonymous.request.fetch(primaryEndpoint, {
          data: '{',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })
      ).status(),
      401
    );
    await anonymous.close();
  });

  await check(
    'RF-12: recepción recibe 403 y no modifica el expediente',
    async () => {
      const receptionist = await browser.newContext({ baseURL });
      const page = await receptionist.newPage();
      await login(page, fixture.accounts.receptionist);
      await page.goto(primaryPage);
      await page.getByRole('heading', { name: 'Acceso restringido' }).waitFor();
      assert.equal(
        await page.getByText(primary.patientName, { exact: true }).count(),
        0
      );
      await page.screenshot({
        path: join(output, '1440-acceso-restringido.png'),
      });
      assert.equal(
        (await receptionist.request.get(primaryEndpoint)).status(),
        403
      );
      assert.equal(
        (
          await receptionist.request.post(primaryEndpoint, {
            data: deniedBody('recepcion'),
          })
        ).status(),
        403
      );
      await receptionist.close();
    }
  );

  await check(
    'RF-12: médico sin vínculo recibe 404/403 sin datos ni escritura',
    async () => {
      const physicianB = await browser.newContext({ baseURL });
      const page = await physicianB.newPage();
      await login(page, fixture.accounts.physicianB);
      await page.goto(primaryPage);
      await page
        .getByRole('heading', { name: 'Expediente no disponible' })
        .waitFor();
      assert.equal(
        await page.getByText(primary.patientName, { exact: true }).count(),
        0
      );
      await page.screenshot({
        path: join(output, '1440-expediente-no-disponible.png'),
      });
      assert.equal(
        (await physicianB.request.get(primaryEndpoint)).status(),
        404
      );
      assert.equal(
        (
          await physicianB.request.post(primaryEndpoint, {
            data: deniedBody('sin-vinculo'),
          })
        ).status(),
        403
      );
      await physicianB.close();
    }
  );

  await check('RF-12: cuenta sin rol recibe 403', async () => {
    const unassigned = await browser.newContext({ baseURL });
    const page = await unassigned.newPage();
    await login(page, fixture.accounts.unassigned);
    await page.goto(primaryPage);
    await page.getByRole('heading', { name: 'Acceso restringido' }).waitFor();
    assert.equal(
      (await unassigned.request.get(primaryEndpoint)).status(),
      403
    );
    assert.equal(
      (
        await unassigned.request.post(primaryEndpoint, {
          data: deniedBody('sin-rol'),
        })
      ).status(),
      403
    );
    await unassigned.close();
  });

  await check(
    'RF-12: paciente inexistente recibe 404 sin crear expediente',
    async () => {
      const physician = await browser.newContext({ baseURL });
      const page = await physician.newPage();
      await login(page, fixture.accounts.physician);
      const missingEndpoint = endpointFor(fixture.nonexistentPatientId);
      assert.equal((await physician.request.get(missingEndpoint)).status(), 404);
      assert.equal(
        (
          await physician.request.post(missingEndpoint, {
            data: deniedBody('paciente-inexistente'),
          })
        ).status(),
        404
      );
      await physician.close();
    }
  );

  await check(
    'RF-12: entrada inválida y suplantación rechazadas con 400',
    async () => {
      const physician = await browser.newContext({ baseURL });
      const page = await physician.newPage();
      await login(page, fixture.accounts.physician);
      const final = fixture.clinical['1440'].texts.final;
      const { changeReason: _reason, ...withoutReason } = final;
      assert.equal(
        (
          await physician.request.post(primaryEndpoint, {
            data: { ...withoutReason, expectedRevision: 4 },
          })
        ).status(),
        400
      );
      assert.equal(
        (
          await physician.request.post(primaryEndpoint, {
            data: {
              ...final,
              authorPhysicianId: fixture.physicianId,
              expectedRevision: 4,
            },
          })
        ).status(),
        400
      );
      assert.equal(
        (
          await physician.request.fetch(primaryEndpoint, {
            data: '{',
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          })
        ).status(),
        400
      );
      await physician.close();
    }
  );

  await check(
    'RF-12: sesión vencida recibe 401 sin leer ni escribir datos',
    async () => {
      const expired = await browser.newContext({ baseURL });
      await expired.addCookies([
        {
          httpOnly: true,
          name: fixture.expiredSession.name,
          sameSite: 'Lax',
          url: baseURL,
          value: fixture.expiredSession.value,
        },
      ]);
      const page = await expired.newPage();
      await page.goto(primaryPage);
      await page.getByRole('heading', { name: 'Sesión requerida' }).waitFor();
      assert.equal(
        await page.getByText(primary.patientName, { exact: true }).count(),
        0
      );
      await page.screenshot({
        path: join(output, '1440-sesion-vencida.png'),
      });
      assert.equal((await expired.request.get(primaryEndpoint)).status(), 401);
      assert.equal(
        (
          await expired.request.post(primaryEndpoint, {
            data: deniedBody('sesion-vencida'),
          })
        ).status(),
        401
      );
      await expired.close();
    }
  );

  await check(
    'RF-12: las escrituras denegadas no alteran el expediente',
    async () => {
      const physician = await browser.newContext({ baseURL });
      const page = await physician.newPage();
      await login(page, fixture.accounts.physician);
      const history = await readHistory(physician, primary.patientId, 4);
      assert.equal(
        history.revisions.some((item) =>
          (item.diagnosis ?? '').includes('DENEGADO')
        ),
        false
      );
      await physician.close();
    }
  );
} catch (error) {
  // Playwright call logs can include filled values. Keep credentials out of artifacts.
  results.push({ name: phase, status: 'FAIL', type: error.name });
  process.stderr.write(`FAIL ${phase} (${error.name})\n`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(
    join(output, 'resultados-clinicos.json'),
    JSON.stringify(results, null, 2) + '\n'
  );
}
