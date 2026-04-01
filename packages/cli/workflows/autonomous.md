# Autonomous Pipeline Workflow

Full autonomous pipeline. Drives all remaining milestone phases without human intervention. For each incomplete phase: discuss → plan → execute → verify. Pauses only for explicit blockers, grey-area acceptance criteria, or budget ceiling. Re-reads ROADMAP.md after each phase to catch dynamically inserted phases. SUNCO-specific: mandatory lint-gate is enforced at every phase boundary.

Used by `/sunco:auto`.

---

## Core Principle

The orchestrator never executes work directly. It discovers phases, sequences them, delegates each stage to the appropriate workflow, and enforces the lint-gate checkpoint between phases. Crash recovery is built in: completed phases are skipped on re-entry. Budget and stuck detection prevent infinite loops.

Orchestrator responsibility chain:

```
parse_args → initialize → discover_phases → budget_check
→ for each phase: progress_banner → smart_discuss → plan → execute
  → lint_gate → verify → adaptive_replan → transition
→ completion_summary
```

---

## Step 1: parse_args

Parse `$ARGUMENTS` for flags before loading any context.

| Token | Variable | Default |
|-------|----------|---------|
| `--from N` | `FROM_PHASE` | unset (all incomplete) |
| `--only N` | `ONLY_PHASE` | unset |
| `--max-phases N` | `MAX_PHASES` | `0` (unlimited) |
| `--max-tokens N` | `MAX_TOKENS` | from config or `0` |
| `--no-discuss` | `SKIP_DISCUSS` | false |
| `--no-verify` | `SKIP_VERIFY` | false |
| `--dry-run` | `DRY_RUN` | false |

Rules:
- `--from N` — skip all phases before N (numeric, handles decimals like `5.1`)
- `--only N` — run exactly one phase; implies `--max-phases 1`
- `--max-phases 0` — unlimited (default)
- `--dry-run` — display phase plan but execute nothing
- Unrecognized flags → warn and ignore (do not error)

---

## Step 2: initialize

Bootstrap via milestone-level init:

```bash
INIT=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init milestone-op)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON fields:

| Field | Description |
|-------|-------------|
| `milestone_version` | e.g. `"v0.2"` |
| `milestone_name` | Human name |
| `phase_count` | Total phases in milestone |
| `completed_phases` | Count of phases with disk_status complete |
| `roadmap_exists` | bool |
| `state_exists` | bool |
| `budget_ceiling` | Max tokens from config (0 = unlimited) |
| `commit_docs` | bool — commit planning artifacts after each phase |

**Hard errors:**
- `roadmap_exists: false` → abort: "No ROADMAP.md found. Run `/sunco:new` first."
- `state_exists: false` → abort: "No STATE.md found. Run `/sunco:init` to restore harness."

Load checkpoint state:

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load
```

Parse `last_completed_phase`, `checkpoint_phase`, `retry_counts` (map of phase → retry count).

Display startup banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone : {milestone_version} — {milestone_name}
 Phases    : {phase_count} total, {completed_phases} complete
 Budget    : {MAX_TOKENS > 0 ? MAX_TOKENS + " tokens max" : "unlimited"}
 Lint gate : enforced at each phase boundary
```

---

## Step 3: discover_phases

Analyze ROADMAP.md to build the phase execution list:

```bash
ROADMAP=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" roadmap analyze)
```

Parse the `phases` array. Each phase has: `number`, `name`, `goal`, `disk_status`, `roadmap_complete`.

**Filter to incomplete phases:**
Keep phases where `disk_status !== "complete"` OR `roadmap_complete === false`.

**Apply `--from` filter:** Drop phases where `number < FROM_PHASE` (numeric comparison).

**Apply `--only` filter:** Keep only the matching phase.

**Apply `--max-phases` cap:** If `MAX_PHASES > 0`, truncate list to first `MAX_PHASES` entries.

**Sort by `number` ascending** (numeric, not lexicographic).

**If no incomplete phases remain:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS — ALL PHASES COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases are complete for this milestone.
 Next: run `/sunco:milestone complete` to archive and tag.
```

Exit cleanly.

**Display phase plan:**

```
## Execution Plan

| # | Phase | Status |
|---|-------|--------|
| 3 | Config System         | In Progress |
| 4 | Skill Loader          | Not Started |
| 5 | Agent Router          | Not Started |

Phases to execute: {N}
```

---

## Step 4: budget_check

Evaluate token budget before starting the loop:

```bash
CURRENT_TOKENS=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state get session.tokens_used 2>/dev/null || echo "0")
```

If `MAX_TOKENS > 0` AND `CURRENT_TOKENS >= MAX_TOKENS`:

