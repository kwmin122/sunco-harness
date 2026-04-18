# UI Review Workflow

Audit a phase's UI output against six quality pillars. Spawns a sunco-ui-auditor agent that evaluates the rendered CLI output, checks it against UI-SPEC.md (if exists), scores each pillar 0-10, and writes a UI-REVIEW.md report with specific fix instructions. Used by `/sunco:ui-review`.

---

## Surface dispatch (Phase 41/M2.4)

`/sunco:ui-review N` accepts an optional `--surface` flag. Routing:

| Input | Route |
|---|---|
| no flag, or `--surface cli` | **CLI path** — Steps 1-4 below, unchanged. **Byte-identical** to pre-Phase-41 output (R1 regression guarantee). |
| `--surface web` | **Web path** — Steps 1-4 below (6-pillar scoring kept intact), then the Impeccable WRAP steps in [§ Web path addendum](#web-path-addendum-phase-41m24). Dual output: `.planning/domains/frontend/IMPECCABLE-AUDIT.md` + phase `UI-REVIEW.md`. |
| `--surface native` or any unknown value | **Error** — emit `Unsupported --surface: <value>. Supported: cli, web.` and exit non-zero. Do NOT fall through silently (R4 explicit-only triggers). |

The sections below describe the CLI path. The web path reuses them verbatim and adds the addendum at the end.

---

## Overview

Four steps (CLI path):

1. **Initialize** — locate the phase and its UI artifacts
2. **Spawn auditor** — evaluate against 6 pillars
3. **Aggregate scores** — compute overall score, classify verdict
4. **Write UI-REVIEW.md** — pillar scores, issues, and fix instructions

---

## The Six Pillars

| # | Pillar | What it checks |
|---|--------|----------------|
| 1 | Clarity | Is the information hierarchy obvious? Does the user know what happened and what to do next? |
| 2 | Consistency | Are colors, symbols, and patterns used the same way throughout? No mixed metaphors. |
| 3 | Density | Right amount of information — not too sparse (wastes space), not too dense (overwhelming). |
| 4 | Feedback | Every action gets a response. Loading states exist. Success/failure are explicit. |
| 5 | Affordance | Available actions are visible. User knows how to proceed. No dead ends. |
| 6 | Accessibility | Status communicated with symbol + text, not color alone. Readable at 80 chars wide. |

Each pillar is scored 0-10. Overall score is the mean.

---

## Step 1: Initialize

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |

Locate artifacts:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)

# UI spec (design contract)
UI_SPEC="${PHASE_DIR}/UI-SPEC.md"

