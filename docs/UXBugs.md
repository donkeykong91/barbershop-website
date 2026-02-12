# UX Bugs - Initial QA Pass

Date: 2026-02-12
Auditor: Totoro (UX)

Scope reviewed:
- Customer journey: service selection → slot search → contact → summary → confirmation
- Exposed admin surfaces in current build (none found in customer-facing UI; only admin APIs are present)

---

## UX-001
**Severity:** High
**Story/Epic:** EPIC A / Story A3 - Select Date/Time Slot

**UX issue summary + repro:**
When availability returns zero slots, the UI shows `0 found` but does not present a clear empty-state explanation or next actions.
Repro: Step 1 → select a service/staff combination with no availability in next 7 days → click **Find available slots**.

**Expected vs actual:**
- **Expected:** User sees a clear empty state with actionable options (change service, change barber, widen date range, contact shop).
- **Actual:** User sees a sparse slot panel with `0 found`, no guidance, and a disabled forward path.

**Proposed design solution (mandatory):**
Add a dedicated empty-state card in Step 2 when `slots.length === 0` with:
1) Clear message: "No appointments available in the next 7 days."
2) Action buttons: "Try another barber", "Choose a different service", "Search next 14 days", and "Call the shop".
3) Optional helper text explaining that popular times fill quickly.

**Implementation notes for Sen:**
- In `src/templates/Scheduler.tsx`, add conditional render for empty state inside Step 2.
- Add a `rangeDays` state (default 7) and expose quick toggles (7/14 days).
- Add links/buttons to route user back to Step 1 with focus on relevant field.

**Status:** Fixed (Ready for Retest)

**Sen notes:** Added Step-2 empty-state card, helper copy, and actions for barber/service change plus 14-day re-search. Added `rangeDays` (7/14) controls and focus handoff back to relevant Step-1 fields. Completed the remaining CTA gap by wiring **Call the shop** to `href={`tel:${AppConfig.shopPhoneE164}`}` with accessible labeling including the display number.

**Retest evidence (2026-02-12, Sen):**
- ✅ Empty-state card exists in Step 2 when no slots are returned (`slots.length === 0`) with clear copy and helper text.
- ✅ Action controls for "Try another barber", "Choose a different service", and "Search next 14 days" are present and wired.
- ✅ "Call the shop" now triggers a real phone affordance (`tel:+15551234567`) with accessible label context.
- **Result:** Fix complete; ticket is ready for QA retest.

**Retest evidence (2026-02-12, Totoro):**
- ✅ Verified in `Scheduler.tsx` that the empty-state card renders when `slots.length === 0`, with explicit no-availability messaging and helper copy.
- ✅ Verified Step-2 CTAs exist and are wired: barber focus handoff, service focus handoff, and `Search next 14 days` updates range + re-queries availability.
- ✅ Verified `Call the shop` uses `href={`tel:${AppConfig.shopPhoneE164}`}` with accessible label containing display number.
- ✅ Regression check passed via Jest (`Scheduler.test.tsx` + `Scheduler.a11y.test.tsx`): 2/2 suites passed, 5/5 tests.
- **Result:** Pass; ticket closed.

---

## UX-024
**Execution log (2026-02-12 08:46 PST, Sen):** Status set to In Progress.
**Severity:** Medium
**Story/Epic:** EPIC A / Rate-limit resilience in booking submit flow

**Execution log (2026-02-12, Sen):** Started 09:04 PST.

**Execution log (2026-02-12 08:32 PST, Sen):** Set status to In Progress and began ticket validation/retest.

**UX issue summary + repro:**
When booking creation is rate-limited (`429`), customer-facing flow does not provide actionable cooldown guidance (exact wait duration) and recovery is unclear under rapid retries.

**Repro steps (observed during 15-pass QA load):**
1. Trigger repeated booking submissions from same client identity within limiter window.
2. Receive `429 RATE_LIMITED` from `POST /api/v1/bookings/`.
3. Observe submit UX lacks explicit retry timing/cooldown guidance.

**Expected vs actual:**
- **Expected:** UI maps `429` to clear retry guidance (for example: "Too many attempts. Try again in 47s"), temporarily gates resubmit, and preserves form state.
- **Actual:** Error handling is too generic for confident user recovery from throttling.

