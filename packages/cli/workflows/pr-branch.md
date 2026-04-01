# PR Branch Workflow

Create a clean PR branch that excludes `.planning/` commits. Cherry-picks all non-planning commits from the current branch onto a fresh branch based off `main`, producing a branch suitable for a public pull request without internal planning artifacts. Used by `/sunco:pr-branch`.

---

## Overview

Five steps:

1. **Analyze commits** — identify which commits on the current branch are code commits vs. planning commits
2. **Create clean branch** — branch off `main` (or specified base)
3. **Cherry-pick code commits** — replay only non-`.planning/` commits
4. **Verify** — confirm the branch contains the right commits and no `.planning/` files
5. **Report** — show the branch and suggest next step

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--base <branch>` | `BASE_BRANCH` | `main` |
| `--branch-name <name>` | `BRANCH_NAME_OVERRIDE` | auto-generated |
| `--dry-run` | `DRY_RUN` | false |
| `--push` | `AUTO_PUSH` | false |

Determine the current branch:
```bash
CURRENT_BRANCH=$(git branch --show-current)
```

If on `main` or `master`:
```
You are on {CURRENT_BRANCH}. PR branches are created from feature branches.
Checkout the phase branch first: git checkout phase/{N}-{slug}
```

Stop.

---

## Step 2: Identify Commits to Cherry-Pick

Find the divergence point between the current branch and the base branch:
```bash
MERGE_BASE=$(git merge-base "${CURRENT_BRANCH}" "${BASE_BRANCH}")
```

List all commits on the current branch since divergence, oldest-first:
```bash
COMMITS=$(git log --oneline --reverse "${MERGE_BASE}..HEAD")
```

If no commits found: "No commits found on this branch beyond ${BASE_BRANCH}. Nothing to cherry-pick."

### Classify each commit

For each commit SHA, check which files it modified:
```bash
git diff-tree --no-commit-id -r --name-only "${SHA}"
```

**Classification rules:**

| Condition | Classification |
|-----------|---------------|
| All modified files are under `.planning/` | `planning-only` — skip |
| All modified files are under `.sun/` | `state-only` — skip |
| Modified files include both code and `.planning/` | `mixed` — include (cherry-pick will take the code files; `.planning/` additions will not appear in the target branch) |
| No `.planning/` or `.sun/` files | `code` — include |

For `mixed` commits: note them. Cherry-picking a mixed commit will include the code file changes AND the `.planning/` file changes. These need handling (see Step 4).

**Summarize what will be cherry-picked:**

```
Commits to cherry-pick ({N} code commits, {M} planning-only skipped):

  CODE
  a1b2c3d  feat(core): add defineSkill runtime
  e4f5g6h  feat(core): add SkillRegistry
  i7j8k9l  fix(cli): resolve commander option conflict

  PLANNING-ONLY (will be skipped)
  m1n2o3p  docs(planning): add phase 03 CONTEXT.md
  q4r5s6t  docs(planning): write phase 03 plans

  MIXED (will be included, .planning/ files will be excluded from cherry-pick)
  u7v8w9x  feat(core): add health check + update STATE.md
```

If `--dry-run`: stop here and print this analysis without creating a branch.

---

## Step 3: Create Clean Branch

Generate the branch name if not overridden:
```bash
# Derive from current branch
# phase/03-skill-system → pr/03-skill-system
# fix/login-validation → pr/fix/login-validation
DERIVED_NAME=$(echo "$CURRENT_BRANCH" | sed 's|^phase/|pr/|' | sed 's|^milestone/|pr/milestone/|')
CLEAN_BRANCH="${BRANCH_NAME_OVERRIDE:-$DERIVED_NAME}"
```

Create the branch from the base:
```bash
git checkout "${BASE_BRANCH}"
git pull origin "${BASE_BRANCH}" 2>/dev/null || true  # fetch latest if remote available
git checkout -b "${CLEAN_BRANCH}"
```

If the branch already exists:
```
Branch {CLEAN_BRANCH} already exists.
Options:
  overwrite — delete and recreate (git branch -D + checkout -b)
  abort     — stop here
