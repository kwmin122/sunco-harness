# Audit UAT Workflow

Cross-phase user acceptance testing audit. Scans every executed phase directory for a UAT.md, classifies each phase as tested, untested, or partially tested, and produces a gap report with suggested remediation. Used by `/sunco:audit-uat`.

---

## Overview

Four steps:

1. **Discover phases** — enumerate all phase directories with `executed` or `verified` status
2. **Check each phase** — look for UAT.md and classify coverage
3. **Build gap report** — identify untested and partially tested phases
4. **Write audit output** — save `UAT-AUDIT.md` and suggest next actions

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--milestone <name>` | `MILESTONE_FILTER` | all milestones |
| `--phase <n>` | `PHASE_FILTER` | all phases |
| `--fail-on-gap` | `FAIL_ON_GAP` | false |
| `--output <path>` | `OUTPUT_PATH` | `.planning/UAT-AUDIT.md` |

If `--phase` is given: audit only that single phase. Useful for pre-ship spot checks.

---

## Step 2: Discover Phase Directories

```bash
PHASE_DIRS=$(ls -d .planning/phases/[0-9]*-* 2>/dev/null | sort)
```

If no directories found:
```
No phase directories found in .planning/phases/.
Run /sunco:execute <phase> before auditing UAT.
```

Stop.

For each directory, read the phase number and name from the directory name pattern `NN-slug`:
```bash
for dir in $PHASE_DIRS; do
  PHASE_NUM=$(basename "$dir" | grep -oE "^[0-9]+")
  PHASE_SLUG=$(basename "$dir" | sed "s/^[0-9]*-//")
done
```

Apply filters:
- If `MILESTONE_FILTER` set: skip phases not in that milestone (check CONTEXT.md frontmatter `milestone:` field).
- If `PHASE_FILTER` set: skip phases whose number does not match.

**Only audit phases that are at least executed.** Determine execution status:
```bash
HAS_VERIFICATION=$(test -f "${dir}/${PHASE_NUM}-VERIFICATION.md" && echo "yes" || echo "no")
HAS_ANY_SUMMARY=$(ls "${dir}/"*"-SUMMARY.md" 2>/dev/null | wc -l)
```

If neither a VERIFICATION.md nor any SUMMARY.md exists: classify as `not_executed` and skip from gap analysis (not a UAT gap — phase was never built).

---

## Step 3: Classify Each Phase

For each executed phase directory, check for UAT artifacts.

### UAT.md presence check

```bash
UAT_FILE="${dir}/UAT.md"
HAS_UAT=$(test -f "$UAT_FILE" && echo "yes" || echo "no")
```

### If UAT.md exists — classify coverage

Read the file and extract:

**Passing criteria count:**
```bash
PASS_COUNT=$(grep -c "\- \[x\]" "$UAT_FILE" 2>/dev/null || echo 0)
```

**Failing criteria count:**
```bash
FAIL_COUNT=$(grep -c "\- \[ \]" "$UAT_FILE" 2>/dev/null || echo 0)
```

**Overall result line** (if present):
```bash
OVERALL=$(grep -i "^Overall:" "$UAT_FILE" | head -1)
```

**Coverage classification:**

| Condition | Classification |
|-----------|---------------|
| UAT.md absent | `untested` |
| UAT.md present, 0 criteria checked | `untested` (stub only) |
| UAT.md present, FAIL_COUNT > 0 | `failing` |
| UAT.md present, all criteria pass, no `Overall: PASS` | `partial` |
| UAT.md present, all pass, Overall: PASS | `tested` |

Record per phase:
```json
{
  "phase": "03",
  "slug": "skill-system",
  "status": "untested",
  "uat_path": null,
  "pass_count": 0,
  "fail_count": 0,
  "note": "No UAT.md found"
}
```

---

## Step 4: Build Gap Report

Summarize findings:

```bash
TOTAL_PHASES=<count of executed phases audited>
TESTED_COUNT=<count with status "tested">
PARTIAL_COUNT=<count with status "partial">
UNTESTED_COUNT=<count with status "untested">
FAILING_COUNT=<count with status "failing">
```

### Console output

```
UAT Audit — {date}

{TOTAL_PHASES} executed phase(s) audited

  Tested:    {TESTED_COUNT}
  Partial:   {PARTIAL_COUNT}
  Untested:  {UNTESTED_COUNT}
  Failing:   {FAILING_COUNT}

--- Gaps ---

Untested phases:
  Phase {N}: {title} — no UAT.md
  Phase {N}: {title} — UAT.md is a stub (0 criteria checked)

Failing phases:
  Phase {N}: {title} — {FAIL_COUNT} criteria failing

Partial phases:
  Phase {N}: {title} — {PASS_COUNT} pass, no Overall: PASS line
```

If no gaps: `All {TOTAL_PHASES} executed phases have passing UAT. No action required.`

---

## Step 5: Write UAT-AUDIT.md

Write to `OUTPUT_PATH`:

```markdown
---
audit_type: uat
audited_at: {ISO timestamp}
milestone: {MILESTONE_FILTER or "all"}
total_phases: {N}
tested: {N}
partial: {N}
untested: {N}
failing: {N}
---

# UAT Audit Report

**Audited:** {ISO timestamp}
**Scope:** {milestone name or "all phases"}

---

## Summary

| Phase | Title | Status | Pass | Fail | UAT File |
|-------|-------|--------|------|------|----------|
| {N}   | {title} | tested   | {N} | 0  | UAT.md ✓ |
| {N}   | {title} | untested | —   | —  | missing  |
| {N}   | {title} | failing  | {N} | {N} | UAT.md ✗ |

---

## Gaps to Address

{For each untested phase:}
### Phase {N}: {title} — Untested

No UAT.md found. This phase has never been user-acceptance tested.

To create a UAT checklist:
```
/sunco:validate {N}
```
Or write UAT.md manually to `.planning/phases/{NN}-{slug}/UAT.md`.

{For each failing phase:}
### Phase {N}: {title} — Failing

UAT.md present but {FAIL_COUNT} criteria are not checked off:
{list unchecked criteria}

---

## Tested Phases

{For each tested phase: one line confirming pass count and Overall status.}

---

## Recommended Actions

1. {highest priority gap action}
2. {next action}
```

---

## Step 6: Finalize

If `--fail-on-gap` is set and there are any untested or failing phases:
```
UAT audit failed: {UNTESTED_COUNT + FAILING_COUNT} phase(s) have UAT gaps.
See: {OUTPUT_PATH}
```
Exit with non-zero status (for CI use).

Otherwise, always exit cleanly:
```
UAT audit complete. Report saved to {OUTPUT_PATH}.
```

---

## Error Handling

| Error | Response |
|-------|----------|
| No phase dirs found | Stop with instructions to run /sunco:execute first |
| CONTEXT.md unreadable | Skip milestone filter check, use directory name only |
| OUTPUT_PATH not writable | Print report to console, warn about write failure |
| `--fail-on-gap` in CI | Non-zero exit if any gap found |
