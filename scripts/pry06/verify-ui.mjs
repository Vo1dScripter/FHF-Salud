// Prueba de presentación con fixtures interceptadas; NO acredita sesión ni BD.
// El estado configuration se verifica además contra la API real sin variables.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : 'playwright'
);
const baseURL = process.env.PRY06_BASE_URL ?? 'http://127.0.0.1:3106';
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname),
  'Solo app local; nunca producción',
);
const out = 'evidencias/PRY06/01-rodrigo';
await mkdir(out, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true });
const patients = Array.from({ length: 25 }, (_, i) => ({
  id: `70000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  displayName:
    i === 0
      ? 'Paciente Ficticio de Nombre Compuesto Muy Largo para Revisión de Interfaz y Ajuste de Texto'
      : `Paciente Ficticio ${i + 1}`,
  active: i !== 1,
  createdAt: '2026-11-16T12:00:00Z',
}));
let mode = 'populated';
let completed = false;
try {
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
      colorScheme: 'light',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Comprobación genuina: sin credenciales de Supabase, nunca consultar remoto.
    const unavailable = await context.request.get(`${baseURL}/api/pacientes`);
    assert.equal(unavailable.status(), 503);
    assert.equal((await unavailable.json()).error.code, 'configuration');
    await page.goto(`${baseURL}/pacientes`);
    await page
      .getByRole('alert')
      .filter({ has: page.getByRole('heading', { level: 2 }) })
      .waitFor();
    await page.screenshot({
      path: `${out}/${width}-configuration-real.png`,
      fullPage: true,
    });
    results.push({
      width,
      check: 'API y UI reales: configuración ausente 503',
      status: 'PASS',
    });
    await page.route('**/api/pacientes?*', async (route) => {
      if (mode === 'loading') return;
      const url = new URL(route.request().url());
      let status = 200;
      let body = {
        patients: mode === 'empty' ? [] : patients,
        hasMore: url.searchParams.get('page') === '1' && mode !== 'empty',
      };
      if (
        ['forbidden', 'unauthenticated', 'unavailable', 'validation'].includes(
          mode,
        )
      ) {
        status = {
          forbidden: 403,
          unauthenticated: 401,
          unavailable: 503,
          validation: 400,
        }[mode];
        body = {
          error: {
            code: mode,
            message: 'Estado de prueba ficticio; sin datos clínicos.',
          },
        };
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
    mode = 'populated';
    await page.goto(baseURL);
    const menu = page.getByRole('button', { name: 'Abrir menú' });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Pacientes', exact: true })
      .click();
    await page.getByText(patients[0].displayName, { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole('navigation', { name: 'Navegación principal' })
        .getByRole('link', {
          name: 'Pacientes',
          exact: true,
          includeHidden: true,
        })
        .getAttribute('aria-current'),
      'page',
    );
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByRole('row').count(), 26);
    await page.getByLabel('Nombre del paciente').fill('Paciente');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByText('Página 1 · 25 pacientes', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.getByText('Página 2 · 25 pacientes', { exact: true }).waitFor();
    assert(await page.getByRole('button', { name: 'Siguiente' }).isDisabled());
    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await page.getByText('Página 1 · 25 pacientes', { exact: true }).waitFor();
    await page.getByLabel('Nombre del paciente').focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      'Buscar',
    );
    assert.notEqual(
      await page
        .getByRole('button', { name: 'Buscar', exact: true })
        .evaluate((el) => getComputedStyle(el).outlineStyle),
      'none',
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `${out}/${width}-populated-fixture.png`,
      fullPage: true,
    });
    await page.getByRole('switch', { name: 'Modo oscuro' }).click();
    await page.screenshot({
      path: `${out}/${width}-dark-fixture.png`,
      fullPage: true,
    });
    await page.getByRole('switch', { name: 'Modo oscuro' }).click();
    results.push({
      width,
      check:
        'fixture: navegación, 25 registros, búsqueda, paginación, teclado/foco, temas y overflow',
      status: 'PASS',
    });
    for (mode of [
      'empty',
      'forbidden',
      'unauthenticated',
      'unavailable',
      'validation',
      'loading',
    ]) {
      await page.reload();
      if (mode === 'empty')
        await page
          .getByRole('heading', { name: 'Sin pacientes visibles' })
          .waitFor();
      else if (mode === 'loading')
        await page
          .getByRole('status')
          .filter({ hasText: 'Cargando pacientes' })
          .waitFor();
      else
        await page
          .getByRole('alert')
          .filter({ has: page.getByRole('heading', { level: 2 }) })
          .waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `${out}/${width}-${mode}-fixture.png`,
        fullPage: true,
      });
      results.push({ width, check: `fixture: ${mode}`, status: 'PASS' });
    }
    mode = 'populated';
    await page.reload();
    await page.getByText(patients[0].displayName, { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Ir a Citas médicas' }).click();
    await page
      .getByRole('heading', { level: 1, name: 'Citas médicas' })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, '/citas');
    await page.screenshot({ path: `${out}/${width}-citas-regression.png`, fullPage: true });
    assert.deepEqual(errors, []);
    results.push({
      width,
      check: 'retorno a Citas y cero pageerror',
      status: 'PASS',
    });
    await context.close();
  }
  completed = true;
} finally {
  await browser.close();
  await writeFile(
    `${out}/ui-results.json`,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        completed,
        scope: 'UI fixtures + configuración real sin Supabase; no E2E de BD',
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
process.stdout.write(
  `${results.length} comprobaciones PASS (UI fixtures y configuración real)`,
);
