---
name: sunco:quick
description: Execute an ad-hoc task with SUNCO guarantees (atomic commits, lint-gate, state tracking) but skip optional planning overhead. Flags are composable for the right level of rigor.
argument-hint: "<task description> [--discuss] [--research] [--full]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<task description>` — What to do. Required.

**Flags (composable):**
- `--discuss` — Lightweight discussion first. Ask 2-3 key questions before executing.
- `--research` — Investigate approaches before planning. Spawns one research agent.
- `--full` — Full plan-checking + verification. Same rigor as the main workflow but for a single task.

**Default (no flags):** Execute directly with lint-gate and atomic commit.
</context>

<objective>
Execute a single task with the right level of rigor. Guarantees: atomic git commit, lint-gate before commit, state tracking in STATE.md. Skip the full discuss→plan→execute pipeline for small tasks.

**After this command:** Task complete with clean commit.
</objective>

<process>
## Step 1: Parse task

If $ARGUMENTS has text (not a flag): that's the task description.
Otherwise: ask "What do you want to do?"

## Step 2: Apply --discuss (if flag present)

Ask 2-3 key clarifying questions ONLY (not the full discuss flow):

1. "Is there anything I should know about how this should be implemented?"
2. "Any files or patterns I should follow for this?"
3. One question specific to the task (based on task description)

Capture answers. Proceed.

## Step 3: Apply --research (if flag present)

Spawn a single research agent:
"Quick research: what's the best approach for [task]?
Context: [answers from discuss if applicable]
Constraint: TypeScript, [from CLAUDE.md stack]
Output: recommended approach in 3-5 bullet points only."

## Step 4: Apply --full (if flag present)

Create a mini PLAN.md:
- 2-5 tasks
- acceptance_criteria for each
- done_when list

Run plan verification: check against requirements (quick check, not the full loop).

## Step 5: Execute

Execute the task:

If `--full`: spawn a subagent with the mini plan.
Otherwise: execute inline.

During execution:
- Read relevant files first
- Make focused changes
- Verify each change works before moving on

## Step 6: Lint-gate (MANDATORY)

```bash
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

If lint fails: fix before committing.

## Step 7: Atomic commit

```bash
git add [specific files]
git commit -m "feat([scope]): [task description summary]"
```

## Step 8: Apply --full verification (if flag present)

Run quick verify:
- Layer 2 (guardrails): already done above
- Layer 3 (BDD): check acceptance_criteria from mini plan

## Step 9: Report

Show:
```
Quick task complete.
  Task: [description]
  Files changed: [N]
  Commit: [hash] — [message]
  Lint: pass
```
</process>
