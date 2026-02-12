# Code Bugs — Initial QA Pass

Date: 2026-02-12 (PST)
Reviewer: Kamaji (QA)
Scope: v1 stories/AC validation + functional API checks (scheduler dependencies, availability, booking create/retrieve/cancel, admin auth behavior)

## Ticket KBW-QA-001
- **Severity:** High
- **Story reference:** C2 — Cancel Booking (Policy-Aware), API auth conventions in `docs/api-schema.md`
- **Title:** Booking cancellation endpoint allows unauthenticated cancellation by booking ID
- **Repro steps:**
  1. Create booking via `POST /api/v1/bookings/` and capture returned `bookingId` (token not needed for repro after this point).
  2. Call `POST /api/v1/bookings/{bookingId}/cancel/` **without** `x-booking-access-token`, `Authorization`, or any other auth header.
  3. Observe response `200` and booking status changes to `cancelled`.
- **Expected:**
  - Cancellation should require booking-level authorization (same model as protected booking retrieval) so only an authorized customer can cancel.
  - Unauthenticated request should fail with `401 UNAUTHORIZED`.
- **Actual:**
  - Endpoint cancels booking with only `bookingId` and no auth token.
- **Affected files/routes:**
  - Route: `POST /api/v1/bookings/[bookingId]/cancel`
  - File: `src/pages/api/v1/bookings/[bookingId]/cancel.ts`
  - Related auth/repo logic: `src/features/bookings/repository.ts`, `src/pages/api/v1/bookings/[bookingId].ts`
- **Fix recommendation:**
  - Enforce booking access token on cancel route (accept same token sources as GET booking detail: `x-booking-access-token`, bearer token, or query fallback if retained).
  - Verify token before invoking `cancelBooking` and return `401` (missing) / `403` (invalid).
  - Add regression tests for cancel auth cases.
- **Status:** Closed
- **Retest notes (Kamaji, 2026-02-12 PST):**
  - Verified unauthenticated `POST /api/v1/bookings/{bookingId}/cancel/` returns `401 UNAUTHORIZED`.
  - Verified invalid token via `x-booking-access-token: invalid-token` returns `403 FORBIDDEN`.
  - Verified valid booking access token successfully cancels an allowed booking with `200` and `status: cancelled`.
  - Verified cancellation policy enforcement remains active after auth fix: repeat cancel on an already-cancelled booking returns `409 CONFLICT` (`BOOKING_NOT_CANCELLABLE` behavior).
  - Retest booking IDs used: `21cfcbbc-bcc6-4b82-9347-92839fa99538`, `22f138d1-a559-4483-8ed9-1368567b928e`.
- **Implementation notes (Sen):**
  - Added booking token extraction to `POST /api/v1/bookings/{bookingId}/cancel` using the same accepted sources as protected booking retrieval (`x-booking-access-token`, `Authorization: Bearer`, `accessToken` query).
  - Added explicit auth enforcement before cancellation logic:
    - Missing token -> `401 UNAUTHORIZED`
    - Invalid token -> `403 FORBIDDEN`
  - Left existing cancellation policy behavior untouched (`BOOKING_NOT_CANCELLABLE` and `CANCELLATION_CUTOFF_REACHED` still return `409`, and successful cancellation still returns booking `id` + `status`).

## Ticket KBW-QA-002
- **Severity:** High
- **Story reference:** A3 — Scheduler slot selection UX/business-hours constraints
- **Title:** Step 2 time-slot picker shows AM-only options instead of full 9:00 AM–5:00 PM shop window
- **Reported by:** Kevin (2026-02-12 PST)
- **Repro steps:**
  1. Open booking flow and proceed to Step 2 (time selection).
  2. Select a service/day and load available slots.
  3. Observe returned options are only morning (AM) times.
- **Expected:**
  - Time slots should be offered only within shop hours, **9:00 AM through 5:00 PM**, for each day.
  - Midday/afternoon options must be present where capacity exists.
- **Actual:**
  - UI currently presents AM-only slot options on Step 2.
- **Affected area:**
  - Scheduler step 2 availability generation/rendering (API + template integration).
- **Fix request:**
  - Sen to enforce daily slot generation bounds to 9:00 AM–5:00 PM local shop time and ensure UI reflects those slots correctly.
  - Add/adjust regression coverage (Jest + Playwright) for slot range behavior.
