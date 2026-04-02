---
name: sunco:land
description: Land and deploy. Merge PR, wait for CI and deploy, verify production health. Takes over after /sunco:ship creates the PR.
argument-hint: "[#<pr-number>] [<url>]"
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `#<pr-number>` — Optional. Specific PR number. Auto-detects from current branch if omitted.
- `<url>` — Optional. Production URL for post-deploy health check.

**Examples:**
- `/sunco:land` — Auto-detect PR, skip health check
- `/sunco:land #42` — Merge PR #42
- `/sunco:land https://myapp.com` — Merge and verify at URL
- `/sunco:land #42 https://myapp.com` — Specific PR + health check
</context>

<objective>
Merge the PR, wait for CI/deploy, and verify production health. Mostly automated — only stops for pre-merge readiness gate and failure conditions.

**After this command:** Production is verified or issues are reported.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/land.md end-to-end.
</process>

<success_criteria>
- PR found and validated (open, no conflicts)
- CI checks pass (or waited for completion)
- Pre-merge readiness gate presented to user
- PR merged via gh pr merge
- Deploy detected and waited for (if workflow exists)
- Health check performed (if URL provided)
- Deploy report produced with timing data
- Revert offered on failure
</success_criteria>
