# QA Bugs

## QA-WEB-BLOCKER-001 — High — Browser automation outage blocked full 3-pass interactive QA
- **Area**: End-to-end booking flow validation at `https://kevinbarbershopwebsite.vercel.app/`
- **Repro steps**:
  1. Start interactive QA run.
  2. Attempt to continue browser-driven test after loading booking step.
- **Expected**: Browser session remains available to complete all 3 requested passes.
- **Actual**: Browser tool call fails with timeout: `Can't reach the OpenClaw browser control service (timed out after 20000ms)` and advises gateway restart.
- **Impact**: Could not complete all three full interactive passes; only partial coverage completed before outage.
- **Status**: Open (blocker)

## QA-WEB-002 — High — Homepage shows online booking unavailable/no bookable services
- **Area**: Public booking flow content/state on homepage booking section
- **Repro steps**:
  1. Fetch homepage content (`https://kevinbarbershopwebsite.vercel.app/`) during this run.
  2. Inspect booking section text.
- **Expected**: At least one bookable service/slot path should be available for online booking.
- **Actual**: Page displays `Online booking is temporarily unavailable.` and `We currently have no bookable services online.`
- **Impact**: Users cannot complete online booking.
- **Evidence**: Reproduced across repeated homepage checks in this run.
- **Status**: Open

## QA-WEB-003 — High — Inconsistent booking availability state across render paths
- **Area**: Homepage booking section / booking flow state consistency
- **Repro steps**:
  1. Open site interactively and click `Find available slots` in booking wizard.
  2. Observe Step 2 renders many slots (`299 found in next 7 days`).
  3. Separately fetch homepage content in non-interactive request path and observe messaging.
- **Expected**: Booking availability messaging should be consistent across render/request contexts.
- **Actual**: Interactive flow shows many available slots, while non-interactive content states `Online booking is temporarily unavailable` and `no bookable services online`.
- **Impact**: Users and monitoring tools can receive contradictory booking availability status.
- **Status**: Open

## QA-WEB-004 — Medium — Barber preference availability message conflicts with selectable barber options
- **Area**: Homepage barber preference content/state
- **Repro steps**:
  1. Open `https://kevinbarbershopwebsite.vercel.app/` in interactive browser run.
  2. Observe barber dropdown contains specific options (`Kevin`, `Mario`).
  3. In separate fetch/readability render path, observe text: `No specific barbers are currently available online. We'll book you with any available barber.`
- **Expected**: Availability message should match actual selectable options.
- **Actual**: Message says no specific barbers are available while specific barbers are selectable in UI.
- **Impact**: Users may assume barber selection is disabled when it is actually available.
- **Status**: Open

## QA-WEB-BLOCKER-002 — High — Vercel Security Checkpoint blocks automated QA access (HTTP 403)
- **Area**: Site accessibility for automated/browser-assisted QA
- **Repro steps**:
  1. Open `https://kevinbarbershopwebsite.vercel.app/` in browser automation.
  2. Observe page content: `We're verifying your browser` (Vercel Security Checkpoint).
  3. Fetch homepage via `web_fetch` (multiple attempts with cache-busting query params).
- **Expected**: QA tooling can load public homepage/booking content for regression checks.
- **Actual**: Requests are blocked by Vercel checkpoint; fetch returns `403` and browser shows verification interstitial.
- **Impact**: Full website QA pass cannot proceed beyond security checkpoint until allowlist/challenge bypass is configured.
- **Status**: Open (blocker)

## QA-WEB-005 — High — Booking Step 2 intermittently fails to load availability (JSON parse error from HTML response)
- **Area**: Booking wizard Step 2 availability loader
- **Repro steps**:
  1. Open `https://kevinbarbershopwebsite.vercel.app/` and go to Book an Appointment.
  2. Click `Find available slots`.
  3. Observe Step 2 error state. Click `Back to service & barber`, then `Find available slots` again.
  4. Click `Retry loading slots`.
- **Expected**: Slot API returns valid JSON and Step 2 displays available time slots.
- **Actual**: Step 2 shows `Availability failed to load` with details `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` and cannot continue.
- **Impact**: Customers cannot proceed past availability selection; online booking flow is blocked intermittently/fully depending on backend response.
- **Status**: Open

## QA-WEB-006 — High — End-to-end booking validation blocked by browser control timeout at Step 2→Step 3 transition
- **Area**: Live booking flow (`/?staffId=stf_kevin#book`) end-to-end completion
- **Repro steps**:
  1. Open `https://kevinbarbershopwebsite.vercel.app/?staffId=stf_kevin#book`.
  2. In Step 1, keep `Classic Haircut` and `Preferred barber: Kevin`, then click `Find available slots`.
  3. In Step 2, select `Earliest available` slot (`Feb 20, 2026, 9:30 AM`, Kevin).
  4. Click `Continue` to proceed to Step 3 (Contact).
