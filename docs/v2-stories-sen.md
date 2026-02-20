# Kevin Barbershop — V2 Story Pack for Sen

Date: 2026-02-13  
Owner: Project Manager (Ricky Bobby)  
Execution Agent: Sen  
Related context: `docs/v1-stories.md`, `docs/UX-Stories.md`, booking/payment flow direction (cash-at-shop)

---

## V2 Goal

Ship the next set of production-ready stories that extend the current booking experience with:
- stronger booking reliability,
- cleaner customer communication,
- operational readiness for the shop,
- no regression to cash-at-shop policy.

---

## Guardrails (must hold across all V2 stories)

1. **Cash-at-shop remains unchanged** (no online charge capture in customer flow).
2. **Security-first implementation**: input validation, auth checks, and no secret leakage in logs/UI.
3. **Accessibility parity**: keyboard path + screen-reader labels for all new UI.
4. **No template leftovers** in customer-facing booking flow.

---

## Implementation Status Checklist (Sen)

- [x] **E1 — Appointment Hold Timer During Final Confirmation**  
  **Implemented:** `booking_holds` table, hold create/refresh/release API (`/api/v1/bookings/holds`), booking create now enforces valid hold and rejects expired/mismatched holds (`HOLD_EXPIRED`, `HOLD_MISMATCH`, `HOLD_REQUIRED`).  
  **Verification:** Jest `src/pages/api/v1/bookings/index.test.ts` includes hold-expiry rejection coverage.

- [x] **E2 — One-Tap Reschedule Link for Existing Booking**  
  **Implemented:** signed/hashed expiring action tokens (`booking_action_tokens`), token issue endpoint (`/api/v1/bookings/[bookingId]/actions`), reschedule endpoint (`/api/v1/bookings/[bookingId]/reschedule`), basic self-serve page (`/reschedule`), booking lifecycle event logging.

- [x] **E3 — Booking Conflict Recovery UX**  
  **Implemented:** `SLOT_TAKEN` + alternatives contract already active in booking API and scheduler UI.

- [x] **F1 — Branded Confirmation + Reminder Sequence**  
  **Implemented:** centralized versioned messaging templates in `src/features/bookings/messaging.ts`; reminder offset logic (24h default, 2h near-term fallback), queue hook scaffold + lifecycle logging for queued reminders.

- [x] **F2 — Customer Self-Cancel with Cutoff Enforcement**  
  **Implemented:** secure cancel token support via shared action token framework, idempotent cancel behavior, existing cutoff enforcement retained, cancellation lifecycle logging.

- [x] **G1 — Staff Day-Off / Blackout Management**  
  **Implemented:** `blackout_windows` table, blackout CRUD admin API (`/api/v1/admin/blackouts`), availability engine excludes blackout-overlap slots, conflict rejection when blackout overlaps existing bookings.

- [x] **G2 — Daily Schedule Export (CSV)**  
  **Implemented:** authenticated CSV export endpoint (`/api/admin/bookings/export?date=YYYY-MM-DD`) with deterministic sort and streamed response writes.

- [x] **H1 — Booking API Abuse Shield (IP + fingerprint throttling)**  
  **Implemented:** existing dual IP + fingerprint limiters on availability/booking submit retained; machine-readable 429 payload and retry metadata already present.

- [x] **H2 — Admin Surface Session Hardening**  
  **Implemented:** cookie-backed admin session model (`admin_sessions`), secure/httpOnly/sameSite cookie, idle + absolute timeout checks, login/logout session endpoints, immediate revocation on logout, admin guard accepts valid session uniformly.

---

## Migration / Env / Config Notes

- Added migration: `db/migrations/009_v2_reliability_ops_security.sql`
  - `booking_holds`
  - `booking_lifecycle_events`
  - `booking_action_tokens`
  - `blackout_windows`
  - `admin_sessions`
- New env knobs:
  - `BOOKING_HOLD_MINUTES`
  - `BOOKING_RESCHEDULE_TOKEN_TTL_MIN`
  - `BOOKING_CANCEL_TOKEN_TTL_MIN`
  - `REMINDER_OFFSET_HOURS`
  - `REMINDER_NEAR_TERM_OFFSET_HOURS`
  - `ADMIN_SESSION_IDLE_MIN`
  - `ADMIN_SESSION_ABSOLUTE_MIN`

---

## Validation Log (to be kept current)

- Pass date/time: 2026-02-13 (America/Los_Angeles)
- Jest command: `npm run test:jest -- --runInBand --silent`
  - Result: **PASS**
  - Suites: **17 passed, 0 failed**
  - Tests: **50 passed, 0 failed**
- Playwright command(s): `npm run test:playwright -- e2e/scheduler-a11y.spec.ts`
  - Result: **PASS**
  - Specs: **13 passed, 0 failed**
- Result summary: V2 validation gate commands for this pass are green.

---

## Stabilization Addendum (2026-02-14, Sen)

- **Status transition:** `STABILIZATION_IN_PROGRESS` → `STABILIZATION_PASS`
- **Scope:** Reliability/security regression stabilization before resuming story completion.
- **Fixes shipped in this pass:**
  1. Added Playwright `webServer` bootstrap in `playwright.config.ts` to eliminate connection-refused flakes when local server is not pre-started.
  2. Updated stale E2E flow assumptions after slot auto-advance (removed outdated `Continue` clicks; added Step-3 assertions and required-consent path checks).
  3. Hardened cancel endpoint unauthorized semantics (`401` when no accepted token source is present; `403` reserved for invalid/expired presented token).
  4. Reduced Jest flake/noise around state-update timing in scheduler tests by wrapping state-triggering focus/timer operations in `act(...)`.
- **Stabilization validation commands:**
  - `npm run test:jest -- --runInBand --ci --silent` → ✅ 17 suites / 52 tests passed
  - `npm run test:playwright -- --reporter=line` → ✅ 20/20 passed
- **Next action:** Resume active story completion queue immediately after this stabilization checkpoint.

## QA Reliability Follow-up (2026-02-20, Sen)

- Investigated Step-5 booking confirm error (`Unable to create booking at this time`) tied to legal-consent persistence fallback edge cases.
- Added error-signature hardening for schema-qualified SQLite missing-table messages in `logBookingLegalConsent`.
- Expanded regression coverage to include:
  - schema-qualified missing-table self-heal path (`main.booking_legal_consents`), and
  - successful final confirm API path assertions (`POST /api/v1/bookings` → `201`, consent logging invoked, hold released).
- Validation run:
  - `npm run test:jest -- src/features/bookings/repository.legalConsent.test.ts src/pages/api/v1/bookings/index.test.ts --runInBand` → ✅ PASS

## Story Completion Continuation (post-stabilization)

- **Status:** `READY_FOR_STORY_EXECUTION` → `BLOCKED_PENDING_PRIORITY`
- **Blocker:** V2 story checklist in this file is already fully checked; remaining story backlogs in repo are large legacy checklists (`docs/admin-stories.md`) without prioritized "next story" assignment for this execution cycle.
- **Mitigation attempted:**
  1. Scanned docs for open checklist items.
  2. Confirmed no active V2 story remains unchecked in current execution brief.
  3. Prepared to start the next highest-priority story immediately once PM assigns target story ID (or confirms first open item in `docs/admin-stories.md` should be taken).


