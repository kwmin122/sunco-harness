---
name: sunco:auto
description: Full autonomous pipeline — runs discuss→plan→execute→lint-gate→verify for all remaining phases without manual intervention. Includes crash recovery, budget ceiling, stuck detection, and adaptive replanning.
argument-hint: "[--from <phase>] [--only <phase>] [--max-phases N] [--no-resume] [--budget <tokens>] [--no-discuss] [--no-verify] [--dry-run]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Flags:**
- `--from <phase>` — Start from a specific phase number. Default: read from STATE.md.
- `--only <phase>` — Run exactly one phase. Implies `--max-phases 1`.
- `--max-phases N` — Cap the number of phases to execute this run.
- `--no-resume` — Start fresh even if a previous auto run was interrupted.
- `--budget <tokens>` — Hard token ceiling. Stop before exceeding. Default: no limit.
- `--no-discuss` — Skip the discuss step for all phases (write minimal CONTEXT.md from ROADMAP).
- `--no-verify` — Skip verification (lint-gate still runs — it is never optional).
- `--dry-run` — Display phase plan but execute nothing.
- `--allow <level>` — **(Phase 57)** Highest-allowed `approval_envelope.risk_level` for classifier-gated auto-execution. Permitted values: `read_only` (default) | `local_mutate` | `repo_mutate`. Lower tiers implicit (`--allow=local_mutate` permits both `read_only` and `local_mutate` actions without ACK). **EXCLUDED** from `--allow`: `repo_mutate_official` (per-write ACK per `references/router/APPROVAL-BOUNDARY.md` L19; blessed orchestrator batched-ACK exception applies ONLY to `/sunco:execute`, `/sunco:verify`, `/sunco:release` per L55/L61-L63 — `/sunco:auto` is NOT a blessed orchestrator); `remote_mutate` (per-invocation ACK, never cached, per APPROVAL-BOUNDARY.md L21); `external_mutate` (per-invocation ACK, never cached, never `--batch-ack`, per APPROVAL-BOUNDARY.md L22). These classes always HOLD and surface user ACK regardless of `--allow`.
</context>

<objective>
Run the full SUNCO pipeline autonomously for all remaining phases.

**Pipeline per phase:**
1. discuss (assumptions mode) → confirm with user
2. plan → verify plans
3. execute (with blast radius check + lint-gate)
4. verify (5-layer)
5. Update STATE.md → move to next phase

**SUNCO guarantees in autonomous mode:**
- Mandatory lint-gate after EACH plan in execute step (never skippable)
- Blast radius check before EACH phase execution
- Adaptive replan: re-reads ROADMAP.md after each phase (phases may shift)
- Crash recovery via AutoLock file at `.sun/auto.lock`
- Stuck detection: 3 retries per phase before escalating to user
- Budget ceiling: stops cleanly before exceeding token limit
- Session checkpoints: STATE.md updated after every phase boundary

**After this command:** All phases shipped, or stopped at first unresolvable blocker with clear recovery instructions.
</objective>

<process>
## Step 1: Parse arguments

Parse `$ARGUMENTS` for flags before loading any context.

| Token | Variable | Default |
|-------|----------|---------|
| `--from N` | `FROM_PHASE` | unset (all incomplete) |
| `--only N` | `ONLY_PHASE` | unset |
| `--max-phases N` | `MAX_PHASES` | `0` (unlimited) |
| `--budget N` | `MAX_TOKENS` | `0` (unlimited) |
| `--no-resume` | `NO_RESUME` | false |
| `--no-discuss` | `SKIP_DISCUSS` | false |
| `--no-verify` | `SKIP_VERIFY` | false |
| `--dry-run` | `DRY_RUN` | false |
| `--allow <level>` | `ALLOW_LEVEL` | `read_only` |

Rules:
- `--from N` — skip all phases before N
- `--only N` — run exactly one phase; implies `--max-phases 1`
- `--max-phases 0` — unlimited (default)
- `--dry-run` — display phase plan but execute nothing; print `[DRY RUN]` on all output
- `--allow <level>` — Phase 57 classifier-gate policy; permitted literal set `{read_only, local_mutate, repo_mutate}` ONLY. Invalid value (e.g. `--allow=repo_mutate_official` or `--allow=remote_mutate` or `--allow=external_mutate`) → error with usage hint "permitted: read_only | local_mutate | repo_mutate"; do not proceed.
- Unrecognized flags → warn and ignore

