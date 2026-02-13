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

- Jest command: `npm run test:jest -- --runInBand --silent`
- Playwright command(s): `npm run test:playwright -- e2e/scheduler-a11y.spec.ts`
- Result summary: pending execution in this pass.
