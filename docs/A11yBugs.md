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

