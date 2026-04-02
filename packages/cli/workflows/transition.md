# Phase Transition Workflow

**Internal workflow — not a user-facing command.**

There is no `/sunco:transition` command. This workflow is invoked automatically by `execute-phase` during auto-advance, or inline by the autonomous orchestrator after verification passes. Users should never be told to run `/sunco:transition` directly.

**Valid user commands for phase progression:**
- `/sunco:discuss <N>` — discuss a phase before planning
- `/sunco:plan <N>` — plan a phase
- `/sunco:execute <N>` — execute a phase
- `/sunco:progress` — see roadmap progress

Used internally by `sunco:execute` (via `--auto-transition` flag) and `sunco:auto`.

---

## Core Principle

Transition is the clean boundary between phases. It marks the completed phase as done, archives its artifacts, initializes the next phase directory, updates ROADMAP.md and STATE.md, and optionally handles branch strategy (merge completed, create next). Every transition produces a structured commit so the git log reads as a phase-by-phase story.

Transition responsibility chain:

```
load_context → verify_completion → check_verification_debt
→ update_state → archive_phase → initialize_next_phase
→ handle_branching → update_roadmap → commit_transition
→ display_summary
```

---

## Step 1: load_context

Read all planning state before modifying anything:

```bash
cat .planning/STATE.md 2>/dev/null || true
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/ROADMAP.md 2>/dev/null || true
```

Identify the current phase number from STATE.md (`current_phase` field).

Load phase state:

```bash
PHASE_STATE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" init phase-op "${CURRENT_PHASE}")
if [[ "$PHASE_STATE" == @file:* ]]; then PHASE_STATE=$(cat "${PHASE_STATE#@file:}"); fi
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plan_count`, `summary_count`, `incomplete_count`.

Load config:

```bash
CONFIG=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-get-all)
```

Parse: `git.branching_strategy` (`none` | `phase` | `milestone`), `git.commit_docs`, `git.main_branch`.

---

## Step 2: verify_completion

Check that the current phase has all plans summarized:

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | sort
ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null | sort
```

**Verification logic:**
- Count PLAN files → `PLAN_COUNT`
- Count SUMMARY files → `SUMMARY_COUNT`
- If `PLAN_COUNT === SUMMARY_COUNT` → all plans complete
- If `PLAN_COUNT !== SUMMARY_COUNT` → incomplete

If incomplete AND invoked from `sunco:auto` → abort transition and return error to orchestrator.

If incomplete AND invoked from `sunco:execute` (interactive) → ask user:

```
Phase {N} has {PLAN_COUNT - SUMMARY_COUNT} incomplete plan(s):
  {list missing summaries}

Transition anyway? [y/N]
```

If user says no → abort. If user says yes → proceed with warning.

**Check lint gate:**

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" lint check --phase "${CURRENT_PHASE}"
```

If lint errors exist → abort transition: "Lint gate not passed. Run `/sunco:lint --fix` before transitioning."

This enforces that no phase transition can happen with outstanding lint violations.

---

## Step 3: check_verification_debt

Scan for outstanding verification items:

```bash
for f in "${PHASE_DIR}"/*-VERIFICATION.md "${PHASE_DIR}"/*-UAT.md; do
  [ -f "$f" ] || continue
  grep -qE "result: pending|result: blocked|status: partial|status: human_needed" "$f" && echo "$(basename $f)"
done
```

If any outstanding items exist, append to the transition confirmation:

```
Outstanding verification debt in phase {N}:
  {list filenames}

This debt carries forward. Review later with: /sunco:audit-milestone
```

This does NOT block transition — it ensures the debt is visible before committing.

---

## Step 4: update_state

Mark current phase complete in STATE.md:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set "phases.${CURRENT_PHASE}.status" "complete"
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set "phases.${CURRENT_PHASE}.completed_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Look up the next phase:

