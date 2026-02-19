import { expect, test } from '@playwright/test';

test('UX-022: reset dialog supports Escape close with focus restore', async ({
  page,
}) => {
  await page.goto('/');

  const resetButton = page.getByRole('button', { name: 'Reset booking' });
  await resetButton.click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(resetButton).toBeFocused();
});

test('UX-023 + UX-024: slot cards show end time and 429 shows Retry-After cooldown', async ({
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

  await page.route('**/api/v1/bookings', async (route) => {
    await route.fulfill({
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': '47',
      },
      body: JSON.stringify({
        error: { code: 'RATE_LIMITED', message: 'Too many booking attempts.' },
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Find available slots' }).click();

  await expect(page.getByText(/time:\s*9:00 am.*9:30 am/i)).toBeVisible();

  await page.getByRole('radio').click();
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

  await expect(page.getByText(/try again in 47s/i)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /retry in 47s/i }),
  ).toBeDisabled();
});

test('UX-031: footer nav wraps at mobile widths without horizontal page overflow', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/#book', { waitUntil: 'domcontentloaded', timeout: 120000 });

  await page
    .getByRole('link', { name: 'Accessibility' })
    .scrollIntoViewIfNeeded();

  const footerWrapState = await page.evaluate(() => {
    const emailLink = Array.from(document.querySelectorAll('a')).find(
      (node) => node.textContent?.trim() === 'Email support',
    );
    const footerList = emailLink?.closest('ul') ?? null;
    const root = document.documentElement;

    return {
      hasOverflow: root.scrollWidth > root.clientWidth,
      flexWrap: footerList ? getComputedStyle(footerList).flexWrap : null,
    };
  });

  expect(footerWrapState.flexWrap).toBe('wrap');
  expect(footerWrapState.hasOverflow).toBe(false);

  await expect(page.getByRole('link', { name: 'Accessibility' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Call (555) 123-4567' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email support' })).toBeVisible();
});

test('UX-032: main page has no horizontal overflow at 390/393 mobile zoom-stress checkpoints', async ({
  page,
}) => {
  const assertNoOverflowAtWidth = async (width: number) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto('/#book', { waitUntil: 'domcontentloaded' });

    const emailLink = page.getByRole('link', { name: 'Email support' });
    await emailLink.scrollIntoViewIfNeeded();
    await expect(emailLink).toBeVisible();

    const overflowState = await page.evaluate(() => {
      const root = document.documentElement;
      const email = Array.from(document.querySelectorAll('a')).find(
        (node) => node.textContent?.trim() === 'Email support',
      );
      const emailRect = email?.getBoundingClientRect();

      return {
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        hasOverflow: root.scrollWidth > root.clientWidth,
        emailRightEdge: emailRect?.right ?? null,
      };
    });

    expect(
      overflowState.hasOverflow,
      `unexpected overflow at width ${width}: ${overflowState.scrollWidth} > ${overflowState.clientWidth}`,
    ).toBe(false);
    expect(overflowState.emailRightEdge).not.toBeNull();
    expect(overflowState.emailRightEdge!).toBeLessThanOrEqual(
      overflowState.clientWidth,
    );
  };

  await assertNoOverflowAtWidth(390);
  await assertNoOverflowAtWidth(393);
});
