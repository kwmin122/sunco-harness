---
name: sunco:proceed-gate
description: Final proceed gate — must pass after verify, before ship/release/update. Zero unresolved findings.
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
STOP-THE-LINE gate that runs AFTER `/sunco:verify` and BEFORE any `/sunco:ship`, `/sunco:release`, or `/sunco:update`. This is NOT a layer within verify — it is the final checkpoint that ensures verify's findings are fully resolved before anything ships.

Zero tolerance: every finding must be resolved, every "fixed" claim must have fresh evidence, and mitigations/suppressions are flagged separately from root fixes. Carry-forward of unresolved findings is prohibited.
</objective>

<process>
## Step 1: Locate verification results

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
VERIFICATION="$PHASE_DIR/${PHASE}-VERIFICATION.md"
if [ ! -f "$VERIFICATION" ]; then
  echo "BLOCKED: No verification file found. Run /sunco:verify ${PHASE} first."
  exit 1
fi
```

## Step 2: Check all 7 verify layers passed or findings resolved

Parse the verification file for per-layer results:

```bash
grep -E '(Layer [1-7]|PASS|FAIL|NEEDS|BLOCKED|SKIP)' "$VERIFICATION"
```

For each layer (1-7):
- **PASS**: Record as passed.
- **SKIP (with flag)**: Record as explicitly skipped. Acceptable only if the skip flag was used (e.g., `--skip-adversarial`).
- **FAIL / NEEDS FIXES**: Check if findings are listed. Every finding MUST have a resolution status.

If any layer shows FAIL without resolved findings: `BLOCKED`.

## Step 3: Enumerate ALL findings

Extract every finding from the verification file — not just failures, ALL findings including warnings, notes, and low-severity items:

```bash
grep -n -E '(Finding|Issue|Warning|Error|FAIL|TODO|FIXME|HACK)' "$VERIFICATION"
```

Build a findings list. For EACH finding, determine its status:
- **Resolved (root fix)**: Code was changed to eliminate the issue. Requires evidence.
- **Resolved (mitigation)**: Issue mitigated but root cause remains. Flag explicitly.
- **Resolved (suppression)**: Issue suppressed via config/ignore. Flag explicitly.
- **Unresolved**: No action taken. BLOCK.

Record the count of each status type.

## Step 4: Verify fresh evidence for every "fixed" claim

For EVERY finding marked as "fixed" or "resolved", re-run the original check to confirm:

```bash
# For each resolved finding:
#   1. Identify the original check command
#   2. Re-run it NOW (do not trust cached/prior results)
#   3. Confirm the finding no longer appears
```

This is the critical difference from verify itself: proceed-gate does not trust prior results. It re-checks everything. If a "fixed" finding still reproduces: `BLOCKED`.

### Evidence collection examples:

For lint findings:
```bash
npx eslint [file] --no-warn-ignored 2>&1 | grep -c 'error'
```

For test findings:
```bash
npx vitest run [test-file] --reporter=verbose 2>&1
```

For type findings:
```bash
npx tsc --noEmit 2>&1 | grep -c 'error'
```

For runtime findings:
```bash
node -e "[reproduction command]" 2>&1
```

## Step 5: Flag mitigations and suppressions

Collect all findings resolved via mitigation or suppression (not root fix):

```
MITIGATIONS:
  - [finding]: [what was mitigated, why root fix deferred]

SUPPRESSIONS:
  - [finding]: [what was suppressed, justification]
```

These are NOT counted as root fixes. They are flagged separately in the report. The user must acknowledge them.

## Step 6: Findings-first report

The report lists what was FOUND before declaring any status. This prevents the "everything looks green" trap where findings are buried under pass labels.

```
=== PROCEED GATE REPORT ===
Phase: [N]

--- FINDINGS (listed BEFORE verdict) ---

Total findings: [N]
  Root-fixed:   [N] (re-verified with fresh evidence)
  Mitigated:    [N] (flagged, not root-fixed)
  Suppressed:   [N] (flagged, not root-fixed)
  Unresolved:   [N]

[For each finding:]
  [ID] [severity] [layer] [description]
    Status: [root-fixed / mitigated / suppressed / unresolved]
    Evidence: [fresh check result]

--- LAYER STATUS ---

Layer 1 (Multi-agent review):  [PASS / resolved]
Layer 2 (Guardrails):          [PASS / resolved]
Layer 3 (BDD criteria):        [PASS / resolved]
Layer 4 (Permission audit):    [PASS / resolved]
Layer 5 (Adversarial):         [PASS / resolved / skipped]
Layer 6 (Cross-model):         [PASS / resolved / skipped]
Layer 7 (Human eval):          [PASS / resolved / skipped]

--- VERDICT ---
```

## Step 7: Render decision

Three possible outcomes:

### BLOCKED
Any unresolved finding remains. ANY — including low severity. Carry-forward prohibited.
```
DECISION: BLOCKED
Reason: [N] unresolved finding(s)
Action: Fix findings and re-run /sunco:verify [N], then re-run /sunco:proceed-gate [N]
```

### CHANGES_REQUIRED
All findings technically resolved, but mitigations/suppressions present that user must acknowledge.
```
DECISION: CHANGES_REQUIRED
Reason: [N] mitigation(s) and [N] suppression(s) require acknowledgment
Action: Review flagged items below. Acknowledge each to proceed.
```

If `CHANGES_REQUIRED`: use AskUserQuestion to present each mitigation/suppression and ask for explicit acknowledgment. Only after ALL are acknowledged, upgrade to PROCEED.

### PROCEED
All findings root-fixed with fresh evidence. Zero mitigations, zero suppressions, zero unresolved.
```
DECISION: PROCEED
Evidence: All [N] findings root-fixed with fresh verification
Action: Safe to run /sunco:ship [N] or /sunco:release
```

## Step 8: Record gate result

Write gate result to the phase directory:

```bash
# Append to or create gate log
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] PROCEED GATE: $DECISION" >> "$PHASE_DIR/${PHASE}-GATES.log"
```
</process>

<success_criteria>
- Verification file exists and all 7 layers accounted for (passed, resolved, or explicitly skipped)
- Every finding enumerated — zero findings missed, including low-severity
- Fresh evidence collected for every "fixed" claim — no trust of prior results
- Mitigations and suppressions flagged separately, not counted as root fixes
- Findings listed BEFORE verdict in report (findings-first format)
- BLOCKED if ANY unresolved finding, regardless of severity
- CHANGES_REQUIRED if mitigations/suppressions exist, with user acknowledgment flow
- PROCEED only when all findings root-fixed with fresh evidence
- Gate result logged to phase directory
- No skip mechanism, no severity-based bypass
</success_criteria>
