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

## Regression safeguard in this repo

- Added Playwright stability test:
  - `e2e/booking-step2-continue.stability.spec.ts`
- This test executes Step 2 -> Step 3 transition three times in one run and verifies Step 3 is reached each time.
