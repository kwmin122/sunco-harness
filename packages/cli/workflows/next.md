# Next Workflow

Auto-detect what needs to happen next in the project by reading STATE.md and the planning artifact tree. Determines the single most logical next action and routes the user there with the exact command, or executes it directly if unambiguous. Used by `/sunco:next`.

---

## Overview

Three steps:

1. **Read state** — STATE.md, phase artifacts, git status
2. **Determine next action** — priority decision tree
3. **Present or execute** — show command or run directly

---

## Step 1: Read State

Load current project state:

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/ROADMAP.md 2>/dev/null
git status --short 2>/dev/null
```

Extract from STATE.md:
- `current_phase.number` — current phase
- `current_phase.status` — planning | executing | executed | verified | complete
- `current_plan.number` — current plan within the phase
- `last_activity` — timestamp and description

Scan phase directory for artifact completeness:

```bash
PADDED=$(printf "%02d" "$CURRENT_PHASE")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)

ls "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null   # context gathered?
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null      # planned?
ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null   # executed?
ls "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null  # verified?
ls "${PHASE_DIR}"/*-UAT.md 2>/dev/null       # UAT run?
```

Check for exceptional states:

```bash
cat .planning/HANDOFF.md 2>/dev/null         # interrupted session?
find .planning/phases -name "*-UAT.md" | xargs grep -l "status: testing" 2>/dev/null
find .planning/phases -name "*-VERIFICATION.md" | xargs grep -l "NEEDS FIXES" 2>/dev/null
```

---

## Step 2: Determine Next Action

Priority decision tree (first condition that matches wins):

**Level 1 — Interrupted work (highest priority):**

1. HANDOFF.md exists → `resume_from_handoff`: resume interrupted session
2. UAT in `status: testing` → `resume_uat`: continue open UAT session
3. VERIFICATION.md with "NEEDS FIXES" → `fix_verification`: fix failing verifications

**Level 2 — Current phase not complete:**

4. Phase status is `executing` AND a PLAN.md has no paired SUMMARY.md → `complete_execution`: finish incomplete plan
5. Phase status is `planning` AND PLAN.md exists → `execute_phase`: run the plan
6. Phase status is `executing` AND all PLAN.md files have SUMMARY.md → `verify_phase`: phase ready to verify

**Level 3 — Current phase complete, need to advance:**

7. Phase status is `executed` AND no VERIFICATION.md → `verify_now`: run verification
8. Phase status is `verified` AND ROADMAP.md has a next phase → `advance_phase`: transition to next phase
9. Phase status is `complete` AND next phase has no CONTEXT.md → `discuss_next`: discuss the next phase

**Level 4 — Phase setup:**

10. Next phase exists, CONTEXT.md missing → `discuss_phase`: gather context first
11. Next phase exists, CONTEXT.md present, no PLAN.md → `plan_phase`: plan the phase
12. Current phase has no PLAN.md and no CONTEXT.md → `discuss_current`: start with discussion

**Level 5 — Milestone boundary:**

13. All phases in roadmap are `complete` → `milestone_done`: suggest `/sunco:milestone complete`
14. No ROADMAP.md exists → `create_roadmap`: suggest `/sunco:milestone new` or `/sunco:init`

**Level 6 — No project:**

15. No `.planning/` directory → `init_project`: run `/sunco:init`

---

## Step 3: Present or Execute

For each action type, present the exact command:

**`resume_from_handoff`:**
```
Found interrupted session (HANDOFF.md).

Resuming from: plan 4-02, task 3/5 — "Implement resolve() method"

  /sunco:resume

/clear first — fresh context window
```

**`complete_execution`:**
```
Phase 4 execution is incomplete.
Plan 4-02 has no SUMMARY.md — execution was interrupted.

Continue:
  /sunco:execute 4

/clear first — fresh context window
```

**`execute_phase`:**
```
Phase 4 is planned and ready to execute.

  /sunco:execute 4

/clear first — fresh context window
```

**`verify_phase`:**
```
Phase 4 execution is complete (3 plans, 3 summaries).
Ready to verify.

  /sunco:verify 4
```

**`verify_now`:**
```
Phase 4 was executed but not yet verified.

  /sunco:verify 4
```

**`advance_phase`:**
```
Phase 4 is verified and complete.
Next: Phase 5 — Error Recovery

  /sunco:discuss 5   (recommended — gather context first)
  /sunco:plan 5      (plan directly)

/clear first — fresh context window
```

**`discuss_phase`:**
```
Phase 5 has no context yet.
Discuss it before planning.

  /sunco:discuss 5
```

**`plan_phase`:**
```
Phase 5 context is ready.

  /sunco:plan 5
```

**`milestone_done`:**
```
All phases complete.

  /sunco:milestone complete   archive this milestone
  /sunco:milestone new        start the next milestone
```

**`init_project`:**
```
No .planning/ found. This looks like a new project.

  /sunco:init
```

**Always include:** the one command the user should run next. Never multiple equally-weighted options (pick the primary one, put alternatives below the fold).

---

## Quick Mode

If called with `--quiet` or from `/sunco:do "what's next"`:

Return just the command, no prose:

```
/sunco:execute 4
```

---

## Success Criteria

- [ ] STATE.md read and parsed for current position
- [ ] Phase artifacts scanned (CONTEXT/PLAN/SUMMARY/VERIFICATION/UAT)
- [ ] Exceptional states checked first (HANDOFF, active UAT, failed verification)
- [ ] First matching condition from decision tree determines the action
- [ ] Exact command presented
- [ ] `/clear` reminder included when switching context
- [ ] One primary action, alternatives listed below only when relevant
