import { chromium, devices } from 'playwright';

const scenarios = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  mobile: i % 3 === 0,
  useSpecificStaff: i % 2 === 0,
  range14: i % 4 === 0,
}));

const results = [];

for (const scenario of scenarios) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    scenario.mobile
      ? devices['iPhone 13']
      : { viewport: { width: 1366, height: 900 } },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const startedAt = Date.now();

  try {
    await page.goto('http://localhost:3000/#book', {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('heading', { name: /book an appointment/i }).waitFor();

    if (scenario.range14) {
      await page.getByRole('button', { name: /next 14 days/i }).click();
    }

    if (scenario.useSpecificStaff) {
      const optionCount = await page.locator('#staff option').count();
      if (optionCount > 1) {
        const val = await page
          .locator('#staff option')
          .nth(1)
          .getAttribute('value');
        if (val) await page.locator('#staff').selectOption(val);
      }
    }

    await page.getByRole('button', { name: /find available slots/i }).click();
    await page.getByText(/pick an open slot/i).waitFor();

    const slot = page.locator('button:has-text("Staff:")').first();
    await slot.click();
    await page.getByRole('button', { name: /^continue$/i }).click();

    await page.getByLabel(/first name/i).fill(`Ux${scenario.id}`);
    await page.getByLabel(/last name/i).fill('Tester');
    await page.getByLabel(/email/i).fill(`ux${scenario.id}@example.com`);
    await page.getByLabel(/phone/i).fill('5551234567');

    await page.getByRole('button', { name: /review summary/i }).click();
    await page.getByRole('button', { name: /confirm booking/i }).click();
    await page.getByText(/booking confirmed\./i).waitFor();

    results.push({
      id: scenario.id,
      status: 'pass',
      mobile: scenario.mobile,
      staffSpecific: scenario.useSpecificStaff,
      range14: scenario.range14,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    results.push({
      id: scenario.id,
      status: 'fail',
      mobile: scenario.mobile,
      staffSpecific: scenario.useSpecificStaff,
      range14: scenario.range14,
      durationMs: Date.now() - startedAt,
      error: String(e).slice(0, 200),
    });
  }

  await context.close();
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.status === 'pass').length;
console.log(`SUMMARY: ${passed}/15 passed`);
