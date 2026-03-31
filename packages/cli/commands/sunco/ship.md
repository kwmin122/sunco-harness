---
name: sunco:ship
description: Create a PR for a completed phase. Runs verify first, generates PR body from execution summaries, and creates the PR via gh.
argument-hint: "<phase> [--draft] [--skip-verify]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.

**Flags:**
- `--draft` — Create as draft PR.
- `--skip-verify` — Skip pre-ship verification check. Use only if verify was just run.
</context>

<objective>
Create a clean PR for a completed phase. Verify first (unless --skip-verify), generate PR body from summaries, and create via `gh pr create`.

**After this command:** Review the PR URL. Merge when approved.
</objective>

<process>
## Step 1: Pre-ship verification (skip if --skip-verify)

Check `.planning/phases/[N]-*/[N]-VERIFICATION.md`:
- If it exists and shows OVERALL PASS: proceed.
- If it doesn't exist or shows NEEDS FIXES: ask user if they want to run `/sunco:verify [N]` first.
- If user says proceed anyway: log warning, continue with visible CAUTION label.

## Step 2: Check git state

```bash
git status --short
git log --oneline main..HEAD
```

Verify:
- Working tree is clean (no uncommitted changes)
- Current branch has commits ahead of main
- No merge conflicts

If working tree is dirty: ask user to commit or stash before shipping.

## Step 3: Gather PR content

Read:
1. `.planning/phases/[N]-*/*-SUMMARY.md` — all execution summaries
2. `.planning/phases/[N]-*/[N]-VERIFICATION.md` — verification results
3. `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions made
4. `.planning/ROADMAP.md` — phase goal

Build PR title: `feat(phase-[N]): [phase title from ROADMAP.md]`

Build PR body from summaries:
```markdown
## Phase [N]: [title]

### Summary
[1-3 bullet points from SUMMARY.md files]

### What was built
[bullet list of deliverables from SUMMARY.md]

### Verification
- [ ] Layer 1 (Multi-agent review): [status]
- [ ] Layer 2 (Guardrails): [status]
- [ ] Layer 3 (BDD criteria): [status]
- [ ] Layer 4 (Permission audit): [status]
- [ ] Layer 5 (Adversarial): [status]

### Test plan
[from acceptance criteria in PLAN.md done_when sections]

### Related
- Phase [N] plans: `.planning/phases/[N]-*/`
- Requirements covered: [list from REQUIREMENTS.md]

🤖 Generated with [SUNCO](https://github.com/sunco/sunco)
```

## Step 4: Create PR

```bash
gh pr create \
  --title "[PR title]" \
  --body "[PR body]" \
  [--draft if --draft flag present]
```

## Step 5: Update STATE.md

```bash
# Read .planning/STATE.md and update:
# - Mark phase [N] as shipped
# - Record PR URL
# - Increment current phase to [N+1]
```

## Step 6: Report

Show PR URL.
Tell user: "PR created. Next: run `/sunco:discuss [N+1]` to start Phase [N+1]."
</process>
