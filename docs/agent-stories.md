# Agent Story Tracking

## 2026-02-20 — Sen — Booking Step 5 Confirm Failure (`Unable to create booking at this time`)

- [x] Reproduced failure path in production-like conditions: booking can be persisted, then request still returns `500 INTERNAL_ERROR` if post-create side effects fail.
- [x] Confirmed root causes:
  - legacy `booking_legal_consents` schema drift (missing newer consent columns) can break consent insert.
  - missing `booking_lifecycle_events` table can break post-confirm event logging.
  - both failures previously bubbled as user-facing booking confirm failure.
- [x] Implemented secure/reliability fixes:
  - legal-consent self-heal now handles missing-column drift (not just missing table).
  - lifecycle-event logging now self-heals missing table/index and retries.
  - final booking API now returns success once booking is committed, with defensive error logging for non-critical post-create side effects.
- [x] Added/expanded regression tests covering these failure modes.
- [x] Ran targeted tests, lint, and production build.

### Validation
- `npm test -- src/pages/api/v1/bookings/index.test.ts src/features/bookings/repository.legalConsent.test.ts src/features/bookings/v2Repository.lifecycle.test.ts` ✅
- `npm run lint` ✅ (existing repo warnings only)
- `npm run build` ✅

### Notes
- This prevents ghost-failure UX where users see booking failure after successful booking persistence.
- Added schema self-healing keeps compatibility with partially migrated/legacy production databases.