```
Budget ceiling reached before starting ({CURRENT_TOKENS} / {MAX_TOKENS} tokens used).
Run `/sunco:auto --from {next_phase}` to continue from where this stopped.
```

Exit cleanly.

If `MAX_TOKENS > 0` AND `CURRENT_TOKENS >= MAX_TOKENS * 0.9`:

Display warning: "Approaching budget ceiling ({CURRENT_TOKENS} / {MAX_TOKENS} tokens). {phases_remaining} phases remain."

---

## Step 5: phase loop

For each phase in the execution list, run the full pipeline. Track `PHASE_RETRY` (default 0) per phase.

### 5a. progress_banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS ▸ Phase {N}/{T}: {Name}
 Progress: [████████░░░░░░░░] {P}%   Retry: {PHASE_RETRY}/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Where T = `phase_count`, P = `(completed_phases / phase_count) × 100`.

### 5b. checkpoint_recovery

Check for existing checkpoint:

```bash
PHASE_STATE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_NUM}")
```

Parse: `has_context`, `has_plans`, `has_summaries`, `has_verification`, `incomplete_count`.

**If `has_verification` is true AND verification status is `passed`:**
Display `Phase ${PHASE_NUM}: Already complete — skipping.` and advance to next phase.

**If `has_summaries` is true (partial completion):**
Display `Phase ${PHASE_NUM}: Resuming from checkpoint — {incomplete_count} plans remaining.`
Skip to **5e (execute)** with `--gaps-only` flag.

**If `has_plans` is true but no summaries:**
Display `Phase ${PHASE_NUM}: Plans exist — skipping discuss and plan stages.`
Skip to **5e (execute)**.

**If `has_context` is true:**
Display `Phase ${PHASE_NUM}: Context exists — skipping discuss.`
Skip to **5d (plan)**.

### 5c. smart_discuss

Check `SKIP_DISCUSS` flag and config:

```bash
CFG_SKIP=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" config-get workflow.skip_discuss 2>/dev/null || echo "false")
```

If `SKIP_DISCUSS=true` OR `CFG_SKIP=true`:
Write minimal CONTEXT.md from ROADMAP phase goal. Commit it. Skip to 5d.

Otherwise invoke discuss workflow:

```
Skill(skill="sunco:discuss", args="${PHASE_NUM}")
```

Verify CONTEXT.md was written. If missing → go to **handle_blocker**: "Discuss did not produce CONTEXT.md for phase ${PHASE_NUM}."

### 5d. plan

```
Skill(skill="sunco:plan", args="${PHASE_NUM}")
```

Verify plan produced output:

```bash
PHASE_STATE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_NUM}")
```

Check `has_plans`. If false → go to **handle_blocker**: "Plan stage did not produce any plans for phase ${PHASE_NUM}."

### 5e. execute

```
Skill(skill="sunco:execute", args="${PHASE_NUM} --no-transition")
```

After execution, check completion:

```bash
PHASE_STATE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_NUM}")
```

If `incomplete_count > 0` → go to **handle_stuck**: "${incomplete_count} plans still incomplete after execute."

### 5f. lint_gate (mandatory)

The lint-gate is non-negotiable. No phase can advance without passing it.

```
Skill(skill="sunco:lint", args="--phase ${PHASE_NUM} --strict")
```

Parse lint result. If lint fails:

**PHASE_RETRY < 3:**
Increment `PHASE_RETRY`. Display:
```
Lint gate failed ({error_count} errors). Auto-fixing and retrying... [{PHASE_RETRY}/3]
```
Run auto-fix:
```
Skill(skill="sunco:lint", args="--phase ${PHASE_NUM} --fix")
```
Re-run lint. If still failing and `PHASE_RETRY >= 3` → go to **handle_blocker**.

**PHASE_RETRY >= 3:** Go to **handle_blocker**: "Lint gate failed after 3 retries for phase ${PHASE_NUM}. Manual intervention required."

### 5g. verify

If `SKIP_VERIFY=true`:
Display `Verification skipped (--no-verify flag).` and advance.

Otherwise:

```
Skill(skill="sunco:verify", args="${PHASE_NUM}")
```

Read verification result:

