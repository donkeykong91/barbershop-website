# Agent Story Tracking

## 2026-02-20 — Sen — Booking Confirm Failure Round 11 (runtime trace enablement after Round 10 still failing live)

- [x] Re-verified post-deploy of Round 10 commit and confirmed live failure persists:
  - `POST /api/v1/bookings/holds/` => `201`
  - `POST /api/v1/bookings/` => `500 INTERNAL_ERROR`
- [x] Added explicit server-side error logging at booking API catch boundary (no request-body/PII), to expose exact runtime error message for `/api/v1/bookings` in Vercel logs.
- [x] Ran targeted test, lint, and build before redeploy.
- [ ] Pending after deploy: capture new concrete runtime error line and implement final targeted fix.

## 2026-02-20 — Sen — Booking Confirm Failure Round 10 (legacy booking status-constraint compatibility)

- [x] Reproduced current live failure with production-like confirm flow and trailing-slash path:
  - `POST /api/v1/bookings/holds/` => `201` (hold created)
  - `POST /api/v1/bookings/` => `500 INTERNAL_ERROR` (`Unable to create booking at this time`)
- [x] Identified high-probability root cause from code + runtime behavior:
  - booking insert hard-coded status `'confirmed'`.
  - legacy production schemas may still enforce uppercase `BOOKED` status via `bookings.status` CHECK constraint, which causes hard insert failure and bubbles as generic `500`.
- [x] Implemented secure, minimal-risk fix:
  - booking create now introspects live `bookings` table DDL and selects persisted confirmed value compatibly:
    - modern schema => `'confirmed'`
    - legacy-only schema => `'BOOKED'`
  - API/domain response remains normalized to `confirmed`; conflict protections unchanged.
- [x] Added/expanded regression tests for:
  - false-failure path: legacy `BOOKED`-only schema now succeeds.
  - genuine conflict path: `SLOT_UNAVAILABLE` still blocked.
- [x] Ran required checks:
  - targeted tests ✅
  - lint ✅ (existing warning-only console lint in repo)
  - build ✅

## 2026-02-20 — Sen — Booking Confirm Failure Round 9 (blocked by missing production error visibility)

- [x] Re-verified after latest deploy (`4c78f52`) with deterministic live flow script.
- [x] Result remains:
  - `POST /api/v1/bookings/holds/` => `201`
  - `POST /api/v1/bookings/` => `500 INTERNAL_ERROR` (`Unable to create booking at this time`)
- [ ] Root-cause pinpointing on live is currently blocked by missing server-side error visibility.
  - Public API response intentionally masks exception details.
  - Without Vercel function logs (or direct Turso query access), we cannot identify the exact failing SQL/error branch still causing 500.

### Blocking next action for Kevin
1. Provide Vercel runtime logs for `/api/v1/bookings/` around one failing request (exact stack/error message).
2. Or provide read access / schema dump for production Turso DB (`.schema` for `bookings`, `booking_access_tokens`, `booking_notifications`, `customers`, `booking_holds`, `rate_limit_windows`).
3. After one of the above, I can implement a targeted final fix quickly.

## 2026-02-20 — Sen — Booking Confirm Failure Round 8 (`POST /api/v1/bookings` transaction begin compatibility hardening)

- [x] Investigated persistent live `500` after notification isolation.
- [x] Added defensive transaction compatibility fallback for production DB engines:
  - booking writes now try `BEGIN IMMEDIATE`, and automatically fall back to `BEGIN` only for known transaction-start compatibility errors.
  - preserves rollback semantics and conflict checks.
- [x] Added regression test for `BEGIN IMMEDIATE` fallback path.
- [x] Re-ran targeted tests, lint, and build.

### Validation
- `npm test -- src/features/bookings/repository.createBooking.test.ts --runInBand` ✅
- `npm run lint` ✅ (existing repo warnings only)
- `npm run build` ✅

## 2026-02-20 — Sen — Booking Confirm Failure Round 7 (`POST /api/v1/bookings` still 500; transaction side-effect isolation)

