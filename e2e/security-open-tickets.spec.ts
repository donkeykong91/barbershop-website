import { expect, test } from '@playwright/test';

test('SEC: protected booking endpoints reject query-string token auth', async ({
  request,
}) => {
  const bookingId = '11111111-1111-4111-8111-111111111111';

  const getResponse = await request.get(
    `/api/v1/bookings/${bookingId}?accessToken=leaky-token`,
  );
  expect(getResponse.status()).toBe(401);

  const cancelResponse = await request.post(
    `/api/v1/bookings/${bookingId}/cancel?accessToken=leaky-token`,
  );
  expect(cancelResponse.status()).toBe(401);

  const confirmationResponse = await request.get(
    `/api/v1/bookings/${bookingId}/confirmation?accessToken=leaky-token`,
  );
  expect(confirmationResponse.status()).toBe(401);
});

test('SEC: admin endpoints throttle repeated invalid auth attempts', async ({
  request,
}) => {
  let lastStatus = 0;

  await Array.from({ length: 25 }).reduce<Promise<void>>(
    (chain, _, i) =>
      chain.then(async () => {
        const response = await request.get('/api/v1/admin/services', {
          headers: { 'x-admin-key': `bad-${i}` },
        });
        lastStatus = response.status();
      }),
    Promise.resolve(),
  );

  expect(lastStatus).toBe(429);
});

test('SEC: baseline security headers are set on HTML and API responses', async ({
  request,
}) => {
  const homepage = await request.get('/');

  expect(homepage.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  );
  expect(homepage.headers()['x-frame-options']).toBe('DENY');
  expect(homepage.headers()['x-content-type-options']).toBe('nosniff');
  expect(homepage.headers()['referrer-policy']).toBe(
    'strict-origin-when-cross-origin',
  );

  const api = await request.get('/api/v1/services?includeInactive=true');
  expect(api.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  );
});
