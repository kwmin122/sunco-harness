---
name: sunco:context
description: Display current decisions, blockers, and next actions for the active phase. Use at the start of a session to orient yourself.
argument-hint: "[phase] [--full]"
allowed-tools:
  - Read
  - Bash
---

<context>
**Arguments:**
- `[phase]` — Phase number. Default: current phase from STATE.md.

**Flags:**
- `--full` — Show all decisions, not just the most recent.
</context>

<objective>
Show a focused context view for the current phase: what decisions were made, what constraints apply, what blockers exist, and what the next action is. Read-only.
</objective>

<process>
## Step 1: Read state

Read:
1. `.planning/STATE.md` — current phase and decisions
2. `.planning/phases/[N]-*/[N]-CONTEXT.md` — phase-specific decisions
3. `.planning/ROADMAP.md` — phase goal
4. `.planning/REQUIREMENTS.md` — requirements this phase covers

## Step 2: Build context summary

```
== Context: Phase [N] — [title] ==

GOAL
----
[phase goal from ROADMAP.md]

DECISIONS
---------
[If CONTEXT.md exists, list decisions made]
[If --full: show all; otherwise show last 5]

CONSTRAINTS
-----------
[From CONTEXT.md constraints section]
[From CLAUDE.md tech stack]

OUT OF SCOPE (Phase [N])
------------------------
[Explicit exclusions from CONTEXT.md]

BLOCKERS
--------
[From STATE.md blockers section]
[None] if empty

CURRENT STATUS
--------------
Plans: [N created / N executed]
Lint: [passing/failing/unknown]
Verification: [passed/failed/pending]

NEXT ACTION
-----------
→ /sunco:[command]
```

If CONTEXT.md doesn't exist yet: show "No context captured for Phase [N]. Run `/sunco:discuss [N]` first."
</process>
