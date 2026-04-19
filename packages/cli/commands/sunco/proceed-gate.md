---
name: sunco:proceed-gate
description: Final proceed gate after verify. Blocks unresolved findings per HIGH/MEDIUM/LOW severity policy; cross-domain findings (Phase 49/M4.2) consumed when present; --allow-low-open permits LOW pass-through (HIGH/MED remain blocked).
argument-hint: "<phase> [--allow-low-open]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
STOP-THE-LINE gate that runs AFTER `/sunco:verify` and BEFORE any `/sunco:ship`, `/sunco:release`, or `/sunco:update`. This is NOT a layer within verify — it is the final checkpoint that ensures verify's findings are fully resolved before anything ships.

Zero **blocking** unresolved findings: every finding must be resolved, every "fixed" claim must have fresh evidence, and mitigations/suppressions are flagged separately from root fixes. Carry-forward of unresolved findings is prohibited.

**Phase 49/M4.2 cross-domain layer (additive, non-regressive):** When `.planning/domains/contracts/CROSS-DOMAIN-FINDINGS.md` exists for the phase, this gate also consumes cross-domain findings and applies a severity × state policy:

- `HIGH` + `open` → **HARD BLOCK** (no override, no flag bypass — schema also rejects HIGH dismissal structurally)
- `MEDIUM` + `open` → **BLOCK** (dismissible via human-edited `overrides[]` lifecycle entry with `dismissed_rationale` ≥50 chars)
- `LOW` + `open` → **BLOCK** by default; `--allow-low-open` flag on this gate permits pass-through (HIGH/MED still blocked when flag is set)
- All `resolved` (with `resolved_commit`) or `dismissed-with-rationale` (MED/LOW only) → **PASS**

When CROSS-DOMAIN-FINDINGS.md is **absent** for the phase, existing VERIFICATION.md-only behavior is preserved byte-for-byte — non-cross-domain phases (single-domain or no-SPEC phases) see zero behavior change.
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
ALLOW_LOW_OPEN="${ALLOW_LOW_OPEN:-0}"  # set to 1 when --allow-low-open flag parsed
CROSS_DOMAIN_FINDINGS=".planning/domains/contracts/CROSS-DOMAIN-FINDINGS.md"
```

## Step 1.5: Cross-domain findings consumption (Phase 49/M4.2)

If `$CROSS_DOMAIN_FINDINGS` exists, load its auto-generated findings block and human-edited lifecycle overrides. Apply severity × state policy in Step 7 verdict. If absent, skip this step — existing VERIFICATION.md-only behavior preserved for non-cross-domain phases.

```bash
if [ -f "$CROSS_DOMAIN_FINDINGS" ]; then
  node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    import { parseLifecycleOverrides } from './packages/cli/references/cross-domain/src/extract-spec-block.mjs';
    const md = readFileSync('$CROSS_DOMAIN_FINDINGS', 'utf8');
    const fStart = md.indexOf('<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-START -->');
    const fEnd = md.indexOf('<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-END -->');
    const body = fStart !== -1 && fEnd !== -1 ? md.slice(fStart, fEnd) : '';
    // Parse findings YAML (rule/severity/state tuples) — tolerant regex parser
    const findings = [];
    const re = /- rule:\s*(\S+)[\s\S]*?severity:\s*(HIGH|MEDIUM|LOW)[\s\S]*?file:\s*(\S+)[\s\S]*?line:\s*(\d+)[\s\S]*?state:\s*(\S+)/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      findings.push({ rule: m[1], severity: m[2], file: m[3], line: Number(m[4]), state: m[5] });
    }
    const { overrides } = parseLifecycleOverrides(md);
    const overrideById = new Map(overrides.map(o => [o.id, o]));
    // Effective state = override.state (if exists) else finding.state
    const effective = findings.map(f => {
      const id = f.rule + ':' + f.file + ':' + f.line;
      const ov = overrideById.get(id);
      return { ...f, effective_state: ov?.state ?? f.state, override: ov };
    });
    console.log(JSON.stringify({ findings: effective }));
  " > /tmp/cross-domain-state.json
  CROSS_DOMAIN_ACTIVE=1
