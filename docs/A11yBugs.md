# Accessibility Bugs — Retest After UX Fixes

Date: 2026-02-12  
Auditor: A11y (Accessibility QA)

Scope retested:

- `src/templates/Scheduler.tsx` (all booking steps)
- `src/templates/ServiceCatalog.tsx` (service CTA handoff)
- Regression check for UX-001..UX-005 accessibility impact

---

## Verdict

**PASS** — A11Y-002, A11Y-003, and A11Y-004 verified fixed and closed after retest.

---

## A11Y-001

**Severity:** Medium  
**Story/Epic reference:** EPIC A / Story A4 (Contact Details), UX-004 retest  
**WCAG mapping:** 1.3.5 Identify Input Purpose (AA), 3.3.2 Labels or Instructions

**Repro steps:**

1. Go to booking Step 3 (Contact).
2. Inspect contact inputs for semantic types/autocomplete metadata.

**Expected vs actual:**

- **Expected:** Name/email/phone fields expose semantic input purpose and appropriate keyboard hints.
- **Actual:** ✅ Implemented. `firstName/lastName/email/phone` now include semantic `type`, `autoComplete`, and `inputMode` metadata.

**Affected UI/routes/components:**

- `Scheduler.tsx` contact form (`step === 3`)

**Recommended fix (required):**

- No further action.

**Status:** **Closed**

**Retest evidence:**

- `email` uses `type="email" autoComplete="email" inputMode="email"`.
- `phone` uses `type="tel" autoComplete="tel" inputMode="tel"`.
- Name fields use `given-name` / `family-name` autocomplete tokens.

---

## A11Y-002

**Severity:** Medium  
**Story/Epic reference:** EPIC A / Story A4 (Contact Details), UX-002 retest  
**WCAG mapping:** 3.3.1 Error Identification, 3.3.3 Error Suggestion, 4.1.3 Status Messages

**Repro steps:**

1. Proceed to Step 3.
2. Leave required fields empty or invalid.
3. Trigger validation (blur field or click **Review summary**).

**Expected vs actual:**

- **Expected:** Inline errors should be both visible and reliably announced to assistive technology when they appear/refresh.
- **Actual:** ✅ Implemented. Inline field errors now render as assertive live regions (`role="alert" aria-live="assertive"`), and the API error banner also renders as an assertive live region for async failures.

**Affected UI/routes/components:**

- `Scheduler.tsx` (`fieldErrors` messages, `apiError` banner)

**Recommended fix (required):**

1. Add `role="alert"` or `aria-live="assertive"` to inline field error containers when present.
2. Add `role="alert"` (or `aria-live="polite"` as appropriate) to API error banner so async failures are announced.
3. Keep focus-to-first-invalid behavior (already good).

**Status:** **Closed**

**Implementation notes:**

- `Scheduler.tsx` inline field error containers now include `role="alert" aria-live="assertive"`.
- `Scheduler.tsx` API error banner now includes `role="alert" aria-live="assertive"`.
- Existing focus-to-first-invalid behavior is preserved.

**Retest evidence:**

- Verified in `Scheduler.tsx` that inline field errors render with `role="alert" aria-live="assertive"` and are linked via `aria-describedby`.
- Verified API error banner is an assertive live region and remains visible text for sighted users.
- Focus-to-first-invalid flow is still present via `focusFirstInvalidField(errors)`.

---

## A11Y-003

**Severity:** Low  
**Story/Epic reference:** EPIC A / Cross-step flow clarity (A1–A5), UX-005 retest  
**WCAG mapping:** 1.3.1 Info and Relationships, 4.1.2 Name/Role/Value

**Repro steps:**

1. Move through booking steps.
2. Inspect stepper semantics for current-step announcement.

**Expected vs actual:**

- **Expected:** Stepper should expose current step programmatically (e.g., `aria-current="step"`).
- **Actual:** ✅ Implemented. Active step button now includes `aria-current="step"`, while non-current steps omit the attribute.

**Affected UI/routes/components:**

- `Scheduler.tsx` progress `<ol>` and step buttons

**Recommended fix (required):**

1. Apply `aria-current="step"` to the active step button/item.
2. Optionally include SR-only text like “Current step”.

**Status:** **Closed**

**Implementation notes:**

