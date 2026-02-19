import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const axeSource = readFileSync(
  path.resolve('node_modules/axe-core/axe.min.js'),
  'utf8',
);
const PASSES = Number(process.env.PASSES || 100);
const findings = new Map();
const passLog = [];
const runOnly = {
  type: 'tag',
  values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
};

function addFinding(key, finding, passId) {
  if (!findings.has(key)) findings.set(key, { ...finding, passes: [] });
  findings.get(key).passes.push(passId);
}

async function runAxe(page, stepLabel, passId) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(
    async (_runOnly) => window.axe.run(document, { runOnly: _runOnly }),
    runOnly,
  );
  for (const v of result.violations) {
    const node = v.nodes?.[0];
    const key = `${v.id}::${stepLabel}::${(node?.target || []).join(',')}`;
    addFinding(
      key,
      {
        id: v.id,
        impact: v.impact || 'minor',
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        step: stepLabel,
        target: node?.target || [],
      },
      passId,
    );
  }
}

async function onePass(browser, i) {
  const context = await browser.newContext({
    viewport:
      i % 3 === 0 ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    reducedMotion: i % 4 === 0 ? 'reduce' : 'no-preference',
  });
  try {
    const page = await context.newPage();
    context.setDefaultTimeout(8000);
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
            {
              slotStart: '2026-03-02T17:30:00.000Z',
              slotEnd: '2026-03-02T18:00:00.000Z',
              staffId: 'staff-1',
            },
          ],
        }),
      });
    });
    await page.route('**/api/v1/bookings**', async (route) => {
      if (i % 10 === 0) {
        await route.fulfill({
          status: 429,
          headers: { 'Retry-After': '3' },
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'RATE_LIMITED' } }),
        });
        return;
      }
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

    await page.goto('http://127.0.0.1:3005/');
    if (i % 10 === 1) await runAxe(page, 'step1', i);
    await page.getByRole('button', { name: 'Find available slots' }).click();
    if (i % 10 === 1) await runAxe(page, 'step2', i);

    const radios = page.getByRole('radio');
    await radios.first().focus();
    await page.keyboard.press('ArrowDown');
    const secondChecked = await radios.nth(1).getAttribute('aria-checked');
    if (secondChecked !== 'true') {
      addFinding(
        'custom-radio-arrow::step2::[role=radio]',
        {
          id: 'A11Y-CUSTOM-RADIO-KEYS',
          impact: 'serious',
          description:
            'Radiogroup options do not support Arrow-key movement/selection.',
          help: 'Implement full ARIA radio keyboard interaction (roving tabindex + Arrow keys).',
          helpUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/radio/',
          step: 'step2',
          target: ['[role="radio"]'],
        },
        i,
      );
    }

    await radios.first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    if (i % 10 === 1) await runAxe(page, 'step3', i);

    await page.getByLabel(/first name/i).fill('Pat');
    await page.getByLabel(/last name/i).fill('Lee');
    await page.getByLabel(/^email/i).fill('pat@example.com');
    await page.getByLabel(/^phone/i).fill('5551234567');
    await page.getByRole('button', { name: 'Review summary' }).click();
    if (i % 10 === 1) await runAxe(page, 'step4', i);

    await page
      .getByRole('button', { name: /Confirm booking|Retry in/i })
      .click();
    await page.waitForTimeout(60);
    if (i % 10 === 1) await runAxe(page, 'step5_or_error', i);

    // custom check: status region should be non-interactive
    const statusWithButtons = page.locator(
      '[role="status"] button, [role="status"] a',
    );
    if (await statusWithButtons.count()) {
      addFinding(
        'custom-status-interactive::step5::[role=status]',
        {
          id: 'A11Y-CUSTOM-STATUS-INTERACTIVE',
          impact: 'moderate',
          description:
            'Live status region contains interactive controls, causing noisy/duplicative announcements.',
          help: 'Scope aria-live/role=status to confirmation text only; keep action buttons outside.',
          helpUrl:
            'https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html',
          step: 'step5',
          target: ['[role="status"]'],
        },
        i,
      );
    }
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
for (let i = 1; i <= PASSES; i += 1) {
  try {
    await onePass(browser, i);
    passLog.push({ pass: i, ok: true });
  } catch (error) {
    passLog.push({ pass: i, ok: false, error: String(error) });
  }
  if (i % 20 === 0) console.log(`progress ${i}/${PASSES}`);
}
await browser.close();

const out = {
  totalPasses: PASSES,
  completed: passLog.filter((p) => p.ok).length,
  failedPasses: passLog.filter((p) => !p.ok),
  findings: Array.from(findings.values()).map((f) => ({
    ...f,
    occurrences: f.passes.length,
  })),
};
writeFileSync('docs/a11y-100-pass-results.json', JSON.stringify(out, null, 2));
console.log(
  `done: ${out.completed}/${PASSES}, findings=${out.findings.length}`,
);