**Proposed design solution (mandatory):**
1. Parse/show `Retry-After` when present.
2. Display cooldown timer and disable confirm CTA until expiry.
3. Keep user state intact (no forced re-entry).
4. Distinguish rate-limit errors from generic network failures.

**Implementation notes for Sen:**
- In `Scheduler.tsx` submit handler, branch on `429` and read `Retry-After`.
- Add countdown state in review/confirm action row.
- Reuse existing `apiError` live region with specific throttling copy.

**Status:** Closed

**Implementation notes (Sen, 2026-02-12):**
- Kept explicit `429` handling in booking submit flow with `Retry-After` parsing (seconds and HTTP-date format).
- Kept cooldown countdown state in the review/confirm action row; confirm CTA remains disabled during cooldown and button label reflects retry timer.
- Kept customer-entered state intact and used throttling-specific guidance in the existing `apiError` alert region.

**Retest evidence (2026-02-12, Sen):**
- Jest: `npm run test:jest -- src/templates/Scheduler.test.tsx src/templates/Scheduler.a11y.test.tsx` passed (2 suites, 10 tests).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts --grep "rate-limited booking submit shows retry countdown and disables confirm"` ✅ (1 passed).
---

## UX-022
**Severity:** High
**Story/Epic:** UXS-21 — Make reset-confirm dialog keyboard-complete (Esc + focus trap)

**Execution log (2026-02-12 08:28 PST, Sen):** Started implementation.
**Status:** Closed

**Implementation notes (Sen, 2026-02-12):**
- Reset confirmation dialog now supports initial safe focus on **Cancel**, trapped Tab/Shift+Tab loop, `Escape` close, and focus restoration to the reset trigger.

**Retest evidence:**
- Jest: `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx src/templates/Scheduler.test.tsx` ✅.
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ includes reset dialog keyboard behavior coverage.

**UX issue summary + repro:**
Reset confirmation dialog opens visually but lacks explicit Escape-close and focus-trap behavior, risking keyboard escape into page content behind modal.
Repro: Open Reset booking dialog and navigate with keyboard Tab/Shift+Tab/Escape.

**Expected vs actual:**
- **Expected:** Modal traps focus, supports Escape close, and restores focus to trigger.
- **Actual:** Only button-click close is guaranteed.

**Proposed design solution (mandatory):**
Add complete modal keyboard behavior (Escape, tab loop, initial safe focus, and restore focus).

**Implementation notes for Sen:**
- Add keydown handling and tab-cycle management for dialog controls.
- Set initial focus to Cancel (least destructive).
- Keep existing close behavior and trigger-focus restore.

---

## UX-023
**Execution log (2026-02-12 08:58 PST, Sen):** Status set to In Progress.
**Severity:** Low
**Story/Epic:** UXS-22 - Improve slot card information scent with explicit end time

**Execution log (2026-02-12 08:34 PST, Sen):** Set status to In Progress and started implementation.

**UX issue summary + repro:**
Slot cards emphasize a single formatted timestamp; end-time visibility is implicit rather than explicit, slowing confidence checks for users comparing adjacent windows.
Repro: Step 2 compare nearby slots and infer appointment end times.

**Expected vs actual:**
- **Expected:** Slot cards show explicit start-end time range.
- **Actual:** Users infer duration from service length or details elsewhere.

**Proposed design solution (mandatory):**
Display explicit local time range (start-end) on each slot card.

**Implementation notes for Sen:**
- Add time-range formatter using shop timezone.
- Keep earliest badge + staff line intact.
- Maintain current card density and tap-target size.

**Status:** Closed

**Implementation notes (Sen, 2026-02-12):**
- Slot cards now display explicit local time range (`Time: start-end`) using the shop-time formatter, while preserving earliest badge and staff detail lines.

**Retest evidence:**
- Jest: `npm run test:jest -- src/templates/Scheduler.test.tsx` ✅ (`shows explicit slot time range on slot cards`).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts --grep "slot cards display explicit start-end time range"` ✅ (1 passed).


---

## UX-025
**Execution log (2026-02-12 09:06 PST, Sen):** Status set to In Progress; began duplicate-ticket ID reconciliation for UX-025 across sections.
**Execution log (2026-02-12 09:08 PST, Sen):** Reconciliation complete; status set to Closed (normalized).
**Severity:** Medium
**Story/Epic:** EPIC A / Staff preference clarity in Step 1

