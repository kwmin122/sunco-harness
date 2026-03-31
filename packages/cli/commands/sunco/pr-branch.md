---
name: sunco:pr-branch
description: Create a clean PR branch by filtering out .planning/ commits. Makes PRs reviewable by removing planning noise from the diff.
argument-hint: "[phase] [--name <branch-name>] [--dry-run]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `[phase]` — Phase number to create PR branch for. Default: current phase.

**Flags:**
- `--name <branch-name>` — Custom branch name. Default: `pr/phase-[N]-[slug]`
- `--dry-run` — Show what would be included without creating branch.
</context>

<objective>
Create a clean PR branch containing only code changes — no .planning/ artifact commits. Reviewers see only the code diff, not the planning scaffolding.

**Strategy:** Cherry-pick commits from the feature work that don't touch `.planning/` files, or use a merge strategy that excludes `.planning/` from the diff.
</objective>

<process>
## Step 1: Identify commits for this phase

```bash
# Find commits since the phase started
git log --oneline main..HEAD
```

## Step 2: Classify commits

For each commit, check which files it touches:
```bash
git show --name-only [commit-hash] | grep -v "^.planning/"
```

Classify:
- **Code commits** — touch only `packages/`, `src/`, config files
- **Planning commits** — touch only `.planning/`
- **Mixed commits** — touch both (need splitting or careful handling)

## Step 3: If --dry-run

Show:
```
PR Branch Preview for Phase [N]:

Would include ([N] commits):
  [hash] feat: [message]
  [hash] fix: [message]

Would exclude ([N] planning commits):
  [hash] docs(planning): [message]

Branch name: pr/phase-[N]-[slug]
```

Stop here.

## Step 4: Create clean PR branch

Determine branch name: `pr/phase-[N]-[title-slug]`
Or use `--name` if provided.

Strategy: create branch from main and cherry-pick code commits:

```bash
git checkout main
git checkout -b [branch-name]
```

For each code commit (or mixed commit): cherry-pick it.
For mixed commits: cherry-pick and then `git restore .planning/` to exclude planning changes.

```bash
git cherry-pick [hash]
# if mixed commit:
git restore .planning/
git commit --amend --no-edit
```

## Step 5: Verify the branch

```bash
git diff main...[branch-name] -- .planning/
```

Should be empty (no .planning/ changes in the PR diff).

```bash
git diff main...[branch-name] -- packages/
```

Should show all intended code changes.

## Step 6: Report

Show:
```
PR branch created: [branch-name]
  Code commits: [N]
  Planning commits excluded: [N]
  Files changed: [N]

Ready for PR:
  git push origin [branch-name]
  gh pr create --head [branch-name]

Or use /sunco:ship [N] which handles this automatically.
```
</process>
