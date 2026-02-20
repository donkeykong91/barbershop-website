import { logBookingLegalConsent } from './repository';

jest.mock('../../lib/db/sqlite', () => ({
  run: jest.fn(),
  queryAll: jest.fn(),
  queryOne: jest.fn(),
}));

const { run } = jest.requireMock('../../lib/db/sqlite') as {
  run: jest.Mock;
};

describe('logBookingLegalConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    'SQLITE_ERROR: no such table: booking_legal_consents',
    'SQLITE_ERROR: no such table: main.booking_legal_consents',
  ])(
    'self-heals when booking_legal_consents table is missing (%s) and then retries insert',
    async (missingTableError) => {
      run
        .mockRejectedValueOnce(new Error(missingTableError))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await expect(
        logBookingLegalConsent({
          bookingId: 'bk_123',
          legalVersion: '2026-02-12',
          agreedToTerms: true,
          agreedToPrivacy: true,
          agreedToBookingPolicies: true,
          marketingOptIn: false,
          smsOptIn: false,
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        }),
      ).resolves.toBeUndefined();

      expect(run).toHaveBeenCalledTimes(4);
      expect(run.mock.calls[1]?.[0]).toContain(
        'CREATE TABLE IF NOT EXISTS booking_legal_consents',
      );
      expect(run.mock.calls[2]?.[0]).toContain(
        'CREATE INDEX IF NOT EXISTS idx_booking_legal_consents_booking_id',
      );
    },
  );
});