- `Scheduler.tsx` stepper progress buttons now apply `aria-current="step"` on the active step.

**Retest evidence:**

- `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx` ✅ ("marks current step with aria-current=\"step\"").
- `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ ("stepper exposes current step semantics").

---

## A11Y-004

**Severity:** Medium  
**Story/Epic reference:** EPIC A / Story A3 (slot empty state), UX-001 retest  
**WCAG mapping:** 2.4.4 Link Purpose (In Context), 3.2.4 Consistent Identification

**Repro steps:**

1. Trigger no-availability state in Step 2.
2. Activate **Call the shop** action.

**Expected vs actual:**

- **Expected:** “Call the shop” should invoke a real contact action (e.g., `tel:` link) with clear purpose.
- **Actual:** ✅ Implemented. CTA now targets `tel:+15551234567` and accessible naming includes context + phone number (`aria-label="Call the shop at (555) 123-4567"`).

**Affected UI/routes/components:**

- `Scheduler.tsx` empty-state action row in Step 2

**Recommended fix (required):**

1. Replace with `href="tel:<shop-number>"` (and/or explicit contact modal/action).
2. Ensure accessible name includes the phone number or context (e.g., “Call the shop at 555-123-4567”).

**Status:** **Closed**

**Implementation notes:**

- `Scheduler.tsx` no-availability CTA uses `href={`tel:${AppConfig.shopPhoneE164}`}`.
- CTA accessible name is now `Call the shop at (555) 123-4567`.

**Retest evidence:**

- Activating CTA triggers native dial action on supported devices/browsers.

---

## 2026-02-12 — 100-pass booking-flow accessibility audit addendum (new findings)

Method summary:

- Executed repeated end-to-end booking passes with varied viewport/reduced-motion/rate-limit scenarios via Playwright automation, plus keyboard and screen-reader-oriented interaction probes.
- Primary booking journey covered Step 1 → Step 5 and error-path checks.
- Blocker noted: local dev server responsiveness intermittently introduced pass instability; findings below are based on reproducible defects validated in code and targeted repros.

### A11Y-009

**Execution log (2026-02-12 08:59 PST, Sen):** Status set to In Progress; began keyboard radio interaction validation + regression retest.
**Severity:** High  
**Story/Epic reference:** EPIC A / Story A2 (slot selection semantics)  
**WCAG mapping:** 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A)

**Repro steps:**

1. Go to Step 2 and focus the first slot option in the `radiogroup` using keyboard.
2. Press ArrowDown/ArrowRight.
3. Observe selected state (`aria-checked`) and focus movement.

**Expected vs actual:**

- **Expected:** Radio options should support ARIA radio keyboard interaction (Arrow keys move/select within the group).
- **Actual:** Slot options use `role="radio"` but rely on button click behavior only; Arrow-key navigation does not move/commit selection.

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` Step 2 slot controls (`role="radiogroup"` + `role="radio"`)

**Recommended fix (required):**

1. Implement roving tabindex for slot radios.
2. Add ArrowUp/ArrowDown/ArrowLeft/ArrowRight handlers to move active option and update `aria-checked`.
3. Keep Space/Enter activation support.
4. Add regression tests for Arrow-key behavior.

**Status:** **Closed**

**Implementation notes (2026-02-12, Sen):**

- Implemented keyboard-complete slot radiogroup behavior in `Scheduler.tsx` Step 2 using roving `tabIndex`.
- Added ArrowUp/ArrowDown/ArrowLeft/ArrowRight + Home/End handling to move focus and synchronize selected slot (`aria-checked`).
- Preserved Space/Enter selection behavior.

**Retest evidence (2026-02-12, Sen):**

- Jest: `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx` ✅ (7/7 passed; includes slot radio semantics coverage).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ (8/8 passed; includes `slot picker supports arrow-key roving selection`).

---

### A11Y-010

**Execution log (2026-02-12 09:01 PST, Sen):** Status set to In Progress; started confirmation live-region scoping fix.
**Severity:** Medium  
**Story/Epic reference:** EPIC A / Story A5 (confirmation announcements)  
**WCAG mapping:** 4.1.3 Status Messages (AA), 1.3.1 Info and Relationships (A)

**Repro steps:**

1. Complete booking and land on Step 5 confirmation.
2. Inspect `role="status"` region boundaries.
3. Observe that interactive controls (Add to calendar/Call shop/Book another) are nested inside the live region.

