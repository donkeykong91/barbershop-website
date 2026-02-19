const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:3010',
  });
  const results = [];

  for (let i = 12; i <= 15; i += 1) {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const start = Date.now();
    try {
      await page.route('**/api/v1/availability**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                slotStart: '2026-03-02T17:00:00.000Z',
                slotEnd: '2026-03-02T17:30:00.000Z',
                staffId: 'staff-1',
              },
            ],
          }),
        });
      });

      await page.route('**/api/v1/bookings', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: `bk_${i}`,
              status: 'confirmed',
              totalCents: 3500,
              currency: 'USD',
            },
          }),
        });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page
        .getByRole('button', { name: 'Find available slots' })
        .waitFor();
      await page.getByRole('button', { name: 'Find available slots' }).click();
      await page
        .getByRole('button', { name: /staff:/i })
        .first()
        .click();
      await page.getByRole('button', { name: 'Continue' }).click();

      await page.getByLabel('first Name').fill('Pat');
      await page.getByLabel('last Name').fill('Lee');
      await page.getByLabel('email').fill(`pat${i}@example.com`);
      await page.getByLabel('phone').fill('5551234567');
      await page.getByRole('button', { name: 'Review summary' }).click();
      await page.getByRole('button', { name: 'Confirm booking' }).click();
      await page.getByText('Booking confirmed.').waitFor();

      const durationMs = Date.now() - start;
      console.log(`pass ${i}: ok (${durationMs}ms)`);
      results.push({ pass: i, status: 'ok', durationMs });
    } catch (error) {
      const durationMs = Date.now() - start;
      console.log(`pass ${i}: fail (${durationMs}ms) ${error.message}`);
      results.push({
        pass: i,
        status: 'fail',
        durationMs,
        error: error.message,
      });
    } finally {
      await page.close();
    }
  }

  console.log('SUMMARY');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
