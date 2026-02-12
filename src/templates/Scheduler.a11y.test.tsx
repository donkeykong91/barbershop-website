import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Scheduler } from './Scheduler';

const services = [
  {
    id: 'svc-1',
    name: 'Haircut',
    durationMin: 30,
    priceCents: 3500,
    currency: 'USD',
    active: true,
    bookable: true,
  },
];

const staff = [{ id: 'staff-1', displayName: 'Alex', active: true }];

describe('Scheduler accessibility regressions', () => {
  beforeEach(() => {
    (globalThis as { fetch?: jest.Mock }).fetch = jest.fn();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks current step with aria-current="step"', () => {
    render(<Scheduler services={services} staff={staff} />);

    expect(screen.getByRole('button', { name: 'Service' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('button', { name: 'Time' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows dedicated availability load-failure state and inline validation errors', async () => {
    const user = userEvent.setup();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Unable to load availability' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              slotStart: '2026-02-20T18:00:00.000Z',
              slotEnd: '2026-02-20T18:30:00.000Z',
              staffId: 'staff-1',
            },
          ],
        }),
      } as Response);

    render(<Scheduler services={services} staff={staff} />);

    await user.click(
      screen.getByRole('button', { name: 'Find available slots' }),
    );

    const loadFailure = await screen.findByText(/availability failed to load/i);
    expect(loadFailure).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry loading slots/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(
      screen.getByRole('button', { name: 'Find available slots' }),
    );
    await user.click(
      await screen.findByRole('radio', { name: /staff: alex/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Review summary' }));

    const firstNameError = await screen.findByText('first Name is required.');
    expect(firstNameError).toHaveAttribute('role', 'alert');
    expect(firstNameError).toHaveAttribute('aria-live', 'assertive');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders call-the-shop as tel link with accessible name including phone', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    render(<Scheduler services={services} staff={staff} />);
    await user.click(
      screen.getByRole('button', { name: 'Find available slots' }),
    );

    const callLink = await screen.findByRole('link', {
      name: /call the shop at \(555\) 123-4567/i,
    });

    expect(callLink).toHaveAttribute('href', 'tel:+15551234567');
  });

  it('announces reset confirmation dialog before destructive action', async () => {
    const user = userEvent.setup();
    render(<Scheduler services={services} staff={staff} />);

    await user.click(screen.getByRole('button', { name: 'Reset booking' }));

    const dialog = screen.getByRole('dialog', {
      name: /confirm reset booking/i,
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByText(/this will clear your selected service/i),
    ).toBeInTheDocument();
  });

  it('exposes selected slot state with radio semantics', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
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
    } as Response);

    render(<Scheduler services={services} staff={staff} />);
    await user.click(screen.getByRole('button', { name: 'Find available slots' }));

    const radios = await screen.findAllByRole('radio');
    expect(screen.getByRole('radiogroup', { name: /available appointment slots/i })).toBeInTheDocument();
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');

    await user.click(radios[0]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('uses polite status live regions for contextual notices and confirmation text only', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              slotStart: '2026-03-02T17:00:00.000Z',
              slotEnd: '2026-03-02T17:30:00.000Z',
              staffId: 'staff-1',
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'bk_123',
            status: 'confirmed',
            totalCents: 3500,
            currency: 'USD',
          },
        }),
      } as Response);

    window.sessionStorage.setItem(
      'kb_booking_draft_v1',
      JSON.stringify({
        version: 1,
        step: 2,
        selectedServiceId: 'svc-1',
        selectedStaffId: 'missing',
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

    render(<Scheduler services={services} staff={staff} />);

    const restoreNotice = await screen.findByText(/restored your draft/i);
    expect(restoreNotice).toHaveAttribute('role', 'status');
    expect(restoreNotice).toHaveAttribute('aria-live', 'polite');

    await user.click(screen.getByRole('button', { name: /search next 14 days/i }));
    await user.click(await screen.findByRole('radio', { name: /staff:/i }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.type(screen.getByLabelText(/first name/i), 'Pat');
    await user.type(screen.getByLabelText(/last name/i), 'Lee');
    await user.type(screen.getByLabelText(/^email/i), 'pat@example.com');
    await user.type(screen.getByLabelText(/^phone/i), '5551234567');

    await user.click(screen.getByRole('button', { name: 'Review summary' }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    const successText = await screen.findByText('Booking confirmed.');
    const successStatus = successText.closest('[role="status"]');
    expect(successStatus).not.toBeNull();
    expect(successStatus).toHaveAttribute('aria-live', 'polite');
    expect(successStatus).not.toContainElement(
      screen.getByRole('button', { name: /add to calendar/i }),
    );
  });

  it('excludes inactive staff members from preferred barber options', () => {
    render(
      <Scheduler
        services={services}
        staff={[
          { id: 'staff-active', displayName: 'Active Barber', active: true },
          { id: 'staff-inactive', displayName: 'Inactive Barber', active: false },
        ]}
      />,
    );

    const staffSelect = screen.getByLabelText(/preferred barber/i);
    expect(staffSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Any barber' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Active Barber' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Inactive Barber' }),
    ).not.toBeInTheDocument();
  });

  it('uses a unique scheduler staff control id and de-duplicates Any barber fallback options', () => {
    render(
      <Scheduler
        services={services}
        staff={[
          { id: 'any', displayName: 'Any barber', active: true },
          { id: 'staff-1', displayName: 'Alex', active: true },
          { id: 'staff-1', displayName: 'Alex Duplicate', active: true },
        ]}
      />,
    );

    const preferredBarberSelect = screen.getByLabelText('Preferred barber');
    expect(preferredBarberSelect).toHaveAttribute('id', 'booking-staff');

    const anyBarberOptions = screen.getAllByRole('option', { name: 'Any barber' });
    expect(anyBarberOptions).toHaveLength(1);
    expect((preferredBarberSelect as HTMLSelectElement).options).toHaveLength(2);
  });
});
