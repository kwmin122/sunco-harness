---
name: sunco:thread
description: Manage persistent context threads for cross-session work. Threads capture ongoing context (decisions, progress, blockers) that survive context resets.
argument-hint: "[--new <title>] [--list] [--read <id>] [--append <id>] [--close <id>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Flags:**
- `--new <title>` — Create a new thread.
- `--list` — List all active threads.
- `--read <id>` — Read a thread's full context.
- `--append <id>` — Append notes to an existing thread.
- `--close <id>` — Close a completed thread.
</context>

<objective>
Persistent context threads for ongoing work that spans multiple sessions. Unlike session pause/resume (which saves one active state), threads can capture multiple parallel contexts — e.g., one thread per feature being worked on, one for a bug investigation, one for architectural research.

**Stores in:** `.sun/threads/`
</objective>

<process>
## If --list

```bash
ls .sun/threads/*.md 2>/dev/null
```

Display each thread:
```
Active Threads:
  [thread-001] [title] — last updated [date]
  [thread-002] [title] — last updated [date]

Closed Threads:
  [thread-003] [title] — closed [date]
```

## If --new <title>

Get title from flag or ask: "Thread title?"

Generate thread ID: `thread-[YYYY-MM-DD]-[slug]`

Create `.sun/threads/[id].md`:
```markdown
# Thread: [title]

## Created
[timestamp]

## Status
active

## Context
[ask user: "Initial context for this thread?" or capture from current conversation]

## Updates
(append updates below)
```

Show: "Thread created: [id]"

## If --read <id>

Read `.sun/threads/[id].md` and display full contents.

## If --append <id>

Read current thread.
Ask (or accept from $ARGUMENTS): "What to add to this thread?"

Append to thread file:
```markdown
---
[timestamp]
[content]
```

Show: "Thread updated."

## If --close <id>

Read thread.
Ask: "Summary of resolution (optional):"

Update status to "closed" and add closing summary.
Move to closed section in listing.

## Default (no flag)

If there are active threads: show --list output.
Ask: "Which thread? Or create a new one with --new?"

If no threads: ask "Create a new thread? [yes/no]" with guidance on when threads are useful.
</process>