```

---

## Step 4: Cherry-Pick Code Commits

Cherry-pick each `code` commit in order (oldest first):

```bash
for SHA in $CODE_COMMITS; do
  git cherry-pick "${SHA}" 2>&1
done
```

### Handling mixed commits

For `mixed` commits (code + .planning/ files), cherry-pick then immediately unstage and remove `.planning/` additions:

```bash
git cherry-pick "${SHA}" --no-commit
# Remove .planning/ additions that came in
git restore --staged .planning/ 2>/dev/null || true
git checkout -- .planning/ 2>/dev/null || true
# Also handle .sun/ state files
git restore --staged .sun/ 2>/dev/null || true
git checkout -- .sun/ 2>/dev/null || true
# Commit only the code portion
git commit -m "$(git log -1 --format='%s' ${SHA}) [planning artifacts excluded]"
```

### Handling conflicts

If `git cherry-pick` fails with a conflict:

```
Cherry-pick conflict on commit {SHA}: {message}

Conflicting files:
  {list}

Options:
  resolve — fix conflicts manually, then run: git cherry-pick --continue
  skip    — skip this commit (work will be missing from PR branch)
  abort   — abandon the pr-branch creation
```

If user resolves: continue after `git cherry-pick --continue`.
If user skips: `git cherry-pick --skip` and note the skipped commit in the final report.
If user aborts: `git cherry-pick --abort && git checkout "${CURRENT_BRANCH}" && git branch -D "${CLEAN_BRANCH}"`.

---

## Step 5: Verify the Clean Branch

After all cherry-picks, verify there are no `.planning/` or `.sun/` files committed:

```bash
PLANNING_IN_BRANCH=$(git log --name-only --diff-filter=A "${BASE_BRANCH}..HEAD" \
  | grep "\.planning/\|^\.sun/" | head -10)
```

If planning files are found:
```
Warning: .planning/ or .sun/ files detected in the PR branch.

  {list of files}

These were likely added in mixed commits. Remove them:
  git log --oneline --name-only {BASE_BRANCH}..HEAD | grep '.planning'
```

Ask "Remove these files from the branch before continuing? [y/n]"

If `y`: for each offending commit, `git rebase -i` to drop the file. (Guide the user step by step if needed.)

### Verify commit count is reasonable

Compare:
```bash
CODE_COUNT=$(echo "$CODE_COMMITS" | wc -l | tr -d ' ')
BRANCH_COUNT=$(git log --oneline "${BASE_BRANCH}..HEAD" | wc -l | tr -d ' ')
```

If counts differ significantly: warn with the difference but do not block.

---

## Step 6: Push (if --push)

If `--push`:
```bash
REMOTE=$(git remote | head -1)
git push -u "${REMOTE}" "${CLEAN_BRANCH}" 2>&1
```

If push fails: print manual push instructions.

---

## Step 7: Report

```
PR branch created.

  Source:         {CURRENT_BRANCH}
  PR branch:      {CLEAN_BRANCH}
  Base:           {BASE_BRANCH}
  Commits:        {N} code commits cherry-picked
  Skipped:        {M} planning-only commits excluded
  Planning files: none in PR branch

{If skipped commits: "Skipped commits: {list of SHAs + messages}"}
{If conflicts skipped: "Warning: {N} commit(s) were skipped due to unresolved conflicts."}

Next:
  git push -u origin {CLEAN_BRANCH}
  /sunco:ship {PHASE_ARG}   — to create the PR from this branch
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Run from `main` / `master` | Block — must be on a feature branch |
| No commits beyond base | "Nothing to cherry-pick." |
| Cherry-pick conflict | Offer resolve/skip/abort |
| `.planning/` files in clean branch | Warn, offer to fix |
| Clean branch already exists | Ask overwrite/abort |
| Push fails | Print manual instructions |
