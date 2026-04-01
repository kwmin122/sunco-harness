# New Workspace Workflow

Create an isolated git worktree for parallel or experimental work. Runs `git worktree add`, initializes a `.planning/` directory for the workspace, configures independent state so workspace work doesn't pollute the main branch's planning artifacts, and presents the ready state. Used by `/sunco:workspaces new`.

---

## Overview

Five steps:

1. **Parse arguments** — workspace name, branch, base branch
2. **Create git worktree** — isolated working tree on a new branch
3. **Initialize planning** — copy or scaffold `.planning/` for the workspace
4. **Configure state** — workspace-specific STATE.md and config
5. **Present ready state** — show path, how to switch, how to remove

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First word | `WORKSPACE_NAME` | required |
| `--branch <name>` | `BRANCH_NAME` | `ws/[workspace-name]` |
| `--base <branch>` | `BASE_BRANCH` | current branch |
| `--copy-planning` | `COPY_PLANNING` | false |
| `--empty` | `EMPTY_PLANNING` | false |

If `WORKSPACE_NAME` not provided:

```
Workspace name required.

Usage: /sunco:workspaces new <name> [--branch <branch>] [--base <branch>]

Examples:
  /sunco:workspaces new experiment-v2
  /sunco:workspaces new hotfix-auth --base main
  /sunco:workspaces new feature-ui --branch feature/ui-redesign
```

Validate workspace name:
- Lowercase, hyphens only (no spaces, no special chars)
- Not already in use: `git worktree list 2>/dev/null | grep workspace-name`

Derive paths:

```bash
WORKTREE_PATH="../$(basename $(pwd))-${WORKSPACE_NAME}"
BRANCH_NAME="ws/${WORKSPACE_NAME}"
```

---

## Step 2: Create Git Worktree

Check if worktree path already exists:

```bash
git worktree list 2>/dev/null
ls "${WORKTREE_PATH}" 2>/dev/null
```

If path exists: "Worktree path already exists at [path]. Choose a different name or remove the existing worktree."

Create the worktree:

```bash
# Create new branch from base
git worktree add "${WORKTREE_PATH}" -b "${BRANCH_NAME}" "${BASE_BRANCH}"
```

Verify:

```bash
git worktree list 2>/dev/null | grep "${WORKSPACE_NAME}"
ls "${WORKTREE_PATH}" 2>/dev/null
```

If creation failed, surface the git error verbatim and suggest:
- Check that `BASE_BRANCH` exists
- Check that `BRANCH_NAME` is not already taken
- Ensure you have git 2.5+ (worktree support)

---

## Step 3: Initialize Planning

Decide the planning directory strategy:

**If `--copy-planning`:**

Copy the current `.planning/` into the worktree, excluding phase execution artifacts (keep structure, reset state):

```bash
cp -r .planning/ "${WORKTREE_PATH}/.planning/"

# Reset state to clean for this workspace
cat > "${WORKTREE_PATH}/.planning/STATE.md" << 'EOF'
# State — Workspace: [WORKSPACE_NAME]

## Project Reference
[Copied from main .planning/STATE.md — Core Value line]

## Current Position

Phase: [inherited from main branch]
Status: workspace initialized
Last activity: [today] — Workspace [WORKSPACE_NAME] created from [BASE_BRANCH]

## Workspace Context

This is an isolated workspace. Changes here do not affect the main branch.
Base: [BASE_BRANCH]
Purpose: [describe workspace purpose]
EOF
```

**If `--empty` or no planning in current directory:**

Create minimal planning scaffold:

```bash
mkdir -p "${WORKTREE_PATH}/.planning/phases"
mkdir -p "${WORKTREE_PATH}/.planning/todos/pending"
mkdir -p "${WORKTREE_PATH}/.sun"
```

Create minimal STATE.md:

```bash
cat > "${WORKTREE_PATH}/.planning/STATE.md" << EOF
# State — Workspace: ${WORKSPACE_NAME}

## Project Reference
[TBD — run /sunco:init or /sunco:scan to populate]

## Current Position

Phase: Not started
Status: workspace initialized
Last activity: $(date -u +%Y-%m-%d) — Workspace ${WORKSPACE_NAME} created

## Workspace Context

Base branch: ${BASE_BRANCH}
Purpose: [describe workspace purpose]
EOF
```

**Default (no flags):**

Use `--copy-planning` behavior if `.planning/` exists, `--empty` if not.

---

## Step 4: Configure Workspace State

Write workspace configuration to `.sun/workspace.toml` in the worktree:

```bash
cat > "${WORKTREE_PATH}/.sun/workspace.toml" << EOF
[workspace]
name = "${WORKSPACE_NAME}"
branch = "${BRANCH_NAME}"
base_branch = "${BASE_BRANCH}"
created_at = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
main_worktree = "$(pwd)"
EOF
```

This file lets SUNCO commands know they're operating in a workspace context (e.g., `/sunco:status` can show workspace badge, `/sunco:ship` can remind you to merge back).

Register the workspace in the main worktree's workspace registry:

```bash
mkdir -p .sun/workspaces
cat > ".sun/workspaces/${WORKSPACE_NAME}.toml" << EOF
[workspace]
name = "${WORKSPACE_NAME}"
path = "${WORKTREE_PATH}"
branch = "${BRANCH_NAME}"
base_branch = "${BASE_BRANCH}"
created_at = "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
status = "active"
EOF
```

---

## Step 5: Present Ready State

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► WORKSPACE CREATED  [workspace-name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Workspace:  experiment-v2
Branch:     ws/experiment-v2
Path:       ../myproject-experiment-v2
Base:       main

Planning:   .planning/ initialized (copied from main)

Switch to workspace:
  cd ../myproject-experiment-v2

Then run SUNCO commands normally. All planning artifacts
stay isolated from your main branch.

When done:
  /sunco:workspaces list           see all workspaces
  /sunco:workspaces remove [name]  remove when finished
  git merge ws/experiment-v2       merge work back (when ready)
```

---

## Success Criteria

- [ ] Workspace name validated (no spaces, not duplicate)
- [ ] `git worktree add` succeeded
- [ ] Worktree path is accessible
- [ ] `.planning/` initialized (copied or scaffolded)
- [ ] STATE.md in workspace has workspace-specific context
- [ ] `.sun/workspace.toml` written in worktree
- [ ] Workspace registered in main worktree's `.sun/workspaces/`
- [ ] User shown exact `cd` path and next steps
- [ ] Removal command shown
