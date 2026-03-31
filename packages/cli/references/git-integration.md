# Git Integration

SUNCO's git integration strategies for branching, commits, and isolation. Configured in `.sun/config.toml`. Used by the execute, ship, and quick commands.

---

## Branching Strategies

Three strategies, from simplest to most isolated.

### `none` (simplest)

All work happens on the current branch.

```toml
[git]
strategy = "none"
```

**How it works:**
- Plans execute directly on whatever branch is checked out
- Commits are made to the current branch
- No branch management — what you see is what you get

**Best for:**
- Solo projects with a single active development line
- Phases that are a continuation of existing work in progress
- When you want full control over branching yourself

**Risks:**
- No isolation between phases
- A failed execution pollutes your working branch
- Harder to do selective rollback

---

### `phase` (recommended default)

Creates a dedicated branch per phase.

```toml
[git]
strategy = "phase"
```

**Branch naming:**
```
sunco/phase-{N}-{slug}
```

Where `{slug}` is the phase name from ROADMAP.md, lowercased with hyphens.

Examples:
- `sunco/phase-1-core-foundation`
- `sunco/phase-3-skill-registry`
- `sunco/phase-7-npm-publish`

**How it works:**
1. Before executing Phase N, create `sunco/phase-{N}-{slug}` from current HEAD
2. All execution commits land on this branch
3. After `/sunco:verify N` passes, `/sunco:ship N` merges it back to the base branch
4. Branch is deleted after successful merge

**Best for:**
- Most active projects
- When you want to be able to discard a failed phase cleanly
- When multiple people might review phase work before merging
- Clean PR workflow: one PR per phase

---

### `milestone`

Creates a branch per milestone, covering all phases in that milestone.

```toml
[git]
strategy = "milestone"
```

**Branch naming:**
```
sunco/{milestone}-{slug}
```

Where `{milestone}` is the milestone number/name and `{slug}` is the milestone name.

Examples:
- `sunco/m1-prototype`
- `sunco/m2-alpha`
- `sunco/v1-launch`

**How it works:**
1. On first phase of a milestone, create `sunco/{milestone}-{slug}`
2. All phases in the milestone commit to this single branch
3. At milestone completion, merge once and create a release tag

**Best for:**
- Projects with tightly coupled phases within a milestone
- When you want a single review/PR per milestone (fewer PRs, bigger)
- Release-oriented workflow (tag at milestone boundary)

---

## Worktree Support

SUNCO supports git worktrees for true parallel isolation. Use when running multiple phases simultaneously.

```toml
[git]
strategy = "phase"
use_worktrees = true
```

**How worktrees work:**

```bash
# SUNCO creates a worktree for Phase N
git worktree add .sun/worktrees/phase-[N] sunco/phase-[N]-[slug]

# Execution agents run in the worktree directory
# No conflicts with main working tree
# Worktree removed after phase merge
```

**Best for:**
- Running Phase N execute while Phase N+1 plan is being worked on
- Truly parallel multi-phase execution (workstreams)
- Isolation testing: verify a phase without touching your main tree

**Requirements:**
- Git 2.15+ (worktree add --track support)
- Disk space for the worktree copy
- No uncommitted changes in the base directory when creating the worktree

---

## Commit Message Conventions

SUNCO uses Conventional Commits format.

### Per-task commits (from execution agents)

```
feat([scope]): [description]
```

Where:
- `[scope]` = `[phase]-[task]` for phase work, or package name for quick tasks
- `[description]` = imperative mood, lowercase, no period

Examples:
```
feat(1-01): add defineSkill factory function
feat(1-02): implement skill registry with Map storage
fix(2-01): handle undefined config gracefully
refactor(core): extract validation helpers to shared module
test(3-01): add unit tests for skill scanner
docs(cli): update help text for execute command
chore(deps): update vitest to 4.1.2
```

### Phase summary commits (from SUNCO)

```
chore(phase-[N]): execution complete — [M] plans, [title]
```

Example:
```
chore(phase-1): execution complete — 2 plans, core foundation
```

### Ship commits (merge commits)

```
feat(phase-[N]): [phase title] — [requirements covered]
```

Example:
```
feat(phase-1): core foundation — REQ-001 REQ-002 REQ-003
```

---

## Atomic Commit Strategy

Each task within a plan should produce one atomic commit. An atomic commit:

- Is complete by itself (passes lint and tsc)
- Does not depend on uncommitted work from another task
- Can be understood from its commit message alone
- Can be reverted without breaking other tasks

### Commit timing in execution

After each task in a plan completes:
1. Stage only the files modified by that task
2. Run `npx tsc --noEmit` on staged files (pre-commit check)
3. Commit with the task-scoped message
4. Proceed to next task

Do not batch multiple tasks into one commit. Do not commit at plan end only.

### Why atomic commits matter

- Makes `git bisect` viable when finding regressions
- Allows selective revert of specific tasks
- Makes code review granular (reviewer can review task-by-task)
- Reduces blast radius of a bad commit

---

## Revert Strategy

If execution goes wrong and you need to clean up:

**Revert a single task:**
```bash
git revert [commit-hash]
```

**Revert a full plan:**
```bash
git revert [task-1-hash] [task-2-hash] [task-3-hash]
```

**Abandon a phase branch:**
```bash
git checkout main
git branch -D sunco/phase-[N]-[slug]
```

**Abandon a phase worktree:**
```bash
git worktree remove .sun/worktrees/phase-[N]
git branch -D sunco/phase-[N]-[slug]
```

---

## Configuration Reference

Full git configuration in `.sun/config.toml`:

```toml
[git]
# Branching strategy: none | phase | milestone
strategy = "phase"

# Use git worktrees for isolation (requires git 2.15+)
use_worktrees = false

# Base branch to create phase branches from
base_branch = "main"

# Delete phase branch after successful ship
delete_after_ship = true

# Sign commits (requires GPG/SSH signing configured)
sign_commits = false

# Push phase branch to remote automatically after execute
auto_push = false
```

---

## `.gitignore` Recommendations

Add to your project `.gitignore`:

```
# SUNCO worktrees
.sun/worktrees/

# SUNCO debug sessions (optional — you may want to keep these)
.sun/debug/

# SUNCO health history
.sun/health-history.jsonl
```

Keep in version control:
- `.sun/config.toml` — shared project config
- `.planning/` — all planning artifacts
- `packages/cli/commands/`, `packages/cli/workflows/`, etc. — skill definitions
