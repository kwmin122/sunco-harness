---
name: sunco:todo
description: Add, list, and complete tasks. Lightweight task tracking in .sun/todos.md. Separate from the planning system — for ad-hoc tasks and reminders.
argument-hint: "[text] [--list] [--done <N>] [--delete <N>]"
allowed-tools:
  - Read
  - Bash
  - Write
---

<context>
**Arguments:**
- `[text]` — Task text to add.

**Flags:**
- `--list` — Show all todos (open and recently completed).
- `--done <N>` — Mark todo number N as complete.
- `--delete <N>` — Delete todo number N.
</context>

<objective>
Lightweight task tracking. Todos live in `.sun/todos.md` as a simple checklist. Use for ad-hoc tasks, reminders, and things that don't fit in the planning system.
</objective>

<process>
## If --list

Read `.sun/todos.md`.
Display:
```
Open:
  [1] [task text]  (added [date])
  [2] [task text]  (added [date])

Recently Completed (last 5):
  [✓] [task text]  (done [date])
```

If empty: "No todos. Add one with: /sunco:todo [text]"

## If --done N

Read `.sun/todos.md`.
Find item N in the open list.
Mark it as `[x]` with completion date.
Show: "Done: [task text]"

## If --delete N

Read `.sun/todos.md`.
Remove item N.
Show: "Deleted: [task text]"

## Otherwise (add todo)

If $ARGUMENTS has text (not a flag): use that as the task.
Otherwise: ask "What's the task?"

Create `.sun/todos.md` if it doesn't exist with header:
```markdown
# Todos
```

Append:
```markdown
- [ ] [task text]  <!-- added: [YYYY-MM-DD] -->
```

Show: "Todo added."
</process>
