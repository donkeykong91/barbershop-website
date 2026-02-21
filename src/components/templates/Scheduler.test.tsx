/* eslint-disable simple-import-sort/imports */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { AppConfig } from '@/utils/AppConfig';
import { Scheduler } from './Scheduler';

const services = [
  {
    id: 'svc-1',
    name: 'Haircut',
    description: 'Classic cut',
    durationMin: 30,
    priceCents: 3000,
    currency: 'USD',
    active: true,
    visible: true,
    bookable: true,
    displayOrder: 1,
  },
];

const staff = [{ id: 'stf-1', displayName: 'Kevin', active: true }];

describe('Scheduler UX regressions', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: jest.fn(),
      writable: true,
    });

    window.history.replaceState({}, '', '/');
    window.sessionStorage.clear();
  });

  it('bootstraps deep-link service/staff params before availability search', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            slotStart: '2026-03-02T17:00:00.000Z',
            slotEnd: '2026-03-02T17:30:00.000Z',
            staffId: 'stf-1',
          },
        ],
      }),
    });

    window.history.replaceState({}, '', '/?serviceId=svc-1&staffId=stf-1#book');

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    await screen.findByRole('radio', { name: /staff: kevin/i });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [availabilityUrl] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
    ];
    const parsedUrl = new URL(availabilityUrl, 'http://localhost');
    expect(parsedUrl.searchParams.get('serviceId')).toBe('svc-1');
    expect(parsedUrl.searchParams.get('staffId')).toBe('stf-1');
  });

  it('shows explicit slot time range on slot cards', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            slotStart: '2026-03-02T17:00:00.000Z',
            slotEnd: '2026-03-02T17:30:00.000Z',
            staffId: 'stf-1',
          },
        ],
      }),
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    await screen.findByText(/time:/i);
    expect(screen.getByText(/9:00 am[-–]9:30 am/i)).toBeInTheDocument();
  });

  it('renders load-failed state separate from no-slots empty state', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Unable to load availability' } }),
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    await screen.findByText(/availability failed to load/i);
    expect(
      screen.queryByText(/no appointments available in the next/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry loading slots/i }),
    ).toBeInTheDocument();
  });

  it('maps non-JSON 403 availability responses to a safe user-facing message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '<!DOCTYPE html><html><body>checkpoint</body></html>',
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    await screen.findByText(/availability failed to load/i);
    expect(
      screen.getByText(/temporarily protected by a security check/i),
    ).toBeInTheDocument();
  });

  it('renders actionable call CTA with tel link + accessible label', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const callLink = await screen.findByRole('link', {
      name: /call the shop at/i,
    });
    expect(callLink).toHaveAttribute('href', `tel:${AppConfig.shopPhoneE164}`);
    expect(callLink).toHaveAttribute(
      'aria-label',
      `Call the shop at ${AppConfig.shopPhoneDisplay}`,
    );
  });

  it('advances to contact step after selecting a slot and continuing', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            slotStart: '2026-03-02T17:00:00.000Z',
            slotEnd: '2026-03-02T17:30:00.000Z',
            staffId: 'stf-1',
          },
        ],
      }),
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    fireEvent.click(
      await screen.findByRole('radio', { name: /staff: kevin/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/step 3 of 5/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });

  it('supports arrow-key slot radio navigation with roving tabindex', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            slotStart: '2026-03-02T17:00:00.000Z',
            slotEnd: '2026-03-02T17:30:00.000Z',
            staffId: 'stf-1',
          },
          {
            slotStart: '2026-03-02T17:30:00.000Z',
            slotEnd: '2026-03-02T18:00:00.000Z',
            staffId: 'stf-1',
          },
        ],
      }),
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    const radios = await screen.findAllByRole('radio');
    act(() => {
      radios[0].focus();
    });
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });

    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('shows explicit start-end time range in review summary', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            slotStart: '2026-03-02T17:00:00.000Z',
            slotEnd: '2026-03-02T17:30:00.000Z',
            staffId: 'stf-1',
          },
        ],
      }),
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );
    fireEvent.click(await screen.findByRole('radio', { name: /staff:/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Pat' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Lee' },
    });
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: 'pat@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^phone/i), {
      target: { value: '5551234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /review summary/i }));

    expect(screen.getByText(/9:00 am-9:30 am/i)).toBeInTheDocument();
  });

  it('maps 429 booking responses to cooldown guidance and disables resubmit until expiry', async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              slotStart: '2026-03-02T17:00:00.000Z',
              slotEnd: '2026-03-02T17:30:00.000Z',
              staffId: 'stf-1',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'hold_123', expiresAt: '2026-03-02T17:05:00.000Z' },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '5' }),
        json: async () => ({ error: { message: 'RATE_LIMITED' } }),
      });

    render(<Scheduler services={services} staff={staff} />);

    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: /staff: kevin/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('radio', { name: /staff: kevin/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Pat' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Lee' },
    });
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: 'pat@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^phone/i), {
      target: { value: '5551234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /review summary/i }));
    screen
      .getAllByRole('checkbox')
      .slice(0, 3)
      .forEach((checkbox) => fireEvent.click(checkbox));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /confirm booking/i })).toBeEnabled(),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));
    });

    await waitFor(() =>
      expect(
        screen.getByText(/too many booking attempts\. try again in 5s\./i),
      ).toBeInTheDocument(),
    );

    const cooldownButton = screen.getByRole('button', { name: /retry in 5s/i });
    expect(cooldownButton).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(5500);
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /confirm booking/i }),
      ).toBeEnabled(),
    );

    jest.useRealTimers();
  });

  it('only shows restored-draft notice once per session for the same restored draft', () => {
    window.sessionStorage.setItem(
      'kb_booking_draft_v1',
      JSON.stringify({
        version: 1,
        step: 2,
        selectedServiceId: 'svc-1',
        selectedStaffId: 'stf-1',
        rangeDays: 7,
        selectedSlot: null,
        contact: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          notes: '',
        },
        consent: {
          agreeToTerms: false,
          agreeToPrivacy: false,
          agreeToBookingPolicies: false,
          marketingOptIn: false,
          smsOptIn: false,
        },
      }),
    );

    const firstRender = render(<Scheduler services={services} staff={staff} />);
    expect(
      screen.getByText(/found your previous booking draft/i),
    ).toBeInTheDocument();

    firstRender.unmount();

    render(<Scheduler services={services} staff={staff} />);
    expect(
      screen.queryByText(/found your previous booking draft/i),
    ).not.toBeInTheDocument();
  });

  it('parses date-form Retry-After headers for 429 cooldown guidance', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-12T16:00:00.000Z'));

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              slotStart: '2026-03-02T17:00:00.000Z',
              slotEnd: '2026-03-02T17:30:00.000Z',
              staffId: 'stf-1',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'hold_456', expiresAt: '2026-03-02T17:05:00.000Z' },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'retry-after'
              ? 'Thu, 12 Feb 2026 16:00:45 GMT'
              : null,
        },
        json: async () => ({ error: { message: 'RATE_LIMITED' } }),
      });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );
    fireEvent.click(await screen.findByRole('radio', { name: /staff:/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Pat' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Lee' },
    });
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: 'pat@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^phone/i), {
      target: { value: '5551234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /review summary/i }));
    screen
      .getAllByRole('checkbox')
      .slice(0, 3)
      .forEach((checkbox) => fireEvent.click(checkbox));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /confirm booking/i })).toBeEnabled(),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/too many booking attempts\. try again in 45s\./i),
      ).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('shows slot conflict alternatives and supports one-tap recovery', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              slotStart: '2026-03-02T17:00:00.000Z',
              slotEnd: '2026-03-02T17:30:00.000Z',
              staffId: 'stf-1',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'hold_789', expiresAt: '2026-03-02T17:05:00.000Z' },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'SLOT_TAKEN',
            message: 'Selected slot is no longer available',
            alternatives: [
              {
                slotStart: '2026-03-02T17:30:00.000Z',
                slotEnd: '2026-03-02T18:00:00.000Z',
                staffId: 'stf-1',
              },
            ],
          },
        }),
      });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    fireEvent.click(await screen.findByRole('radio', { name: /staff:/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Pat' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Lee' },
    });
    fireEvent.change(screen.getByLabelText(/^email/i), {
      target: { value: 'pat@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^phone/i), {
      target: { value: '5551234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: /review summary/i }));
    screen
      .getAllByRole('checkbox')
      .slice(0, 3)
      .forEach((checkbox) => fireEvent.click(checkbox));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /confirm booking/i })).toBeEnabled(),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));
    });

    await screen.findByText(/that time was just taken/i);
    fireEvent.click(screen.getByRole('button', { name: /9:30 am-10:00 am/i }));

    expect(
      screen.queryByText(/that time was just taken/i),
    ).not.toBeInTheDocument();
  });
});
