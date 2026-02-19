const { chromium, devices } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:3005';

const scenarios = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  mobile: i % 3 === 0,
  rangeDays: i % 4 === 0 ? 14 : 7,
  staffMode: i % 2 === 0 ? 'any' : 'specific',
  availabilityMode: i % 10 === 0 ? 'error' : i % 5 === 0 ? 'empty' : 'normal',
  bookingMode: i % 12 === 0 ? 'rate-limit' : 'success',
}));

const iso = (dayOffset, hour, minute = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

const buildSlots = () => [
  { slotStart: iso(1, 17, 0), slotEnd: iso(1, 17, 30), staffId: 'staff-1' },
  { slotStart: iso(1, 18, 0), slotEnd: iso(1, 18, 30), staffId: 'staff-2' },
  { slotStart: iso(2, 17, 0), slotEnd: iso(2, 17, 30), staffId: 'staff-1' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const summary = {
    passes: 0,
    desktop: 0,
    mobile: 0,
    successBookings: 0,
    emptyStates: 0,
    availabilityErrors: 0,
    rateLimited: 0,
  };
  const issues = new Map();
  const issue = (name) => issues.set(name, (issues.get(name) || 0) + 1);

  for (const s of scenarios) {
    if (s.id % 20 === 0) console.log(`progress:${s.id}`);
    const context = await browser.newContext(
      s.mobile
        ? devices['iPhone 13']
        : { viewport: { width: 1280, height: 800 } },
    );
    const page = await context.newPage();
    page.setDefaultTimeout(4000);

    await page.route('**/api/v1/availability**', async (route) => {
      if (s.availabilityMode === 'error')
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Server unavailable' } }),
        });
      if (s.availabilityMode === 'empty')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: buildSlots() }),
      });
    });

    await page.route('**/api/v1/bookings', async (route) => {
      if (s.bookingMode === 'rate-limit')
        return route.fulfill({
          status: 429,
          headers: { 'retry-after': '15' },
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'RATE_LIMITED' } }),
        });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: `bk_${s.id}`,
            status: 'confirmed',
            totalCents: 3500,
            currency: 'USD',
          },
        }),
      });
    });

    try {
      await page.goto(BASE_URL);
      if (s.rangeDays === 14)
        await page.getByRole('button', { name: 'Next 14 days' }).click();
      if (s.staffMode === 'specific')
        await page.locator('#staff').selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Find available slots' }).click();

      if (s.availabilityMode === 'error') {
        summary.availabilityErrors += 1;
        if (
          (await page.getByText(/No appointments available/i).isVisible()) &&
          (await page.getByText(/could not load slots right now/i).isVisible())
        ) {
          issue('Error state is conflated with no-availability empty state');
        }
        summary.passes += 1;
        continue;
      }

      if (s.availabilityMode === 'empty') {
        summary.emptyStates += 1;
        await page.getByText(/No appointments available/i).isVisible();
        summary.passes += 1;
        continue;
      }

      await page.getByRole('radio').first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByLabel(/first name/i).fill('Pat');
      await page.getByLabel(/last name/i).fill('Lee');
      await page.getByLabel(/^email/i).fill('pat@example.com');
      await page.getByLabel(/^phone/i).fill('5551234567');
      await page.getByRole('button', { name: 'Review summary' }).click();

      const dt =
        (await page.getByText(/Date\/Time \(Shop time/i).textContent()) || '';
      if (!dt.includes('-') && !dt.includes(' to '))
        issue(
          'Review summary shows only slot start time, not explicit start-end range',
        );

      await page
        .getByRole('button', { name: /Confirm booking|Retry in/i })
        .click();
      if (s.bookingMode === 'rate-limit') {
        summary.rateLimited += 1;
        await page.getByText(/Try again in 15s/i).isVisible();
      } else {
        summary.successBookings += 1;
        await page.getByText(/Booking confirmed\./i).isVisible();
      }

      summary.passes += 1;
    } catch (e) {
      issue(`Pass failure: ${String(e.message).split('\n')[0]}`);
    } finally {
      if (s.mobile) summary.mobile += 1;
      else summary.desktop += 1;
      await context.close();
    }
  }

  await browser.close();
  console.log(
    JSON.stringify(
      {
        ...summary,
        issues: [...issues.entries()].map(([name, count]) => ({ name, count })),
      },
      null,
      2,
    ),
  );
})();
