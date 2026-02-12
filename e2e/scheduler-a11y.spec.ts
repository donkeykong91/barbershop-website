import { expect, test } from '@playwright/test';

test('reset booking dialog supports keyboard escape + focus return', async ({ page }) => {
  await page.goto('/');

  const resetButton = page.getByRole('button', { name: 'Reset booking' });
  await resetButton.click();

  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(
    page.getByRole('dialog', { name: /confirm reset booking/i }),
  ).toHaveCount(0);
  await expect(resetButton).toBeFocused();
});

test('slot picker exposes radiogroup semantics and selected state', async ({ page }) => {
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

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();

  await expect(
    page.getByRole('radiogroup', { name: /available appointment slots/i }),
  ).toBeVisible();

  const firstRadio = page.getByRole('radio').nth(0);
  const secondRadio = page.getByRole('radio').nth(1);
  await expect(firstRadio).toHaveAttribute('aria-checked', 'false');
  await firstRadio.click();
  await expect(firstRadio).toHaveAttribute('aria-checked', 'true');
  await expect(secondRadio).toHaveAttribute('aria-checked', 'false');
});

test('slot picker supports arrow-key roving selection', async ({ page }) => {
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

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();

  const firstRadio = page.getByRole('radio').nth(0);
  const secondRadio = page.getByRole('radio').nth(1);

  await firstRadio.focus();
  await page.keyboard.press('ArrowRight');

  await expect(secondRadio).toBeFocused();
  await expect(secondRadio).toHaveAttribute('aria-checked', 'true');
  await expect(firstRadio).toHaveAttribute('aria-checked', 'false');
});

test('availability load error state is distinct from no-slots empty state', async ({ page }) => {
  await page.route('**/api/v1/availability**', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'SERVICE_UNAVAILABLE' } }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();

  await expect(page.getByText('Availability failed to load.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry loading slots' })).toBeVisible();
  await expect(page.getByText(/no appointments available in the next/i)).toHaveCount(0);
});

test('review step displays explicit slot start-end time range', async ({ page }) => {
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

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();
  await page.getByRole('radio', { name: /staff:/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel(/first name/i).fill('Pat');
  await page.getByLabel(/last name/i).fill('Lee');
  await page.getByLabel(/^email/i).fill('pat@example.com');
  await page.getByLabel(/^phone/i).fill('5551234567');

  await page.getByRole('button', { name: 'Review summary' }).click();

  await expect(page.getByText(/Date\/Time \(Shop time .*\): .*9:00 AM-9:30 AM/i)).toBeVisible();
});

test('rate-limited booking submit shows retry countdown and disables confirm', async ({ page }) => {
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
      status: 429,
      headers: { 'Retry-After': '5' },
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'RATE_LIMITED' } }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();
  await page.getByRole('radio', { name: /staff:/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel(/first name/i).fill('Pat');
  await page.getByLabel(/last name/i).fill('Lee');
  await page.getByLabel(/^email/i).fill('pat@example.com');
  await page.getByLabel(/^phone/i).fill('5551234567');

  await page.getByRole('button', { name: 'Review summary' }).click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(
    page.getByText(/too many booking attempts\. try again in 5s\./i),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /retry in 5s/i })).toBeDisabled();
});

test('confirmation panel uses polite status live region', async ({ page }) => {
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
          id: 'bk_123',
          status: 'confirmed',
          totalCents: 3500,
          currency: 'USD',
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();
  await page.getByRole('radio', { name: /staff:/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel(/first name/i).fill('Pat');
  await page.getByLabel(/last name/i).fill('Lee');
  await page.getByLabel(/^email/i).fill('pat@example.com');
  await page.getByLabel(/^phone/i).fill('5551234567');

  await page.getByRole('button', { name: 'Review summary' }).click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  const statusPanel = page.locator('[role="status"]').filter({ hasText: 'Booking confirmed.' });
  await expect(statusPanel).toHaveAttribute('aria-live', 'polite');
  await expect(statusPanel.getByRole('button', { name: 'Add to calendar' })).toHaveCount(0);
  await expect(statusPanel.getByRole('button', { name: 'Book another appointment' })).toHaveCount(0);
});

test('preferred barber list de-duplicates Any barber fallback and uses unique scheduler control id', async ({ page }) => {
  await page.route('**/api/v1/services', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'svc-1',
            name: 'Haircut',
            durationMin: 30,
            priceCents: 3500,
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
          { id: 'any', displayName: 'Any barber', active: true },
          { id: 'staff-active', displayName: 'Active Barber', active: true },
          { id: 'staff-active', displayName: 'Active Barber Duplicate', active: true },
          { id: 'staff-inactive', displayName: 'Inactive Barber', active: false },
        ],
      }),
    });
  });

  await page.goto('/');

  const schedulerCard = page.locator('#book');
  const preferredBarberSelect = schedulerCard.getByLabel('Preferred barber');
  await expect(preferredBarberSelect).toBeVisible();
  await expect(preferredBarberSelect).toHaveAttribute('id', 'booking-staff');

  const optionTexts = await preferredBarberSelect
    .locator('option')
    .evaluateAll((options) => options.map((option) => option.textContent?.trim() ?? ''));

  expect(optionTexts).toEqual(['Any barber', 'Active Barber']);
});
