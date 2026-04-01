# Resume Project Workflow

Instantly restore full project context after a break. Loads STATE.md and HANDOFF.md, detects incomplete work (uncommitted changes, partial plans, failed verifications), presents a clear status snapshot, determines the single best next action, and routes there. Used by `/sunco:resume`.

---

## Trigger Conditions

Use this workflow when:
- Starting a new session on an existing project
- User says "continue", "what's next", "where were we", "resume"
- Any planning operation when `.planning/` already exists
- User returns after time away

---

## Overview

Six steps:

1. **Initialize** — check what planning artifacts exist
2. **Load state** — read STATE.md, HANDOFF.md, PROJECT.md
3. **Detect incomplete work** — uncommitted changes, partial plans, interrupted agents
4. **Present status** — one clean status block
5. **Determine next action** — logic tree based on project state
6. **Route** — send user to the right command with `/clear` reminder

---

## Step 1: Initialize

Check for planning directory:

```bash
ls .planning/ 2>/dev/null
```

**If `.planning/` does not exist:**

```
No .planning/ directory found.
This looks like a new project.

Run /sunco:init to set up the planning harness.
```

**If `.planning/` exists but STATE.md is missing:**

Jump to the Reconstruction section at the end of this document.

**If STATE.md exists:** Continue to Step 2.

---

## Step 2: Load State

Read all primary artifacts in parallel:

```bash
cat .planning/STATE.md
cat .planning/PROJECT.md 2>/dev/null
cat .planning/HANDOFF.md 2>/dev/null     # from /sunco:pause
cat .planning/ROADMAP.md 2>/dev/null
```

**From STATE.md extract:**
- Project identity (core value, one-liner)
- Current phase number, phase name, plan index, status
- Progress percentage and visual bar
- Recent decisions (last 3)
- Pending todos count
- Blockers and concerns
- Session continuity: "Stopped at" note

**From HANDOFF.md extract (if exists):**
- `status` — what was in progress
- `phase`, `plan`, `task`, `total_tasks`
- `next_action` — explicit instruction for resumption
- `blockers` — any known issues
- `human_actions_pending` — items waiting on user
- `uncommitted_files` — files modified but not committed
- `context_notes` — mental model dump

---

## Step 3: Detect Incomplete Work

Scan for unfinished states:

```bash
# Uncommitted changes
git status --short 2>/dev/null

# Plans without summaries (executed but not completed)
for plan in .planning/phases/*/*-PLAN.md; do
  [ -e "$plan" ] || continue
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "INCOMPLETE: $plan"
done 2>/dev/null || true

# Active UAT sessions
find .planning/phases -name "*-UAT.md" 2>/dev/null | xargs grep -l "status: testing" 2>/dev/null || true

# Failed verification files
find .planning/phases -name "*-VERIFICATION.md" 2>/dev/null | xargs grep -l "NEEDS FIXES" 2>/dev/null || true
```

Classify findings:

| Finding | Priority | Label |
|---------|----------|-------|
| HANDOFF.md exists | Highest | "Structured handoff found" |
| Uncommitted changes | High | "Uncommitted changes" |
| PLAN without SUMMARY | High | "Incomplete execution" |
| Active UAT session | Medium | "UAT in progress" |
| VERIFICATION with NEEDS FIXES | Medium | "Verification failed" |

---

## Step 4: Present Status

Render one status block:

```
╔══════════════════════════════════════════════════════════════╗
║  PROJECT STATUS                                              ║
╠══════════════════════════════════════════════════════════════╣
║  Building: [one-liner from "What This Is"]                   ║
║                                                              ║
║  Phase:    4 of 8 — Workflow State                           ║
║  Plan:     2 of 3 — State Persistence                        ║
║  Status:   executing                                         ║
║  Progress: [████████░░░░] 48%                               ║
║                                                              ║
║  Last activity: 2026-03-30 — Completed plan 4-01             ║
╚══════════════════════════════════════════════════════════════╝
```

