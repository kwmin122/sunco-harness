# Add Todo Workflow

Zero-friction todo capture. Parses the input text, assigns a stable ID, writes the todo to `.planning/todos/`, registers it with sunco-tools, and optionally links it to the current phase. Used by `/sunco:todo add`.

---

## Overview

Four steps:

1. **Parse input** — extract title, priority, phase link, and tags from `$ARGUMENTS`
2. **Assign ID** — determine the next todo ID from the existing todo store
3. **Write todo file** — create the todo entry in `.planning/todos/`
4. **Register with sunco-tools** — persist to the state layer and report

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS` for the following:

| Token | Variable | Default |
|-------|----------|---------|
| All non-flag text | `TODO_TITLE` | — (required) |
| `--priority <p>` | `PRIORITY` | `medium` |
| `--phase <n>` | `PHASE_LINK` | current phase from STATE.md |
| `--tag <t>` | `TAG` | none |
| `--no-phase` | `NO_PHASE` | false |
| `--done` | `START_DONE` | false |

Priority values: `high`, `medium`, `low`. Reject anything else:
```
Invalid priority: {value}. Use: high | medium | low
```

If `TODO_TITLE` is absent after stripping flags, stop:
```
Usage: /sunco:todo add "title" [--priority high|medium|low] [--phase N] [--tag tag]
Example: /sunco:todo add "Write unit tests for config parser" --priority high
```

Normalize `TODO_TITLE`: strip leading/trailing whitespace, collapse internal whitespace.

### Infer phase link

If `--no-phase` is set: `PHASE_LINK=""`. Otherwise:
- If `--phase` was given: use that value.
- Else: read STATE.md and extract `current_phase.number`.

```bash
CURRENT_PHASE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state load \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); \
    const s=JSON.parse(d); process.stdout.write(s.current_phase?.number ?? '')")
PHASE_LINK="${PHASE_LINK:-$CURRENT_PHASE}"
```

---

## Step 2: Assign Todo ID

Ensure `.planning/todos/` exists:
```bash
mkdir -p .planning/todos
```

Determine the next sequential ID:
```bash
LAST_ID=$(ls .planning/todos/*.md 2>/dev/null \
  | grep -oE "TODO-[0-9]+" | grep -oE "[0-9]+" \
  | sort -n | tail -1)
LAST_ID="${LAST_ID:-0}"
NEXT_ID=$((LAST_ID + 1))
TODO_ID=$(printf "TODO-%04d" "$NEXT_ID")
```

Filename: `.planning/todos/${TODO_ID}.md`

---

## Step 3: Write Todo File

Write the todo file:

```markdown
---
id: {TODO_ID}
title: {TODO_TITLE}
status: pending
priority: {PRIORITY}
phase: {PHASE_LINK}
tags: [{TAG if provided, else empty}]
created_at: {ISO timestamp}
---

# {TODO_ID}: {TODO_TITLE}

## Description

{TODO_TITLE}

{If PHASE_LINK is set:}
**Linked phase:** Phase {PHASE_LINK}

## Acceptance Criteria

- [ ] {Infer one obvious criterion from the title, e.g. if title is "Write unit tests for X", criterion is "All X tests pass with > 80% coverage"}

## Notes

_Add implementation notes here._
```

If `START_DONE` is set: set `status: done` in frontmatter and add `completed_at: {ISO timestamp}`.

---

## Step 4: Register with sunco-tools

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" todo add \
  --id "${TODO_ID}" \
  --title "${TODO_TITLE}" \
  --priority "${PRIORITY}" \
  --phase "${PHASE_LINK}" \
  --file ".planning/todos/${TODO_ID}.md"
```

If sunco-tools is unavailable (not installed globally), fall back to file-only mode:
```
sunco-tools not found — todo saved to file only.
To enable full state tracking, install: npm install -g popcoru
```

Continue regardless — the file is the source of truth.

---

## Step 5: Report

```
Todo added.

  ID:       {TODO_ID}
  Title:    {TODO_TITLE}
  Priority: {PRIORITY}
  Phase:    {PHASE_LINK if set, else "unlinked"}
  File:     .planning/todos/{TODO_ID}.md

Run /sunco:todo list to see all pending todos.
```

If `PRIORITY` is `high`, also suggest:
```
High-priority todo — run /sunco:check-todos to work on it now.
```

---

## Error Handling

| Error | Response |
|-------|----------|
| `TODO_TITLE` missing | Print usage and stop |
| Invalid priority value | Print valid options and stop |
| `.planning/todos/` write fails | Show error with manual instructions |
| sunco-tools registration fails | Log warning, continue in file-only mode |
| Duplicate title detected | Warn "Similar todo exists: {ID} — {title}". Ask "Add anyway? [y/n]" |

### Duplicate detection

Before writing, check for near-duplicate titles:
```bash
grep -rl "title:" .planning/todos/ 2>/dev/null \
  | xargs grep -l "${TODO_TITLE}" 2>/dev/null | head -3
```

If any match is found: show the match and ask "Add anyway? [y/n]". If user answers `n`, stop.