- **Expected**: Flow advances to Step 3 and allows contact details entry so booking can be completed.
- **Actual**: Browser control call timed out exactly on the `Continue` action with: `Can't reach the OpenClaw browser control service (timed out after 20000ms)`. End-to-end booking could not be completed in this run.
- **Evidence**:
  - URL: `https://kevinbarbershopwebsite.vercel.app/?staffId=stf_kevin#book`
  - Observed at: 2026-02-19 ~16:10 PT
  - Pre-failure state confirmed: Step 2 loaded with `144 found in next 7 days`, slot selected.
  - Tool/network observation: control-plane timeout prevented completion; browser tool explicitly advised gateway/browser service restart.
- **Security impact**: **Low** direct security risk; primary impact is QA reliability and release confidence. Indirect risk: unstable tooling can mask real production defects by reducing deterministic regression coverage.
- **Status**: Open

## Partial run observations before blocker
- Initial interactive pass reached Step 2 and slot list rendered.
- Browser control has been intermittently unstable across runs.
- Additional non-interactive checks showed booking-unavailable messaging on homepage.

---
RUN_TS: 2026-02-18T18:03:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE

---
RUN_TS: 2026-02-18T19:02:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE

---
RUN_TS: 2026-02-18T20:03:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE

---
RUN_TS: 2026-02-18T23:03:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE

---
RUN_TS: 2026-02-19T00:03:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3); exploratory fetch /booking and /reschedule returned 404 not linked from homepage flow

---
RUN_TS: 2026-02-19T01:03:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced same booking-unavailable state text; no materially new repro/path

---
RUN_TS: 2026-02-19T02:03:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) with unchanged booking-unavailable and no-specific-barbers messaging

---
RUN_TS: 2026-02-19T03:03:00-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) with identical booking unavailable + barber messaging; no materially different path/repro

---
RUN_TS: 2026-02-19T04:06:22-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) with unchanged booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T05:03:55-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging; exploratory pass: /booking returned 404, /reschedule returned 200 with 'Reschedule Appointment' page; no new materially harmful defect signature

---
RUN_TS: 2026-02-19T06:05:19-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T07:03:31-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T08:06:01-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T09:03:28-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T10:03:17-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T11:03:34-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T12:03:30-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T13:03:28-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T14:03:50-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T15:03:22-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T16:03:12-08:00
LAST_TICKET_ID: QA-WEB-005
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced identical booking-unavailable + no-specific-barbers messaging; no materially different repro/path

---
RUN_TS: 2026-02-19T16:11:00-08:00
LAST_TICKET_ID: QA-WEB-006
NEW_IDS_ADDED: NONE
COVERAGE_EVIDENCE:
- Manual/automation repro on `/?staffId=stf_kevin#book`:
  - Step 1 -> Step 2 loads successfully (`144 found in next 7 days` in interactive browser).
  - Selecting first slot works.
  - Continue action reproduced OpenClaw browser-control timeout (`timed out after 20000ms`) at transition boundary.
- Independent request-path check (`web_fetch`) returns HTTP 200 and booking homepage content, confirming app availability while control-plane can still fail.
ROOT_CAUSE_TRIAGE:
- Primary: browser-control/control-plane instability (QA-WEB-006) rather than deterministic booking app logic defect.
- Secondary app-hardening gap found (QA-WEB-005 signature class): Step-2 availability loader assumed JSON and surfaced parser failures when backend/challenge returned HTML.
IMPLEMENTATION (Sen):
- Updated `src/components/templates/Scheduler.tsx`:
  - Added safe response parser for availability requests (`parseJsonSafely`).
  - Added explicit fallback messaging for non-JSON 403/5xx responses.
  - Preserved compatibility with existing mocked `fetch().json()` test flows.
- Added regression test (Sen):
  - `src/components/templates/Scheduler.test.tsx`
  - `maps non-JSON 403 availability responses to a safe user-facing message`
VALIDATION:
- `npx jest src/components/templates/Scheduler.test.tsx -t "maps non-JSON 403 availability responses"` PASS
- `npm run typecheck` PASS
NEXT_STEPS:
- Continue investigation for QA-WEB-006 by stabilizing browser-control layer (gateway/browser service health) and rerun full E2E booking from Step 2 -> Step 5 once control-plane is stable.

## QA-WEB-AH-001 - High - AUTOMATION-HEALTH: Browser relay attached-tab control-plane failure blocks mandatory E2E booking smoke
- **Category**: AUTOMATION-HEALTH (control-plane, not app-logic)
- **Area**: OpenClaw browser control / Chrome extension relay for /?staffId=stf_kevin#book
- **Repro steps**:
  1. Start browser session and open https://kevinbarbershopwebsite.vercel.app/?staffId=stf_kevin#book.
  2. Request page snapshot to begin E2E actions.
