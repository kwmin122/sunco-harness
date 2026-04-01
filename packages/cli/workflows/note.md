# Note Workflow

Zero-friction idea capture. Append a note to `.planning/notes.md`, list existing notes, or promote a note to a todo. Used by `/sunco:note`.

---

## Overview

Three sub-commands:

| Mode | Trigger | Effect |
|------|---------|--------|
| Add | `/sunco:note <text>` | Append note to notes.md |
| List | `/sunco:note --list` | Show all notes |
| Promote | `/sunco:note --promote <N>` | Move note N to todos |

The goal of this workflow is zero friction. Adding a note should take one command and no setup. If `notes.md` does not exist, create it. If the text is empty, ask for it.

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional text (before any flags) | `NOTE_TEXT` | empty |
| `--list` | `LIST_MODE` | false |
| `--promote <N>` | `PROMOTE_INDEX` | unset |
| `--tag <tag>` | `TAG` | unset |
| `--context` | `INCLUDE_CONTEXT` | false |

Rules:
- If `NOTE_TEXT` is empty and no flags: show list (same as `--list`)
- If `NOTE_TEXT` is a number and no other args: treat as `--promote {N}`
- `--tag` allows tagging a note: `#idea`, `#risk`, `#later`, `#question`
- `--context` appends the current phase and date as context metadata

---

## Step 2: Ensure notes.md Exists

```bash
NOTES_FILE=".planning/notes.md"
mkdir -p .planning/

if [[ ! -f "$NOTES_FILE" ]]; then
  cat > "$NOTES_FILE" << 'EOF'
# Notes

Captured ideas, observations, and questions. Use `/sunco:note <text>` to add.
Promote a note to a todo: `/sunco:note --promote <N>`

---

EOF
fi
```

---

## Step 3A: Add Note

If `LIST_MODE` and `PROMOTE_INDEX` are both unset, and `NOTE_TEXT` is non-empty:

### Build note entry

```
{N}. {NOTE_TEXT}
   {If TAG: #{tag}}
   {If INCLUDE_CONTEXT: Phase {current_phase.number} — {current_date}}
   Added: {YYYY-MM-DD HH:MM}
```

### Append to notes.md

Read the current note count (count lines starting with a number + `.`).

```bash
CURRENT_COUNT=$(grep -c "^[0-9]*\." "$NOTES_FILE" 2>/dev/null || echo "0")
NEW_INDEX=$(( CURRENT_COUNT + 1 ))
```

Append:

```bash
echo "" >> "$NOTES_FILE"
echo "${NEW_INDEX}. ${NOTE_TEXT}" >> "$NOTES_FILE"
if [[ -n "$TAG" ]]; then
  echo "   #${TAG}" >> "$NOTES_FILE"
fi
if [[ "${INCLUDE_CONTEXT}" == "true" ]]; then
  echo "   Phase ${CURRENT_PHASE} — $(date +%Y-%m-%d)" >> "$NOTES_FILE"
fi
echo "   Added: $(date '+%Y-%m-%d %H:%M')" >> "$NOTES_FILE"
```

### Confirm

```
Note captured (#${NEW_INDEX}).
  {NOTE_TEXT}

  /sunco:note --list          to see all notes
  /sunco:note --promote ${NEW_INDEX}   to move to todos
```

---

## Step 3B: List Notes

If `LIST_MODE` is true or `NOTE_TEXT` is empty:

Read notes.md and render:

```
Notes ({N} total)
─────────────────────────────────────────────────
{For each note:}
  {N}. {text}
     {tag if present}
     Added: {date}

─────────────────────────────────────────────────
Add:     /sunco:note <text>
Promote: /sunco:note --promote <N>
Seed:    /sunco:plant-seed <text>     (for ideas with a trigger condition)
Todo:    /sunco:todo <text>           (for actionable tasks)
```

If notes.md has no entries yet:

```
No notes yet.

Capture your first idea:
  /sunco:note "something worth remembering"
```

---

## Step 3C: Promote Note to Todo

If `PROMOTE_INDEX` is set:

### Find the note

Read notes.md. Find the entry at position `PROMOTE_INDEX`.

If not found:

```
Note #{PROMOTE_INDEX} not found.
Run /sunco:note --list to see available notes.
```

### Promote

Read the note text. Write it to the todos file:

```bash
TODOS_FILE=".planning/todos.md"
# Append to todos (see todo.md workflow for format)
```

Mark the note as promoted in notes.md by adding `   ✓ Promoted to todo: {date}` below it.

Confirm:

```
Note #{PROMOTE_INDEX} promoted to todo.
  "{note_text}"

Run /sunco:todo to see your todo list.
```

---

## Notes File Format

```markdown
# Notes

Captured ideas, observations, and questions. Use `/sunco:note <text>` to add.
Promote a note to a todo: `/sunco:note --promote <N>`

---

1. Look into using smol-toml for config serialization instead of manual JSON
   #idea
   Added: 2026-03-31 14:22

2. The skill registry scan is O(n) — may need indexing for large installs
   #risk
   Phase 03 — 2026-03-31
   Added: 2026-03-31 15:05
   ✓ Promoted to todo: 2026-03-31 15:30

3. Research whether Vercel AI SDK v6 supports tool streaming for Claude
   #question
   Added: 2026-03-31 16:11
```

---

## Route

After adding a note: "Done. Notes live at `.planning/notes.md`."

If the note sounds like it has a future trigger condition ("when X is done, do Y"): "This sounds like a seed — try `/sunco:plant-seed` to attach a trigger condition."

If the note sounds like an immediate action ("fix", "add", "change"): "This sounds actionable — try `/sunco:todo '{note_text}'` to add it as a tracked task."
