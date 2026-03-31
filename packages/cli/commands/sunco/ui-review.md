---
name: sunco:ui-review
description: Retroactive 6-pillar visual UI audit of implemented frontend code. Scores each pillar 0-10 and produces a UI-REVIEW.md with specific findings.
argument-hint: "<phase> [--dir <path>] [--strict]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number to audit. Required unless `--dir` is specified.

**Flags:**
- `--dir <path>` — Audit a specific directory instead of a phase's files. Use for auditing a component library or a sub-tree.
- `--strict` — Fail if any pillar scores below 7. Use before shipping.
</context>

<objective>
Perform a retroactive visual and code-quality audit of implemented UI code across 6 pillars. Each pillar is scored 0-10 with specific, actionable findings. Outputs a `UI-REVIEW.md` with scores, findings, and a prioritized fix list.

**Creates:**
- `.planning/phases/[N]-*/UI-REVIEW.md` — scored audit report with findings and fix list

**After this command:** Fix the issues identified, then re-run `/sunco:ui-review [N]` to verify improvements. When all pillars score ≥ 7, the UI is review-ready.
</objective>

<process>
## Step 1: Identify audit scope

If phase number provided:
- Read `.planning/ROADMAP.md` to get the phase title and deliverables
- Find the phase directory: `.planning/phases/[N]-*/`
- Read all PLAN.md files to get the list of `files_modified`
- Build the file list from those plans

If `--dir` provided:
- Audit all `*.tsx`, `*.ts`, `*.jsx`, `*.js`, `*.css`, `*.module.css`, `*.scss` files under that directory recursively

If both provided: use `--dir` and associate the report with the phase.

## Step 2: Read reference artifacts

If a `UI-SPEC.md` exists for the phase: read it. The audit will check implementation against the spec.

Read any existing design system config:
```bash
cat tailwind.config.* 2>/dev/null
cat src/styles/globals.css src/app/globals.css 2>/dev/null | head -100
```

## Step 3: Run 6-pillar audit

Spawn an audit agent for each pillar in parallel.

**Agent name:** `sunco-ui-auditor` — description: `UI audit: [pillar]`

---

### Pillar 1: Typography (0-10)

Read all component files. Check:
- Are font sizes using design system tokens (e.g., `text-sm`, `text-base`, `text-lg`) rather than raw `px`/`rem` values?
- Is there a consistent heading hierarchy (h1 > h2 > h3) without skipped levels?
- Are line heights and letter spacing intentional?
- Are there orphaned or inconsistent font-weight usages?
- Is body text readable (≥ 16px equivalent)?

Score deductions:
- Raw px font sizes: -2
- Skipped heading levels: -2 per instance
- Inconsistent weights with no apparent reason: -1
- Body text < 16px: -3

---

### Pillar 2: Color and Contrast (0-10)

Read component files and CSS. Check:
- Are colors from the design system palette (not hardcoded hex values)?
- WCAG 2.1 AA: text contrast ≥ 4.5:1 on backgrounds
- WCAG 2.1 AA: large text (18px+ bold, 24px+ regular) contrast ≥ 3:1
- Are disabled states visually distinguishable?
- Is color used as the sole differentiator for any information (color-blind risk)?

Score deductions:
- Hardcoded hex/rgb colors outside design tokens: -1 each (max -3)
- Any obvious low-contrast text/background combination: -3
- Information conveyed only by color: -2

---

### Pillar 3: Spacing and Alignment (0-10)

