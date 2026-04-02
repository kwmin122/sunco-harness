# Audit Milestone Workflow

Audit a milestone before completing it. Checks that every phase has a passing VERIFICATION.md, that every milestone requirement maps to a completed phase, and produces an actionable PASS/FAIL report. Used by `/sunco:audit-milestone`.

---

## Overview

The audit is a pre-completion gate. It runs without modifying any files and produces a human-readable (or JSON) report. Audit results gate the `complete-milestone` workflow unless `--force` is used there.

Audit checks two dimensions:

1. **Phase verification**: does every phase in the milestone have a VERIFICATION.md with all layers passed?
2. **Requirements coverage**: does every milestone requirement map to at least one completed, verified phase?

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional (milestone name) | `MILESTONE_ID` | read from STATE.md |
| `--json` | `JSON_OUTPUT` | false |
| `--phase <N>` | `PHASE_FILTER` | unset (all phases) |
| `--verbose` | `VERBOSE` | false |
| `--fix-hints` | `FIX_HINTS` | true |

If `MILESTONE_ID` is not provided, read `current_milestone.name` from `.planning/STATE.md`.

---

## Step 2: Load Milestone Context

### Read STATE.md

```bash
cat .planning/STATE.md 2>/dev/null || { echo "No SUNCO project found."; exit 1; }
```

Extract:
- `current_milestone.name`
- `current_milestone.phases` — list of phase numbers belonging to this milestone
- `project_name`

### Read ROADMAP.md

```bash
cat .planning/ROADMAP.md 2>/dev/null
```

For each phase in `MILESTONE_PHASES`, extract:
- Phase name
- Phase goal (one-line description)
- Status field

### Read REQUIREMENTS.md

```bash
cat .planning/REQUIREMENTS.md 2>/dev/null || REQ_FILE_EXISTS=false
```

Extract all milestone-scoped requirements:
- Lines matching `REQ-[0-9]+` pattern, or numbered list items, or `- [ ]` / `- [x]` items
- For each requirement: ID, description, linked phase (if annotated), current status

### Resolve phases list

If `PHASE_FILTER` is set, restrict to only that phase number.

```bash
for PHASE_NUM in ${MILESTONE_PHASES}; do
  PADDED=$(printf "%02d" "$PHASE_NUM")
  PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-"*/ 2>/dev/null | head -1)
  PHASE_NAME=$(basename "${PHASE_DIR:-${PADDED}-unknown}" | sed "s/${PADDED}-//")
  echo "${PADDED}|${PHASE_NAME}|${PHASE_DIR}"
done
```

---

## Step 3: Phase Verification Audit

For each phase, check the following in sequence. Record result as `PASS`, `WARN`, or `FAIL`.

### Check 3.1: Phase directory exists

```bash
[[ -d "${PHASE_DIR}" ]] && echo "PASS" || echo "FAIL: directory missing"
```

A missing phase directory is a hard FAIL — no further checks for that phase.

### Check 3.2: VERIFICATION.md exists

```bash
VERIFY_FILE="${PHASE_DIR}${PADDED}-VERIFICATION.md"
[[ -f "$VERIFY_FILE" ]] && echo "PASS" || echo "FAIL: VERIFICATION.md not found"
```

If missing: FAIL. Set hint: "Run `/sunco:verify ${PADDED}` to generate VERIFICATION.md."

### Check 3.3: All plans have SUMMARY.md

```bash
PLAN_COUNT=$(ls "${PHASE_DIR}"*"-PLAN.md" 2>/dev/null | wc -l | tr -d ' ')
SUMMARY_COUNT=$(ls "${PHASE_DIR}"*"-SUMMARY.md" 2>/dev/null | wc -l | tr -d ' ')
MISSING=$((PLAN_COUNT - SUMMARY_COUNT))
```

If `MISSING > 0`: FAIL. Set hint: "Run `/sunco:execute ${PADDED}` to complete ${MISSING} remaining plan(s)."

### Check 3.4: VERIFICATION.md overall result is PASS

```bash
OVERALL=$(grep -i "^## Overall:" "$VERIFY_FILE" 2>/dev/null | head -1)
```

Parse: if line contains `PASS` → PASS; if `NEEDS FIXES` or `FAIL` → FAIL; if ambiguous → WARN.

### Check 3.5: Individual layer results

```bash
# Extract layer result table from VERIFICATION.md
grep -A8 "^| Layer" "$VERIFY_FILE" 2>/dev/null | grep "^| [0-9]"
```

For each layer row, extract result column:
- `PASS` → pass
- `WARN` → warn (does not block overall, but note it)
- `FAIL` → fail (blocks overall audit)
- `SKIPPED` → acceptable for layers 5 and 6 only

