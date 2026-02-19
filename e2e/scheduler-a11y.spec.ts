import { expect, test } from '@playwright/test';

test('top hero load does not mark Services nav link active by default', async ({
  page,
}) => {
  await page.goto('/');

  const topNav = page.getByRole('navigation').first();
  await expect(
    topNav.getByRole('link', { name: 'Services' }),
  ).not.toHaveAttribute('aria-current', 'location');
});

test('fresh baseline draft state does not show restored-draft toast', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'kb_booking_draft_v1',
      JSON.stringify({
        version: 1,
        step: 1,
        selectedServiceId: 'svc_haircut',
        selectedStaffId: 'any',
        rangeDays: 7,
        selectedSlot: null,
        contact: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          notes: '',
        },
      }),
    );
  });

  await page.goto('/');

  await expect(
    page.getByText(/restored your in-progress booking draft/i),
  ).toHaveCount(0);
});

test('reset booking dialog supports keyboard escape + focus return', async ({
  page,
}) => {
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

test('slot picker exposes radiogroup semantics and selected state', async ({
  page,
}) => {
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
  await expect(secondRadio).toHaveAttribute('aria-checked', 'false');

  await firstRadio.click();

  await expect(page.getByText(/step 3 of 5/i)).toBeVisible();
  await expect(page.getByLabel('First name')).toBeVisible();
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

test('availability load error state is distinct from no-slots empty state', async ({
  page,
}) => {
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
  await expect(
    page.getByRole('button', { name: 'Retry loading slots' }),
  ).toBeVisible();
  await expect(
    page.getByText(/no appointments available in the next/i),
  ).toHaveCount(0);
});

test('review step displays explicit slot start-end time range', async ({
  page,
}) => {
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

  await expect(page.getByText(/step 3 of 5/i)).toBeVisible();
  await page.getByLabel(/first name/i).fill('Pat');
  await page.getByLabel(/last name/i).fill('Lee');
  await page.getByLabel(/^email/i).fill('pat@example.com');
  await page.getByLabel(/^phone/i).fill('5551234567');

  await page.getByRole('button', { name: 'Review summary' }).click();

  await expect(
    page.getByText(/Date\/Time \(Shop time .*\): .*9:00 AM-9:30 AM/i),
  ).toBeVisible();
});

test('rate-limited booking submit shows retry countdown and disables confirm', async ({
  page,
}) => {
  await page.route('**/api/v1/services**', async (route) => {
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
            visible: true,
            bookable: true,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/staff**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 'staff-1', displayName: 'Pat', active: true }],
      }),
    });
  });

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

  await expect(page.getByText(/step 3 of 5/i)).toBeVisible();
  await page.getByLabel(/first name/i).fill('Pat');
  await page.getByLabel(/last name/i).fill('Lee');
  await page.getByLabel(/^email/i).fill('pat@example.com');
  await page.getByLabel(/^phone/i).fill('5551234567');

  await page.getByRole('button', { name: 'Review summary' }).click();
  const requiredConsentCheckboxes = page.getByRole('checkbox');
  await requiredConsentCheckboxes.nth(0).check();
  await requiredConsentCheckboxes.nth(1).check();
  await requiredConsentCheckboxes.nth(2).check();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(
    page.getByText(/too many booking attempts\. try again in 5s\./i),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /retry in 5s/i }),
  ).toBeDisabled();
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

  await expect(page.getByText(/step 3 of 5/i)).toBeVisible();
  await page.getByLabel(/first name/i).fill('Pat');
  await page.getByLabel(/last name/i).fill('Lee');
  await page.getByLabel(/^email/i).fill('pat@example.com');
  await page.getByLabel(/^phone/i).fill('5551234567');

  await page.getByRole('button', { name: 'Review summary' }).click();
  const requiredConsentCheckboxes = page.getByRole('checkbox');
  await requiredConsentCheckboxes.nth(0).check();
  await requiredConsentCheckboxes.nth(1).check();
  await requiredConsentCheckboxes.nth(2).check();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  const statusPanel = page
    .locator('[role="status"]')
    .filter({ hasText: 'Booking confirmed.' });
  await expect(statusPanel).toHaveAttribute('aria-live', 'polite');
  await expect(
    statusPanel.getByRole('button', { name: 'Add to calendar' }),
  ).toHaveCount(0);
  await expect(
    statusPanel.getByRole('button', { name: 'Book another appointment' }),
  ).toHaveCount(0);
});

test('preferred barber list de-duplicates Any barber fallback and uses unique scheduler control id', async ({
  page,
}) => {
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
          {
            id: 'staff-active',
            displayName: 'Active Barber Duplicate',
            active: true,
          },
          {
            id: 'staff-inactive',
            displayName: 'Inactive Barber',
            active: false,
          },
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
    .evaluateAll((options) =>
      options.map((option) => option.textContent?.trim() ?? ''),
    );

  expect(optionTexts).toEqual(['Any barber', 'Active Barber']);
});

test('initial nav state highlights top section and not Services unless deep-linked', async ({
  page,
}) => {
  await page.goto('/');

  const topNav = page.locator('nav').first();
  await expect(
    topNav.getByRole('link', { name: 'Book Appointment' }),
  ).toHaveAttribute('aria-current', 'location');
  await expect(
    topNav.getByRole('link', { name: 'Services' }),
  ).not.toHaveAttribute('aria-current', 'location');

  await page.goto('/#services');
  await expect(
    page.locator('nav').first().getByRole('link', { name: 'Services' }),
  ).toHaveAttribute('aria-current', 'location');
});

test('restored draft notice appears only on real restore and not every reload in same session', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'kb_booking_draft_v1',
      JSON.stringify({
        version: 1,
        step: 2,
        selectedServiceId: 'svc-1',
        selectedStaffId: 'staff-1',
        rangeDays: 7,
        selectedSlot: null,
        contact: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          notes: '',
        },
      }),
    );
  });

  await page.goto('/');
  await expect(
    page.getByText(
      /restored your draft|restored your in-progress booking draft/i,
    ),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText(
      /restored your draft|restored your in-progress booking draft/i,
    ),
  ).toHaveCount(0);
});

test('slot conflict surfaces alternatives and allows one-tap recovery', async ({
  page,
}) => {
  await page.route('**/api/v1/services**', async (route) => {
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
            visible: true,
            bookable: true,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/staff**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 'staff-1', displayName: 'Pat', active: true }],
      }),
    });
  });

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
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'SLOT_TAKEN',
          message: 'Selected slot is no longer available',
          alternatives: [
            {
              slotStart: '2026-03-02T17:30:00.000Z',
              slotEnd: '2026-03-02T18:00:00.000Z',
              staffId: 'staff-1',
            },
          ],
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();
  await page.getByRole('radio', { name: /staff:/i }).click();

  await expect(page.getByText(/step 3 of 5/i)).toBeVisible();
  await page.getByLabel(/first name/i).fill('Pat');
  await page.getByLabel(/last name/i).fill('Lee');
  await page.getByLabel(/^email/i).fill('pat@example.com');
  await page.getByLabel(/^phone/i).fill('5551234567');

  await page.getByRole('button', { name: 'Review summary' }).click();
  const requiredConsentCheckboxes = page.getByRole('checkbox');
  await requiredConsentCheckboxes.nth(0).check();
  await requiredConsentCheckboxes.nth(1).check();
  await requiredConsentCheckboxes.nth(2).check();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(page.getByText(/that time was just taken/i)).toBeVisible();
  await page.getByRole('button', { name: /9:30 AM-10:00 AM/i }).click();
  await expect(page.getByText(/that time was just taken/i)).toHaveCount(0);
});
