# Forensics Workflow

Post-mortem investigation of a failed workflow, build, or verification. Reads failed artifact files, blames changed files with git, traces errors back to their origin, classifies the root cause, and writes a structured `.planning/phases/XX-name/FORENSICS.md` report. Used by `/sunco:forensics`.

---

## Overview

Six steps:

1. **Initialize** — find the failed phase and its artifacts
2. **Read failure artifacts** — VERIFICATION.md, SUMMARY.md, UAT.md
3. **Git blame changed files** — who changed what, when
4. **Trace error origin** — follow the symptom back to the cause
5. **Classify root cause** — assign a root cause category
6. **Write FORENSICS.md** — structured report with prevention recommendation

---

## Step 1: Initialize

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | auto-detect from STATE.md |
| `--plan <n>` | `PLAN_ARG` | all plans |

Locate the phase directory:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
```

If no phase found, detect from STATE.md:

```bash
cat .planning/STATE.md 2>/dev/null
```

Use `current_phase.number`. If still ambiguous, ask: "Which phase failed? Provide the phase number."

---

## Step 2: Read Failure Artifacts

Read all failure signals in the phase directory:

```bash
# Verification results
cat "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null

# Execution summaries (what was done)
cat "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null

# UAT results (what the user found)
cat "${PHASE_DIR}"/*-UAT.md 2>/dev/null

# Plan files (what was intended)
cat "${PHASE_DIR}"/*-PLAN.md 2>/dev/null
```

Extract:
- **Failure symptoms** — exact error messages, test names that failed, UAT gaps
- **What was built** — from SUMMARY.md accomplishments section
- **What was intended** — from PLAN.md objective and done_when criteria
- **Gap between intent and delivery** — compare plan done_when to summary output

Build a symptom list:

```
Symptoms collected:
  1. TypeScript error: "Property 'resolve' does not exist on type 'SkillRegistry'"
  2. UAT Gap: "Resolve by ID returns undefined for valid IDs" (severity: major)
  3. Verification FAIL: "SkillRegistry.resolve() returns undefined" (Layer 2)
```

---

## Step 3: Git Blame Changed Files

Find files changed in this phase:

```bash
# Find commits since phase start (use SUMMARY.md commit timestamp as range start)
PHASE_START_COMMIT=$(git log --oneline --follow "${PHASE_DIR}/"*-SUMMARY.md 2>/dev/null | tail -1 | cut -d' ' -f1)

# List all files changed
git diff --name-only "${PHASE_START_COMMIT}"..HEAD 2>/dev/null | grep -v ".planning/"

# For each changed source file, get blame on relevant lines
```

For each file implicated by a symptom, run targeted git blame:

```bash
git log --oneline -10 -- [file] 2>/dev/null
git show HEAD:[file] 2>/dev/null | head -50   # current state
```

Map symptoms to commits:
- Which commit introduced the failing code?
- Was it in this phase, or was it a pre-existing issue exposed by new code?
- Are multiple commits contributing to the same failure?

---

## Step 4: Trace Error Origin

For each symptom, trace from surface to root:

**Tracing method:**

1. **Symptom location** — where does the error manifest? (file, line, function)
2. **Call path** — what calls into the failing code? (trace upward)
3. **Data origin** — what data/state led to this state? (trace downward)
4. **Decision point** — where was the wrong choice made? (architectural, logic, typo)
5. **Earliest introducible fix point** — where is the smallest fix with the largest effect?

Example trace:

```
Symptom:    SkillRegistry.resolve() returns undefined
                ↓
Manifest:   src/core/skill-registry.ts:42 — returns this.skills.get(id)
                ↓
Call path:  skill-loader.ts:88 calls resolve() after registerAll()
                ↓
Data flow:  skills Map never populated — registerAll() called before load()
                ↓
Root:       skill-loader.ts:31 — register loop runs before async load completes
                ↓
Fix point:  await this.load() before register loop, or register inside load callback
```

Record the trace in memory. Multiple symptoms may share a root.

---

## Step 5: Classify Root Cause

Assign one root cause category per failure:

| Category | Definition | Example |
|----------|------------|---------|
| `missing-implementation` | Feature was never built | Function stubbed, returns undefined |
| `logic-error` | Built incorrectly — wrong algorithm or condition | Off-by-one, wrong comparison |
| `integration-gap` | Parts exist but not connected | Event emitted, no listener registered |
| `async-ordering` | Race condition or await missing | Promise resolved after consumer checked |
| `spec-mismatch` | Built exactly as specced, but spec was wrong | Plan said X, reality needed Y |
| `environment` | Works in code, breaks at runtime | Path assumption, missing env var |
| `regression` | Worked before, broken by new change | Correct code broken by refactor |
| `test-gap` | Bug exists but was never tested | No unit test for edge case |

Assign a confidence level per classification (HIGH / MEDIUM / LOW).

---

## Step 6: Write FORENSICS.md

Write `.planning/phases/XX-name/FORENSICS.md`:

```markdown
# Forensics Report — Phase XX: [Phase Name]

Date: [ISO date]
Investigator: sunco-forensics
Status: complete

## Summary

[2-3 sentences: what failed, why, how it will be prevented]

## Failure Symptoms

1. [Symptom 1 — exact error or behavior]
2. [Symptom 2]

## Root Cause Analysis

### Root Cause 1 — [Category]

**Symptom:** [which symptom(s) this explains]
**Location:** [file:line or component]
**Trace:**
  [Symptom] → [Call path] → [Data origin] → [Decision point]

**Evidence:**
  - Commit [hash]: [what was changed]
  - [file]:[line]: [relevant code snippet]

**Confidence:** HIGH | MEDIUM | LOW

### Root Cause 2 — [Category]
[same structure]

## Timeline

| Time | Event |
|------|-------|
| [timestamp] | Phase XX execution started |
| [timestamp] | Commit [hash]: [description] |
| [timestamp] | Failure first manifested |

## Intent vs. Delivery Gap

| Plan done_when | Actual outcome | Status |
|----------------|----------------|--------|
| SkillRegistry.resolve(id) returns skill | Returns undefined | FAILED |
| All 12 unit tests pass | 3 tests fail | FAILED |

## Prevention

For each root cause, one concrete prevention:

1. **[Category]** — [prevention action]
   Example: "async-ordering → add integration test asserting resolve() returns skills after init()"

2. **[Category]** — [prevention action]

## Recommended Fix

[If the fix is clear, describe it in 2-3 sentences.]
[If complex, recommend creating a fix phase: /sunco:phase add "Fix Phase XX gaps"]

Next action:
  Fix manually    →  [file]:[line], change [X] to [Y]
  Create fix phase →  /sunco:plan-milestone-gaps
  Escalate        →  Review with team before proceeding
```

Commit the forensics report:

```bash
git add "${PHASE_DIR}/FORENSICS.md"
git commit -m "docs: forensics report for phase ${PADDED} — [root cause summary]"
```

Display summary inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► FORENSICS COMPLETE  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Root cause: async-ordering (HIGH confidence)
Location:   src/core/skill-loader.ts:31
Fix:        await this.load() before register loop

Report: .planning/phases/XX-name/FORENSICS.md

Next:
  /sunco:plan-milestone-gaps   create fix phases from this report
  /sunco:verify XX             re-verify after fixing
```

---

## Success Criteria

- [ ] Failure artifacts read (VERIFICATION.md, SUMMARY.md, UAT.md)
- [ ] Changed files traced via git log
- [ ] Symptoms mapped to specific code locations
- [ ] Root cause classified with evidence
- [ ] Intent vs. delivery gap table produced
- [ ] Prevention recommendation per root cause
- [ ] FORENSICS.md written and committed
- [ ] Next action presented (fix manually, plan gap phase, or escalate)
