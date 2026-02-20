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

## 2026-02-20 — Sen — Booking Confirm Failure Round 3 (`Unable to create booking at this time`)

- [x] Reproduced remaining failure path aligned to user flow (`POST /api/v1/bookings` final confirm): repository write path can still fail hard on partially migrated DB schema before API can return success.
- [x] Identified true remaining failure points:
  - missing `booking_notifications` table/index in legacy production schema can fail notification queue insert during booking transaction.
  - missing `booking_access_tokens` table/index in legacy production schema can fail access-token insert during booking transaction.
- [x] Implemented secure, low-regression fix:
  - added pre-transaction schema guards in booking write path to ensure `booking_notifications` + `booking_access_tokens` tables/indexes exist before transactional inserts.
  - retained existing transaction + rollback behavior; no relaxation of validation, rate limits, hold checks, or auth surface.
- [x] Added regression coverage that fails on prior implementation and passes after fix.
- [x] Ran targeted tests, lint, and build.

### Validation
- `npm test -- src/features/bookings/repository.createBooking.test.ts src/pages/api/v1/bookings/index.test.ts` ✅
- `npm run lint` ✅ (existing repo warnings only)
- `npm run build` ✅

### Notes
- This closes another legacy-schema production trap that could still surface as generic booking creation failure.

## 2026-02-20 — Sen — Booking Confirm False 409 Round 4 (`POST /api/v1/bookings`)

- [x] Reproduced the false-409 confirm path in production-like inputs: valid hold can be rejected with `409 HOLD_MISMATCH` when hold timestamps include a timezone offset (`-08:00`) while confirm payload is normalized to `Z`.
- [x] Identified root cause: hold/confirm comparison used raw string equality for timestamps instead of instant equality, causing equivalent moments to be treated as different.
- [x] Implemented secure, minimal-risk fix:
  - normalized hold-vs-confirm slot checks to compare parsed instants (`Date` epoch ms) instead of raw string formatting.
  - preserved strict checks for `serviceId` and `staffId`, and left all existing availability/hold-expiry/conflict behavior intact.
- [x] Added/expanded regression tests for both:
  - false 409 case (offset timestamp hold now confirms successfully).
  - genuine conflict case (`SLOT_TAKEN`) still blocks booking and does not proceed to hold validation/booking create.
- [x] Ran targeted tests, lint, and production build.

### Validation
- `npm test -- src/pages/api/v1/bookings/index.test.ts --runInBand` ✅
- `npm run lint` ✅ (existing repo warnings only)
- `npm run build` ✅

### Notes
- This directly addresses final-confirm false conflicts without weakening intended overlap/conflict protections.
