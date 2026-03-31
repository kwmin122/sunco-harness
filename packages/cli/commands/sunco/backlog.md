---
name: sunco:backlog
description: Parking lot for ideas that aren't ready for the active milestone. Backlog items use 999.x numbering to stay outside the active phase sequence.
argument-hint: "[idea] [--list] [--promote <N>] [--review]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `[idea]` — Idea or feature to add to the backlog.

**Flags:**
- `--list` — Show all backlog items.
- `--promote <N>` — Promote backlog item N to the active roadmap as a new phase.
- `--review` — Interactive review session — go through backlog items and decide: keep, promote, or discard.
</context>

<objective>
Parking lot for good ideas that aren't ready for the active milestone. Backlog items use 999.x numbering (999.1, 999.2, ...) in ROADMAP.md to make them visible but out of active sequence.
</objective>

<process>
## If --list

Read `.planning/ROADMAP.md`, find all phases with number 999.x.
Also read `.sun/backlog.md` if exists.

Display:
```
== Backlog ==

999.1 [title] — [brief description] (added [date])
999.2 [title] — [brief description]
...

[N] items in backlog
```

## If --promote N

Read backlog item 999.N.
Ask: "Which milestone should this go into? Which phase number? [list active phases]"
Move the item from 999.x to the specified phase slot in ROADMAP.md.
Renumber remaining backlog items.
Show: "Promoted to Phase [new number]."

## If --review

Show each backlog item one at a time.
For each: ask "Keep as backlog / Promote to active / Discard? [K/P/D]"
- K: keep in backlog
- P: promote (ask which phase)
- D: remove from backlog

## Otherwise (add to backlog)

If $ARGUMENTS has text: use as idea title.
Otherwise: ask "What's the idea? (brief title)"

Then ask: "One sentence description (optional):"

Read `.planning/ROADMAP.md`.
Find the next available 999.x number.

Append to ROADMAP.md backlog section:
```markdown
### Phase 999.[N]: [title]
- Status: backlog
- Description: [description]
- Added: [YYYY-MM-DD]
- Goal: [if user provided]
```

Create a backlog section in ROADMAP.md if it doesn't exist:
```markdown
## Backlog (Future Consideration)
```

Show: "Added to backlog as 999.[N]. Use `/sunco:backlog --promote 999.[N]` when ready."
</process>
