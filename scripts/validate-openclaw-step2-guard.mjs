import { continueFromStep2WithGuard } from './lib/openclaw-step2-continue-guard.js';

function makeDriver({ shouldAdvanceAfterTimeout }) {
  let snapshots = 0;

  return {
    async snapshot() {
      snapshots += 1;
      if (snapshots === 1) {
        return { state: 'step2', continueRef: 'e-continue' };
      }

      if (shouldAdvanceAfterTimeout) {
        return { state: 'step3' };
      }

      return { state: 'step2', continueRef: 'e-continue' };
    },
    findContinueRef(snapshot) {
      return snapshot.continueRef;
    },
    async click() {
      throw new Error("Can't reach the OpenClaw browser control service (timed out after 20000ms)");
    },
    isStep3(snapshot) {
      return snapshot.state === 'step3';
    },
  };
}

async function run() {
  const success = await continueFromStep2WithGuard(makeDriver({ shouldAdvanceAfterTimeout: true }), {
    targetId: 'demo-tab',
    maxAttempts: 2,
    backoffMs: [0],
  });

  if (!success.recoveredFromTimeout) {
    throw new Error('Expected recoveredFromTimeout=true in success scenario.');
  }

  let failedAsExpected = false;
  try {
    await continueFromStep2WithGuard(makeDriver({ shouldAdvanceAfterTimeout: false }), {
      targetId: 'demo-tab',
      maxAttempts: 2,
      backoffMs: [0],
    });
  } catch (error) {
    failedAsExpected = error?.name === 'Step2ContinueGuardError';
  }

  if (!failedAsExpected) {
    throw new Error('Expected bounded retry failure in non-advance scenario.');
  }

  console.log('openclaw-step2-guard validation: PASS');
}

run();
