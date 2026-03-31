---
name: sunco:note
description: Zero-friction idea capture. Append a note, list recent notes, or promote a note to a todo. Fast — no planning required.
argument-hint: "[text] [--list] [--promote <N>]"
allowed-tools:
  - Read
  - Bash
  - Write
---

<context>
**Arguments:**
- `[text]` — Note text to capture. Captured immediately.

**Flags:**
- `--list` — Show recent notes (last 20).
- `--promote <N>` — Promote note number N to a todo item.
</context>

<objective>
Zero-friction idea capture. Notes are appended to `.sun/notes/notes.md` with timestamp. No frontmatter, no structure — just capture and move on.
</objective>

<process>
## If --list

Read `.sun/notes/notes.md`.
Show last 20 notes with index numbers.

## If --promote N

Read `.sun/notes/notes.md` and find note N.
Add it to the todo list via the same logic as `/sunco:todo --add`.
Show: "Note [N] promoted to todo."

## Otherwise (capture note)

If $ARGUMENTS has text (not a flag): use that as the note.
Otherwise: ask "What's the idea?" (one-line prompt).

Create `.sun/notes/` if it doesn't exist.

Append to `.sun/notes/notes.md`:
```
[YYYY-MM-DD HH:MM] [note text]
```

Show: "Noted."

That's it. Fast. No friction.
</process>
