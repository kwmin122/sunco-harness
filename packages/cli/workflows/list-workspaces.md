# List Workspaces Workflow

List all active git worktrees with their branch, current phase, and working tree status. Provides a quick at-a-glance view of all parallel SUNCO workspaces. Used by `/sunco:workspaces list`.

---

## Overview

Two steps:

1. **Query git worktrees** — run `git worktree list` and parse output
2. **Enrich with SUNCO state** — read STATE.md from each worktree and render the summary

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--json` | `JSON_OUTPUT` | false |
| `--short` | `SHORT` | false |

`--short`: one-line-per-worktree format (no git status detail).

---

## Step 2: Query Git Worktrees

```bash
WORKTREE_LIST=$(git worktree list --porcelain 2>&1)
```

If git fails: "Not a git repository or git not available."

Parse the porcelain output. Each worktree block looks like:
```
worktree /path/to/worktree
HEAD abc1234abc1234
branch refs/heads/phase/03-skill-system
```

For bare worktrees (no branch checked out):
```
worktree /path/to/bare
HEAD abc1234abc1234
bare
```

Extract per worktree:
- `WORKTREE_PATH` — absolute path
- `BRANCH` — branch name (strip `refs/heads/` prefix)
- `HEAD_SHA` — short SHA (first 7 chars)
- `IS_BARE` — true if bare
- `IS_MAIN` — true if this is the main worktree (first entry in the list)

---

## Step 3: Enrich with SUNCO State

For each worktree (skip bare worktrees):

**Check for dirty working tree:**
```bash
DIRTY=$(git -C "${WORKTREE_PATH}" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
```

**Read SUNCO state if present:**
```bash
STATE_FILE="${WORKTREE_PATH}/.sun/STATE.md"
if [[ -f "$STATE_FILE" ]]; then
  CURRENT_PHASE=$(grep -m1 "^Current Phase:" "$STATE_FILE" | sed 's/Current Phase: //')
  PHASE_STATUS=$(grep -m1 "^Status:" "$STATE_FILE" | sed 's/Status: //')
  LAST_ACTIVITY=$(grep -m1 "^Last Activity:" "$STATE_FILE" | sed 's/Last Activity: //')
else
  CURRENT_PHASE=""
  PHASE_STATUS=""
  LAST_ACTIVITY=""
fi
```

**Determine workspace name** — derive from the branch name:
- `phase/03-skill-system` → `03-skill-system`
- `milestone/alpha` → `milestone-alpha`
- `main` / `master` → `main`
- anything else → the full branch name

---

## Step 4: Render Output

If `--json`: print JSON array of workspace objects and stop.

If `--short`:
```
WORKSPACE          BRANCH                        PHASE     STATUS
main               main                          04        executing
03-skill-system    phase/03-skill-system         03        verified
02-bugfix          fix/login-validation          —         —
```

Otherwise (default):

```
Active workspaces ({N} total)

  main  [main]
  Path:     /Users/you/project
  Phase:    04 — agent-router
  Status:   executing
  Activity: 2026-03-31 14:22 UTC
  Changes:  clean

  03-skill-system  [phase/03-skill-system]
  Path:     /Users/you/project-workspaces/03-skill-system
  Phase:    03 — skill-system
  Status:   verified
  Activity: 2026-03-30 09:10 UTC
  Changes:  3 modified files

  02-bugfix  [fix/login-validation]
  Path:     /Users/you/project-workspaces/02-bugfix
  Phase:    —
  Status:   —
  Activity: —
  Changes:  clean
```

Mark the current worktree (where the command was run) with `(current)` next to the name.

If dirty, show the modified file count. If more than 5 dirty files:
```
  Changes:  12 files (run `git -C <path> status` for details)
```

If no SUNCO state found: show `Phase: —` and `Status: —`.

---

## Step 5: Footer

Show a summary line:
```
{N} workspace(s) total  |  {clean_count} clean  |  {dirty_count} with changes

To enter a workspace:  cd <path>
To remove a workspace: /sunco:workspaces remove <branch>
To create a workspace: /sunco:workspaces new <phase>
```

If only the main worktree exists:
```
Only the main workspace is active.
To create a parallel workspace: /sunco:workspaces new <phase>
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Not a git repo | "Not a git repository." |
| `git worktree list` fails | Show error and stop |
| STATE.md unreadable | Skip enrichment for that worktree, show branch only |
| Worktree path does not exist on disk | Mark as `(missing)` — stale worktree registration |