**UX issue summary + repro:**
Step 1 **Preferred barber** can display duplicate fallback choices (for example, repeated `Any barber`) depending on staff payload shape.

**Repro steps:**
1. Load scheduler with a staff payload that already contains an `any` entry (or equivalent fallback record).
2. Open Step 1 and inspect **Preferred barber** list.
3. Observe duplicate fallback option(s).

**Expected vs actual:**
- **Expected:** One clear fallback option (`Any barber`) and one entry per actual barber.
- **Actual:** Duplicate fallback entries can appear, which degrades scannability and decision confidence.

**Proposed design solution (mandatory):**
- Normalize staff options before rendering: drop duplicate IDs and reserve fallback construction to UI only.
- Keep inactive/stale records out of customer picker.

**Implementation notes for Sen:**
- In `Scheduler.tsx`, sanitize `staff` list before creating `selectableStaff`.
- Add unit coverage for duplicate/fallback payloads.

**Execution log (2026-02-12 09:08 PST, Sen):** Status set to In Progress; started preferred-barber fallback de-duplication fix.
**Status:** Closed

**Implementation notes (Sen, 2026-02-12):**
- Normalized Step-1 Scheduler staff options in `src/templates/Scheduler.tsx` to prevent duplicate fallback choices:
  - dropped incoming pseudo-fallback rows (`any` / `Any barber`),
  - removed inactive staff,
  - de-duplicated by normalized id,
  - prepended exactly one UI fallback option (`Any barber`).
- Updated Scheduler preferred-barber control id to `booking-staff` so label targeting remains unambiguous while preserving existing section anchor ids.

