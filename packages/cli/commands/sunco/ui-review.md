---
name: sunco:ui-review
description: Retroactive 6-pillar visual UI audit of implemented frontend code. Scores each pillar 0-10 and produces a UI-REVIEW.md with specific findings. `--surface web` layers on an Impeccable WRAP audit (Phase 41/M2.4) via the vendored detector.
argument-hint: "<phase> [--dir <path>] [--strict] [--surface cli|web]"
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
- `--surface cli|web` — Audit surface (Phase 41/M2.4).
  - Omitted or `--surface cli` → **existing** 6-pillar audit behavior, byte-identical to pre-Phase-41 output (R1 regression guarantee).
  - `--surface web` → 6-pillar audit **+** Impeccable detector scan via `references/impeccable/wrapper/detector-adapter.mjs`, dual output (`.planning/domains/frontend/IMPECCABLE-AUDIT.md` + phase `UI-REVIEW.md`).
  - `--surface native` or any unknown value → **explicit error** (per R4 explicit-only triggers).
</context>

<objective>
Perform a retroactive visual and code-quality audit of implemented UI code across 6 pillars. Each pillar is scored 0-10 with specific, actionable findings. Outputs a `UI-REVIEW.md` with scores, findings, and a prioritized fix list.

**Creates:**
- `.planning/phases/[N]-*/UI-REVIEW.md` — scored audit report with findings and fix list

**After this command:** Fix the issues identified, then re-run `/sunco:ui-review [N]` to verify improvements. When all pillars score ≥ 7, the UI is review-ready.
</objective>

<process>
## Step 0: Surface dispatch (Phase 41/M2.4)

Parse `--surface <value>` from arguments. Resolve:

| Input | Route |
|---|---|
| no flag, or `--surface cli` | **CLI path** — run Steps 1-7 unchanged (byte-identical to pre-Phase-41). Skip the Impeccable WRAP step. |
| `--surface web` | **Web path** — run Steps 1-7 as documented, then run Step 8 (Impeccable WRAP) and Step 9 (summary wrap). |
| `--surface native` or any other value | **Error** — emit `Unsupported --surface: <value>. Supported: cli, web.` and exit non-zero. Do NOT fall through silently. |

R1 regression guarantee: with no flag (or `--surface cli`) this command produces byte-identical output vs pre-Phase-41. The Phase 41 additions are scoped to `--surface web` only.

---

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

---

## Step 8: Impeccable WRAP (`--surface web` only — Phase 41/M2.4)

**Skip this step entirely when the flag is absent or `--surface cli`.** The CLI path ends at Step 7 (byte-identical regression guarantee).

### 8a. Target resolution

Conservative default: scan project root, excluding `.planning/`, `node_modules/`, `.git/`, and `packages/cli/references/impeccable/`. These defaults are enforced by `detector-adapter.mjs::DEFAULT_EXCLUDES` plus the detector's internal `SKIP_DIRS`.

If `--dir <path>` was provided, use that path as the target (still subject to the default excludes). Never scan the vendored detector or installed runtime — if resolution would require that, abort and report the scope escalation.

### 8b. Run the detector via wrapper

```bash
# Invoked programmatically from the adapter module; documented here for transparency.
node - <<'EOF'
import { runDetector, writeAuditReport, DetectorUnavailableError }
  from './packages/cli/references/impeccable/wrapper/detector-adapter.mjs';

const outPath = '.planning/domains/frontend/IMPECCABLE-AUDIT.md';
let result;
try {
  result = runDetector(process.argv[2] || process.cwd());
} catch (err) {
  if (err instanceof DetectorUnavailableError) {
    result = { status: 'unavailable', reason: err.reason };
    process.stderr.write(`warn: detector unavailable — ${err.reason}. LLM critique still runs.\n`);
  } else {
    throw err;
  }
}
writeAuditReport(result, outPath);
EOF
```

Fallback contract (Gate 41 A3):

| Detector outcome | Behavior | IMPECCABLE-AUDIT.md header |
|---|---|---|
| Exit 0 (clean) or 2 (findings) | Success — findings translated + severity derived | `detector_status: ok`, `reason: null` |
| Node missing (ENOENT) | Warn + continue to Step 8c (LLM critique) | `detector_status: unavailable`, `reason: node-not-found` |
| Spawn crash / other exec error | Warn + continue | `detector_status: unavailable`, `reason: detector-crash` |
| Exit code ∉ {0, 2} | Warn + continue | `detector_status: unavailable`, `reason: detector-abnormal-exit` |
| JSON parse failure | Warn + continue | `detector_status: unavailable`, `reason: json-parse-failed` |
| Target not found | Warn + continue | `detector_status: unavailable`, `reason: target-not-found` |

**All fallback paths exit 0. UI-REVIEW.md (from Step 5) must already exist — Step 8 appends to it in Step 9 regardless of detector status.**

### 8c. Spawn `sunco-ui-reviewer` (LLM critique)

```
Task(
  prompt="
You are sunco-ui-reviewer. Read:
  - .planning/phases/[N]-*/CONTEXT.md
  - .planning/phases/[N]-*/UI-SPEC.md (if present)
  - .planning/phases/[N]-*/UI-REVIEW.md (existing 6-pillar — DO NOT MODIFY)
  - .planning/domains/frontend/IMPECCABLE-AUDIT.md (pre-written with detector status + findings)

Produce:
  - Append `## LLM Critique` section to IMPECCABLE-AUDIT.md
  - Append `## Impeccable Summary Wrap (Phase 41 WRAP)` section to UI-REVIEW.md
    (preserve all existing 6-pillar content — append only)

See agents/sunco-ui-reviewer.md for the 3-stage protocol and output structure.
",
  subagent_type="sunco-ui-reviewer",
  description="Impeccable critique Phase [N]"
)
```

Category→severity derivation is done inside the adapter (not the agent). The agent consumes the already-normalized HIGH/MEDIUM/LOW findings.

## Step 9: Summary wrap output (web path only)

At this point both files exist:

| File | Location | Produced by |
|---|---|---|
| `UI-REVIEW.md` | `.planning/phases/[N]-[name]/` | Step 5 (6-pillar) + Step 8c append (summary wrap) |
| `IMPECCABLE-AUDIT.md` | `.planning/domains/frontend/` | Step 8b (detector status + findings) + Step 8c append (LLM critique) |

Extend the Step 7 report with an Impeccable summary line:

```
Impeccable audit: [detector_status] — HIGH: N · MEDIUM: N · LOW: N
  Detail: .planning/domains/frontend/IMPECCABLE-AUDIT.md
```

If `detector_status: unavailable`, print the reason and emphasize that LLM critique still ran.

**R6 scope boundary:** Phase 41 reports severity + file:line + message only. Finding-lifecycle state (open/resolved/dismissed) is Phase 48/M4 scope — do not report it here.
</process>