---

## Step 2: Initialize

Check for AutoLock: `.sun/auto.lock`

- If lock exists and `NO_RESUME=false`: resume from locked state
  - Read `currentPhase`, `completedPhases` from lock
  - Display: `Resuming autonomous run from phase [N] (crash recovery).`
- If lock exists and `NO_RESUME=true`: delete lock, start fresh
- If no lock: create it

Read `.planning/STATE.md` and `.planning/ROADMAP.md`:
- Get current phase
- Get all phases from ROADMAP.md
- If `--from` in arguments: override start phase

Write AutoLock:
```json
{
  "startedAt": "[ISO timestamp]",
  "currentPhase": [N],
  "completedPhases": [],
  "retryCount": {},
  "status": "running"
}
```

**Hard errors (abort immediately):**
- `.planning/ROADMAP.md` does not exist → "No ROADMAP.md found. Run `/sunco:new` first."
- `.planning/STATE.md` does not exist → "No STATE.md found. Run `/sunco:init` to restore harness."

Display startup banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone : [version] — [name]
 Phases    : [total] total, [completed] complete
 Budget    : [MAX_TOKENS > 0 ? "MAX_TOKENS tokens max" : "unlimited"]
 Lint gate : enforced at each phase boundary (non-negotiable)
 Flags     : [active flags or "none"]
```

---

## Step 3: Discover phases

Read ROADMAP.md and build the execution list:
- Parse all phases with number, name, goal, disk_status
- Filter: keep phases where `disk_status !== "complete"`
- Apply `--from` filter: drop phases where `number < FROM_PHASE`
- Apply `--only` filter: keep only the matching phase
- Apply `--max-phases` cap: truncate to first N entries
- Sort by phase number ascending (numeric, not lexicographic)

**If no incomplete phases remain:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS — ALL PHASES COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases are complete for this milestone.
 Next: run /sunco:milestone complete
```
Exit cleanly. Delete AutoLock.

**Display phase plan:**
```
## Execution Plan

| # | Phase | Status |
|---|-------|--------|
| 3 | Config System         | In Progress |
| 4 | Skill Loader          | Not Started |
| 5 | Agent Router          | Not Started |

Phases to execute: [N]
```

If `DRY_RUN=true`: exit here after displaying the plan.

---

## Step 4: Budget pre-check

If `MAX_TOKENS > 0`:
- Check current token estimate from STATE.md session tracking
- If already at limit: display budget ceiling message and exit cleanly
- If at > 80% of limit: display warning but continue

---

## Step 5: Phase loop

For each remaining phase, track `PHASE_RETRY` (default 0) per phase.

### 5a. Progress banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS ▸ Phase [N]/[T]: [Name]
 Progress: [████████░░░░░░░░] [P]%   Retry: [PHASE_RETRY]/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Update AutoLock:
```json
{ "currentPhase": [N], "status": "running" }
```

### 5a.5. Classifier-first gate (Phase 57)

**Before any stage execution for this phase iteration**, invoke `/sunco:router --intent` to produce a RouteDecision. This is the Phase 57 classifier-first invocation contract — the classifier runs at EACH phase boundary prior to `5b. Checkpoint recovery` and any subsequent stage execution.

Procedure:

1. **Invoke classifier**: Run `/sunco:router --intent` internally (black-box consumer of Phase 52b `packages/cli/references/router/src/classifier.mjs` + `confidence.mjs` + `evidence-collector.mjs`; no new runtime introduced by Phase 57). Read the emitted `approval_envelope.risk_level`, `confidence` band, and `confidence_signals[]`.

