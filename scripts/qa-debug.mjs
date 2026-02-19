import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();
await page.route('**/api/v1/services', (r) =>
  r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: [
        {
          id: 'svc-1',
          name: 'Classic',
          durationMin: 30,
          priceCents: 4500,
          currency: 'USD',
          active: true,
          bookable: true,
        },
      ],
    }),
  }),
);
await page.route('**/api/v1/staff', (r) =>
  r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: [{ id: 'stf-1', displayName: 'Marco', active: true }],
    }),
  }),
);
await page.route('**/api/v1/availability**', (r) =>
  r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: [
        {
          slotStart: new Date(Date.now() + 86400000).toISOString(),
          slotEnd: new Date(Date.now() + 90000000).toISOString(),
          staffId: 'stf-1',
        },
      ],
    }),
  }),
);
await page.route('**/api/v1/bookings', (r) =>
  r.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        id: 'b1',
        status: 'confirmed',
        totalCents: 4500,
        currency: 'USD',
      },
    }),
  }),
);
console.log('goto');
await page.goto('http://127.0.0.1:3005', { waitUntil: 'domcontentloaded' });
console.log('click book');
await page.click('a[href="#book"]');
await page.waitForSelector('#service');
console.log('find slots');
await page.getByRole('button', { name: /Find available slots/i }).click();
await page.waitForTimeout(300);
console.log('slot');
await page.getByRole('radio').first().click();
await page.getByRole('button', { name: /Continue/i }).click();
await page.fill('#firstName', 'A');
await page.fill('#lastName', 'B');
await page.fill('#email', 'a@b.com');
await page.fill('#phone', '5551234567');
await page.getByRole('button', { name: /Review summary/i }).click();
await page.getByRole('button', { name: /Confirm booking/i }).click();
await page.getByText(/Booking confirmed/i).waitFor({ timeout: 5000 });
console.log('done');
await context.close();
await browser.close();