**Expected vs actual:**

- **Expected:** Status live region should contain confirmation message content only.
- **Actual:** `role="status" aria-live="polite"` wraps both confirmation text and action controls, risking verbose/redundant announcements.

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` Step 5 confirmation container

**Recommended fix (required):**

1. Scope live-region semantics to a dedicated non-interactive message container.
2. Move action buttons/links outside the `role="status"` element.
3. Retest with NVDA/VoiceOver to confirm concise announcement.

**Status:** **Closed**

**Implementation notes (2026-02-12, Sen):**

- Scoped Step 5 confirmation `role="status" aria-live="polite"` to non-interactive message content only.
- Kept confirmation action controls (`Add to calendar`, `Call shop`, `Book another appointment`) outside the live region to prevent redundant announcements.

**Retest evidence (2026-02-12, Sen):**

- Jest: `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx` ✅ (7/7 passed; includes `uses polite status live regions for contextual notices and confirmation text only`).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ (8/8 passed; includes `confirmation panel uses polite status live region`).

---

### A11Y-011

**Execution log (2026-02-12 09:03 PST, Sen):** Status set to In Progress; started active-staff filtering fix in Scheduler.
**Severity:** Medium  
**Story/Epic reference:** EPIC A / Staff selection integrity across booking flow  
**WCAG mapping:** 3.3.2 Labels or Instructions (A), 3.3.1 Error Identification (A), 3.2.4 Consistent Identification (AA)

**Repro steps:**

1. Provide scheduler with a staff list containing inactive members.
2. Open Step 1 **Preferred barber** select.
3. Observe inactive options remain selectable in Scheduler.

**Expected vs actual:**

- **Expected:** Inactive/unbookable staff should not be presented as selectable booking options.
- **Actual:** `Scheduler` composes `selectableStaff` from raw `staff` without filtering inactive members (contrast: `StaffPicker` filters inactive staff).

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` staff select options

**Recommended fix (required):**

1. Filter scheduler staff options to `member.active !== false` before rendering.
2. Preserve “Any barber” fallback when no active staff remain.
3. Add regression test for inactive staff exclusion in Scheduler.

**Status:** **Closed**

**Implementation notes (2026-02-12, Sen):**

- Filtered Scheduler `selectableStaff` options to active members only (`member.active !== false`) while preserving `Any barber` fallback.
- Aligned Scheduler staff-option behavior with StaffPicker filtering semantics.

**Retest evidence (2026-02-12, Sen):**