2. **`--allow` gate (AB-57-1)**: Compare `approval_envelope.risk_level` against `ALLOW_LEVEL` using the tier ordering `read_only < local_mutate < repo_mutate`. Permitted literal set `{read_only, local_mutate, repo_mutate}`. Actions:
   - `risk_level ≤ ALLOW_LEVEL` AND `risk_level ∈ {read_only, local_mutate, repo_mutate}` → pass to band gate.
   - `risk_level ∈ {repo_mutate_official, remote_mutate, external_mutate}` → **HOLD regardless of `--allow`** and surface user ACK prompt:
     - `repo_mutate_official` → per-write ACK (APPROVAL-BOUNDARY.md L19; batched-ACK exception does NOT apply because `/sunco:auto` is not on the blessed orchestrator list at L61-L63).
     - `remote_mutate` → per-invocation ACK, never cached (APPROVAL-BOUNDARY.md L21).
     - `external_mutate` → per-invocation ACK, never cached, never `--batch-ack` (APPROVAL-BOUNDARY.md L22).
   - `risk_level > ALLOW_LEVEL` (within permitted set; e.g., `--allow=read_only` but next action is `repo_mutate`) → HOLD + prompt user to re-invoke with higher `--allow` or to provide per-write ACK inline.

3. **Band gate (AB-57-2 thin-HIGH degradation)**: Evaluate `confidence` band + `confidence_signals[]`:
   - **HIGH band + ≥2 of 3 primary evidence signals present** (state machine / freshness gate / ephemeral route log) → auto-execute authorized (proceed to 5b). Note: frozen-weight HIGH threshold is upstream in Phase 52b `confidence.mjs`; Phase 57 adds the 2-of-3 primary-signal rule at gate time.
   - **HIGH band + only 1 of 3 primary signals (thin-HIGH)** → degrade to MEDIUM treatment (HOLD + prompt; do not auto-execute).
   - **MEDIUM band** → HOLD + prompt regardless of `--allow` (always ACK required at MEDIUM confidence).
   - **LOW band** → HOLD + surface `/sunco:debug` recommendation (classifier evidence is insufficient to gate auto-execution).
   - **UNKNOWN stage** → 2 consecutive UNKNOWN decisions → hard halt. 1 UNKNOWN → HOLD + prompt (remediate evidence drift before proceeding).
   - **HOLD stage (classifier-emitted)** → hard halt (explicit HOLD intent from classifier; do not auto-bypass).

4. **On HOLD/halt**: Update AutoLock `status: "paused"` + record `holdReason` (e.g., `risk_level_exceeds_allow` / `risk_level_requires_ack` / `thin_high_degraded_to_medium` / `medium_band_hold` / `low_band_debug` / `unknown_stage` / `hold_stage`). Surface the RouteDecision `reason[]` ordered list to the user. Prompt: `[proceed with ACK / re-invoke with different --allow / /sunco:debug / abort]`. Do NOT count classifier-HOLD as a stuck-detector retry (5a.5 HOLD is orthogonal to phase-level retry at 5h).

5. **On pass**: Proceed to `5b. Checkpoint recovery`. The classifier-gate logs decision to `.sun/router/session/*.json` (ephemeral) and, if promotion criteria fire per `references/router/EVIDENCE-MODEL.md`, also to `.planning/router/decisions/*.json` (durable). Phase 52b writer path-allowlist enforced; no mutation outside those directories.

**Scope boundary — no generic router-pipeline auto-hook installed by this gate (AB-57-3)**. The classifier-first gate here is a classification + policy-check, not a mutation hook. Post-RELEASE compound artifact write follows the Phase 56 path chain — see "5f.5. RELEASE-phase compound chain" below.

### 5b. Checkpoint recovery

Before running any stage, check what artifacts already exist for this phase:
- Has CONTEXT.md → skip discuss (5c)
- Has PLAN.md files but no summaries → skip to execute (5e)
- Has SUMMARY.md files (partial) → skip to execute with `--gaps-only` (5e)
- Has VERIFICATION.md with `passed` status → mark complete, skip to 5i

Display what was found:
```
Phase [N]: [what was found] — resuming from [stage].
```

### 5c. Discuss (assumptions mode)

If `SKIP_DISCUSS=true`: write minimal CONTEXT.md from ROADMAP phase goal and proceed.

Otherwise: invoke `/sunco:assume [N] --silent` to derive assumptions from codebase.

Show the assumption list to the user:
```
Assumptions for Phase [N]:
  [safe assumption list]
  [risky assumption list]

Proceed? [yes/edit/abort]
```
- `yes` → continue
- `edit` → run `/sunco:discuss [N]` in interactive mode to capture corrections
- `abort` → update AutoLock with status=paused, stop loop

