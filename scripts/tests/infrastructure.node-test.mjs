import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(
  readFileSync('supabase/functions/reminder-dispatch/index.ts', 'utf8'),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  },
).outputText;
function handler(secret) {
  let serve;
  vm.runInNewContext(code, {
    Deno: {
      env: { get: () => secret },
      serve: (fn) => {
        serve = fn;
      },
    },
    Request,
    Response,
    TextEncoder,
    crypto: webcrypto,
  });
  return serve;
}
test('reminder endpoint rejects missing configuration, missing and incorrect credentials', async () => {
  for (const [expected, provided] of [
    [undefined, 'test'],
    ['test', undefined],
    ['test', 'wrong'],
  ]) {
    const response = await handler(expected)(
      new Request('https://example.test', {
        method: 'POST',
        headers: provided ? { 'x-reminder-secret': provided } : {},
      }),
    );
    assert.equal(response.status, 401);
  }
});
test('authorized infrastructure call reports unavailable and never fake dispatch success', async () => {
  const response = await handler('test')(
    new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-reminder-secret': 'test' },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).dispatchEnabled, false);
});
test('unsupported methods cannot dispatch', async () => {
  assert.equal(
    (await handler('test')(new Request('https://example.test'))).status,
    405,
  );
});
test('push worker never displays private payloads or follows supplied external URLs', async () => {
  const events = new Map();
  let notification;
  let opened;
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    self: {
      addEventListener: (name, fn) => events.set(name, fn),
      location: { origin: 'https://example.test' },
      registration: {
        showNotification: async (title, options) => {
          notification = { title, options };
        },
      },
      clients: {
        matchAll: async () => [],
        openWindow: async (url) => {
          opened = url;
        },
      },
    },
  });
  assert.equal(events.has('fetch'), false);
  let pending;
  events.get('push')({
    data: {
      json: () => ({
        body: 'private medical details',
        url: 'https://evil.test',
      }),
    },
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.equal(
    JSON.stringify(notification).includes('private medical details'),
    false,
  );
  events.get('notificationclick')({
    notification: { close() {} },
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.equal(opened, 'https://example.test/citas');
});
