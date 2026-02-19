import { ensureIsoDateTime, parseIntEnv } from './v2Repository';

describe('parseIntEnv', () => {
  it('returns fallback for invalid values', () => {
    expect(parseIntEnv(undefined, 5)).toBe(5);
    expect(parseIntEnv('abc', 10)).toBe(10);
    expect(parseIntEnv('0', 7)).toBe(7);
  });

  it('returns parsed positive integers', () => {
    expect(parseIntEnv('15', 5)).toBe(15);
  });
});

describe('ensureIsoDateTime', () => {
  it('accepts ISO-8601 datetime with UTC offset', () => {
    expect(
      ensureIsoDateTime('2026-02-17T12:30:00.000Z', 'slotStart'),
    ).toBe('2026-02-17T12:30:00.000Z');
  });

  it('accepts ISO-8601 datetime with signed timezone', () => {
    expect(ensureIsoDateTime('2026-02-17T12:30:00+00:00', 'slotEnd')).toBe(
      '2026-02-17T12:30:00+00:00',
    );
  });

  it('rejects naive datetime without timezone', () => {
    expect(() => ensureIsoDateTime('2026-02-17T12:30:00', 'slotStart')).toThrow(
      'INVALID_SLOTSTART_FORMAT',
    );
  });

  it('rejects malformed values', () => {
    expect(() => ensureIsoDateTime('not-a-date', 'slotEnd')).toThrow(
      'INVALID_SLOTEND_FORMAT',
    );
  });
});