```bash
NEXT_PHASE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" roadmap next-phase "${CURRENT_PHASE}")
```

Parse `next_phase_number`, `next_phase_name`, `next_phase_slug`, `is_last_phase`.

Update STATE.md current position:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set "current_phase" "${NEXT_PHASE_NUM}"
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set "last_transition" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Update `.planning/STATE.md` narrative section:

```markdown
## Current Position

**Phase**: {next_phase_num} — {next_phase_name}
**Status**: Not Started
**Last Transition**: {timestamp}

**Completed Phases**: {list all completed phase numbers and names}
```

---

## Step 5: archive_phase

Archive completed phase artifacts to `.planning/archive/`:

```bash
ARCHIVE_DIR=".planning/archive/phase-${PADDED_PHASE}-${PHASE_SLUG}"
mkdir -p "${ARCHIVE_DIR}"
```

Copy (do not move — original stays in `.planning/phases/` for reference):

```bash
cp "${PHASE_DIR}"/*-CONTEXT.md "${ARCHIVE_DIR}/" 2>/dev/null || true
cp "${PHASE_DIR}"/*-PLAN.md "${ARCHIVE_DIR}/" 2>/dev/null || true
cp "${PHASE_DIR}"/*-SUMMARY.md "${ARCHIVE_DIR}/" 2>/dev/null || true
cp "${PHASE_DIR}"/*-VERIFICATION.md "${ARCHIVE_DIR}/" 2>/dev/null || true
cp "${PHASE_DIR}"/*-UAT.md "${ARCHIVE_DIR}/" 2>/dev/null || true
```

Write archive index:

```bash
cat > "${ARCHIVE_DIR}/ARCHIVE.md" << EOF
# Phase {N} — {name} — Archive

**Completed**: {timestamp}
**Plans executed**: {PLAN_COUNT}
**Summaries**: {SUMMARY_COUNT}
**Verification status**: {VERIFY_STATUS}

## Files
{list of archived files}
EOF
```

---

## Step 6: initialize_next_phase

If this is not the last phase:

```bash
NEXT_DIR=".planning/phases/${NEXT_PADDED_PHASE}-${NEXT_SLUG}"
mkdir -p "${NEXT_DIR}"
```

Write a stub README so the directory is not empty:

```bash
cat > "${NEXT_DIR}/README.md" << EOF
# Phase {next_phase_num} — {next_phase_name}

**Status**: Not Started
**Goal**: {goal from ROADMAP}

## Next Steps

1. Run \`/sunco:discuss ${next_phase_num}\` to gather context
2. Run \`/sunco:plan ${next_phase_num}\` to create plans
3. Run \`/sunco:execute ${next_phase_num}\` to execute
EOF
```

If this is the last phase → skip directory creation, display milestone completion prompt instead (see step 9).

---

## Step 7: handle_branching

Evaluate branching strategy:

```bash
STRATEGY=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-get git.branching_strategy 2>/dev/null || echo "none")
```

**Strategy: `none`** — do nothing. All work stays on current branch.

**Strategy: `phase`:**

Check if on a phase branch:

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
MAIN=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-get git.main_branch 2>/dev/null || echo "main")
```

If `CURRENT_BRANCH` matches pattern `phase/{N}-*`:
```bash
git checkout "${MAIN}"
git merge --no-ff "${CURRENT_BRANCH}" -m "merge: phase ${CURRENT_PHASE} — ${PHASE_NAME}"
```

Create next phase branch:
```bash
NEXT_BRANCH="phase/${NEXT_PADDED_PHASE}-${NEXT_SLUG}"
git checkout -b "${NEXT_BRANCH}"
```

Display: `Branching: merged '${CURRENT_BRANCH}' into ${MAIN}, created '${NEXT_BRANCH}'`

**Strategy: `milestone`:**

Do not merge on phase transition — milestone branches merge at milestone completion only. If a phase branch exists, stay on it. Display: `Branching strategy: milestone — staying on current branch until milestone complete.`

---

## Step 8: update_roadmap

Update ROADMAP.md to reflect phase completion:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" roadmap mark-complete "${CURRENT_PHASE}"
```

