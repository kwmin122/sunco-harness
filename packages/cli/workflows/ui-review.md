# UI Review Workflow

Audit a phase's UI output against six quality pillars. Spawns a sunco-ui-auditor agent that evaluates the rendered CLI output, checks it against UI-SPEC.md (if exists), scores each pillar 0-10, and writes a UI-REVIEW.md report with specific fix instructions. Used by `/sunco:ui-review`.

---

## Overview

Four steps:

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