- **Expected**: Snapshot returns DOM refs so E2E booking steps can proceed.
- **Actual**: Browser tool fails before E2E interaction with error signature: Chrome extension relay is running, but no tab is connected. Click the OpenClaw Chrome extension icon on a tab to attach it (profile "chrome").
- **Impact**: Mandatory real-browser E2E booking smoke cannot be completed; run must be treated as blocked/failed coverage.
- **Failure domain**: control-plane
- **Status**: Open
---
RUN_TS: 2026-02-19T17:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: QA-WEB-AH-001
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: URL_OPENED_ONLY (snapshot/control handshake failed before Step 1 interaction)
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: web_fetch passes x3 on / (qa_pass=1..3) reproduced unchanged booking-unavailable + no-specific-barbers messaging. Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed at snapshot initialization with control-plane signature Chrome extension relay is running, but no tab is connected; repro step: first snapshot call immediately after opening URL.

---
RUN_TS: 2026-02-19T18:04:22-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-19T19:04:03-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-19T20:04:32-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-19T21:06:45-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-19T22:05:38-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-19T23:04:12-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-20T00:04:11-08:00
LAST_TICKET_ID: QA-WEB-AH-001
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging. Daily exploratory pass for new day: /reschedule returned 200 with 'Reschedule Appointment' content; no new materially harmful defect signature.

## QA-WEB-007 � High � Final booking confirmation intermittently fails with `Unable to create booking at this time`
- **Area**: Booking API final confirm path (`POST /api/v1/bookings`)
- **Repro steps**:
  1. Complete booking flow through Step 4 and submit confirmation.
  2. Observe generic error banner: `Unable to create booking at this time`.
- **Expected**: Booking confirm returns `201` with booking id/access token.
- **Actual**: API can return `500 INTERNAL_ERROR` with generic message even when upstream booking input is valid.
- **Root cause**:
  - `logBookingLegalConsent()` write could fail on environments missing `booking_legal_consents` migration table.
  - That post-booking write failure bubbles as 500 and surfaces generic confirm error.
- **Fix (Sen)**:
  - Added self-healing schema fallback in `src/features/bookings/repository.ts`:
    - Detect missing `booking_legal_consents` table error.
    - Create table + index on demand.
    - Retry legal-consent insert.
- **Status**: Closed (2026-02-20)
- **Verification**:
  - Added regression test `src/features/bookings/repository.legalConsent.test.ts`.
  - Booking API and hold tests remain passing.

---
RUN_TS: 2026-02-20T00:18:00-08:00
LAST_TICKET_ID: QA-WEB-007
NEW_IDS_ADDED: QA-WEB-007
COVERAGE_EVIDENCE:
- Root-cause isolation confirms final-step failure path in booking API error handling (`INTERNAL_ERROR`).
- Local regression path verified with simulated missing-table failure (`no such table: booking_legal_consents`) and retry success.
VALIDATION:
- `npx jest src/features/bookings/repository.legalConsent.test.ts src/pages/api/v1/bookings/index.test.ts src/pages/api/v1/bookings/holds.test.ts --runInBand` PASS
- `npm run typecheck` PASS
RESIDUAL_BLOCKERS:
- Full live interactive E2E assertion remains partially constrained by browser control-plane instability (`AUTOMATION-HEALTH-WEB-20260219-1710`).

---
RUN_TS: 2026-02-20T01:04:00-08:00
LAST_TICKET_ID: QA-WEB-007
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-20T02:05:02-08:00
LAST_TICKET_ID: QA-WEB-007
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-20T03:05:59-08:00
LAST_TICKET_ID: QA-WEB-007
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: NONE_RECORDED
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: CONTROL_HANDSHAKE_FAILED_PRE_STEP1
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory browser E2E attempt on /?staffId=stf_kevin#book failed before first interaction. Error signature: Chrome extension relay is running, but no tab is connected. Repro step: browser open call using profile chrome immediately returned relay-not-connected error. web_fetch passes x3 on / (qa_pass=1..3) unchanged booking-unavailable + no-specific-barbers messaging.

---
RUN_TS: 2026-02-20T04:06:00-08:00
LAST_TICKET_ID: QA-WEB-007
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP3_CONTACT_FORM
FAILURE_DOMAIN: app
COVERAGE_EVIDENCE: Mandatory real-browser E2E smoke executed on /?staffId=stf_kevin#book using browser actions (open -> Step1 Find available slots -> Step2 slot selected -> Step3 contact form reached). No new app-logic defect signature observed vs baseline. Additional website passes: web_fetch x3 on / returned 200 with unchanged homepage content. Daily exploratory check: /reschedule returned 200 with 'Reschedule Appointment' content.