Verify CONTEXT.md was written. If missing → call `handle_blocker`: "Discuss did not produce CONTEXT.md for phase [N]."

### 5d. Plan

Run `/sunco:plan [N]`.

Verify plan produced output (check for PLAN.md files in phase directory).

If no plans produced → call `handle_blocker`: "Plan stage did not produce any plans for phase [N]."

If plan generation fails and `PHASE_RETRY < 3`: ask user for clarification and retry once with the additional context.

### 5e. Blast radius check

Before executing, check blast radius for Phase [N]:
- Read all `files_modified` from plans
- Check overlap with previous phases' outputs (to detect cross-phase interference)
- Flag if blast radius > 10 files:

```
Blast radius: [N] files across [K] plans.
[If N > 10]: Large blast radius — proceed carefully.
```

### 5f. Execute with lint-gate

Run `/sunco:execute [N]`.

The lint-gate is enforced inside execute — this is the SUNCO guarantee.

**If execution fails:**
1. Check if failure is transient (network, timeout) → retry once automatically
2. If lint-gate fails with `PHASE_RETRY < 3`:
   - Increment `PHASE_RETRY`
   - Run auto-fix: `/sunco:lint --fix`
   - Re-execute
3. If agent fails: log and continue with remaining plans (partial progress is preserved)
4. After 3 failures: call `handle_blocker`

**Check for incomplete plans after execute:**
If any plans remain without SUMMARY.md → call `handle_stuck`: "[N] plans still incomplete after execute."

### 5g. Verify

If `SKIP_VERIFY=true`: display "Verification skipped (--no-verify flag)." and advance.

Otherwise: run `/sunco:verify [N]`.

Read verification result:

**If `passed`:** Display `Phase [N] PASSED — [phase_name]` and continue.

**If `partial`:**
- Show outstanding items
- If `PHASE_RETRY < 3`: increment retry, re-run execute for failing items only (`--gaps-only`), loop back to 5f
- If `PHASE_RETRY >= 3` → call `handle_blocker`

**If `failed`:** Call `handle_blocker`: "Verification failed for phase [N]."

**If no VERIFICATION.md produced:** Call `handle_blocker`: "Execute did not produce verification results for phase [N]."

### 5h. Adaptive replan

After each successful phase, re-read ROADMAP.md to catch dynamically inserted phases:
- Diff the phase list against the original discovery
- If new phases were inserted:
  ```
  Adaptive replan: [N] new phase(s) detected in ROADMAP.md — adding to queue.
    + Phase [X]: [name]
  ```
  Append new phases to the execution queue (sorted by number).

### 5i. Session checkpoint

Mark phase complete:
- Update AutoLock: add phase to `completedPhases`, set `currentPhase` to N+1
- Update `.planning/STATE.md`: mark phase N as complete, set current phase to N+1
- Reset `PHASE_RETRY` counter for next phase

Run `/sunco:transition [N]` to archive phase artifacts and initialize next phase directory.

### 5f.5. RELEASE-phase compound chain (Phase 57; AB-57-3 preservation)

When the phase loop reaches a RELEASE phase, the compound artifact write is **not** triggered by `/sunco:auto` directly. Phase 57 installs **no generic router-pipeline auto-hook** (Gate 54 U1 + Gate 56 release-workflow contract preserved).

The explicit path chain for compound artifact generation under `/sunco:auto` is:

1. `/sunco:auto` may reach a RELEASE phase in the queue (e.g., a phase whose stage classifier emits `current_stage: RELEASE`).
2. `/sunco:auto` invokes `/sunco:release` at Step 5f (execute with lint-gate) as the release stage command. `/sunco:release` is on the blessed orchestrator list (APPROVAL-BOUNDARY.md L63) and carries the Phase 56 10-sub-stage approval-envelope contract (`workflows/release.md`).
3. `/sunco:release` proceeds through its 10 sub-stages (PRE_FLIGHT → VERSION_BUMP → CHANGELOG → COMMIT → TAG → PUSH → PUBLISH → VERIFY_REGISTRY → TAG_PUSH → COMPOUND_HOOK per Phase 56 L2 mapping). Each sub-stage's `approval_envelope.risk_level` drives ACK behavior inside `/sunco:release`; `/sunco:auto` classifier-first gate (5a.5) is a separate upstream check and does not bypass Phase 56 sub-stage ACKs.
4. `/sunco:release` reaches COMPOUND_HOOK sub-stage after VERIFY_REGISTRY success and BEFORE TAG_PUSH (Phase 56 L7; DESIGN §11 30e literal ordering).
5. The existing Phase 56 release workflow writes the compound artifact to `.planning/compound/<scope>-<ref>-<YYYYMMDD>.md` at `status=proposed` per Gate 54 auto-write path-allowlist + APPROVAL-BOUNDARY.md L47 `local_mutate` exception (compound-router draft auto-write classified as local_mutate).