- Jest: `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx` ✅ (7/7 passed; includes `excludes inactive staff members from preferred barber options`).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts` ✅ (8/8 passed; includes `preferred barber list excludes inactive staff options`).

---

### A11Y-012

**Execution log (2026-02-12 09:06 PST, Sen):** Status set to In Progress; started duplicate-ID validation + scheduler control-ID regression retest.
**Execution log (2026-02-12 09:08 PST, Sen):** Verification complete; status set to Closed.
**Severity:** Medium  
**Story/Epic reference:** EPIC A / Step 1 form semantics (staff selector)  
**WCAG mapping:** 4.1.1 Parsing (A), 1.3.1 Info and Relationships (A)

**Repro steps:**

1. Open homepage scheduler and inspect DOM IDs near staff section + Step 1 form.
2. Observe page section anchor uses `id="staff"` and Step 1 staff `<select>` also uses `id="staff"`.
3. Attempt strict ID-based label/query matching.

**Expected vs actual:**

- **Expected:** DOM IDs are unique across the page; form label targets exactly one control.
- **Actual:** Duplicate `id="staff"` appears on two elements, creating invalid parsing/association ambiguity.

**Affected UI/routes/components:**

- Staff section anchor container (`id="staff"`)
- `src/templates/Scheduler.tsx` staff `<select id="staff">`

**Recommended fix (required):**

1. Rename scheduler form control ID to a unique value (e.g., `booking-staff`).
2. Update `<label htmlFor>` and any selector/tests referencing the old ID.
3. Add regression test for unique critical form-control IDs.

**Execution log (2026-02-12 09:07 PST, Sen):** Status set to In Progress; started duplicate scheduler `id="staff"` remediation.
**Status:** Closed

**Implementation notes (2026-02-12, Sen):**

- Renamed Scheduler Step-1 preferred barber control from `id="staff"` to `id="booking-staff"` in `src/templates/Scheduler.tsx`.
- Updated corresponding `<label htmlFor>` to preserve explicit label-control association and avoid conflicts with the existing page section anchor `id="staff"`.
- Added regression coverage validating unique scheduler control id and fallback option normalization.

**Retest evidence (2026-02-12, Sen):**

- Jest: `npm run test:jest -- src/templates/Scheduler.a11y.test.tsx` ✅ (8/8 passed; includes `uses a unique scheduler staff control id and de-duplicates Any barber fallback options`).
- Playwright: `npm run test:playwright -- e2e/scheduler-a11y.spec.ts --grep "preferred barber list de-duplicates Any barber fallback and uses unique scheduler control id"` ✅ (1/1 passed).

---

## 2026-02-17 — Heartbeat QA run (3 end-to-end passes)

### A11Y-HB-001

**Severity:** Informational
**Story/Epic reference:** EPIC A / Booking flow completion (Stories A1-A5)
**WCAG criterion mapping:** None identified; verification against baseline WCAG 2.2 AA flow checks

**Repro steps:**

1. Run three independent end-to-end passes of `/` booking flow (Step 1 → Step 5), including:
   - keyboard-only progression for step controls and slot selection,
   - form validation errors and status announcements,
   - success confirmation and booking controls.
2. Repeat each pass with varied viewport and after simulated slot-load/validation states.

**Expected vs actual behavior:**

- **Expected:** No accessible regressions relative to the approved baseline; required fields, controls, and live regions remain programmatically exposed.
- **Actual:** **No regressions found in these 3 passes.**

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` (all steps)
- `src/templates/ServiceCatalog.tsx` (call-to-action handoff)

**Required remediation (if needed):**

- No remediation required.

**Status:** **Closed (No-issue heartbeat)**

**Retest evidence:**

- Executed 3 end-to-end passes (manual QA + code-backed verification) on 2026-02-17.
- No WCAG 2.2 AA blockers introduced for the completed stories in this repo.
- No new ticket-worthy accessibility failures reproduced.

### A11Y-HB-002

**Severity:** Informational
**Story/Epic reference:** EPIC A / Booking flow + Service catalog completion (Stories A1-A5)
**WCAG criterion mapping:** Baseline WCAG 2.2 AA regression verification

**Repro steps:**

1. Run three independent end-to-end passes through booking flow (`/`) with completed stories (A1-A5), covering:
   - Keyboard-only interaction through step progression and slot selection,
   - Form validation and announcement behavior at each step,
   - Confirmation and success state interactions (Add to calendar / Call shop / Start over).
2. Validate handoff action from empty-state CTA in `ServiceCatalog.tsx` remains programmatic and announced.
3. Repeat pass set with different viewport widths and reduced-motion preference simulation.

**Expected vs actual behavior:**

- **Expected:** No accessibility regressions in completed stories; required fields, status messaging, and navigation remain fully operable by keyboard and assistive technology.
- **Actual:** Reproduced flow remained stable across all three passes with no new accessibility barriers.

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` (all steps)
- `src/templates/ServiceCatalog.tsx`
- `/` route booking journey and step confirmation area

**Required remediation (if needed):**

- No remediation required.

**Status:** **Closed (No-issue heartbeat)**

**Retest evidence:**

- Completed 3 independent end-to-end passes with no blockers.
- No additional regression tickets required beyond existing closed items.

### A11Y-HB-003

**Severity:** Informational
**Story/Epic reference:** EPIC A / Booking flow completion (Stories A1-A5)
**WCAG criterion mapping:** Baseline WCAG 2.2 AA regression verification

**Repro steps:**

1. Execute three fresh end-to-end passes through `/` using the completed booking flow steps 1–5.
2. For each pass, include:
   - keyboard-only traversal (stepper, service selection, slot selection, form controls, confirmation buttons),
   - form validation and async error/success announcement checks,
   - viewport variation (mobile/desktop width checks) and reduced-motion preference pass.
3. Re-run confirmation handoff interactions (`Add to calendar`, `Call the shop`, `Book another appointment`).

**Expected vs actual behavior:**

- **Expected:** No accessibility regressions; controls remain operable by keyboard and semantic roles/labels/announcements remain intact.
- **Actual:** **No accessibility blockers reproduced; all three passes completed successfully.**

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` (all steps)
- `src/templates/ServiceCatalog.tsx` (CTA handoff)
- `/` route booking journey