Record per-layer results:

| Layer | Name | Result |
|-------|------|--------|
| 1 | Multi-agent review | {result} |
| 2 | Guardrails | {result} |
| 3 | BDD criteria | {result} |
| 4 | Permission audit | {result} |
| 5 | Adversarial | {result} |
| 6 | Cross-model | {result} |

### Check 3.6: No open issues in VERIFICATION.md

```bash
OPEN_ISSUES=$(grep -c "^- \[ \]" "$VERIFY_FILE" 2>/dev/null || echo "0")
```

If `OPEN_ISSUES > 0`: WARN. "Phase ${PADDED} has ${OPEN_ISSUES} unresolved issue(s) in VERIFICATION.md."

### Phase audit result

Aggregate all checks:
- Any `FAIL` → phase result = `FAIL`
- No `FAIL`, at least one `WARN` → phase result = `WARN`
- All `PASS` (SKIPs allowed for layers 5-6) → phase result = `PASS`

---

## Step 4: Requirements Coverage Audit

### Map requirements to phases

For each requirement in REQUIREMENTS.md:

1. Check if the requirement has an explicit phase annotation (e.g., `(Phase 02)`, `@phase:02`, or a link to a phase file)
2. If annotated: check that the annotated phase is in the milestone and has result `PASS`
3. If not annotated: search CONTEXT.md files across all milestone phases for any mention of the requirement ID or key term

```bash
for REQ in "${REQUIREMENTS[@]}"; do
  REQ_ID=$(echo "$REQ" | grep -oP "REQ-\d+" | head -1)
  REQ_TEXT=$(echo "$REQ" | sed 's/REQ-[0-9]*://' | xargs)

  # Search phase CONTEXT.md files
  FOUND_IN=""
  for PHASE_NUM in ${MILESTONE_PHASES}; do
    PADDED=$(printf "%02d" "$PHASE_NUM")
    CONTEXT_FILE=$(ls ".planning/phases/${PADDED}-"*"/CONTEXT.md" 2>/dev/null | head -1)
    if [[ -f "$CONTEXT_FILE" ]]; then
      grep -qi "${REQ_ID}\|${REQ_TEXT:0:30}" "$CONTEXT_FILE" && FOUND_IN="${FOUND_IN} ${PADDED}"
    fi
  done

  if [[ -n "$FOUND_IN" ]]; then
    echo "COVERED|${REQ_ID}|${REQ_TEXT:0:60}|Phase(s):${FOUND_IN}"
  else
    echo "UNCOVERED|${REQ_ID}|${REQ_TEXT:0:60}|no matching phase"
  fi
done
```

### Coverage summary

- `covered_count` — requirements found in a verified phase
- `uncovered_count` — requirements with no phase match
- `coverage_pct` — `covered_count / total * 100`

Uncovered requirements are WARN if coverage >= 80%, FAIL if coverage < 80%.

---

## Step 5: Identify Gaps

Compile all failures and warnings into a structured gap list:

### Unverified phases (FAIL-level gaps)

Phases that are in the milestone but have no VERIFICATION.md or have a FAIL result:

```
Gap Type: UNVERIFIED_PHASE
Phase: {N} — {name}
Reason: VERIFICATION.md missing / Layer 2 FAILED
Fix: /sunco:verify {N}
```

### Incomplete phases (FAIL-level gaps)

Phases with plans that have no SUMMARY.md:

```
Gap Type: INCOMPLETE_PHASE
Phase: {N} — {name}
Missing: {count} SUMMARY.md file(s)
Fix: /sunco:execute {N}
```

### Uncovered requirements (WARN or FAIL)

Requirements not traceable to any milestone phase:

```
Gap Type: UNCOVERED_REQUIREMENT
Requirement: {REQ_ID} — {description}
Fix: Add a phase that covers this requirement, or annotate the existing phase
```

### Lint debt (WARN)

Open `- [ ]` items in any VERIFICATION.md:

```
Gap Type: OPEN_VERIFICATION_ITEM
Phase: {N}
Item: {text of unchecked item}
```

---

## Step 6: Compute Overall Audit Result

```
AUDIT = PASS  if: no FAIL gaps and coverage >= 80%
AUDIT = WARN  if: no FAIL gaps but coverage < 80%, or any WARN gaps
AUDIT = FAIL  if: any FAIL gaps exist
```

Record:
- `audit_result`: PASS / WARN / FAIL
- `fail_count`: count of FAIL-level gaps
- `warn_count`: count of WARN-level gaps
- `coverage_pct`: requirements coverage percentage

---

## Step 7: Render Report