`/sunco:auto` does not invoke `compound-router.runCompound(ctx)` directly; the invocation happens through `/sunco:release` as an intermediate orchestrator. Phase 54 compound-router assets + Phase 56 `workflows/release.md` path remain byte-identical under Phase 57. TAG_PUSH failure semantics (Phase 56 L6) are unchanged: post-semantic-completion git-metadata reconciliation failure does not move the compound trigger timing and does not re-trigger COMPOUND_HOOK on retry.

### 5j. Budget check (per-phase)

After each phase, check token usage:
- If at limit: display budget ceiling message and exit cleanly
  ```
  Budget ceiling reached after phase [N] ([current] / [max] tokens).
  Progress saved. Resume with: /sunco:auto --from [next_phase]
  ```

---

## Step 6: Handle blocker

Called when any stage cannot auto-recover.

Record the blocker in STATE.md and AutoLock.

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS — BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phase   : [N] — [phase_name]
 Blocker : [message]
 Retries : [PHASE_RETRY]/3

 Progress so far is saved. To resume after resolving:
   /sunco:auto --from [N]

 To investigate: /sunco:debug
 To skip and continue: /sunco:auto --from [N+1]
```

Update AutoLock: `{ "status": "blocked", "blockedAt": [N], "blockerMessage": "..." }`

Exit (do not continue to subsequent phases).

---

## Step 7: Handle stuck

Called when a phase makes no progress (execute completes but plans remain incomplete, or same verification errors repeat).

Increment `PHASE_RETRY`. If `PHASE_RETRY < 3`:
```
Phase [N] appears stuck ([PHASE_RETRY]/3). Retrying with fresh context...
```
Re-run from 5f with `--gaps-only`.

If `PHASE_RETRY >= 3` → call `handle_blocker` with message: "Phase [N] stuck after 3 retries — same plans failing repeatedly."

---

## Step 8: Stuck detection (time-based)

Track start time per phase. If a phase takes > 3x the average of completed phases:
```
Phase [N] is taking longer than expected.
  Average time per phase: [X] minutes
  Current phase time: [Y] minutes

Continue waiting? [yes/no]
```
If `no`: pause cleanly, update AutoLock.

---

## Step 9: Completion

When all phases complete:

1. Update AutoLock: `{ "status": "complete" }`
2. Update STATE.md: all phases complete

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► AUTONOMOUS — COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phases completed : [phases_run]
 Total phases     : [phase_count]
 Lint gate        : all passed
 Verification     : all passed

 Completed phases:
   [list each: N — name — PASSED]

 Next step: /sunco:milestone complete
```

Generate session report: `/sunco:session-report --auto`

Delete AutoLock file.

---

## Lint Gate Policy

The lint-gate runs after every execute. It is never optional — even if `--no-verify` is passed, lint always runs. No phase can advance with architecture violations.

Config key `lint.strict_mode`:
- `true` → zero warnings allowed
- `false` (default) → zero errors allowed, warnings OK

---

## State Persistence

All autonomous state written to `.sun/auto.lock` and `.planning/STATE.md`:

| Key | Description |
|-----|-------------|
| `autonomous.last_completed` | Last phase number that fully completed |
| `autonomous.blocker.phase` | Phase blocked on (if any) |
| `autonomous.blocker.message` | Blocker reason |
| `autonomous.retry_counts.*` | Per-phase retry count map |
| `autonomous.phases_run` | List of phases executed this run |

This enables clean crash recovery: re-running `/sunco:auto` picks up from `last_completed + 1` automatically.

---

## Config Keys