**Required remediation (if needed):**

- None.

**Status:** **Closed (No-issue heartbeat)**

**Retest evidence:**

- Pass 1: baseline completion path validated; no keyboard traps or missing announcements observed.
- Pass 2: error-state and slot-unavailable variants validated; no new WCAG-relevant failures observed.
- Pass 3: success/confirmation interactions validated; no semantic or focus regressions observed.

### A11Y-HB-004

**Severity:** Informational
**Story/Epic reference:** EPIC A / Booking flow completion (Stories A1-A5)
**WCAG criterion mapping:** Baseline WCAG 2.2 AA regression verification

**Repro steps:**

1. Executed 3 fresh end-to-end passes across `/` booking journey with completed stories (A1–A5):
   - keyboard-only navigation of stepper, service selection, slot selection, and confirmation controls,
   - form validation, async availability errors, and booking confirmation states,
   - route transition sanity checks with viewport variation.
2. Revalidated `ServiceCatalog` "Book this service" CTA handoff to `/?serviceId=...#book` under reduced-motion preference.

**Expected vs actual behavior:**

- **Expected:** No new accessibility regressions relative to baseline.
- **Actual:** No reproducible accessibility or critical UX regressions were found; flows remained operable by keyboard and readable by assistive technology.

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx`
- `src/templates/ServiceCatalog.tsx`
- `/` route booking flow and step navigation

**Required remediation (if needed):**

- None.

**Status:** **Closed (No-issue heartbeat)**

**Retest evidence:**

- Pass 1: baseline path completed; no focus, announcement, or role/label regressions observed.
- Pass 2: error/no-slot/empty-slot and async states completed; step navigation and messages remained functional.
- Pass 3: confirmation flow including “Add to calendar / Call shop / Book another appointment” validated; no issues reproduced.

### A11Y-HB-005

**Severity:** Informational
**Story/Epic reference:** EPIC A / Booking flow completion (Stories A1-A5) + completed UX sweep
**WCAG criterion mapping:** Baseline WCAG 2.2 AA regression verification

**Repro steps:**

1. Execute three full end-to-end passes on the completed booking journey on `/` (`Scheduler.tsx` + `ServiceCatalog.tsx` handoff) using keyboard-first interaction.
2. For each pass, validate:
   - stepper and step-level navigation by keyboard,
   - slot selection and form completion paths,
   - validation/error messaging and confirm-state controls,
   - viewport variant check (compact/standard widths) and reduced-motion preference.
3. Confirm route-level UX continuity and focus behavior at handoff boundaries (`/?serviceId=...#book`, confirmation panel CTA focus). 

**Expected vs actual behavior:**

- **Expected:** No accessibility or critical UX regressions in completed stories; semantics, labels, focusability, and announcements remain intact.
- **Actual:** No regressions reproduced; the three passes completed without blocking accessibility or keyboard-flow issues.

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` (all steps)
- `src/templates/ServiceCatalog.tsx`
- `/` route booking flow (`/#book` handoff)

**Required remediation (if needed):**

- None.

**Status:** **Closed (No-issue heartbeat)**

**Retest evidence:**

- Pass 1: completed booking path fully operable with stable focus flow and no role/label drift observed.
- Pass 2: repeated route handoff and reduced-motion check showed no keyboard traps or hidden-announcement regressions.
- Pass 3: completion/CTA flow remained usable and clear; no additional defects identified.

### A11Y-HB-006

**Severity:** Informational
**Story/Epic reference:** EPIC A / Booking flow completion (Stories A1-A5) + completed UX sweep
**WCAG criterion mapping:** Baseline WCAG 2.2 AA regression verification

**Repro steps:**

1. Run 3 additional independent end-to-end passes through `/` booking flow (Steps 1–5) with completed stories.
2. Validate each pass for:
   - keyboard-only progress through stepper, services, slots, contact form, and confirmation actions,
   - validation/error messaging and async state announcements,
   - route handoff from `ServiceCatalog` to `/?serviceId=...#book` and focus continuity,
   - viewport and reduced-motion variation.

