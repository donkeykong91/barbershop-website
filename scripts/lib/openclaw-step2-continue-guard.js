'use strict';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = [800, 1600];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isBrowserControlTimeout(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes("can't reach the openclaw browser control service")
    || (message.includes('openclaw browser control service') && message.includes('timed out'))
    || message.includes('timed out after 20000ms')
  );
}

function backoffForAttempt(attempt, backoffMs) {
  const index = Math.max(0, attempt - 1);
  return backoffMs[Math.min(index, backoffMs.length - 1)] ?? 0;
}

function toDiagnosticError(message, details) {
  const error = new Error(message);
  error.name = 'Step2ContinueGuardError';
  error.details = details;
  return error;
}

async function continueFromStep2WithGuard(driver, options) {
  const {
    targetId,
    refs = 'aria',
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    backoffMs = DEFAULT_BACKOFF_MS,
  } = options || {};

  if (!targetId) {
    throw new Error('continueFromStep2WithGuard requires targetId.');
  }

  if (!driver?.snapshot || !driver?.click || !driver?.findContinueRef || !driver?.isStep3) {
    throw new Error('Driver must provide snapshot/click/findContinueRef/isStep3 functions.');
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const preClickSnapshot = await driver.snapshot({ targetId, refs });
    const continueRef = driver.findContinueRef(preClickSnapshot);

    if (!continueRef) {
      throw toDiagnosticError('Continue button ref missing in Step 2 snapshot.', {
        targetId,
        attempt,
      });
    }

    try {
      await driver.click({ targetId, ref: continueRef });
    } catch (error) {
      lastError = error;

      if (!isBrowserControlTimeout(error)) {
        throw error;
      }

      const timeoutRecoverySnapshot = await driver.snapshot({ targetId, refs });
      if (driver.isStep3(timeoutRecoverySnapshot)) {
        return {
          ok: true,
          advanced: true,
          recoveredFromTimeout: true,
          attempt,
          targetId,
        };
      }

      if (attempt >= maxAttempts) {
        throw toDiagnosticError('Step 2 Continue timeout persisted and Step 3 never appeared.', {
          targetId,
          attempt,
          maxAttempts,
          timeoutMessage: String(error?.message || error),
        });
      }

      await sleep(backoffForAttempt(attempt, backoffMs));
      continue;
    }

    const postClickSnapshot = await driver.snapshot({ targetId, refs });
    if (driver.isStep3(postClickSnapshot)) {
      return {
        ok: true,
        advanced: true,
        recoveredFromTimeout: false,
        attempt,
        targetId,
      };
    }

    if (attempt >= maxAttempts) {
      throw toDiagnosticError('Continue click acknowledged, but Step 3 never appeared before retry budget was exhausted.', {
        targetId,
        attempt,
        maxAttempts,
      });
    }

    await sleep(backoffForAttempt(attempt, backoffMs));
  }

  throw toDiagnosticError('Step 2 Continue failed after bounded retries.', {
    targetId,
    maxAttempts,
    lastError: String(lastError?.message || lastError || ''),
  });
}

module.exports = {
  continueFromStep2WithGuard,
  isBrowserControlTimeout,
};