Verify the update:

```bash
grep -A2 "Phase ${CURRENT_PHASE}" .planning/ROADMAP.md | grep -q "complete\|DONE" && echo "OK"
```

If the roadmap update tool is unavailable, manually update: find the phase entry in ROADMAP.md and add `**Status**: Complete` and `**Completed**: {date}` to its frontmatter block.

Update PROJECT.md if requirements were validated in this phase:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" project promote-requirements "${CURRENT_PHASE}"
```

This moves requirements from `Active` to `Validated` in PROJECT.md based on VERIFICATION.md results.

---

## Step 9: commit_transition

Stage all modified planning files:

```bash
git add .planning/STATE.md
git add .planning/ROADMAP.md
git add .planning/PROJECT.md
git add ".planning/phases/${NEXT_DIR}/" 2>/dev/null || true
git add ".planning/archive/${ARCHIVE_DIR}/" 2>/dev/null || true
```

Commit with structured message:

```bash
git commit -m "transition: phase ${CURRENT_PHASE} complete → phase ${NEXT_PHASE_NUM} initialized

Phase ${CURRENT_PHASE}: ${PHASE_NAME}
  Plans: ${PLAN_COUNT} executed, ${SUMMARY_COUNT} summarized
  Lint gate: passed
  Verification: ${VERIFY_STATUS}

Next: Phase ${NEXT_PHASE_NUM} — ${NEXT_PHASE_NAME}"
```

If `git.commit_docs: false` → skip the commit. Display a reminder to commit planning artifacts manually.

### Create Rollback Point

After the transition commit, create a rollback point marking this phase boundary:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point create --label "after-transition-phase-${CURRENT_PHASE}-to-${NEXT_PHASE_NUM}"
```

Also update artifact hashes to reflect the new baseline:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash compute
```

This ensures the next command invocation has a clean hash baseline and a named rollback point at this phase boundary.

---

## Step 10: display_summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TRANSITION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed : Phase {current} — {name}
 Next      : Phase {next} — {next_name}
 Branch    : {current_branch}
 Committed : {commit_sha_short}

 {if verification_debt}
 Debt items : {count} — review with /sunco:audit-milestone
 {/if}

 {if is_last_phase}
 All phases complete!
 Next: /sunco:milestone complete
 {else}
 Next action: /sunco:discuss {next_phase_num}
 {/if}
```

---

## Step 11: ROADMAP.md progress bar update

After the commit, update the visual progress indicator in ROADMAP.md if one exists:

```bash
# Count completed phases
TOTAL_PHASES=$(grep -c "^## Phase" .planning/ROADMAP.md 2>/dev/null || echo "0")
COMPLETED=$(grep -c "\[x\]\|Status.*[Cc]omplete\|Status.*DONE" .planning/ROADMAP.md 2>/dev/null || echo "0")
PCT=$(( COMPLETED * 100 / TOTAL_PHASES ))
```

If ROADMAP.md has a `## Progress` section, update it:

```markdown
## Progress

[██████░░░░░░░░░░]  {PCT}%  {COMPLETED}/{TOTAL_PHASES} phases complete
Last transition: {PHASE_NAME} ({timestamp})
```