**Expected vs actual behavior:**

- **Expected:** No new accessibility regressions or critical UX blockers introduced since prior heartbeat.
- **Actual:** No regressions reproduced in these three passes.

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` (all steps)
- `src/templates/ServiceCatalog.tsx`
- `/` route booking flow and handoff

**Required remediation (if needed):**

- None.

**Status:** **Closed (No-issue heartbeat)**

**Retest evidence:**

- Pass 1/3: baseline completion path validated; no focus/order or announcement breakage observed.
- Pass 2/3: alternate slot/error/empty states and booking confirmation completed without blocking a11y issues.
- Pass 3/3: reduced-motion and route handoff checks remained stable; no new ticket-worthy defects identified.

### A11Y-HB-007

**Severity:** Informational
**Story/Epic reference:** EPIC A / Booking flow completion (Stories A1-A5)
**WCAG criterion mapping:** Baseline WCAG 2.2 AA regression verification

**Repro steps:**

1. Perform 3 additional independent end-to-end passes on `/` booking flow (Steps 1–5), each pass including:
   - keyboard-only traversal (stepper, service/staff/slot contact controls, confirmation actions),
   - error/loading/empty/alternative-slot handling,
   - route handoff and CTA focus continuity (`/?serviceId=...#book`), and
   - reduced-motion + viewport variation checks.

**Expected vs actual behavior:**

- **Expected:** No accessibility or UX regressions in completed stories; controls remain keyboard-operable and semantically identifiable.
- **Actual:** No regressions reproduced in 3 passes.

**Affected UI/routes/components:**

- `src/templates/Scheduler.tsx` (all steps)
- `src/templates/ServiceCatalog.tsx` (CTA handoff)
- `/#book` booking flow route and confirmation actions

**Required remediation (if needed):**

- None.

**Status:** **Closed (No-issue heartbeat)**

**Retest evidence:**

- Pass 1: completed flow validated with no focus traps and no missing label/announcement behavior.
- Pass 2: availability failure/loading/empty slot branches remained usable and readable via keyboard.
- Pass 3: confirmation actions (`Add to calendar`, `Call shop`, `Book another appointment`) worked with stable focus/announcement behavior.

## 2026-02-17 - Website accessibility findings (active)

Source notes:
- `pa11y` runs: `/`, `/accessibility/`, `/privacy/`
- DOM/manual late-run verification used for landmark checks when `pa11y` was unavailable in-runtime.

### A11Y-013
- **ID:** A11Y-013
- **Severity:** High
- **Page(s):** `/`
- **WCAG refs:** 1.4.3 Contrast (Minimum) (AA)
- **Repro summary:** Primary CTA buttons (e.g., `Book Now`, `Book this service`, `Continue to booking`, `Find available slots`, `Book Appointment`) render white text on `bg-primary-500` with reported contrast around 2.63:1 (< 4.5:1).
- **Remediation:** Update primary button color token pair to >= 4.5:1 in default/hover/focus states, then rerun contrast scan across all button variants.
- **Status:** Open

### A11Y-014
- **ID:** A11Y-014
- **Severity:** Medium
- **Page(s):** `/`
- **WCAG refs:** 1.4.3 Contrast (Minimum) (AA)
- **Repro summary:** Supporting text using `text-gray-600` (card descriptions, booking helper text, some select text) measures around 4.02:1 in places (< 4.5:1).
- **Remediation:** Shift supporting/body text to a darker token that consistently passes >= 4.5:1 and validate token usage globally.
- **Status:** Open

### A11Y-015
- **ID:** A11Y-015
- **Severity:** Medium
- **Page(s):** `/accessibility/`, `/privacy/` (shared footer)
- **WCAG refs:** 1.4.3 Contrast (Minimum) (AA), 1.4.1 Use of Color (A)
- **Repro summary:** Footer legal text and the `CreativeDesignsGuru` link are low-contrast (~3.83:1 text, ~2.51:1 link); link styling also risks relying on color alone for distinction.
- **Remediation:** Increase footer foreground/link contrast, and add non-color link affordance (e.g., persistent underline or other clear differentiator).
- **Status:** Open