# Actual output to audit (from SUMMARY.md or source files)
cat "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null
grep -r "chalk\|<Box\|<Text\|console.log\|ui\." src/ --include="*.ts" -l 2>/dev/null
```

If UI-SPEC.md exists, the audit compares reality to spec. If not, the audit evaluates the output standalone.

---

## Step 2: Spawn Auditor

```
Task(
  prompt="
You are a CLI UI auditor. Audit the UI output of Phase XX: [Phase Name].

What to audit:
  - Rendered CLI output described in SUMMARY.md accomplishments
  - Source files: [list of UI-relevant source files]
  - UI-SPEC.md (if it exists — compare actual vs. spec)

Score each pillar 0-10:

1. Clarity (0-10)
   - Information hierarchy obvious?
   - User knows what happened?
   - Next action clear?

2. Consistency (0-10)
   - Same color for same meaning throughout?
   - Same symbols for same status?
   - Spacing and indentation uniform?

3. Density (0-10)
   - No unused whitespace?
   - No information overload?
   - Key info visible without scrolling?

4. Feedback (0-10)
   - Loading states shown for async ops?
   - Success explicitly confirmed?
   - Error states handled and shown?

5. Affordance (0-10)
   - Available commands/actions listed after output?
   - No dead ends (every screen suggests what's next)?
   - Interactive prompts label options clearly?

6. Accessibility (0-10)
   - Status indicators use symbol AND text, not color alone?
   - Errors include the error message, not just color?
   - Readable at 80 chars?

For each issue, provide:
  pillar: [1-6]
  severity: blocker | major | minor | cosmetic
  description: [what's wrong]
  location: [file:line or component name]
  fix: [exact instruction to fix it]

Return JSON:
{
  scores: { clarity: N, consistency: N, density: N, feedback: N, affordance: N, accessibility: N },
  issues: [{ pillar, severity, description, location, fix }],
  overall: N,
  verdict: 'pass' | 'pass_with_warnings' | 'fail',
  strengths: ['...']
}
",
  subagent_type="sunco-ui-auditor",
  description="UI audit Phase XX"
)
```

---

## Step 3: Aggregate Scores

Parse the auditor's JSON output.

**Verdict logic:**

| Condition | Verdict |
|-----------|---------|
| Any pillar below 4 | FAIL |
| Overall below 6 | FAIL |
| Overall 6-7.9, no blocker issues | PASS WITH WARNINGS |
| Overall 8+ and no major issues | PASS |

---

## Step 4: Write UI-REVIEW.md

Write `.planning/phases/XX-name/UI-REVIEW.md`:

```markdown
# UI Review — Phase XX: [Phase Name]

Date: [ISO date]
Auditor: sunco-ui-auditor
Verdict: PASS | PASS WITH WARNINGS | FAIL
Overall score: X.X / 10

## Pillar Scores

| Pillar | Score | Assessment |
|--------|-------|------------|
| Clarity | 8 | ✓ Good hierarchy, next action always visible |
| Consistency | 7 | ⚠ One instance of wrong color for warning state |
| Density | 9 | ✓ Clean, no waste |
| Feedback | 6 | ⚠ Loading state missing in 2 async operations |
| Affordance | 8 | ✓ Available commands shown after each output |
| Accessibility | 5 | ✗ 3 status indicators use color only, no symbol |

## Issues

### 1. [Accessibility] Missing status symbols — major
**Location:** src/core/ui/SkillList.tsx:34
**Description:** Error state renders as red text with no symbol. Screen readers cannot distinguish it from normal text.
**Fix:** Add ✗ prefix to all error messages: `chalk.red('✗ ' + message)`

### 2. [Feedback] No loading state for skill resolution — minor
**Location:** src/commands/run.ts:67
**Description:** Skill resolution can take 200-500ms. No indication the CLI is working.
**Fix:** Add ora spinner before resolution: `const spinner = ora('Resolving skill...').start()`

## Strengths

- Clear section headers with consistent ━━━ border pattern
- All commands list available next actions
- Phase progress bar is well-proportioned

## Action Items

- [ ] Add ✗ prefix to all error states in SkillList.tsx
- [ ] Add loading spinner to skill resolution in run.ts
- [ ] Fix warning color consistency in StatusHeader.tsx

## Spec Compliance (if UI-SPEC.md exists)

| Spec requirement | Implemented | Notes |
|-----------------|-------------|-------|
| Status uses symbol + color | Partial | Errors missing symbol |
| Footer shows next action | Yes | |
| 80-char max width | Yes | |
```

Commit:

```bash
git add "${PHASE_DIR}/UI-REVIEW.md"
git commit -m "docs: UI review phase ${PADDED} — score X.X/10, [verdict]"
```

Display inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► UI REVIEW  Phase XX  Score: 7.2/10  WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pillar scores: Clarity 8  Consistency 7  Density 9
               Feedback 6  Affordance 8  Accessibility 5

2 issues to fix (1 major, 1 minor)

Report: .planning/phases/XX-name/UI-REVIEW.md
```

---

## Success Criteria

- [ ] All 6 pillars scored with rationale
- [ ] Issues include exact file:line and fix instruction
- [ ] Verdict computed from pillar scores and issue severities
- [ ] UI-SPEC.md compliance checked (if spec exists)
- [ ] Strengths noted (not only issues)
- [ ] UI-REVIEW.md written and committed

---

## Web path addendum (Phase 41/M2.4)

Only runs when the caller passed `--surface web`. CLI-path invocations (no flag or `--surface cli`) must skip this entire section — byte-identical regression guarantee (R1).

### Step A — Run the vendored detector via wrapper

Use the Phase 38 + Phase 41 adapter:

```
import { runDetector, writeAuditReport, DetectorUnavailableError }
  from 'packages/cli/references/impeccable/wrapper/detector-adapter.mjs';
```

Invocation:

```
const out = '.planning/domains/frontend/IMPECCABLE-AUDIT.md';
let r;
try {
  r = runDetector(projectRootOrSrc);          // target resolution + excludes applied inside
} catch (err) {
  if (err instanceof DetectorUnavailableError) {
    r = { status: 'unavailable', reason: err.reason };
  } else { throw err; }
}
writeAuditReport(r, out);
```

Target resolution (conservative — Gate 41 A3): project root minus `DEFAULT_EXCLUDES` (`.planning`, `node_modules`, `packages/cli/references/impeccable`) plus the detector's internal `SKIP_DIRS`. Never scan vendored references or installed runtime.

Fallback contract — every failure produces an IMPECCABLE-AUDIT.md with explicit `detector_status` + `reason`. No silent success.

| Reason | When |
|---|---|
| `node-not-found` | Node binary missing (ENOENT on spawn) |
| `detector-crash` | Spawn threw or returned non-recoverable error |
| `detector-abnormal-exit` | Exit code ∉ {0, 2} |
| `json-parse-failed` | Detector output is not a valid JSON array |
| `target-not-found` | Provided target path does not exist |

All fallback paths: exit 0 upstream, continue to Step B (LLM critique). Detector failure never blocks the audit — it's additive value only.

### Step B — Spawn `sunco-ui-reviewer` for LLM critique

This is a different agent from `sunco-ui-auditor` (the one used in Steps 1-4 above). `sunco-ui-auditor` handles 6-pillar scoring; `sunco-ui-reviewer` layers Impeccable critique on top. See `packages/cli/agents/sunco-ui-reviewer.md` for the 3-stage protocol (ref-load → correlate → write).

Outputs (append-only):

- `.planning/domains/frontend/IMPECCABLE-AUDIT.md` gains a `## LLM Critique` section.
- Phase `UI-REVIEW.md` gains a `## Impeccable Summary Wrap (Phase 41 WRAP)` section appended below the existing 6-pillar content. **Existing 6-pillar content is not modified.**

### Step C — Report

Extend the inline report (Section 4 above) with an Impeccable summary line:

```
Impeccable audit: [detector_status] — HIGH: N · MEDIUM: N · LOW: N
  Detail: .planning/domains/frontend/IMPECCABLE-AUDIT.md
```

### R6 scope boundary (hard)

Phase 41/M2.4 reports **severity (HIGH/MEDIUM/LOW) + file:line + message only**.

Finding-lifecycle state (open / resolved / dismissed) is **Phase 48/M4** scope. Do NOT add state tracking, auto-fix diffs, or carry-over ledgers in Phase 41. If reviewers request that surface, escalate per Gate 41 triggers instead of inlining it here.