Append warnings for incomplete work:

```
Incomplete work detected:
  ⚠  HANDOFF.md exists — paused at plan 4-02, task 3/5
  ⚠  2 uncommitted files: src/state/workflow.ts, tests/workflow.test.ts
  ⚠  VERIFICATION.md for phase 3 shows NEEDS FIXES

Pending todos: 3  →  /sunco:todo list
```

---

## Step 5: Determine Next Action

Priority logic (first match wins):

**1. HANDOFF.md exists:**
- Primary: Resume from structured handoff
- Read `next_action` and present it verbatim
- Check `human_actions_pending` — if non-empty, surface first: "Before resuming: [action]"
- Validate `uncommitted_files` against `git status` — flag any divergence
- After presenting, ask: "Resume from handoff? (yes / discard handoff and reassess)"

**2. Uncommitted changes in source files (not planning docs):**
- Primary: Review and commit, or continue the interrupted execution
- Present: "Uncommitted changes in src/. These may be from an interrupted execution. Commit them, or continue executing plan 4-02?"

**3. PLAN.md without SUMMARY.md:**
- Primary: Complete the incomplete execution
- Present: "Plan 4-02 was started but not completed. Continue executing it?"

**4. Active UAT session (testing status):**
- Primary: Resume UAT
- Present: "UAT session open for phase 3 — 3 tests remaining. Resume?"

**5. VERIFICATION.md with NEEDS FIXES:**
- Primary: Fix and re-verify
- Present: "Phase 3 verification has outstanding issues. Fix them before shipping?"

**6. Phase in progress, all plans complete:**
- Primary: Transition to next phase
- Present: "All plans for phase 4 are complete. Advance to phase 5?"

**7. Phase has no PLAN.md files yet:**
- Check if CONTEXT.md exists:
  - If missing: "No context for phase 4. Discuss it first? → /sunco:discuss 4"
  - If exists: "Context ready. Plan phase 4? → /sunco:plan 4"

**8. Current phase fully done:**
- Primary: Start next phase
- Present: "Phase 4 is complete. Start phase 5: [Phase Name]?"

---

## Step 6: Route

Present the primary action clearly. Always include the exact command:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next up: Continue executing plan 4-02 — State Persistence

  /sunco:execute 4

/clear first — fresh context window

───────────────────────────────────────────────────────

Also available:
  /sunco:plan 4      re-plan phase 4
  /sunco:todo list   review 3 pending todos
  /sunco:status      full project overview
```

Update STATE.md session continuity section:

```markdown
## Session Continuity

Last session: 2026-03-31T09:00:00Z
Stopped at:   Session resumed, proceeding to execute plan 4-02
```

**Quick resume mode:**

If user said "continue" or "go" with no other input:
- Run steps 1-5 silently
- Execute the primary action immediately
- Print: "Resuming from [state]..."

---

## Reconstruction

If STATE.md is missing but other artifacts exist:

```
STATE.md missing. Reconstructing from artifacts...
```

1. Read PROJECT.md → extract "What This Is" and Core Value
2. Read ROADMAP.md → determine total phases
3. Find highest numbered SUMMARY.md → that's the last completed plan
4. Count pending todos in `.planning/todos/pending/`
5. Check for UAT files, VERIFICATION files
6. Build STATE.md from findings:

```markdown
# State

## Project Reference
[from PROJECT.md]

## Current Position
Phase: [inferred from last SUMMARY]
Status: reconstructed
Last activity: [mtime of last artifact]

[reconstructed warning banner]
```

Write STATE.md, then proceed normally.

---

## Success Criteria

- [ ] STATE.md loaded or reconstructed
- [ ] HANDOFF.md parsed if present (then deleted after successful resumption)
- [ ] Incomplete work detected and flagged
- [ ] Clean status block presented
- [ ] Exact next command shown
- [ ] STATE.md session continuity updated
- [ ] User knows where project stands in one read