## QA-WEB-AH-002 - High - AUTOMATION-HEALTH: Browser control-plane timeout during booking Step 2 -> Step 3 transition
- **Category**: AUTOMATION-HEALTH (control-plane, not app-logic)
- **Area**: OpenClaw browser control service during mandatory E2E on /?staffId=stf_kevin#book
- **Repro steps**:
  1. Open booking URL in controlled browser session.
  2. Click **Find available slots** (Step 1 -> Step 2).
  3. Select an available slot.
  4. Click **Continue** to move to Step 3.
- **Expected**: Browser action completes and flow advances to Contact step.
- **Actual**: Browser control service timed out at action call.
- **Error signature**: Can't reach the OpenClaw browser control service (timed out after 20000ms).
- **Failure domain**: control-plane
- **Status**: Open

---
RUN_TS: 2026-02-20T05:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-002
NEW_IDS_ADDED: QA-WEB-AH-002
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Find available slots -> slot selected). Control-plane failed when clicking Continue at Step 2 with error signature Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e288 Continue). Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T06:03:00-08:00
LAST_TICKET_ID: QA-WEB-AH-002
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Find available slots -> slot selected). Control-plane failure reproduced on Step 2 Continue with same signature as existing QA-WEB-AH-002: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e288 Continue). Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

## QA-WEB-AH-003 - Medium - AUTOMATION-HEALTH: Browser action ref/session desync blocks Step 1 interaction
- **Category**: AUTOMATION-HEALTH (control-plane, not app-logic)
- **Area**: OpenClaw browser control action dispatch on booking page /?staffId=stf_kevin#book
- **Repro steps**:
  1. Open controlled browser tab to booking URL.
  2. Capture snapshot successfully (Step 1 visible with Find available slots).
  3. Execute click action on Step 1 CTA using snapshot ref.
- **Expected**: Click executes and flow moves to Step 2.
- **Actual**: Browser control rejects action with ref/session desync style error.
- **Error signature**: Can't reach the OpenClaw browser control service ... Unknown ref "e99". Run a new snapshot and use a ref from that snapshot.
- **Failure domain**: control-plane
- **Status**: Open

---
RUN_TS: 2026-02-20T07:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: QA-WEB-AH-003
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP1_ACTION_DISPATCH
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open + snapshot succeeded at Step 1). Step 1 click action failed with control-plane ref/session desync signature: Can't reach the OpenClaw browser control service ... Unknown ref "e99". Repro step: browser act(click ref=e99) immediately after snapshot. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T08:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e288 Continue). Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T09:03:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e288 Continue). Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T10:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e303 Continue) after selecting slot ref=e148. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T11:03:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e316 Continue) after selecting slot ref=e148. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T12:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e155 Continue) after selecting slot ref=e160. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T13:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e155 Continue) after selecting slot ref=e160. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T14:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T04:07:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e311 Continue) after selecting slot ref=e148. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T14:35:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T14:34:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP3_CONTACT_FORM
FAILURE_DOMAIN: control-plane (false-negative timeout on action ack)
COVERAGE_EVIDENCE: Reproduced Step2 Continue timeout signature (`Can't reach the OpenClaw browser control service (timed out after 20000ms)`) twice while driving /?staffId=stf_kevin#book with browser actions. In both cases, immediate same-target snapshot showed flow had already advanced to Step3 contact form. Confirms automation/control-plane response timeout rather than booking UI/app failure.
MITIGATION_NOTES: Use one tab targetId end-to-end, snapshot before critical actions, and on timeout verify state with same-target snapshot before declaring failure. See docs/openclaw-step2-timeout-runbook.md.

---
RUN_TS: 2026-02-20T15:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T14:34:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e155 Continue) after selecting slot ref=e160. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.

---
RUN_TS: 2026-02-20T16:04:00-08:00
LAST_TICKET_ID: QA-WEB-AH-003
NEW_IDS_ADDED: NONE
LAST_SUCCESSFUL_E2E_TS: 2026-02-20T14:34:00-08:00
E2E_ATTEMPTED: YES
E2E_STEP_REACHED: STEP2_CONTINUE_ACTION
FAILURE_DOMAIN: control-plane
COVERAGE_EVIDENCE: Mandatory real-browser E2E attempted on /?staffId=stf_kevin#book (open -> Step1 Find available slots -> Step2 slot selected). Control-plane failure reproduced on Step 2 Continue with existing QA-WEB-AH-002 signature: Can't reach the OpenClaw browser control service (timed out after 20000ms). Repro step: browser act(click ref=e155 Continue) after selecting slot ref=e160. Additional website passes: web_fetch x3 on /, /?qa_pass=2, /?qa_pass=3 all HTTP 200 with unchanged homepage content.