| Key | Default | Effect |
|-----|---------|--------|
| `workflow.skip_discuss` | `false` | Skip discuss for all phases |
| `workflow.skip_verify` | `false` | Skip verification (lint still runs) |
| `autonomous.max_phases` | `0` | Override `--max-phases` |
| `autonomous.max_tokens` | `0` | Override `--budget` |
| `lint.strict_mode` | `false` | Zero warnings in lint gate |
| `git.commit_docs` | `true` | Commit planning artifacts after each phase |

---

## AutoLock File Format

The AutoLock at `.sun/auto.lock` is a JSON file that enables crash recovery:

```json
{
  "startedAt": "2026-03-31T10:00:00Z",
  "currentPhase": 4,
  "completedPhases": [1, 2, 3],
  "retryCount": {
    "1": 0,
    "2": 0,
    "3": 1
  },
  "status": "running",
  "blockedAt": null,
  "blockerMessage": null,
  "budgetAtStart": 0,
  "phasesRun": [1, 2, 3]
}
```

Status values:
- `running` — pipeline is active
- `blocked` — stopped at a blocker, needs user resolution
- `paused` — user aborted cleanly (can resume)
- `complete` — all phases done (lock is deleted)

The lock file is deleted on clean completion. On any non-clean exit it is left in place for recovery.

---

## Dry Run Mode

When `--dry-run` is set, the pipeline:
1. Reads all state and discovers phases normally
2. Displays the execution plan with all phase details
3. Does NOT call any sub-skills
4. Does NOT modify STATE.md or ROADMAP.md
5. Does NOT create or modify AutoLock
6. All output lines prefixed with `[DRY RUN]`

Dry run output:
```
[DRY RUN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[DRY RUN]  SUNCO ► AUTONOMOUS (dry run)
[DRY RUN] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[DRY RUN] Would execute 3 phases:

[DRY RUN]  Phase 3: Config System
[DRY RUN]    Step 1: discuss (assumptions mode)
[DRY RUN]    Step 2: plan
[DRY RUN]    Step 3: execute (blast radius: unknown until discuss)
[DRY RUN]    Step 4: lint-gate
[DRY RUN]    Step 5: verify

[DRY RUN] No changes made.
```

Use dry run to preview what `/sunco:auto` would do before committing to a full run.

---

## Session Checkpoint Strategy

The autonomous pipeline writes to STATE.md at every phase boundary — not just at the end. This enables:

1. **Crash recovery**: re-run picks up from `last_completed + 1`
2. **Budget cutoff**: stop mid-pipeline with complete state saved
3. **Partial inspection**: run `/sunco:progress` mid-pipeline to see what was done
4. **Phase-level audit**: each completed phase has a full transition record

Checkpoint data per phase:
```
autonomous.completed_phases[] = [1, 2, 3]
autonomous.last_completed = 3
phases.3.status = "complete"
phases.3.completed_at = "2026-03-31T10:30:00Z"
phases.3.lint_passed = true
phases.3.verification = "passed"
```

---

## Adaptive Replan Detail

After each phase completes, the pipeline re-reads ROADMAP.md. Adaptive replan handles:

### New phases inserted by a previous phase

When executing a phase sometimes adds new phases to ROADMAP.md (e.g., a discovery phase that defines additional work). The pipeline detects this by diffing the phase list before and after each execution.

### Phases removed or merged

If a phase was marked complete or deleted from ROADMAP.md during execution (unlikely but possible), the pipeline respects the update and skips it.

### Phase renaming

If a phase number changes (e.g., a new phase inserted before the current one, shifting numbers), the pipeline uses phase slugs as stable identifiers, not just numbers.

Adaptive replan display:
```
Adaptive replan after Phase [N]:
  Added: Phase [X] — [name]
  Removed: (none)
  Total phases in queue: [N]
```

---

## Running Autonomously vs Interactively

### Autonomous (recommended for familiar codebases)

```
/sunco:auto
```

The pipeline runs with minimal interruption. Only stops for:
1. Blockers that cannot be auto-resolved after 3 retries
2. Budget ceiling reached
3. Explicit user abort (`edit` or `abort` at assumption review)

### Semi-autonomous (for unfamiliar phases)

```
/sunco:auto --from N
```

Start autonomous from a specific phase, after manually discussing/planning earlier ones.

### One phase at a time

```
/sunco:auto --only N
```

