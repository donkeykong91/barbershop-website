import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3005';

const viewports = [
  { width: 390, height: 844, name: 'mobile-390' },
  { width: 412, height: 915, name: 'mobile-412' },
  { width: 768, height: 1024, name: 'tablet-768' },
  { width: 1280, height: 720, name: 'desktop-1280' },
  { width: 1440, height: 900, name: 'desktop-1440' },
];

const makeSlots = () => {
  const now = new Date();
  const day1 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  day1.setUTCHours(18, 0, 0, 0);
  const day1End = new Date(day1.getTime() + 30 * 60 * 1000);

  const day2 = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  day2.setUTCHours(23, 0, 0, 0);
  const day2End = new Date(day2.getTime() + 30 * 60 * 1000);

  return [
    {
      slotStart: day1.toISOString(),
      slotEnd: day1End.toISOString(),
      staffId: 'stf-1',
    },
    {
      slotStart: day2.toISOString(),
      slotEnd: day2End.toISOString(),
      staffId: 'stf-2',
    },
  ];
};

const runPass = async (browser, i) => {
  const scenarioType =
    i < 60 ? 'success' : i < 80 ? 'empty' : i < 90 ? 'validation' : 'rateLimit';
  const viewport = viewports[i % viewports.length];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const slots = makeSlots();

  await page.route('**/api/v1/services', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'svc-1',
            name: 'Classic Cut',
            durationMin: 30,
            priceCents: 4500,
            currency: 'USD',
            active: true,
            bookable: true,
          },
          {
            id: 'svc-2',
            name: 'Buzz Cut',
            durationMin: 20,
            priceCents: 3000,
            currency: 'USD',
            active: true,
            bookable: true,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/staff', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'stf-1', displayName: 'Marco', active: true },
          { id: 'stf-2', displayName: 'Luis', active: true },
          { id: 'stf-3', displayName: 'Inactive Barber', active: false },
        ],
      }),
    });
  });

  await page.route('**/api/v1/availability**', async (route) => {
    if (scenarioType === 'empty') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: slots }),
    });
  });

  await page.route('**/api/v1/bookings', async (route) => {
    if (scenarioType === 'rateLimit') {
      await route.fulfill({
        status: 429,
        headers: { 'Retry-After': '8' },
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'RATE_LIMITED' } }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: `booking-pass-${i + 1}`,
          status: 'confirmed',
          totalCents: 4500,
          currency: 'USD',
        },
      }),
    });
  });

  const result = {
    pass: i + 1,
    scenarioType,
    viewport: viewport.name,
    status: 'pass',
    notes: [],
  };

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.click('a[href="/#book"]');
    await page.waitForSelector('#service');

    const staffSelect = page.locator('select#staff');
    if (await staffSelect.count()) {
      const options = await staffSelect.locator('option').allTextContents();
      if (options.some((opt) => /inactive barber/i.test(opt))) {
        result.notes.push(
          'Defect: inactive staff appears in Preferred barber options.',
        );
      }
      if (scenarioType !== 'empty' && options.length > 1 && i % 2 === 0) {
        await staffSelect.selectOption({ index: 1 });
      }
    }

    if (i % 3 === 0)
      await page.getByRole('button', { name: /Next 14 days/i }).click();

    await page.getByRole('button', { name: /Find available slots/i }).click();

    if (scenarioType === 'empty') {
      await page
        .getByText(/No appointments available/i)
        .waitFor({ timeout: 5000 });
      await page.getByRole('button', { name: /Search next 14 days/i }).click();
      await page.getByRole('button', { name: /Try another barber/i }).click();
      await page.getByRole('button', { name: /Find available slots/i }).click();
      await page
        .getByText(/No appointments available/i)
        .waitFor({ timeout: 5000 });
      result.notes.push('Empty-state recovery controls verified.');
      return result;
    }

    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: /^Continue$/i }).click();

    if (scenarioType === 'validation') {
      await page.getByRole('button', { name: /Review summary/i }).click();
      await page
        .getByText(/is required/i)
        .first()
        .waitFor({ timeout: 5000 });
      result.notes.push('Inline validation surfaced for required fields.');
    }

    await page.fill('#firstName', `QA${i}`);
    await page.fill('#lastName', 'Runner');
    await page.fill('#email', `qa${i}@example.com`);
    await page.fill('#phone', '5551234567');
    await page.getByRole('button', { name: /Review summary/i }).click();

    if (scenarioType === 'rateLimit') {
      await page.getByRole('button', { name: /Confirm booking/i }).click();
      await page
        .getByText(/Too many booking attempts/i)
        .waitFor({ timeout: 5000 });
      await page
        .getByRole('button', { name: /Retry in/i })
        .waitFor({ timeout: 5000 });
      result.notes.push('429 handling with cooldown surfaced.');
      return result;
    }

    await page.getByRole('button', { name: /Confirm booking/i }).click();
    await page.getByText(/Booking confirmed/i).waitFor({ timeout: 5000 });
    await page
      .getByRole('button', { name: /Add to calendar/i })
      .waitFor({ timeout: 5000 });
    result.notes.push('Full happy-path booking completed.');
  } catch (error) {
    result.status = 'fail';
    result.notes.push(error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
  }

  return result;
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const total = 100;
  const concurrency = 5;
  const results = [];
  let next = 0;

  const worker = async () => {
    while (next < total) {
      const i = next;
      next += 1;
      const res = await runPass(browser, i);
      results.push(res);
      const detail = res.status === 'fail' ? ` :: ${res.notes.at(-1)}` : '';
      console.log(
        `PASS ${res.pass}: ${res.status.toUpperCase()} [${res.scenarioType}] (${res.viewport})${detail}`,
      );
    }
  };

  await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
  await browser.close();

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    byScenario: {
      success: results.filter((r) => r.scenarioType === 'success').length,
      empty: results.filter((r) => r.scenarioType === 'empty').length,
      validation: results.filter((r) => r.scenarioType === 'validation').length,
      rateLimit: results.filter((r) => r.scenarioType === 'rateLimit').length,
    },
    findings: {
      inactiveStaffVisibleCount: results.filter((r) =>
        r.notes.some((n) => n.includes('inactive staff')),
      ).length,
    },
    failures: results.filter((r) => r.status === 'fail'),
  };

  console.log('\nSUMMARY');
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
