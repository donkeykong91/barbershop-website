const { chromium } = require('@playwright/test');

(async () => {
  const passId = Number(process.argv[2] || '0');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:3010',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

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
            id: `bk_${passId}`,
            status: 'confirmed',
            totalCents: 3500,
            currency: 'USD',
          },
        }),
      });
    });

    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('button', { name: 'Find available slots' }).click();
    await page
      .getByRole('button', { name: /staff:/i })
      .first()
      .click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel('first Name').fill('Pat');
    await page.getByLabel('last Name').fill('Lee');
    await page.getByLabel('email').fill(`pat${passId}@example.com`);
    await page.getByLabel('phone').fill('5551234567');

    await page.getByRole('button', { name: 'Review summary' }).click();
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await page.getByText('Booking confirmed.').waitFor();
    console.log(`pass ${passId}: ok (${Date.now() - start}ms)`);
  } catch (error) {
    console.log(`pass ${passId}: fail ${error.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
