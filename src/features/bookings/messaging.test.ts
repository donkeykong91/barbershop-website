import { getReminderSendTime } from './messaging';

describe('messaging reminder offsets', () => {
  it('uses near-term offset for appointments within 24h', () => {
    const now = new Date('2026-02-13T18:00:00.000Z').getTime();
    const sendAt = getReminderSendTime('2026-02-14T10:00:00.000Z', now);
    expect(sendAt).toBe('2026-02-14T08:00:00.000Z');
  });

  it('uses standard offset for appointments farther out', () => {
    const now = new Date('2026-02-13T18:00:00.000Z').getTime();
    const sendAt = getReminderSendTime('2026-02-16T10:00:00.000Z', now);
    expect(sendAt).toBe('2026-02-15T10:00:00.000Z');
  });
});
