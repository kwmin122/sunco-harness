# Remove Workspace Workflow

Remove a git worktree cleanly. Verifies there are no uncommitted changes worth keeping, runs `git worktree remove`, prunes stale refs, and optionally deletes the associated branch. Used by `/sunco:workspaces remove`.

---

## Overview

Four steps:

1. **Identify the worktree** — resolve the target from branch name or path
2. **Safety checks** — check for uncommitted work and unpushed commits
3. **Remove** — run `git worktree remove` and prune
4. **Clean up branch** — optionally delete the local branch

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional token (branch or path) | `WORKSPACE_ARG` | — (required) |
| `--delete-branch` | `DELETE_BRANCH` | false |
| `--force` | `FORCE` | false |

If `WORKSPACE_ARG` is absent:
```
Usage: /sunco:workspaces remove <branch-or-path>
Example: /sunco:workspaces remove phase/03-skill-system

Run /sunco:workspaces list to see active workspaces.
```

---

## Step 2: Identify the Worktree

Get the full worktree list:
```bash
WORKTREE_LIST=$(git worktree list --porcelain)
```

Try to match `WORKSPACE_ARG` against:
1. Exact branch name (`phase/03-skill-system`)
2. Short branch name (`03-skill-system`)
3. Absolute path (`/Users/you/project-workspaces/03-skill-system`)
4. Path basename (`03-skill-system`)

Extract matching entry's:
- `WORKTREE_PATH` — absolute path
- `BRANCH` — full branch name
- `HEAD_SHA` — commit SHA

If no match found:
```
Workspace "{WORKSPACE_ARG}" not found.

Active workspaces:
  {list branch names from git worktree list}

Run /sunco:workspaces list for details.
```

### Refuse to remove the main worktree

The main worktree is the first entry in `git worktree list`. If the matched path is the main worktree:
```
Cannot remove the main worktree.
To remove a linked worktree, specify its branch or path.
```

---

## Step 3: Safety Checks

### Uncommitted changes

```bash
DIRTY=$(git -C "${WORKTREE_PATH}" status --porcelain 2>/dev/null)
```

If dirty and `--force` is NOT set:
```
Workspace has uncommitted changes:

{first 20 lines of git status --short}

{If more than 20 files: "...and N more files"}

Options:
  --force        Remove anyway and discard changes
  Stash manually: cd {WORKTREE_PATH} && git stash
```

Stop.

If dirty and `--force` IS set: proceed with a visible warning:
```
Warning: Discarding uncommitted changes in {BRANCH}.
```

### Unpushed commits

```bash
UNPUSHED=$(git -C "${WORKTREE_PATH}" log @{u}..HEAD --oneline 2>/dev/null)
```

If unpushed commits exist and `--force` is NOT set:
```
Workspace has {N} unpushed commit(s):

  {commit list}

Push first:
  git -C "{WORKTREE_PATH}" push

Or remove anyway:
  /sunco:workspaces remove {WORKSPACE_ARG} --force
```

Stop.

If upstream tracking branch does not exist (no `@{u}`): skip this check.

---

## Step 4: Confirm and Remove

Show what will happen:
```
Removing workspace: {BRANCH}

  Path:        {WORKTREE_PATH}
  Branch:      {BRANCH}
  Last commit: {HEAD_SHA} — {last commit message}
  Delete branch: {yes | no}

Proceed? [y/n]
```

If `n`: stop.

### Remove the worktree

```bash
git worktree remove "${WORKTREE_PATH}" ${FORCE:+--force} 2>&1
```

If the command fails and `--force` is not set: retry with `--force` only if user confirms:
```
git worktree remove failed. Retry with --force? [y/n]
```

### Prune stale worktree references

```bash
git worktree prune 2>&1
```

---

## Step 5: Clean Up Branch

If `--delete-branch` is set:

Check if the branch is fully merged into the current branch or `main`:
```bash
MERGED=$(git branch --merged main 2>/dev/null | grep "${BRANCH}" | head -1)
```

If merged: delete safely:
```bash
git branch -d "${BRANCH}"
echo "  Branch deleted: ${BRANCH}"
```

If not merged:
```
Branch {BRANCH} is not merged into main.
Delete anyway? [y/n]
```

If `y`:
```bash
git branch -D "${BRANCH}"
echo "  Branch force-deleted: ${BRANCH} (was not merged)"
```

If `n`: keep the branch. "Branch kept. You can delete it manually: `git branch -d {BRANCH}`"

---

## Step 6: Report

```
Workspace removed.

  Branch:  {BRANCH}
  Path:    {WORKTREE_PATH} (removed)
  Branch:  {deleted | kept}

Active workspaces:
  Run /sunco:workspaces list to see remaining workspaces.
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Main worktree specified | Block with explanation |
| Uncommitted changes without --force | Show changes, suggest stash or --force |
| Unpushed commits without --force | Show commits, suggest push or --force |
| `git worktree remove` fails | Offer retry with --force |
| Branch deletion fails | Log warning, continue |
