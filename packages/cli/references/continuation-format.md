# Session Continuation Protocol

How to save and restore context across SUNCO sessions. Applied by `/sunco:pause` (save) and `/sunco:resume` (restore).

---

## Why Sessions Break

Agent context is ephemeral. When a session ends — whether by choice, time, or crash — everything in the agent's working memory is lost. A HANDOFF.md bridges the gap between sessions so work can continue without re-establishing context from scratch.

**What gets lost without a handoff:**
- Which wave was active
- Why certain decisions were made (not just what was decided)
- What was about to be done next
- What was partially completed
- What tests were failing and why

**What SUNCO can recover from files alone:**
- Which phase and plan is current (from ROADMAP.md + STATE.md)
- What tasks exist (from plan files)
- What was committed (from git log)
- What tests pass or fail (from running tests again)

The gap between "recoverable from files" and "full context" is what HANDOFF.md bridges.

---

## HANDOFF.md Format

Created by `/sunco:pause` at `.sun/HANDOFF.md`.

```markdown
# Session Handoff — 2026-03-31 14:23

## Where We Are

Phase: 03-skill-registry
Plan: 02 (of 3)
Wave: 2 (of 3)
Wave status: in_progress

Last commit: abc1234 — feat(03-01): implement SkillLoader
Last lint-gate: PASSED at 13:45

## What Was Just Done

Completed Plan 01 (SkillLoader). SkillLoader reads .skill.ts files from the
skills directory, validates each file has a default export from defineSkill(),
and returns an array of unregistered Skill objects.

Currently mid-way through Plan 02 (SkillRegistry). Wave 1 complete (types and
interfaces). Wave 2 in progress: SkillRegistry class started but not finished.

## What Needs to Happen Next

**Immediate next task (Wave 2, Task 2):**
Finish SkillRegistry.register() — it currently throws on duplicate ID but does
not validate that the skill ID is non-empty. Need to add:
  1. Guard: `if (!skill.id) throw new InvalidSkillError('id required')`
  2. Test case for empty-id behavior
  3. Run npm test to confirm green

**After Wave 2 completes:**
Wave 3: Wire SkillRegistry to SkillLoader in SkillLoader.load() return path.
See plan-02.md task "wire-registry-to-loader" for details.

## Key Decisions Made This Session

1. SkillRegistry uses Map<string, Skill>, not array + find(). Reason: O(1)
   lookup by id matters when registry has 50+ skills loaded.

2. register() is synchronous. Decided not to make it async even though future
   loaders might be async — callers should await the loader, not the registry.

3. SkillConflictError extends Error (not a custom base class). Reason: keeping
   error hierarchy flat for now; can introduce hierarchy in later phase.

## Open Questions / Blockers

- None currently blocking

## Uncommitted Work

- packages/core/src/registry/skill-registry.ts (partial, Wave 2 in progress)
  Status: SkillRegistry class exists, register() incomplete

## Known Test Status

- Unit tests for SkillLoader: 12/12 passing
- Unit tests for SkillRegistry: 4/6 passing (empty-id test pending implementation)
- All other tests: passing (ran full suite at 13:45)

## Context That Won't Be Obvious From Files

The SkillLoader and SkillRegistry are intentionally decoupled — SkillLoader does
NOT call SkillRegistry.register(). The caller (SkillLoaderService) does both steps.
This was a design decision to keep loader pure (no side effects). The wiring in
Wave 3 is adding this to SkillLoaderService, not to SkillLoader.
```

---

## What to Include

### Always include

| Section | Why |
|---------|-----|
| Phase + plan + wave + status | Exact position in execution, no ambiguity |
| Last commit + lint-gate status | Whether current state is clean |
| What was just done | 1-3 sentences, prevents re-doing completed work |
| Immediate next task | Exact action, not vague direction |
| Key decisions with rationale | Rationale prevents re-litigating decisions |
| Uncommitted files + their status | Avoids stale uncommitted work confusion |

### Include when relevant

| Section | When |
|---------|------|
| Open questions or blockers | When anything is blocking |
| Known test status | When tests are in a non-green state |
| Context not obvious from files | When a design decision would look wrong without context |
| Environment notes | When something about the local env affects execution |

### Never include

| Item | Why not |
|------|---------|
| Full file contents | Git and the files themselves have this |
| List of all completed tasks from past phases | Too much noise, git log has history |
| Explanations of SUNCO itself | Context is about the project, not the tool |
| Speculative next phases | Stick to what's immediately next |

---

## Resume Priority Order

When `/sunco:resume` reads a HANDOFF.md, it processes context in this order:

1. **Current position** — phase, plan, wave. Establishes exactly where to continue.

2. **Uncommitted files** — check status before anything else. If uncommitted work exists, confirm whether to commit, continue, or discard before resuming execution.

3. **Test status** — re-run tests to confirm the state matches what HANDOFF.md says. If tests are failing that HANDOFF.md says were passing, something changed between sessions.

4. **Immediate next task** — the single action to take first. Do not ask for confirmation unless the task is risky.

5. **Key decisions** — load into context so agents don't re-ask settled questions.

6. **Open questions** — surface to user if any blockers exist.

**Resume is complete when:**
- Current position is verified against git state
- Test status matches expected (or mismatch is acknowledged)
- Execution of next task has started

---

## Auto-Pause (Implicit Handoff)

SUNCO writes a HANDOFF.md automatically at the end of every `/sunco:execute` run and on SIGINT. These auto-generated handoffs are less rich than manually written ones but cover the essential fields.

Auto-generated HANDOFF.md structure:

```markdown
# Auto-Pause — 2026-03-31 14:23

## Position
Phase: 03-skill-registry / Plan: 02 / Wave: 2 / Status: in_progress

## Last Commit
abc1234 — feat(03-01): implement SkillLoader

## Pending Tasks
- finish-register-validation (Wave 2, Task 2)
- wire-registry-to-loader (Wave 3, Task 1)
- integration-test (Wave 3, Task 2)

## Uncommitted Files
- packages/core/src/registry/skill-registry.ts

## Auto-generated — run /sunco:context for full session context
```

The `-- run /sunco:context` note at the bottom indicates that a richer handoff can be generated on demand.

---

## Multiple Sessions / Long Projects

For projects spanning many sessions, HANDOFF.md is overwritten each session. Historical context lives in:

- **Git log** — committed decisions and implementations
- **SUMMARY.md** — per-plan post-execution summaries (in `.planning/phase/plan/`)
- **STATE.md** — overall project state (in `.planning/`)
- **`.planning/ROADMAP.md`** — phase history and progress

HANDOFF.md is the bridge between the last session and the current one. It is not a long-term archive.

---

## Conflict Resolution

If HANDOFF.md and git state disagree, git state wins:

| Conflict | Resolution |
|----------|------------|
| HANDOFF.md says Wave 2 in progress, but last commit is Wave 3 complete | Trust git — Wave 3 was completed |
| HANDOFF.md says tests passing, but `npm test` shows failures | Trust current test run — something changed |
| HANDOFF.md says uncommitted files exist, but `git status` is clean | Trust git — files were committed or discarded |
| HANDOFF.md says phase 03, ROADMAP.md says phase 04 | ROADMAP.md is the source of truth for current phase |

HANDOFF.md describes intent as of the last session. Git state describes reality. Always verify, never assume.