```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

**If `passed`:** Display `Phase ${PHASE_NUM} PASSED — {phase_name}` and continue.

**If `partial`:**
Display outstanding items. If `PHASE_RETRY < 3`:
Increment retry counter. Re-run execute for failing plans only (`--gaps-only`). Loop back to 5f.
If `PHASE_RETRY >= 3` → go to **handle_blocker**.

**If `failed`:** Go to **handle_blocker**: "Verification failed for phase ${PHASE_NUM}."

**If empty** (no VERIFICATION.md): Go to **handle_blocker**: "Execute did not produce verification results for phase ${PHASE_NUM}."

### 5h. adaptive_replan

After each successful phase, re-read ROADMAP.md to catch dynamically inserted phases:

```bash
UPDATED_ROADMAP=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" roadmap analyze)
```

Diff the phase list against the original discovery. If new phases were inserted:

```
Adaptive replan: {N} new phase(s) detected in ROADMAP.md — adding to queue.
  + Phase {X}: {name}
```

Append new phases to the execution queue (sorted by number).

### 5i. transition

```
Skill(skill="sunco:transition", args="${PHASE_NUM}")
```

Save checkpoint:

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set "autonomous.last_completed" "${PHASE_NUM}"
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set "autonomous.retry_counts.${PHASE_NUM}" "0"
```

### 5j. budget_check (per-phase)

After each phase:

```bash
CURRENT_TOKENS=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state get session.tokens_used 2>/dev/null || echo "0")
```

If `MAX_TOKENS > 0` AND `CURRENT_TOKENS >= MAX_TOKENS`:

```
Budget ceiling reached after phase {PHASE_NUM} ({CURRENT_TOKENS} / {MAX_TOKENS} tokens).
Progress saved. Resume with: /sunco:auto --from {next_phase_num}
```

Exit cleanly.

---

## Step 6: handle_blocker

Called when any stage cannot auto-recover.

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set "autonomous.blocker.phase" "${PHASE_NUM}"
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set "autonomous.blocker.message" "${BLOCKER_MSG}"
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set "autonomous.blocker.timestamp" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS — BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phase   : {PHASE_NUM} — {phase_name}
 Blocker : {BLOCKER_MSG}
 Retries : {PHASE_RETRY}/3

 Progress so far is saved. To resume after resolving:
   /sunco:auto --from {PHASE_NUM}

 To investigate: /sunco:debug
 To skip and continue: /sunco:auto --from {PHASE_NUM+1}
```

Exit (do not continue to subsequent phases).

---

## Step 7: handle_stuck

Called when a phase appears to be making no progress (execute completes but plans remain incomplete, OR same verification errors repeat across retries).

Increment `PHASE_RETRY`. If `PHASE_RETRY < 3`:

Display:
```
Phase {PHASE_NUM} appears stuck ({PHASE_RETRY}/3). Retrying with fresh context...
```

Re-run from 5e with `--gaps-only`. Update retry counter in state.

If `PHASE_RETRY >= 3` → go to **handle_blocker** with message: "Phase ${PHASE_NUM} stuck after 3 retries — same plans failing repeatedly."

---

## Step 8: completion_summary

After all phases complete:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS — COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phases completed : {phases_run}
 Total phases     : {phase_count}
 Lint gate        : all passed
 Verification     : all passed

 Completed phases:
   {list each phase: N — name — PASSED}

 Next step: /sunco:milestone complete
```

Generate session report:

```
Skill(skill="sunco:session-report", args="--auto")
```

---

## Lint Gate Policy

The lint gate runs at step 5f after every execute. It is never optional in the autonomous pipeline (even if `--no-verify` is passed, lint always runs). This is the core SUNCO guarantee: no phase advances with architecture violations.

Lint gate configuration:

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" config-get lint.strict_mode
```

If `strict_mode: true` → zero warnings allowed. If `strict_mode: false` (default) → zero errors allowed, warnings OK.

---

## State Persistence

All autonomous state is written to `.sun/STATE.md` under the `autonomous.*` key namespace:

| Key | Description |
|-----|-------------|
| `autonomous.last_completed` | Last phase number that fully completed |
| `autonomous.blocker.phase` | Phase blocked on (if any) |
| `autonomous.blocker.message` | Blocker reason |
| `autonomous.retry_counts.*` | Per-phase retry count map |
| `autonomous.tokens_at_start` | Token snapshot at pipeline start |
| `autonomous.phases_run` | List of phases executed this run |

This enables clean crash recovery: re-running `/sunco:auto` picks up from `last_completed + 1` automatically (or use `--from` to override).

---

## Config Keys

| Key | Default | Effect |
|-----|---------|--------|
| `workflow.skip_discuss` | `false` | Skip discuss for all phases |
| `workflow.skip_verify` | `false` | Skip verification (lint still runs) |
| `autonomous.max_phases` | `0` | Override `--max-phases` |
| `autonomous.max_tokens` | `0` | Override `--max-tokens` |
| `lint.strict_mode` | `false` | Zero warnings in lint gate |
| `git.commit_docs` | `true` | Commit planning artifacts after each phase |
