import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Footer } from './Footer';
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

describe('Open UX ticket regression coverage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: jest.fn(),
      writable: true,
    });
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('UX-022: reset dialog closes on Escape and restores focus to reset trigger', async () => {
    render(<Scheduler services={services} staff={staff} />);

    const resetTrigger = screen.getByRole('button', { name: /reset booking/i });
    fireEvent.click(resetTrigger);

    expect(screen.getByRole('button', { name: /^cancel$/i })).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(resetTrigger).toHaveFocus());
  });

  it('UX-023: slot cards render explicit start-end time range', async () => {
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

    await waitFor(() =>
      expect(screen.getByText(/time: 9:00 am[-–]9:30 am/i)).toBeInTheDocument(),
    );
  });

  it('UX-024: maps 429 Retry-After to cooldown copy and disables confirm CTA', async () => {
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
        ok: false,
        status: 429,
        headers: { get: () => '47' },
        json: async () => ({ error: { message: 'Too many attempts' } }),
      });

    render(<Scheduler services={services} staff={staff} />);

    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );
    await waitFor(() => expect(screen.getByRole('radio')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio'));

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
    fireEvent.click(screen.getByLabelText(/I agree to the Terms/i));
    fireEvent.click(screen.getByLabelText(/I acknowledge the Privacy Policy/i));
    fireEvent.click(
      screen.getByLabelText(/I agree to the cancellation, reschedule/i),
    );
    fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() =>
      expect(screen.getByText(/try again in 47s/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /retry in 47s/i }),
    ).toBeDisabled();
  });

  it('UX-025: shows dedicated load-failed state (not no-slots empty state) on availability error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Service unavailable' } }),
    });

    render(<Scheduler services={services} staff={staff} />);
    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/availability failed to load/i),
      ).toBeInTheDocument(),
    );

    expect(
      screen.queryByText(/no appointments available in the next/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry loading slots/i }),
    ).toBeInTheDocument();
  });

  it('UX-026: shows explicit start-end time range in review summary', async () => {
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

    expect(screen.getByText(/date\/time \(shop time/i)).toBeInTheDocument();
    expect(screen.getByText(/\(9:00 am-9:30 am\)/i)).toBeInTheDocument();
  });

  it('UX-027: supports arrow-key radio navigation for slot selection', async () => {
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

    const user = userEvent.setup();
    render(<Scheduler services={services} staff={staff} />);

    fireEvent.click(
      screen.getByRole('button', { name: /find available slots/i }),
    );
    const radios = await screen.findAllByRole('radio');

    act(() => {
      radios[0].focus();
    });
    expect(radios[0]).toHaveAttribute('tabindex', '0');

    await user.keyboard('{ArrowDown}');

    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('tabindex', '0');
    expect(radios[0]).toHaveAttribute('tabindex', '-1');
  });

  it('UX-031: footer nav uses responsive wrapping instead of fixed single row', () => {
    render(<Footer />);

    const list = screen.getByRole('list');
    expect(list).toHaveClass('flex-wrap');
    expect(list).not.toHaveClass('flex-row');
    expect(screen.getByRole('link', { name: /email support/i })).toBeVisible();
    expect(
      screen.getByRole('link', { name: /call \(555\) 123-4567/i }),
    ).toBeVisible();
  });

  it('UX-032: footer nav enforces narrow-width overflow containment classes', () => {
    render(<Footer />);

    const list = screen.getByRole('list');
    expect(list).toHaveClass('min-w-0');
    expect(list).toHaveClass('max-w-full');
    expect(list).toHaveClass('overflow-x-hidden');
    expect(list).toHaveClass('overflow-x-clip');

    const supportLink = screen.getByRole('link', { name: /email support/i });
    expect(supportLink).toBeVisible();
    expect(supportLink).toHaveAttribute(
      'href',
      'mailto:support@kevinbarbershop.com',
    );
  });
});
