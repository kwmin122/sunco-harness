---
name: sunco:plan-gate
description: Plan-level verification gate — validates product contract compliance before planning proceeds
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
STOP-THE-LINE gate that validates a plan declares all required impact metadata before planning proceeds. A plan that omits runtime impact, install impact, docs impact, contract references, or smoke commands is a plan that will silently break the product. This gate catches those omissions before any code is written.

This gate runs after `/sunco:plan` produces plan files and BEFORE `/sunco:execute`. If any check fails, the plan is BLOCKED — no skip, no override, no "we'll fix it later."
</objective>

<process>
## Step 1: Locate plan files

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  echo "BLOCKED: No phase directory found for phase ${PHASE}"
  exit 1
fi
PLAN_FILES=$(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null)
if [ -z "$PLAN_FILES" ]; then
  echo "BLOCKED: No plan files found in $PHASE_DIR"
  exit 1
fi
```

## Step 2: Check each plan for required declarations

For EVERY plan file in the phase directory, verify these five mandatory sections exist and are non-empty:

### Check 2a: Runtime impact declared

Search each plan for a `runtime_impact:` field or `## Runtime Impact` section. Valid values: `none`, `cli`, `installer`, `hooks`, `runtime`, `config`. An empty or missing declaration is a BLOCK.

```bash
grep -l -E '(runtime_impact:|## Runtime Impact)' "$PHASE_DIR"/*-PLAN.md
```

If a plan is missing: record `BLOCKED: [plan-file] missing runtime impact declaration`.

### Check 2b: Install/update/release impact declared

Search each plan for `install_impact:` field or `## Install Impact` section. This declares whether the change affects `npm install`, `npx sunco`, update flows, or release artifacts.

```bash
grep -l -E '(install_impact:|## Install Impact)' "$PHASE_DIR"/*-PLAN.md
```

If missing: record `BLOCKED: [plan-file] missing install/update/release impact declaration`.

### Check 2c: Docs to update listed

Search each plan for `docs_update:` field or `## Docs Update` section. Must list specific files or explicitly state `none`. An empty list is acceptable only if the value is literally `none`.

```bash
grep -l -E '(docs_update:|## Docs Update)' "$PHASE_DIR"/*-PLAN.md
```

If missing: record `BLOCKED: [plan-file] missing docs update declaration`.

### Check 2d: Product contract references listed

Search each plan for `contracts:` field or `## Product Contracts` section. Must reference which product contracts (from `.planning/CONTRACTS.md` or equivalent) this plan touches. Valid to say `none` for pure-internal changes.

```bash
grep -l -E '(contracts:|## Product Contracts)' "$PHASE_DIR"/*-PLAN.md
```

If missing: record `BLOCKED: [plan-file] missing product contract references`.

### Check 2e: Smoke commands listed

Search each plan for `smoke_commands:` field or `## Smoke Commands` section. Must list concrete CLI commands that verify the plan's implementation works after execution. At least one command required per plan.

```bash
grep -l -E '(smoke_commands:|## Smoke Commands)' "$PHASE_DIR"/*-PLAN.md
```

If missing: record `BLOCKED: [plan-file] missing smoke commands`.

## Step 3: Aggregate findings

Collect all findings into a structured report:

```
=== PLAN GATE REPORT ===
Phase: [N]
Plans checked: [count]

[For each plan:]
  [plan-file]:
    Runtime impact:    [PASS / BLOCKED]
    Install impact:    [PASS / BLOCKED]
    Docs update:       [PASS / BLOCKED]
    Product contracts: [PASS / BLOCKED]
    Smoke commands:    [PASS / BLOCKED]

VERDICT: [PASS / BLOCKED]
Blocked items: [count]
```

## Step 4: Enforce verdict

- If ALL checks pass for ALL plans: output `PLAN GATE: PASS` — planning may proceed to execution.
- If ANY check fails for ANY plan: output `PLAN GATE: BLOCKED` with the full list of failures. Do NOT proceed. Do NOT offer workarounds.

The blocked output must include specific instructions for what to add to each failing plan file.
</process>

<success_criteria>
- Every plan file in the phase checked against all 5 required declarations
- Zero false passes — missing or empty declarations caught
- BLOCKED verdict if ANY plan is missing ANY declaration
- Clear, actionable report listing exactly what each plan needs
- No skip mechanism, no override flag, no "proceed anyway" option
</success_criteria>