If no `## Progress` section exists: skip (do not add one — ROADMAP format is the user's choice).

---

## Step 12: STATE.md transition narrative

Append a transition log entry to STATE.md so the history of phase completions is preserved:

```markdown
## Transition Log

| Timestamp | Phase | Status | Plans | Verification |
|-----------|-------|--------|-------|-------------|
| {ISO} | Phase {N} — {name} | Complete | {plan_count}/{plan_count} | {verify_status} |
```

If the table already exists, append a new row. If it does not exist, create it.

This log serves as a lightweight audit trail for `/sunco:stats` and milestone completion reports.

---

## Branch Strategy Reference

The three strategies and their expected behaviors:

### `none` (default)
All work on a single branch. No branch creation or merging at transition time. Best for: solo developers, linear repos, experimental projects.

### `phase`
Create one branch per phase. Merge to main on completion.

```
main
  └── phase/01-config-system        (merge → main when phase 1 done)
  └── phase/02-skill-loader         (created at transition time)
```

Merge command run during transition:
```bash
git checkout main
git merge --no-ff "phase/${CURRENT_PADDED}-${PHASE_SLUG}" -m "merge: phase ${N} — ${name}"
git checkout -b "phase/${NEXT_PADDED}-${NEXT_SLUG}"
```

### `milestone`
Create one branch per milestone. Phases commit on the milestone branch. Merge to main only at milestone completion.

```
main
  └── milestone/v0.1                (merge → main when milestone done)
       └── all phase commits here
```

During phase transition: stay on the milestone branch. No merge.
At `/sunco:milestone complete`: merge milestone branch → main and tag.

---

## Verification Prerequisites for Transition

Transition CANNOT proceed if any of these are true (unless `--force`):

| Check | Condition | Error |
|-------|-----------|-------|
| Lint gate | `lint check --phase N` returns errors | "Lint gate not passed. Run /sunco:lint --fix." |
| Incomplete plans | PLAN count ≠ SUMMARY count | "Phase has [N] incomplete plans." |
| Missing verification | VERIFICATION.md absent | "Run /sunco:verify [N] before transitioning." |
| Uncommitted code changes | `git status --short` non-empty | "Uncommitted changes. Commit first." |

These are hard blocks in automated mode (`sunco:auto`). In interactive mode (`sunco:execute --auto-transition`), the user is prompted before each hard block and can override.

---

## Config Reference

| Key | Default | Effect |
|-----|---------|--------|
| `git.branching_strategy` | `none` | `none`, `phase`, or `milestone` |
| `git.main_branch` | `main` | Target branch for merge operations |
| `git.commit_docs` | `true` | Commit planning artifacts on transition |
| `transition.require_verification` | `true` | Block transition without VERIFICATION.md |
| `transition.archive_phase` | `true` | Copy artifacts to `.planning/archive/` |
| `transition.update_roadmap` | `true` | Mark phase complete in ROADMAP.md |

---

## Transition Commit Message Format

The transition commit is the permanent record of phase completion in the git log. Its format is fixed:

```
transition: phase {N} complete → phase {N+1} initialized

Phase {N}: {PHASE_NAME}
  Plans: {PLAN_COUNT} executed, {SUMMARY_COUNT} summarized
  Lint gate: passed
  Verification: {VERIFY_STATUS}

Next: Phase {N+1} — {NEXT_PHASE_NAME}
```

**If last phase:**
```
transition: phase {N} complete — milestone ready

Phase {N}: {PHASE_NAME}
  Plans: {PLAN_COUNT} executed, {SUMMARY_COUNT} summarized
  Lint gate: passed
  Verification: {VERIFY_STATUS}

All phases complete. Run /sunco:milestone complete.
```

This format makes `git log --oneline` readable as a narrative:

```
abc1234  transition: phase 5 complete → phase 6 initialized
def5678  feat(phase-5): implement agent router streaming
ghi9012  feat(phase-5): add provider abstraction layer
jkl3456  transition: phase 4 complete → phase 5 initialized
```

---

## Invocation Contexts

Transition is called in two contexts with slightly different behavior:

### From `sunco:execute --auto-transition`

The `--auto-transition` flag on execute means: after all plans in the phase are done and lint passes, call transition automatically without asking the user.

In this context:
- Incomplete plans → prompt user before proceeding (not a hard abort)
- Missing VERIFICATION.md → warn but proceed (user chose auto-transition)
- Branch strategy handled automatically

### From `sunco:auto` (orchestrator)

The orchestrator calls transition after verify passes. In this context:
- Incomplete plans → hard abort, return error to orchestrator
- Missing VERIFICATION.md → hard abort (orchestrator enforces verification)
- Branch strategy handled automatically

Both contexts produce the same transition commit and STATE.md update. The difference is only in error handling strictness.

---

## Last Phase Detection and Milestone Routing

When transitioning out of the last phase, the workflow recognizes this and routes to milestone completion:

```bash
NEXT_PHASE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" roadmap next-phase "${CURRENT_PHASE}")
IS_LAST=$(echo "$NEXT_PHASE" | node -e "... parse is_last_phase")
```

If `is_last_phase=true`:
- Skip next phase directory initialization
- Display milestone completion prompt:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TRANSITION COMPLETE — MILESTONE READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed : Phase {N} — {name} (FINAL PHASE)
 Milestone : {milestone_name} — all phases complete

 Next steps:
   /sunco:milestone complete   — archive and tag release
   /sunco:audit-milestone      — audit before closing
   /sunco:stats                — project summary
```

---

## What Callers Can Expect

Callers of the transition workflow (execute-phase and auto) can rely on these post-conditions after a successful transition:

1. **STATE.md**: `current_phase` updated to `NEXT_PHASE_NUM`; `phases.{N}.status` = `"complete"` and `phases.{N}.completed_at` = ISO timestamp
2. **ROADMAP.md**: Phase N marked complete with `[x]` marker or `Status: Complete`
3. **Archive**: Phase N artifacts copied to `.planning/archive/phase-{N}-{slug}/ARCHIVE.md`
4. **Next phase directory**: `.planning/phases/{NEXT_PADDED}-{next_slug}/README.md` created
5. **Git log**: Transition commit with structured message at HEAD
6. **Branching** (if strategy != `none`): Current branch merged or new branch created per strategy
7. **Transition log**: New row appended to STATE.md transition log table

If any of these post-conditions are missing, the transition should be treated as failed and the caller should re-invoke.

---

## Transition Log Entry Format

Each transition appends to the project-level transition log (in STATE.md or a dedicated `.planning/TRANSITIONS.md`):

```markdown
| 2026-03-31 10:45 | Phase 3 → Phase 4 | 5 plans, 5 summaries | PASS | commit abc1234 |
```

Transition log columns:
- **Timestamp** — ISO 8601, UTC
- **From → To** — Phase numbers and direction
- **Plans** — `{done}/{total}` count
- **Verification** — `PASS`, `WARN`, or `FORCED`
- **Commit** — Short SHA of the transition commit

This log is used by:
- `/sunco:stats` for milestone timeline reconstruction
- `/sunco:milestone complete` for phase completion table in MILESTONE-SUMMARY.md
- `/sunco:forensics` for post-mortem timeline analysis

---

## Quick Reference

Transition is automatic in both `sunco:execute --auto-transition` and `sunco:auto`. Users do not invoke it directly. For manual phase advancement: run each step individually (`discuss → plan → execute → verify`) then let the next execute trigger transition.

---

## Error Reference

| Error | Cause | Resolution |
|-------|-------|------------|
| "Lint gate not passed" | Outstanding lint errors | `/sunco:lint --fix` |
| "Phase has incomplete plans" | Missing SUMMARY.md files | Re-run `/sunco:execute` |
| "No next phase found" | ROADMAP ends at current | Run `/sunco:milestone complete` |
| "Git merge failed" | Merge conflict | Resolve manually, then re-run transition |
| "STATE.md missing" | Harness not initialized | `/sunco:init` |
| "VERIFICATION.md missing" | Verification not run | `/sunco:verify [N]` |
| "Uncommitted changes" | Untracked code changes | `git add` + `git commit` first |
