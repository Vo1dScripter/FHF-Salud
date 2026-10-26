// Infrastructure endpoint only: no medical tables, dispatch or fake success.
Deno.serve(async (request: Request) => {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'method_not_allowed' },
      { status: 405, headers: { ...headers, Allow: 'POST' } },
    );
  }
  const expected = Deno.env.get('REMINDER_DISPATCH_SECRET');
  const provided = request.headers.get('x-reminder-secret');
  if (!expected || !provided)
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  // Compare fixed-length hashes to avoid early-exit comparisons of the secret.
  const hash = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    );
  const [left, right] = await Promise.all([hash(expected), hash(provided)]);
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left[index] ^ right[index];
  if (difference !== 0)
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  return Response.json(
    {
      status: 'not_ready',
      dispatchEnabled: false,
      reason: 'Reminder schema, authorization and idempotency are pending.',
    },
    { status: 503, headers },
  );
});