- **Status:** Closed
- **Implementation notes (Sen, 2026-02-12 PST):**
  - Root cause was in availability slot generation using UTC day/minute math (`getUTCDay` + `setUTCMinutes`) against `*_time_local` values. This shifted local business windows and surfaced AM-skewed slots in Step 2.
  - Fixed API generation in `src/features/availability/repository.ts` to build slots by local shop calendar date (`America/Los_Angeles` from business-hours config), then convert local slot times to UTC safely before overlap/range checks.
  - Enforced Step 2 rendering bounds in `src/templates/Scheduler.tsx` with a defensive local-time filter so displayed slots are only within 9:00 AM–5:00 PM shop time.
  - Kept booking/payment/security behavior unchanged (cash-only copy/flow unchanged; booking token/auth logic untouched).
- **Regression coverage added/updated:**
  - Jest: `src/features/availability/repository.test.ts` validates daily generated slots stay bounded within 9:00 AM–5:00 PM PT.
  - Jest: `src/templates/Scheduler.test.tsx` validates Step 2 displays in-range slots including afternoon availability (not AM-only).
  - Playwright: `e2e/scheduler-a11y.spec.ts` includes API-level slot-range assertion plus `step 2 shows 9:00 AM–5:00 PM range with afternoon slots (not AM-only)`.
- **Retest notes (Sen, 2026-02-12 PST):**
  - `npm run test:jest -- src/features/availability/repository.test.ts src/templates/Scheduler.test.tsx` ✅ (2 suites, 4 tests passed).
  - `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ (5 tests passed).
  - Confirmed Step 2 now shows both morning and afternoon options within shop-time bounds and excludes out-of-range entries.

## Ticket KBW-QA-003
- **Execution log (2026-02-12 09:06 PST, Sen):** Status set to In Progress; started staff-option normalization verification + duplicate fallback regression retest.
- **Execution log (2026-02-12 09:08 PST, Sen):** Verification complete; status set to Closed.
- **Severity:** Medium
- **Story reference:** EPIC A cross-step booking flow (Step 1 staff preference reliability)
- **Title:** Staff preference control can render duplicate pseudo-options when API returns an `any` row
- **Repro steps:**
  1. Ensure `/api/v1/staff` includes a record whose id/name maps to `any` (or equivalent synthetic "Any barber" row).
  2. Open booking flow Step 1 and inspect **Preferred barber** select.
  3. Observe `Any barber` appears more than once.
- **Expected:**
  - Exactly one `Any barber` option should appear.
  - Staff options should be de-duplicated and normalized before render.
- **Actual:**
  - Step 1 can show duplicate fallback options, increasing mis-selection risk and visual noise.
- **Affected files/routes:**
  - `src/templates/Scheduler.tsx` (`selectableStaff` construction)
  - `GET /api/v1/staff`
- **Fix recommendation:**
  - Normalize staff list in scheduler before prepend:
    1) remove/ignore incoming `id === 'any'` staff rows,
    2) dedupe by `id`,
    3) optionally filter inactive staff for customer flow.
  - Add Jest coverage for duplicate/stale staff payload normalization.
- **Execution log (2026-02-12 09:05 PST, Sen):** Status set to In Progress; started Step 1 staff option normalization fix.
- **Status:** Closed
- **Implementation notes (Sen, 2026-02-12 PST):**
  - Normalized Scheduler Step-1 `selectableStaff` composition in `src/templates/Scheduler.tsx`:
    1) ignore upstream pseudo/fallback rows (`id === 'any'` or `displayName === 'Any barber'`),
    2) filter inactive members (`active === false` excluded),
    3) de-duplicate by normalized staff id,
    4) prepend exactly one UI-owned fallback option (`Any barber`).
- **Retest notes (Sen, 2026-02-12 PST):**
  - Jest: `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx` ✅ (8/8 passed; includes duplicate Any-barber regression).
  - Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts --grep "preferred barber list de-duplicates Any barber fallback and uses unique scheduler control id"` ✅ (1/1 passed).
  - Verified Step 1 Preferred barber now renders one `Any barber` option plus unique active staff only.

## QA AC/Flow Audit Snapshot
- **AC checks passed:** A2, A3, A4, A5, B1, C1 (queue/payload behavior), D1, D2
- **AC checks failed:** C2 security expectation not met in implementation (unauthenticated cancel path)
- **Tickets opened:** 1 (KBW-QA-001)
- **Release recommendation:** **UNBLOCKED** (KBW-QA-001 retest passed; no open blocker from this ticket)