Read component files. Check:
- Are spacing values from the design system scale (e.g., Tailwind's `p-4`, `gap-6`) rather than arbitrary values?
- Is there consistent internal padding within similar components?
- Are elements visually aligned (grid alignment, baseline alignment)?
- Is there adequate whitespace to avoid crowding?
- Are icon+text combinations properly aligned (vertical center)?

Score deductions:
- Arbitrary spacing values (e.g., `padding: 13px`): -1 each (max -3)
- Inconsistent padding between sibling components: -2
- Obvious misalignment: -2 per instance

---

### Pillar 4: Component Consistency (0-10)

Read all component files. Check:
- Are similar UI patterns (buttons, inputs, cards) implemented with the same component, or are there duplicates?
- Do interactive elements (buttons, links) have consistent hover/focus states?
- Are loading indicators consistent across components (one spinner style, not three)?
- Are empty states and error messages consistently styled?
- Are border-radius, shadow, and border styles consistent within component types?

Score deductions:
- Duplicate implementations of the same UI pattern: -2 per duplication
- Inconsistent hover/focus styles: -2
- Multiple spinner/loading implementations: -1
- Inconsistent border-radius across similar components: -1

---

### Pillar 5: Responsive Behavior (0-10)

Read component files for responsive classes or media queries. Check:
- Do layouts change appropriately at mobile (<640px), tablet (640-1024px), desktop (>1024px)?
- Are touch targets ≥ 44px on mobile (check button/link sizes)?
- Is horizontal scrolling prevented on mobile (no overflow)?
- Are images and media responsive (not fixed-width in fluid containers)?
- Are data tables readable on mobile (horizontal scroll or card transform)?

Score deductions:
- Fixed-width containers that cause mobile overflow: -3
- No responsive classes on layout components: -2
- Touch targets < 44px: -2
- Fixed-width images in fluid containers: -1

---

### Pillar 6: Accessibility (WCAG) (0-10)

Read component files for ARIA usage, semantic HTML, and keyboard patterns. Check:
- Are interactive elements using semantic HTML (`<button>`, `<a>`, not `<div onClick>`)?
- Do all images have meaningful `alt` text (or `alt=""` if decorative)?
- Do form inputs have associated `<label>` elements or `aria-label`?
- Do icon-only buttons have `aria-label`?
- Is `tabIndex` used correctly (no positive tabIndex values)?
- Are modal/dialog patterns using correct ARIA roles (`role="dialog"`, `aria-modal`, focus trap)?
- Are live regions (`aria-live`) used for dynamic content updates?

Score deductions:
- `<div onClick>` instead of `<button>`: -2 per instance (max -4)
- Images without alt text: -2
- Form inputs without labels: -2
- Icon-only buttons without aria-label: -1 each (max -2)
- Positive tabIndex values: -1 each

---

## Step 4: Aggregate scores

Calculate total score (sum of 6 pillars, max 60).
Calculate overall rating:
- 54-60: Excellent — ship-ready
- 42-53: Good — minor polish needed
- 30-41: Needs work — significant issues
- < 30: Critical — do not ship

## Step 5: Write UI-REVIEW.md

Write to `.planning/phases/[N]-[phase-name]/UI-REVIEW.md`:

```markdown
# UI Review — Phase [N]: [Phase Title]

**Audited:** [timestamp]
**Scope:** [N files across N components]
**Design system:** [detected]
**Overall score:** [total]/60 — [rating]

---

## Pillar Scores

| Pillar | Score | Status |
|--------|-------|--------|
| 1. Typography | [0-10] | [pass ≥7 / warn <7 / fail <5] |
| 2. Color & Contrast | [0-10] | |
| 3. Spacing & Alignment | [0-10] | |
| 4. Component Consistency | [0-10] | |
| 5. Responsive Behavior | [0-10] | |
| 6. Accessibility (WCAG) | [0-10] | |
| **Total** | **[total]/60** | |

---

## Findings by Pillar

### Pillar 1: Typography
[Score: N/10]

**Issues:**
- [file:line] [specific finding]
- [file:line] [specific finding]

**Fix:**
[Specific remediation]

### Pillar 2: Color & Contrast
[...]

[repeat for all 6 pillars]

---

## Prioritized Fix List

### Critical (fix before shipping)
- [ ] [Finding] — [file reference]

### High (fix this sprint)
- [ ] [Finding] — [file reference]

### Low (nice to have)
- [ ] [Finding] — [file reference]

---

## Spec Compliance
[If UI-SPEC.md exists: list any spec requirements that were not implemented]
```

## Step 6: Strict mode check

If `--strict` is set and any pillar scores below 7:
- Print the failing pillars prominently
- Exit with failure signal (non-zero output)
- Tell user: "Strict mode: [N] pillars below threshold. Fix issues and re-run `/sunco:ui-review [N] --strict`."

## Step 7: Report

Show:
```
UI Review complete for Phase [N].

Overall: [total]/60 — [rating]
  Typography:          [N]/10
  Color & Contrast:    [N]/10
  Spacing & Alignment: [N]/10
  Component Consistency: [N]/10
  Responsive Behavior: [N]/10
  Accessibility:       [N]/10

Critical issues: [N]
High issues: [N]

Report: .planning/phases/[N]-[name]/UI-REVIEW.md
```

Tell user: "Fix critical issues and re-run `/sunco:ui-review [N]` to verify improvements."
</process>