### Human-readable output (default)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MILESTONE AUDIT: {MILESTONE_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Overall: {PASS / WARN / FAIL}
  Phases audited: {count}
  Requirements checked: {count}

## Phase Verification

  | Phase | Name | Plans | Verified | L1 | L2 | L3 | L4 | L5 | L6 | Result |
  |-------|------|-------|----------|----|----|----|----|----|----|----|
  | 01 | {name} | {N}/{N} | yes | P | P | P | P | P | S | PASS |
  | 02 | {name} | {N}/{N} | yes | P | P | W | P | S | S | WARN |
  | 03 | {name} | {N}/{N} | no  | — | — | — | — | — | — | FAIL |
  | 04 | {name} | {2}/{5} | no  | — | — | — | — | — | — | FAIL |

  Legend: P=Pass W=Warn F=Fail S=Skipped —=N/A

## Requirements Coverage

  Covered:   {covered}/{total} ({pct}%)
  Uncovered: {uncovered_count}

  {If uncovered_count > 0:}
  Uncovered requirements:
    - {REQ_ID}: {description}
    - {REQ_ID}: {description}

## Gaps Found

  {If no gaps:}
  No gaps found. Milestone is ready to complete.

  {If gaps:}
  FAIL ({fail_count}):
    - Phase 03: VERIFICATION.md missing
      Fix: /sunco:verify 03
    - Phase 04: 3 plans not executed
      Fix: /sunco:execute 04

  WARN ({warn_count}):
    - Phase 02: Layer 3 (BDD) partial — 2/5 criteria met
    - REQ-07: not traced to any phase

## Recommendation

  {If PASS:}
  All checks passed. Run /sunco:milestone complete to finalize.

  {If WARN:}
  Milestone can be completed with warnings. Gaps are documented.
  To address gaps first: /sunco:plan-milestone-gaps

  {If FAIL:}
  Milestone has blocking gaps. Resolve before completing.
  To create plans for gaps: /sunco:plan-milestone-gaps

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Verbose output (--verbose)

In verbose mode, after each phase row, print the full layer breakdown for that phase and quote the relevant VERIFICATION.md excerpt.

---

## Step 8: JSON Output (--json)

If `--json`:

```json
{
  "milestone": "{MILESTONE_NAME}",
  "audit_result": "PASS | WARN | FAIL",
  "generated": "{ISO timestamp}",
  "phases": [
    {
      "number": "01",
      "name": "{phase name}",
      "plans_total": 4,
      "plans_executed": 4,
      "verification_exists": true,
      "overall_result": "PASS",
      "layers": {
        "1_review": "PASS",
        "2_guardrails": "PASS",
        "3_bdd": "PASS",
        "4_permissions": "PASS",
        "5_adversarial": "SKIPPED",
        "6_crossmodel": "SKIPPED"
      },
      "open_issues": 0,
      "audit_result": "PASS"
    }
  ],
  "requirements": {
    "total": 12,
    "covered": 10,
    "uncovered": 2,
    "coverage_pct": 83,
    "uncovered_items": [
      {"id": "REQ-07", "description": "{text}", "phase_hint": null}
    ]
  },
  "gaps": {
    "fail": [
      {"type": "UNVERIFIED_PHASE", "phase": "03", "reason": "VERIFICATION.md missing", "fix": "/sunco:verify 03"}
    ],
    "warn": [
      {"type": "OPEN_VERIFICATION_ITEM", "phase": "02", "item": "Fix rate limiting edge case"}
    ]
  },
  "summary": {
    "fail_count": 1,
    "warn_count": 2,
    "phases_passing": 3,
    "phases_failing": 1,
    "ready_to_complete": false
  }
}
```

---

## Route

If `AUDIT_RESULT = PASS`: "Milestone audit passed. Run `/sunco:milestone complete` to finalize."

If `AUDIT_RESULT = WARN`: "Milestone has warnings. You can complete it now or address gaps first with `/sunco:plan-milestone-gaps`."

If `AUDIT_RESULT = FAIL`: "Milestone has blocking gaps. Resolve them or run `/sunco:plan-milestone-gaps` to create remediation plans."

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` first." |
| STATE.md missing `current_milestone` | "No active milestone found. Provide milestone name as argument." |
| No phases in milestone | "No phases found for milestone '{name}'. Check ROADMAP.md." |
| REQUIREMENTS.md missing | Skip requirements coverage section. Show note: "No REQUIREMENTS.md — requirements coverage not checked." |
| Phase directory missing | Mark phase as FAIL, continue with remaining phases. |
| VERIFICATION.md unparseable | WARN: "Could not parse VERIFICATION.md for phase {N}. Review manually." |
