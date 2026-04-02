# Check Todos Workflow

List all pending todos, surface priority items, and offer to start working on one immediately. Routes to `/sunco:quick` (small tasks) or `/sunco:execute` (phase-linked tasks) based on the selected todo. Used by `/sunco:todo list` and `/sunco:check-todos`.

---

## Overview

Four steps:

1. **Load todos** — read `.planning/todos/` and query sunco-tools
2. **Render list** — display by priority, grouped by phase
3. **Offer selection** — ask if the user wants to work on one now
4. **Route** — hand off to the appropriate execution workflow

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--phase <n>` | `PHASE_FILTER` | none |
| `--priority <p>` | `PRIORITY_FILTER` | none |
| `--all` | `SHOW_ALL` | false (pending only) |
| `--no-route` | `NO_ROUTE` | false |
| `--json` | `JSON_OUTPUT` | false |

By default: show only `status: pending` todos. `--all` includes done/cancelled.

---

## Step 2: Load Todos

### Primary: sunco-tools query

```bash
TODOS=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" todo list \
  --status "${SHOW_ALL:+all}" \
  --phase "${PHASE_FILTER}" \
  --priority "${PRIORITY_FILTER}" 2>/dev/null)
```

### Fallback: scan files directly

If sunco-tools fails or returns empty, scan `.planning/todos/*.md` directly:

```bash
for f in .planning/todos/*.md; do
  ID=$(grep -m1 "^id:" "$f" | awk '{print $2}')
  TITLE=$(grep -m1 "^title:" "$f" | sed 's/^title: //')
  STATUS=$(grep -m1 "^status:" "$f" | awk '{print $2}')
  PRIORITY=$(grep -m1 "^priority:" "$f" | awk '{print $2}')
  PHASE=$(grep -m1 "^phase:" "$f" | awk '{print $2}')
  # collect into array
done
```

Apply filters after loading:
- If `PHASE_FILTER` set: keep only todos where `phase == PHASE_FILTER`.
- If `PRIORITY_FILTER` set: keep only matching priority.
- If not `SHOW_ALL`: keep only `status: pending`.

### If no todos found

```
No pending todos.

To add one:
  /sunco:todo add "title"
```

Stop.

---

## Step 3: Render Todo List

If `--json`: print raw JSON array and stop.

Otherwise, render grouped by priority:

```
Pending todos ({N} total)

HIGH PRIORITY
  {TODO-0003}  Write unit tests for config parser       [phase 03]
  {TODO-0007}  Fix ESM import in skills-harness/index   [phase 04]

MEDIUM PRIORITY
  {TODO-0001}  Add --dry-run flag to ship workflow       [phase 05]
  {TODO-0009}  Update ROADMAP.md milestone dates        [unlinked]

LOW PRIORITY
  {TODO-0005}  Improve error message for missing toml   [phase 02]
```

Formatting rules:
- Truncate titles at 55 characters, append `…` if longer.
- Phase label: `[phase NN]` if linked, `[unlinked]` if `PHASE_LINK` is empty.
- Sort within each priority group: phase-linked first, then by ID ascending.
- Show a `(done)` prefix if `--all` is used and a todo has `status: done`.

If all todos are in one priority group, skip the group header and list flat.

---

## Step 4: Offer to Work on a Todo

If `--no-route` is set or there are more than 20 todos: skip this step, report count only.

Otherwise, ask:

```
Work on a todo now?
Enter ID (e.g. TODO-0003), or press Enter to skip:
```

Wait for input.

### If user presses Enter (skip)

```
Run /sunco:todo add "title" to capture a new task.
```

Stop.

### If user provides an ID

Validate the ID:
```bash
TODO_FILE=".planning/todos/${SELECTED_ID}.md"
if [[ ! -f "$TODO_FILE" ]]; then
  echo "Todo ${SELECTED_ID} not found."
  exit 1
fi
```

Read the todo:
- `SELECTED_TITLE` from `title:` frontmatter
- `SELECTED_PHASE` from `phase:` frontmatter
- `SELECTED_PRIORITY` from `priority:` frontmatter

---

## Step 5: Route to Execution

### Routing logic

| Condition | Route |
|-----------|-------|
| Todo has no `phase:` link | `/sunco:quick "{SELECTED_TITLE}"` |
| Todo has `phase:` link AND phase status is `planned` or `draft` | `/sunco:execute {SELECTED_PHASE}` |
| Todo has `phase:` link AND phase status is `executed` or `verified` | `/sunco:quick "{SELECTED_TITLE}"` |
| Todo has `phase:` link AND phase has no plans yet | `/sunco:plan {SELECTED_PHASE}` |

Determine phase status by checking for VERIFICATION.md, SUMMARY.md, or PLAN.md files in the phase directory:
```bash
PHASE_DIR=$(ls -d ".planning/phases/$(printf "%02d" $SELECTED_PHASE)-*" 2>/dev/null | head -1)
HAS_PLANS=$(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l)
HAS_SUMMARIES=$(ls "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null | wc -l)
```

### Confirm before routing

```
Working on: {SELECTED_ID} — {SELECTED_TITLE}
Priority:   {SELECTED_PRIORITY}
Route:      /sunco:quick "{SELECTED_TITLE}"

Proceed? [y/n]
```

If `y`: invoke the route. Mark the todo `in_progress` in its frontmatter:
```bash
# Update status in todo file
sed -i '' 's/^status: pending/status: in_progress/' "$TODO_FILE"
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" todo update \
  --id "${SELECTED_ID}" --status "in_progress" 2>/dev/null
```

If `n`: stop without routing.

---

## Step 6: Post-Execution (if routed)

After the routed workflow completes, offer to mark the todo done:

```
Did this resolve {SELECTED_ID}: "{SELECTED_TITLE}"? [y/n]
```

If `y`:
```bash
sed -i '' 's/^status: in_progress/status: done/' "$TODO_FILE"
echo "completed_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$TODO_FILE"
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" todo update \
  --id "${SELECTED_ID}" --status "done" 2>/dev/null
echo "Todo ${SELECTED_ID} marked done."
```

If `n`: leave as `in_progress`. Remind: "Run /sunco:check-todos to resume later."

---

## Error Handling

| Error | Response |
|-------|----------|
| `.planning/todos/` does not exist | "No todos directory found. Run /sunco:todo add to start." |
| Selected ID not found | "Todo {ID} not found. Check the list above." |
| sunco-tools unavailable | Fall back to file scan, continue |
| Routed workflow errors | Surface the error, keep todo as `in_progress` |