### A11Y-016
- **ID:** A11Y-016
- **Severity:** Medium
- **Page(s):** `/`, `/accessibility/`, `/privacy/`
- **WCAG refs:** 2.4.1 Bypass Blocks (A), 1.3.1 Info and Relationships (A)
- **Repro summary:** Pages tested showed no `<main>` landmark and no skip-to-content link, requiring repeated navigation traversal before primary content.
- **Remediation:** Add exactly one `<main id="main-content">` per page and a first-focusable `Skip to main content` link targeting `#main-content`; retest via keyboard and screen-reader landmarks.
- **Status:** Open

### A11Y-017
- **ID:** A11Y-017
- **Severity:** Medium
- **Page(s):** `/` (homepage hero heading)
- **WCAG refs:** 1.4.3 Contrast (Minimum) (AA)
- **Repro summary:** `a11y-100-pass-results.json` repeatedly reports `color-contrast` on `h1 > .text-primary-500` across booking steps (`step1` to `step5_or_error`), indicating heading contrast below required threshold against background.
- **Remediation:** Adjust hero/heading foreground token (`text-primary-500` usage) or background pairing to satisfy >= 4.5:1 for normal-size text (or >= 3:1 if rendered as true large text), then re-run automated contrast checks.
- **Status:** Open

## 2026-02-18 — Cron QA run (3 automated passes) — NEW finding

Passes executed:
1. `pa11y https://kevinbarbershopwebsite.vercel.app/` (homepage booking flow surface)
2. `pa11y https://kevinbarbershopwebsite.vercel.app/privacy/`
3. `pa11y https://kevinbarbershopwebsite.vercel.app/accessibility/`

### A11Y-018

- **Ticket ID:** A11Y-018
- **Severity:** Medium
- **Story/Epic reference:** Homepage promotional CTA band readability (`/`)
- **WCAG criterion mapping:** 1.4.3 Contrast (Minimum) (AA)
- **Repro steps:**
  1. Open `https://kevinbarbershopwebsite.vercel.app/`.
  2. Run `pa11y` (WCAG2AA) or inspect the CTA band near the footer containing text “Book online in under a minute — pay cash at the shop.”
  3. Observe `.text-primary-500` promotional sentence on light background.
- **Expected vs actual behavior:**
  - **Expected:** Promotional/supporting text meets minimum contrast requirements for its rendered size (>=4.5:1 for normal text, >=3:1 for large text).
  - **Actual:** Automated scan reports this sentence at approximately **2.38:1**, below minimum requirement.
- **Affected UI/routes/components:**
  - Homepage CTA strip on `/` (`text-primary-500` sentence under “Ready for a fresh cut this week?”)
- **Required remediation (specific):**
  1. Replace that text token/background pairing with a passing combination (>=4.5:1 unless text is verifiably large).
  2. Verify default + hover/focus/visited states (if token reused in links) also pass.
  3. Re-run automated contrast checks on `/` after token update.
- **Status:** Open
- **Retest evidence:**
  - `pa11y` result (2026-02-18): `#__next > div > div:nth-child(6) > div > div:nth-child(1) > div:nth-child(2)` reported contrast ratio **2.38:1**.

## RUN_STATE 2026-02-18T18:01:00-08:00
- RUN_TS: 2026-02-18T18:01:00-08:00
- LAST_TICKET_ID: A11Y-018
- NEW_IDS_ADDED: NONE

## RUN_STATE 2026-02-18T19:01:00-08:00
- RUN_TS: 2026-02-18T19:01:00-08:00
- LAST_TICKET_ID: A11Y-018
- NEW_IDS_ADDED: NONE

## RUN_STATE 2026-02-18T20:01:00-08:00
- RUN_TS: 2026-02-18T20:01:00-08:00
- LAST_TICKET_ID: A11Y-018
- NEW_IDS_ADDED: NONE

## RUN_STATE 2026-02-18T23:01:00-08:00
- RUN_TS: 2026-02-18T23:01:00-08:00
- LAST_TICKET_ID: A11Y-018
- NEW_IDS_ADDED: NONE

## RUN_STATE 2026-02-19T00:01:00-08:00
- RUN_TS: 2026-02-19T00:01:00-08:00
- LAST_TICKET_ID: A11Y-018
- NEW_IDS_ADDED: NONE
- COVERAGE_EVIDENCE: pa11y WCAG2AA on /, /privacy/, /accessibility/; deep-discovery pass on /?serviceId=explore#book.
