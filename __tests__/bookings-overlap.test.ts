import { createBooking } from '../src/features/bookings/repository';
import * as bookingRepo from '../src/features/bookings/repository';
import * as servicesRepo from '../src/features/services/repository';
import * as db from '../src/lib/db/sqlite';

jest.mock('../src/lib/db/sqlite', () => ({
  queryOne: jest.fn(),
  run: jest.fn(),
}));

jest.mock('../src/features/services/repository', () => ({
  getServiceById: jest.fn(),
}));

const runMock = db.run as jest.Mock;
const queryOneMock = db.queryOne as jest.Mock;
const getServiceByIdMock = servicesRepo.getServiceById as jest.Mock;

const makeService = () => ({
  id: 'svc_1',
  durationMin: 30,
  priceCents: 2500,
  currency: 'USD',
  active: true,
  visible: true,
  bookable: true,
});

describe('bookings repository race-window guard', () => {
  beforeEach(() => {
    runMock.mockReset();
    queryOneMock.mockReset();
    getServiceByIdMock.mockReset();
  });

  it('rolls back and throws when requested slot is already booked', async () => {
    getServiceByIdMock.mockResolvedValueOnce(makeService());
    queryOneMock.mockResolvedValueOnce({ found: 1 });

    await expect(
      createBooking({
        serviceId: 'svc_1',
        staffId: 'stf_kevin',
        slotStart: '2026-03-01T10:00:00.000Z',
        slotEnd: '2026-03-01T10:30:00.000Z',
        customer: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          phone: '+15551234567',
        },
        notes: 'Hold test',
      }),
    ).rejects.toThrow('SLOT_UNAVAILABLE');

    expect(runMock.mock.calls[0]?.[0]).toBe('BEGIN IMMEDIATE');
    expect(runMock.mock.calls).toContainEqual(['ROLLBACK']);
  });

  it('creates booking when no active conflict exists', async () => {
    getServiceByIdMock.mockResolvedValueOnce(makeService());
    queryOneMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    runMock.mockResolvedValue({
      rows: [],
    } as never);

    const booking = bookingRepo.createBooking({
      serviceId: 'svc_1',
      staffId: 'stf_kevin',
      slotStart: '2026-03-01T11:00:00.000Z',
      slotEnd: '2026-03-01T11:30:00.000Z',
      customer: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '+15551234567',
      },
      notes: 'Creates booking',
    });

    await expect(booking).resolves.toMatchObject({
      status: 'confirmed',
      totalCents: 2500,
      currency: 'USD',
    });

    expect(runMock.mock.calls.some((call) => call[0] === 'COMMIT')).toBe(true);
  });
});
