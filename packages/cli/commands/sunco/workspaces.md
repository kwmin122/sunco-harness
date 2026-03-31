---
name: sunco:workspaces
description: Manage isolated project workspaces via git worktrees or clones — each with its own independent .planning/ directory.
argument-hint: "<subcommand> [name] [--clone]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `new <name>` — Create a new isolated workspace.
- `list` — Show all workspaces with their path and status.
- `switch <name>` — Open the target workspace in a new terminal or show its path.
- `remove <name>` — Remove a workspace and clean up its worktree or clone.

**Flags:**
- `--clone` — Use `git clone` instead of `git worktree` (for fully independent repos). Default: worktree.
</context>

<objective>
Create and manage isolated project workspaces so different experiments, client variants, or long-running branches can coexist without polluting the main working tree. Each workspace has its own independent `.planning/` directory and git working tree.

**Creates:**
- `~/.sun/workspaces/<name>/` — workspace root (worktree or clone)
- `~/.sun/workspaces.json` — global workspace registry
- `<workspace>/.sun/` — workspace-level config
- `<workspace>/.planning/` — workspace-local planning artifacts

**After this command:** Navigate to the workspace path and run SUNCO commands there as a fully isolated project.
</objective>

<process>
## If `new <name>`

Validate name: lowercase, hyphens and underscores allowed, no spaces.

Check `~/.sun/workspaces.json` — error if name already exists.

Ask: "Workspace purpose? (one sentence)"

Determine workspace strategy:
- Default (no `--clone`): git worktree
- With `--clone`: full git clone

Get current repo root:
```bash
git rev-parse --show-toplevel
```

Determine workspace path: `~/.sun/workspaces/<name>`
(or ask user for custom path)

### If worktree (default)

Create a new branch for the workspace:
```bash
git checkout -b workspace/<name>
```

Create the worktree:
```bash
git worktree add ~/.sun/workspaces/<name> workspace/<name>
```

### If `--clone`

Clone the repo:
```bash
git clone [repo-root] ~/.sun/workspaces/<name>
```

### After creating workspace

Initialize workspace planning:
```bash
mkdir -p ~/.sun/workspaces/<name>/.planning
mkdir -p ~/.sun/workspaces/<name>/.sun
```

Write `~/.sun/workspaces/<name>/.planning/STATE.md`:
```markdown
# Workspace: <name>

**Purpose:** [user input]
**Type:** [worktree|clone]
**Source:** [original repo path]
**Created:** [timestamp]
**Status:** active
```

Register in `~/.sun/workspaces.json`:
```json
{
  "workspaces": {
    "<name>": {
      "path": "~/.sun/workspaces/<name>",
      "type": "worktree|clone",
      "branch": "workspace/<name>",
      "source": "[repo root]",
      "purpose": "[user input]",
      "status": "active",
      "createdAt": "[timestamp]"
    }
  }
}
```

Show:
```
Workspace '<name>' created.
Path: ~/.sun/workspaces/<name>
Type: [worktree|clone]
Branch: workspace/<name>
```

Show next action: "Navigate to the workspace: `cd ~/.sun/workspaces/<name>` and run `/sunco:init` or `/sunco:plan` to begin."

## If `list`

Read `~/.sun/workspaces.json` (show "No workspaces" if missing or empty).

For each workspace, check if path still exists:
```bash
ls ~/.sun/workspaces/<name> 2>/dev/null
```

For worktree workspaces, verify worktree is registered:
```bash
git worktree list 2>/dev/null
```

Display:
```
WORKSPACES
----------
NAME        TYPE        PATH                              STATUS    CREATED
main-work   worktree    ~/.sun/workspaces/main-work       active    2026-03-31
experiment  clone       ~/.sun/workspaces/experiment      active    2026-03-28
old-spike   worktree    ~/.sun/workspaces/old-spike       missing   2026-03-10
```

Flag any workspaces where the path no longer exists as `missing`.
Suggest: "Run `/sunco:workspaces remove <name>` to clean up missing workspaces."

## If `switch <name>`

Read `~/.sun/workspaces.json`.
If workspace not found: error.

Read workspace path from registry.
Verify path exists:
```bash
ls [workspace-path] 2>/dev/null
```

If missing: error — "Workspace '<name>' path no longer exists. Run `remove <name>` to clean up the registry."

Show:
```
Workspace '<name>'
Path: [workspace-path]

To work in this workspace, open a new terminal and run:
  cd [workspace-path]

Or copy this path to your clipboard.
```

If inside a shell session: offer to `cd` there if the shell supports it, otherwise display the path prominently.

## If `remove <name>`

Read `~/.sun/workspaces.json`.
If workspace not found: error.

Read workspace entry (type, path, branch).

Show what will be removed:
```
This will remove:
  - Workspace path: [path]
  - Git worktree registration (if applicable)
  - Registry entry in ~/.sun/workspaces.json
  - Planning artifacts at [path]/.planning/

This cannot be undone.
```

Ask: "Remove workspace '<name>'? [yes/no]"

If yes:
1. If type is `worktree`:
   ```bash
   git worktree remove ~/.sun/workspaces/<name> --force
   git branch -d workspace/<name>
   ```
2. If type is `clone`:
   ```bash
   rm -rf ~/.sun/workspaces/<name>
   ```
3. Remove from `~/.sun/workspaces.json`.

Show: "Workspace '<name>' removed."
</process>