Run exactly one phase autonomously. Useful for testing the pipeline on a known phase before running everything.

### Stepwise (maximum control)

Instead of `/sunco:auto`, run each step manually:
```
/sunco:discuss N    → gather context
/sunco:plan N       → create plans
/sunco:execute N    → run plans
/sunco:verify N     → verify
/sunco:transition N → transition to next phase
```

This is equivalent to `/sunco:auto --only N` but with human review between each step.

---

## Integration with sunco:execute

`/sunco:auto` orchestrates at the phase level. `/sunco:execute` handles the plan level.

When the autonomous pipeline reaches Step 5f (execute), it calls `/sunco:execute` which:
1. Reads all PLAN.md files in the phase
2. Assigns plans to waves (based on plan frontmatter)
3. Executes wave 1 plans in parallel (one subagent per plan)
4. Waits for wave 1, then executes wave 2, etc.
5. Runs lint-gate after each wave

The autonomous pipeline does NOT duplicate execute logic — it orchestrates it.

---

## Integration with sunco:verify

After execute, the autonomous pipeline calls `/sunco:verify` which runs the 5-layer check:

| Layer | Check | What it catches |
|-------|-------|-----------------|
| 1 | Multi-agent review | Logic errors, inconsistencies |
| 2 | Guardrails (lint-gate) | Architecture violations |
| 3 | BDD acceptance criteria | Functional gaps |
| 4 | Permission audit | Unauthorized file access |
| 5 | Adversarial test | Edge cases, injection, boundary |

Layer 2 (lint-gate) always runs even if `--no-verify` is passed. Layer 5 can be skipped with `--skip-adversarial`.

---

## When Not to Use Auto

Use manual step-by-step instead of `/sunco:auto` when:

1. **Phase is experimental** — exploring design space before committing to implementation
2. **Phase touches infrastructure** — config changes, database schema, deployment
3. **Phase has external dependencies** — requires waiting for external API keys, credentials, or third-party setup
4. **You want to learn** — watching each step manually builds understanding of the system

In these cases: run `/sunco:discuss N` → `/sunco:plan N` → `/sunco:execute N` → `/sunco:verify N` step by step.

---

## --no-discuss Behavior

When `--no-discuss` is set, the autonomous pipeline skips the assumption review and writes a minimal CONTEXT.md from ROADMAP.md phase data:

```markdown
# Phase [N]: [name] — Context

**Gathered**: [timestamp]
**Mode**: auto-generated (--no-discuss)
**Status**: Ready for planning

## Phase Boundary

[goal from ROADMAP verbatim]

## Assumptions

All assumptions derived from codebase (no user input collected).
Run /sunco:assume [N] to review and confirm.
```

This minimal CONTEXT.md is enough for `/sunco:plan` to proceed. The trade-off: assumptions are not confirmed, so plans may be less accurate for novel or complex phases.

Recommended: use `--no-discuss` only for phases that are clearly defined and follow well-established codebase patterns.

---

## Retry Strategy Detail

The retry system (`PHASE_RETRY`) tracks failures per phase:

**Round 1 failure (PHASE_RETRY=1):**
- Log the failure
- Auto-fix lint if lint-gate failed
- Re-run the failing step with additional context from the error output

**Round 2 failure (PHASE_RETRY=2):**
- Log the failure
- Try a different approach (e.g., if execute failed: try `--interactive` mode instead of subagents)
- Notify user with a non-blocking update: "Phase [N] retrying (2/3)..."

**Round 3 failure (PHASE_RETRY=3):**
- Escalate to `handle_blocker`
- Write detailed diagnostic to STATE.md
- Stop the pipeline and provide recovery instructions

The retry counter resets to 0 after each successful phase.

---

## Worked Example: Running a 3-Phase Milestone

Given ROADMAP.md with phases 3, 4, 5 incomplete:

```
/sunco:auto --from 3
```

**Step 1: Initialize**
```
SUNCO ► AUTONOMOUS
  Milestone : v0.2 — CLI Core
  Phases    : 6 total, 2 complete
  Budget    : unlimited
  Lint gate : enforced
```

**Step 2: Discover**
```
Execution Plan:
  Phase 3 — Config System    (In Progress)
  Phase 4 — Skill Loader     (Not Started)
  Phase 5 — Agent Router     (Not Started)
Phases to execute: 3
```

