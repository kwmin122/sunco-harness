---
name: sunco:seed
description: Plant an idea with a trigger condition — it surfaces automatically when the trigger is met. For forward-looking ideas that aren't ready yet but shouldn't be forgotten.
argument-hint: "[idea] [--trigger <condition>] [--list] [--check]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `[idea]` — The idea to plant.

**Flags:**
- `--trigger <condition>` — When should this surface? e.g., "when starting phase 5", "when v2 begins", "when auth is implemented"
- `--list` — Show all planted seeds.
- `--check` — Check if any seeds' trigger conditions are now met.
</context>

<objective>
Plant an idea with a trigger condition. Seeds live in `.sun/seeds.md` and surface when their trigger condition matches the current project state. Prevents good ideas from being lost while avoiding premature distraction.

**The trigger concept:** You're building something and think "this would be great to add — but not now." Plant it as a seed with a trigger. When you reach that milestone or phase, the seed surfaces automatically.
</objective>

<process>
## If --list

Read `.sun/seeds.md`.
Display all seeds grouped by status (dormant / triggered / implemented):
```
Dormant Seeds:
  [1] [idea] — triggers when: [condition] (planted [date])
  [2] [idea] — triggers when: [condition]

Triggered (ready to act on):
  [3] [idea] — trigger met: [when triggered]
```

## If --check

Read `.sun/seeds.md` and `.planning/STATE.md` and `.planning/ROADMAP.md`.

For each dormant seed, evaluate trigger condition against current state:
- Phase number matches: "when starting phase [N]" → check current phase
- Feature exists: "when auth is implemented" → check if auth-related code exists
- Milestone complete: "when v2 begins" → check ROADMAP.md milestone

For each triggered seed: mark as triggered, show to user.

## Otherwise (plant seed)

If $ARGUMENTS has text: use as idea.
Otherwise: ask "What's the idea?"

If `--trigger` not in $ARGUMENTS: ask "When should this surface? (e.g., 'when phase 5 starts', 'when working on auth')"

Create `.sun/seeds.md` if it doesn't exist.

Append:
```markdown
## Seed [N]: [idea summary]
- **Idea:** [full idea text]
- **Trigger:** [trigger condition]
- **Planted:** [YYYY-MM-DD]
- **Status:** dormant
```

Show: "Seed planted. Will surface when: [trigger condition]"

## Auto-check behavior

At the start of `/sunco:progress` and `/sunco:next`, silently check seeds.
If any seeds are triggered: show them as part of the output:
```
💡 Seed triggered: [idea] (trigger: [condition])
   Consider: /sunco:backlog to add this, or /sunco:phase to plan it
```
</process>
