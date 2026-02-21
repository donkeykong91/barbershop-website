# OpenClaw booking Step 2 -> Step 3 timeout runbook

## Symptom

During browser-tool automation on `/?staffId=stf_kevin#book`, clicking **Continue** at Step 2 may return:

`Can't reach the OpenClaw browser control service (timed out after 20000ms)`

## Root cause classification

- **Not an app/UI regression**: booking flow still advances to Step 3 in the same tab after many of these timeout responses.
- **Control-plane response timeout / false-negative** in browser-tool action acknowledgement.
- **High-risk usage pattern**: treating this timeout as a hard failure without verifying page state.

## Durable operating procedure for agents

1. Use a **single tab target** for the whole flow.
   - Keep and reuse `targetId` from `browser.open` (or first `snapshot`).
2. Take a fresh `snapshot` before every critical action and use refs from that snapshot.
3. On Step 2 Continue timeout, **do not classify failure immediately**.
   - Immediately take `snapshot` on the same `targetId`.
   - If snapshot shows `Step 3 of 5`, mark action successful and continue.
4. Only mark control-plane failure if:
   - timeout/error repeats **and**
   - snapshot confirms UI did not advance.
5. If failure is real, restart gateway once (`openclaw gateway restart`), re-open tab, and resume from Step 1 with fresh refs.

## OpenClaw docs alignment

OpenClaw browser tooling guidance requires using refs from the latest snapshot and keeping actions on the same tab via `targetId`. Following that guidance eliminates ref/session drift and reduces control-plane flakiness impact.

## In-repo automation guard (authoritative)

Implemented reusable guard:

- `scripts/lib/openclaw-step2-continue-guard.js`
  - enforces single `targetId`
  - refreshes snapshot refs before Continue click
  - on timeout, re-snapshots same `targetId` and checks for Step 3
  - treats Step 3 as success (timeout false-negative recovery)
  - bounded retry with backoff and clear diagnostic error on true failure

### Operator usage (exact flow for agents)

1. Open booking page and capture one `targetId`.
2. Build a driver adapter that maps your browser actions to:
   - `snapshot({ targetId, refs })`
   - `findContinueRef(snapshot)`
   - `click({ targetId, ref })`
   - `isStep3(snapshot)`
3. Call `continueFromStep2WithGuard(driver, { targetId })`.
4. Continue workflow if return value has `advanced: true`.
5. If it throws `Step2ContinueGuardError`, stop and surface `.details` in your report.

Minimal invocation:

```js
const { continueFromStep2WithGuard } = require('./scripts/lib/openclaw-step2-continue-guard');

const result = await continueFromStep2WithGuard(driver, {
  targetId,
  maxAttempts: 3,
  backoffMs: [800, 1600],
});
```

## Executable validation in this repo

- Jest timeout-recovery tests:
  - `npm run test:step2-guard`
- Scripted smoke validation:
  - `npm run validate:step2-guard`
- Existing browser stability check remains:
  - `e2e/booking-step2-continue.stability.spec.ts`
