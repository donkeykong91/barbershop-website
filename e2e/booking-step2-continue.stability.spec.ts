import { expect, test, type Page } from '@playwright/test';

const BOOKING_PATH = '/?staffId=stf_kevin#book';

async function getFindSlotsButton(page: Page) {
  const button = page.getByRole('button', { name: /find available/i }).first();
  await expect(button).toBeVisible({ timeout: 30000 });
  return button;
}

async function resetDraftIfNeeded(page: Page) {
  await page.getByRole('button', { name: 'Reset booking' }).click();

  const confirmResetButton = page.getByRole('button', { name: 'Confirm reset' });
  if (await confirmResetButton.isVisible()) {
    await confirmResetButton.click();
  }

  await getFindSlotsButton(page);
}

// Intentionally skipped in CI/local by default: this path depends on live browser-control stability
// and can fail from OpenClaw control-plane timeouts unrelated to app behavior.
test.skip('booking Step2 Continue reaches Step3 reliably across repeated runs', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto(BOOKING_PATH);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const findSlotsButton = await getFindSlotsButton(page);
    await findSlotsButton.click();

    const firstSlot = page.getByRole('radio').first();
    await expect(firstSlot).toBeVisible({ timeout: 30000 });
    await firstSlot.click();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/step 3 of 5/i)).toBeVisible({ timeout: 30000 });

    if (attempt < 3) {
      await resetDraftIfNeeded(page);
    }
  }
});
