const {
  continueFromStep2WithGuard,
  isBrowserControlTimeout,
} = require('../../../scripts/lib/openclaw-step2-continue-guard');

describe('openclaw step2 continue guard', () => {
  it('classifies known browser control timeout messages', () => {
    expect(
      isBrowserControlTimeout(new Error("Can't reach the OpenClaw browser control service (timed out after 20000ms)")),
    ).toBe(true);
    expect(isBrowserControlTimeout(new Error('other error'))).toBe(false);
  });

  it('treats timeout as success when same target snapshot already advanced to Step 3', async () => {
    const targetIdUsed: string[] = [];
    const snapshots = [
      { state: 'step2', continueRef: 'e-continue' },
      { state: 'step3' },
    ];

    const driver = {
      snapshot: jest.fn(async ({ targetId }: { targetId: string }) => {
        targetIdUsed.push(targetId);
        return snapshots.shift();
      }),
      findContinueRef: jest.fn((snapshot: { continueRef?: string }) => snapshot.continueRef),
      click: jest.fn(async () => {
        throw new Error("Can't reach the OpenClaw browser control service (timed out after 20000ms)");
      }),
      isStep3: jest.fn((snapshot: { state?: string }) => snapshot?.state === 'step3'),
    };

    const result = await continueFromStep2WithGuard(driver, {
      targetId: 'tab-123',
      maxAttempts: 2,
      backoffMs: [0],
    });

    expect(result).toMatchObject({
      ok: true,
      advanced: true,
      recoveredFromTimeout: true,
      targetId: 'tab-123',
    });
    expect(targetIdUsed).toEqual(['tab-123', 'tab-123']);
    expect(driver.click).toHaveBeenCalledTimes(1);
  });

  it('retries with bounded budget then fails with diagnosis if Step 3 never appears', async () => {
    const driver = {
      snapshot: jest
        .fn()
        .mockResolvedValueOnce({ state: 'step2', continueRef: 'e-continue' })
        .mockResolvedValueOnce({ state: 'step2' })
        .mockResolvedValueOnce({ state: 'step2', continueRef: 'e-continue' })
        .mockResolvedValueOnce({ state: 'step2' }),
      findContinueRef: jest.fn((snapshot: { continueRef?: string }) => snapshot.continueRef),
      click: jest
        .fn()
        .mockRejectedValue(new Error("Can't reach the OpenClaw browser control service (timed out after 20000ms)")),
      isStep3: jest.fn((snapshot: { state?: string }) => snapshot?.state === 'step3'),
    };

    await expect(
      continueFromStep2WithGuard(driver, {
        targetId: 'tab-123',
        maxAttempts: 2,
        backoffMs: [0],
      }),
    ).rejects.toMatchObject({
      name: 'Step2ContinueGuardError',
      message: 'Step 2 Continue timeout persisted and Step 3 never appeared.',
      details: expect.objectContaining({
        targetId: 'tab-123',
        maxAttempts: 2,
      }),
    });

    expect(driver.click).toHaveBeenCalledTimes(2);
  });
});