else
  CROSS_DOMAIN_ACTIVE=0
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

--- CROSS-DOMAIN LAYER (Phase 49/M4.2) ---

[If CROSS_DOMAIN_ACTIVE=1:]
  Findings (effective state):
    HIGH open:   [N]  (HARD BLOCK — no override)
    MEDIUM open: [N]  (BLOCK — dismissible with ≥50-char rationale)
    LOW open:    [N]  (BLOCK default; --allow-low-open pass-through)
    resolved:    [N]
    dismissed:   [N]  (MED/LOW only — HIGH dismissal schema-rejected)

[If CROSS_DOMAIN_ACTIVE=0:]
  Cross-domain layer not active (no CROSS-DOMAIN-FINDINGS.md for this phase).

--- VERDICT ---
```

## Step 7: Render decision

Three possible outcomes. Cross-domain layer verdict contributes when active; otherwise existing VERIFICATION.md logic stands alone.

### BLOCKED
Any blocking unresolved finding remains. Cross-domain severity × state policy:

- `HIGH` + `open` → **HARD BLOCK** (no override, no flag bypass — also caught by schema oneOf rejection of HIGH+dismissed-with-rationale)
- `MEDIUM` + `open` → **BLOCK** — dismissible only via human-edited `overrides[]` entry in the CROSS-DOMAIN-LIFECYCLE region with `state: dismissed-with-rationale` + `dismissed_rationale` ≥50 chars
- `LOW` + `open` → **BLOCK** by default; `--allow-low-open` flag lets the gate PROCEED on LOW-only (HIGH/MED still block even when flag is set)
- VERIFICATION.md unresolved findings continue to BLOCK per existing policy

```
DECISION: BLOCKED
Reason: [N] blocking unresolved finding(s) [+ cross-domain HIGH/MED/LOW counts when active]
Action: Fix findings and re-run /sunco:verify [N], then re-run /sunco:proceed-gate [N]
```

### CHANGES_REQUIRED
All blocking findings technically resolved, but mitigations/suppressions present that user must acknowledge.
```
DECISION: CHANGES_REQUIRED
Reason: [N] mitigation(s) and [N] suppression(s) require acknowledgment
Action: Review flagged items below. Acknowledge each to proceed.
```

If `CHANGES_REQUIRED`: use AskUserQuestion to present each mitigation/suppression and ask for explicit acknowledgment. Only after ALL are acknowledged, upgrade to PROCEED.

### PROCEED
All blocking findings root-fixed with fresh evidence. Zero mitigations, zero suppressions, zero blocking unresolved. When cross-domain layer is active: zero HIGH+open, zero MED+open, zero LOW+open (unless `--allow-low-open` flag was passed, in which case LOW+open is permitted pass-through).
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
- BLOCKED if ANY blocking unresolved finding remains (VERIFICATION.md unresolved OR cross-domain HIGH/MED+open, or cross-domain LOW+open without `--allow-low-open`)
- CHANGES_REQUIRED if mitigations/suppressions exist, with user acknowledgment flow
- PROCEED only when all blocking findings root-fixed with fresh evidence (and cross-domain layer passes severity × state policy, when active)
- Cross-domain layer: HIGH+open is hard-blocked (no override); MED+open requires dismissed-with-rationale override (≥50 chars); LOW+open requires `--allow-low-open` flag for pass-through
- Non-cross-domain phases (CROSS-DOMAIN-FINDINGS.md absent) retain existing ship verification behavior — no regression
- Gate result logged to phase directory
- No skip mechanism for HIGH; only `--allow-low-open` for LOW severity bypass
</success_criteria>