- [x] Narrowed live behavior with deterministic API probing:
  - hold create succeeds (`201`) and booking confirm still returns `500`.
  - immediate manual `DELETE` on hold id still returns `204`, indicating confirm did not release hold and likely failed before post-confirm release step.
- [x] Identified remaining high-probability failure surface in booking write path:
  - notification queue insert ran inside booking transaction and could still abort confirm on legacy-notification schema issues.
  - this side effect is non-critical and should not block confirmed booking creation.
- [x] Implemented secure reliability fix:
  - moved `queueConfirmationNotifications` out of transaction commit path.
  - booking create now commits after core booking + access token writes, then queues notifications as best-effort with defensive logging.
  - retained all conflict/hold/security controls (no 409 bypasses).
- [x] Added regression test proving notification queue failures post-commit no longer fail booking creation.
- [x] Ran targeted tests + lint + build.

### Validation
- `npm test -- src/features/bookings/repository.createBooking.test.ts src/pages/api/v1/bookings/index.test.ts --runInBand` ✅
- `npm run lint` ✅ (existing repo warnings only)
- `npm run build` ✅

## 2026-02-20 — Sen — Booking Confirm Failure Round 6 (`POST /api/v1/bookings` live 500 persisted after first patch)

- [x] Re-tested live after Round 5 deploy and confirmed failure persisted:
  - deterministic API flow still returned `POST /api/v1/bookings/` => `500 INTERNAL_ERROR`.
- [x] Found secondary root cause in Round 5 fix implementation:
  - schema column self-heal attempted parallel `ALTER TABLE` operations for multiple missing columns.
  - SQLite DDL must be serialized; parallel alters can fail and still surface generic booking error.
- [x] Implemented correction:
  - changed missing-column migrations to execute sequentially in deterministic order.
  - retained all prior validation/conflict/hold protections.
- [x] Re-ran targeted checks (`repository.createBooking`), lint, and production build.

### Validation
- `node scripts/live-booking-check.mjs` ✅ still reproduced pre-Round-6 live failure (`holds: 201`, `bookings: 500`) before this iteration’s code change.
- `npm test -- src/features/bookings/repository.createBooking.test.ts --runInBand` ✅
- `npm run lint` ✅ (existing repo warnings only)
- `npm run build` ✅

## 2026-02-20 — Sen — Booking Confirm Failure Round 5 (`POST /api/v1/bookings` live 500)

- [x] Reproduced live failure deterministically against production endpoint sequence (`services` → `availability` → `holds` → final confirm):
  - `POST /api/v1/bookings/holds/` returned `201` with hold id.
  - `POST /api/v1/bookings/` returned `500 INTERNAL_ERROR` with `Unable to create booking at this time`.
- [x] Identified likely schema-drift root cause still unhandled in booking transaction path:
  - `booking_notifications` and `booking_access_tokens` existence checks did not repair missing required columns on legacy tables.
  - `CREATE TABLE IF NOT EXISTS` alone is insufficient when table exists but has drifted columns.
- [x] Implemented secure, minimal-risk fix:
  - added generic pre-transaction column self-heal helper (`PRAGMA table_info` + targeted `ALTER TABLE ADD COLUMN`) for booking write-support tables.
  - ensured `booking_notifications` critical columns (`status`, `payload`, `created_at`) and `booking_access_tokens` (`token_hash`, `created_at`, `updated_at`) are repaired before transaction begins.
  - preserved existing slot-conflict/hold validation and 409 protections.
- [x] Added regression coverage to assert missing-column self-heal executes before transactional booking writes.
- [x] Ran targeted tests, lint, and production build.

### Validation
- `node scripts/live-booking-check.mjs` ✅ reproduced pre-fix live error (`holds: 201`, `bookings: 500`).
- `npm test -- src/features/bookings/repository.createBooking.test.ts src/pages/api/v1/bookings/index.test.ts --runInBand` ✅
- `npm run lint` ✅ (existing repo warnings only)
- `npm run build` ✅

### Notes
- Browser tool verification became unavailable mid-run due browser control service timeout; API-level deterministic verification was used for this iteration.

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
