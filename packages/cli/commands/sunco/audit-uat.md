---
name: sunco:audit-uat
description: Cross-phase audit of all outstanding UAT and verification items. Identifies phases that were executed but never verified or user-accepted.
argument-hint: "[--fix] [--phase N]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - AskUserQuestion
---

<context>
**Flags:**
- `--fix` — After identifying gaps, create gap-closure plans automatically.
- `--phase N` — Audit a specific phase only. Default: all phases.
</context>

<objective>
Audit all phases to ensure UAT (User Acceptance Testing) and verification were properly completed. Finds phases that were executed without verification, or verification that passed automatically without real user confirmation.

**Creates:**
- `.planning/UAT-AUDIT.md` — audit report with gaps and remediation plan
</objective>

<process>
## Step 1: Scan all phase artifacts

For each phase in ROADMAP.md that shows as complete:
1. Check if VERIFICATION.md exists
2. Check if VERIFICATION.md shows OVERALL PASS
3. Check if all 5 verification layers were run (or explicitly skipped)
4. Check if any PLAN.md has UAT acceptance criteria that were never verified

```bash
find .planning/phases/ -name "*-VERIFICATION.md" | sort
find .planning/phases/ -name "*-PLAN.md" | sort
```

## Step 2: Check each plan's done_when criteria

For each PLAN.md, read the `done_when` section.
For each criterion: check if a corresponding SUMMARY.md or VERIFICATION.md confirms it was met.

Mark as:
- VERIFIED — criterion is confirmed in artifacts
- UNVERIFIED — no artifact confirms this criterion
- SKIPPED — explicitly documented as skipped with reason

## Step 3: Identify gaps

Categorize gaps:
1. **No verification at all** — phase executed but VERIFICATION.md missing
2. **Partial verification** — some layers skipped without justification
3. **Unconfirmed criteria** — done_when items with no evidence
4. **Stale verification** — verification was done but code was modified after

## Step 4: Write audit report

```markdown
# UAT Audit Report

## Date
[timestamp]

## Summary
- Phases audited: [N]
- Fully verified: [N]
- Gaps found: [N]
- Critical gaps: [N]

## Results By Phase

### Phase [N]: [title] — [PASS/GAP]
- Verification file: [exists/missing]
- Layers complete: [N/5]
- Unverified criteria: [N]
  - [criterion text]
- Notes: [...]

## All Gaps

### Critical (no verification at all)
[list]

### Medium (partial verification)
[list]

### Low (minor unconfirmed criteria)
[list]

## Remediation Plan
[If --fix: list of gap-closure phases to create]
[Otherwise: manual action items]
```

## Step 5: If --fix

For each gap phase: create a gap-closure plan:
- Add to ROADMAP.md with `gap_closure: true` in frontmatter
- Phase number: [original-phase].gap

Ask: "Create [N] gap-closure phases? [yes/no]"

## Step 6: Report

Show audit summary.
If gaps found: "Run `/sunco:audit-uat --fix` to create gap-closure plans."
If no gaps: "All phases verified. UAT audit passed."
</process>