**Step 3: Phase 3 (assuming CONTEXT.md exists)**
```
SUNCO ► AUTONOMOUS ▸ Phase 3/6: Config System
Progress: [████████░░] 33%   Retry: 0/3

Phase 3: Context exists — skipping discuss.
Running plan...
Running execute...
[lint] Passed — 12 files, 0 errors
Running verify...
Phase 3 PASSED — Config System
```

**Step 4: Transition, move to Phase 4**
```
Phase 4: No artifacts — running discuss (assumptions mode)...
[Shows assumption list]
Proceed? yes
Running plan...
Running execute...
[lint] Passed — 8 files, 0 errors
Running verify...
Phase 4 PASSED — Skill Loader
```

**Step 5: Completion**
```
SUNCO ► AUTONOMOUS — COMPLETE
  Phases completed : 3
  Lint gate        : all passed
  Verification     : all passed
Next step: /sunco:milestone complete
```

---

## AutoLock and Crash Recovery in Practice

### Scenario: Claude context limit hit mid-pipeline

The autonomous pipeline was running phase 4 when the context window was exhausted.

**What happened automatically:**
- AutoLock at `.sun/auto.lock` shows `currentPhase: 4`, `completedPhases: [1, 2, 3]`
- Phase 4 has partial SUMMARY.md files (some plans done, some not)
- STATE.md shows `current_phase: 4`, phases 1-3 marked complete

**Recovery:**
```
/sunco:auto
```

This re-enters the pipeline, reads the AutoLock, and resumes from phase 4. The checkpoint recovery step (5b) detects partial SUMMARY.md files and jumps directly to execute with `--gaps-only` to finish the remaining plans.

No work is duplicated. No manual cleanup needed.

### Scenario: User ran `--no-resume` to start fresh

```
/sunco:auto --no-resume
```

The existing AutoLock is deleted. The pipeline starts from the first incomplete phase (based on STATE.md `current_phase`). This does NOT re-execute already-complete phases — it respects the ROADMAP completion markers.

Use `--no-resume` when: the previous run left inconsistent state and you want a clean start for the remaining phases.

### Scenario: Blocker encountered at phase 4, phases 5-6 continue

After resolving a phase 4 blocker manually:
```
/sunco:auto --from 4
```

The pipeline re-runs phase 4 from scratch (discuss → plan → execute → verify), then continues to phases 5 and 6 automatically. Previously completed phases (1, 2, 3) are never re-executed — the pipeline reads their completion from STATE.md and ROADMAP.md markers and skips them.

---

## Error Reference

| Error | Cause | Resolution |
|-------|-------|------------|
| "No ROADMAP.md found" | No project initialized | `/sunco:new` or `/sunco:init` |
| "No STATE.md found" | Harness not initialized | `/sunco:init` |
| "Budget ceiling reached" | Token limit hit | Re-run with `--from [next]` |
| "Phase stuck after 3 retries" | Repeating failures | Investigate with `/sunco:debug` |
| "Lint gate failed after 3 retries" | Persistent architecture violations | `/sunco:lint --fix` manually |
| "Discuss did not produce CONTEXT.md" | Discuss step failed | Re-run `/sunco:discuss [N]` manually |
| "Plan stage produced no plans" | Plan step failed | Re-run `/sunco:plan [N]` manually |
| "Verification failed" | Phase did not pass 5-layer check | `/sunco:verify [N]` for details |
| "Git merge failed" | Branch merge conflict | Resolve conflict manually, re-run with `--from [N]` |
| "CONTEXT.md missing after discuss" | Discuss step produced no output | Re-run `/sunco:discuss [N]` |
| "Archive already exists" | Milestone was already completed | Use `--force` to overwrite |

---

## Design Philosophy

The autonomous pipeline exists for one reason: to let the agent drive while the developer steers.

The developer's job in the agent era is not writing code — it's setting up the field so agents make fewer mistakes. `/sunco:auto` is the harness that enforces that field: every phase gets discussed before planned, planned before executed, executed before verified. No shortcuts. No skipped lint gates.

The result is a git history that reads as a structured story, a STATE.md that captures every decision, and a codebase where architecture violations cannot accumulate silently.
</process>