**Retest evidence (Sen, 2026-02-12):**
- Jest: `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx` ✅ (8/8 passed; includes duplicate fallback + unique-id assertions).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts --grep "preferred barber list de-duplicates Any barber fallback and uses unique scheduler control id"` ✅ (1/1 passed).
- Manual verification: Scheduler Preferred barber list renders exactly `Any barber` + unique active barbers only for duplicate/injected fallback payloads.

**ID conflict resolution (2026-02-12, Sen):**
- Document contains two different `UX-025` entries.
- Latest timestamped execution log is in PASS 5 addendum (`2026-02-12 09:12 PST`) where `UX-025` refers to availability error-state separation and is Closed.
- Normalization applied: this earlier staff-fallback `UX-025` is treated as a legacy/duplicate-ID entry and mapped to the same implemented behavior tracked under `KBW-QA-003` and `A11Y-012`; PASS 5 `UX-025` remains canonical for the ID.

## UX Bugs � PASS 4 Remediation Addendum (Sen)

Date: 2026-02-12  
Executor: Sen

## UX-019
**Severity:** High  
**Status:** Closed

**Implementation:** Updated Step 2 slot list container to mobile-first page scrolling (`space-y-4 md:max-h-80 md:overflow-y-auto`) and kept desktop bounded list behavior.

**Retest evidence:**
- Jest: updated `src/templates/Scheduler.test.tsx` with `uses page-level scrolling on mobile for slot results`.
- Playwright: updated `e2e/scheduler-a11y.spec.ts` with `mobile slot results use page scroll instead of nested scrolling`.

## UX-022
**Severity:** High  
**Status:** Closed

**Implementation:** Reset confirmation dialog now supports full keyboard behavior: initial focus on Cancel, Tab/Shift+Tab focus loop, Escape close, and focus restore to reset trigger.

**Retest evidence:**
- Jest: reset dialog interaction coverage in `src/templates/Scheduler.test.tsx`.
- Playwright: updated `e2e/scheduler-a11y.spec.ts` with keyboard-trap + Escape + focus-restore test.

## UX-020
**Severity:** Medium  
**Status:** Closed

**Implementation:** Added explicit required indicators and persistent helper hints for first/last/email/phone with `aria-describedby` continuity and existing inline validation preserved.

**Retest evidence:**
- Jest: `shows required helper hints and corrected enter key hints on contact fields` in `src/templates/Scheduler.test.tsx`.
- Playwright: `contact fields expose required hints and mobile enter flow semantics` in `e2e/scheduler-a11y.spec.ts`.

## UX-021
**Severity:** Medium  
**Status:** Closed

**Implementation:** Corrected Enter-key hints to Next for first/last/email and Done for phone; kept Enter keydown progression wiring to next field/review flow.

**Retest evidence:**
- Jest + Playwright assertions included with UX-020 coverage above.

## UX-023
**Execution log (2026-02-12 08:58 PST, Sen):** Status set to In Progress.
**Severity:** Low  
**Status:** Closed

**Implementation:** Added explicit slot time range line on each card (`Time: <start>–<end>`) using shop-time formatter while keeping earliest badge/staff line.

**Retest evidence:**
- Jest: `shows explicit slot time range on slot cards` in `src/templates/Scheduler.test.tsx`.
- Playwright: `slot cards display explicit start-end time range` in `e2e/scheduler-a11y.spec.ts`.

---

## PASS 5 Addendum - 100 E2E UX passes (2026-02-12)

## UX-025
**Execution log (2026-02-12 08:56 PST, Sen):** Status set to In Progress.
**Execution log (2026-02-12 09:12 PST, Sen):** Verification complete; status set to Closed.
**Severity:** High
**Story/Epic:** UXS-24 - Split availability error state from true no-slots empty state

**UX issue summary:**
Availability transport/server failures currently landed in the same visual state as true empty availability (`No appointments available...`), creating decision ambiguity.

**Status:** Closed

**Implementation notes (Sen, 2026-02-12):**
- Added explicit Step-2 availability state handling (`loading`, `error`, `empty`, `success`) and separate `availabilityErrorMessage` rendering.
- Added a dedicated `Availability failed to load` panel with Retry, Back, and Call CTAs.
- Kept no-slots empty-state copy exclusive to successful zero-result responses and prevented error cases from presenting `0 found` semantics.

**Retest evidence (2026-02-12, Sen):**
- Jest: `npm run test:jest -- src/templates/Scheduler.test.tsx src/templates/Scheduler.a11y.test.tsx --silent` ✅ (includes `renders load-failed state separate from no-slots empty state`).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ (includes `availability load error state is distinct from no-slots empty state`).

## UX-027
**Execution log (2026-02-12 09:01 PST, Sen):** Status set to In Progress.
**Execution log (2026-02-12 09:13 PST, Sen):** Verification complete; status set to Closed.
**Severity:** High
**Story/Epic:** UXS-26 - Keyboard-complete radiogroup behavior for slot selection

**UX issue summary:**
Slot options used `role="radio"` cards without full keyboard radio interaction behavior (arrow navigation + roving tabindex), reducing keyboard efficiency.

**Status:** Closed

**Implementation notes (Sen, 2026-02-12):**
- Implemented roving `tabIndex` for Step-2 slot radio cards with a single tabbable option.
- Added Arrow Up/Down/Left/Right + Home/End keyboard handling on the radiogroup and synchronized focus + `aria-checked` selection behavior.
- Preserved pointer/tap selection behavior.

**Retest evidence (2026-02-12, Sen):**
- Jest: `npm run test:jest -- src/templates/Scheduler.test.tsx src/templates/Scheduler.a11y.test.tsx --silent` ✅ (includes `supports arrow-key slot radio navigation with roving tabindex`).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ (includes `slot picker supports arrow-key roving selection`).

## UX-026
**Execution log (2026-02-12 09:06 PST, Sen):** Status set to In Progress.
**Execution log (2026-02-12 09:14 PST, Sen):** Verification complete; status set to Closed.
**Severity:** Medium
**Story/Epic:** UXS-25 - Show explicit start-end time range in Review step summary

**UX issue summary:**
Review step showed only start timestamp for appointment time, requiring end-time inference from service duration.

**Status:** Closed

**Implementation notes (Sen, 2026-02-12):**
- Updated Step-4 review summary `Date/Time` to include explicit start-end time range using `formatShopTimeRange(slotStart, slotEnd)`.

**Retest evidence (2026-02-12, Sen):**
- Jest: `npm run test:jest -- src/templates/Scheduler.test.tsx src/templates/Scheduler.a11y.test.tsx --silent` ✅ (includes `shows explicit start-end time range in review summary`).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ (includes `review summary displays explicit slot time range`).

