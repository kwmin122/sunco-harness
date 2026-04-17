---
name: sunco:review
description: Multi-provider cross-review of a phase. Spawns independent review agents (optionally using different AI providers) to get diverse perspectives on code quality, architecture, and correctness.
argument-hint: "[phase] [--providers claude,gpt] [--focus security|architecture|quality] [--fix]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
---

<context>
**Arguments:**
- `[phase]` — Phase number to review. If omitted, reviews the latest executed phase.

**Flags:**
- `--providers claude,gpt` — Which AI providers to use for review agents. Default: claude only.
- `--focus security|architecture|quality` — Focus the review on a specific dimension. Default: all.
- `--fix` — After the review completes, auto-route each *agreed* issue (≥2 reviewers) through `/sunco:quick`, then re-run `/sunco:verify`. Solo opinions are surfaced but never auto-fixed. Caps at 5 issues per run; override with `--max-fix N`. This is the Superpowers `receiving-code-review` loop implemented as a skill.
- `--max-fix <n>` — Max agreed issues to auto-fix in one run. Default: 5.
</context>

<objective>
Independent multi-agent cross-review of phase implementation. Each agent reviews from a fresh context with no knowledge of other agents' findings. Findings are aggregated into REVIEWS.md.

**Creates:**
- `.planning/phases/[N]-*/[N]-REVIEWS.md` — aggregated review findings from all agents

**After this command:** Address findings, then proceed to `/sunco:ship [N]` or `/sunco:verify [N]`.
</objective>

<process>
## Step 1: Load context

Read:
1. `.planning/phases/[N]-*/*-PLAN.md` — plans with acceptance criteria
2. `.planning/phases/[N]-*/*-SUMMARY.md` — what was built
3. Modified files listed in SUMMARY.md

## Step 2: Determine review scope

If `--focus` is in $ARGUMENTS, use that focus area.
Otherwise review all three dimensions.

## Step 3: Spawn review agents

Spawn 2-3 independent review agents (one per focus area or provider).

**Agent name:** `sunco-reviewer` — description: `Review: [focus]`

**Agent prompt template:**
```
You are a [role] reviewing a code change for a TypeScript CLI project called SUNCO.

Phase: [N] — [phase title]
Goal: [phase goal from ROADMAP.md]

Files to review:
[list of modified files]

Read each file and review for [focus area]:

For SECURITY: injection vectors, path traversal, unvalidated input, secrets in code,
  unsafe regex, prototype pollution, command injection in Bash calls.

For ARCHITECTURE: does it follow the skill-based architecture in CLAUDE.md?
  Correct use of defineSkill()? ESM imports with .js extension? No hardcoded commands?
  Proper use of ctx.agent / ctx.ui / ctx.state patterns?

For QUALITY: TypeScript strict compliance, error handling completeness,
  test coverage for exported functions, naming conventions, dead code.

Format each finding as:
SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW/INFO]
LOCATION: [file:line]
ISSUE: [description]
RECOMMENDATION: [how to fix]

End with overall verdict: APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION
```

## Step 4: Aggregate findings

Collect all findings. Deduplicate identical findings across agents.

Sort by severity: CRITICAL → HIGH → MEDIUM → LOW → INFO.

## Step 5: Write REVIEWS.md

```markdown
# Phase [N] Cross-Review

## Verdict
[APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION]
Reviewers: [N] agents | [date]

## Critical Issues
[list or "None"]

## High Issues
[list or "None"]

## Medium Issues
[list]

## Low / Info
[list]

## Full Findings

### Reviewer 1 ([focus])
[findings]

### Reviewer 2 ([focus])
[findings]
```

## Step 6: Report

Show summary of findings count by severity.
If APPROVE: "No blocking issues. Safe to ship."
If REQUEST_CHANGES: "Fix [N] critical/high issues before shipping."
</process>
