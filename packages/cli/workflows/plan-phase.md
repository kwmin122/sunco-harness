# Plan Phase Workflow

Planning flow for a single phase: reads context, optionally researches implementation, creates 2-3 atomic plans, and verifies them against requirements. Used by `/sunco:plan`.

---

## Overview

Four steps, each building on the last:

1. **Load** — Read CONTEXT.md, REQUIREMENTS.md, ROADMAP.md
2. **Research** — Optional parallel agents investigate implementation approaches
3. **Decompose** — Break phase into 2-3 independent atomic task plans
4. **Verify** — Check plans against requirements (loop up to 3 times)

**Output files:**
- `.planning/phases/[N]-*/[N]-RESEARCH.md` — implementation research (if research step runs)
- `.planning/phases/[N]-*/[N]-01-PLAN.md` through `[N]-03-PLAN.md` — atomic task plans

---

## Step 1: Load Context

Read in this order:

1. `.planning/REQUIREMENTS.md` — full requirement list with IDs and scoping
2. `.planning/ROADMAP.md` — Phase N goal, deliverables, estimated complexity
3. `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions from `/sunco:discuss`
4. `.planning/STATE.md` — current decisions, blockers, active workstream
5. `.planning/phases/[N]-*/` — any existing plans (avoid duplication)

**Guard:** If `[N]-CONTEXT.md` does not exist, warn:
```
Warning: No context found for Phase [N].
Running /sunco:plan without context may produce misaligned plans.
Run /sunco:discuss [N] first, or proceed anyway? [discuss/proceed]
```

---

## Step 2: Research Implementation (skip with --skip-research)

Spawn one research agent with fresh context.

**Research agent prompt:**
```
You are researching the best implementation approach for: [phase goal].

Decisions already made:
[contents of CONTEXT.md decisions section]

Tech stack constraints:
[contents of PROJECT.md constraints section]

Requirements to fulfill:
[list of REQ-IDs and descriptions this phase covers]

For each viable implementation approach:
1. High-level architecture (2-3 sentences)
2. Key files/modules to create or modify
3. Dependencies needed (new packages or existing)
4. Estimated complexity: S (< 2h) / M (2-8h) / L (> 8h)
5. Key risks and unknowns

Recommend the best-fit approach with reasoning tied to the project constraints.
```

Write findings to `[N]-RESEARCH.md`. Include:
- Recommended approach with reasoning
- Alternative(s) considered and why not chosen
- Specific packages/patterns to use
- Files the agent predicts will be touched

---

## Step 3: Decompose into Atomic Plans

Break the phase into 2-3 plans. Each plan must be:

- **Independently completable** — one agent can finish it without coordination
- **Scope-bounded** — touches a defined set of files, not "whatever is needed"
- **Wave-assignable** — either Wave 1 (no dependencies) or Wave 2 (depends on Wave 1)
- **Verifiable** — has acceptance criteria that can be checked programmatically

### Wave Assignment Rules

- **Wave 1**: Plans with no dependencies on other Wave-1 plans in this phase
- **Wave 2**: Plans that require Wave 1 output (imports Wave 1 exports, uses Wave 1 files)

Most phases have Wave 1 only (2-3 parallel plans). Wave 2 is for integration or glue work.

### Plan File Format

Write each plan using the template from `packages/cli/templates/plan.md`.

Key fields:
- `wave`: 1 or 2
- `depends_on`: list of `[N]-[M]` plan IDs, or `[]`
- `files_modified`: explicit list of every file this plan creates or modifies

The `done_when` section always includes:
- Feature-specific completion criteria (verifiable, not vague)
- `/sunco:lint` passes with zero errors
- All acceptance criteria in all tasks met

### Task Decomposition Guidance

Within a plan, tasks should be:
- **Atomic** — one clear unit of work (create X, implement Y, wire Z)
- **Ordered** — each task builds on the previous
- **Verifiable** — acceptance criteria are checkable, not "works correctly"

Aim for 2-4 tasks per plan. Fewer tasks per plan = cleaner git commits.

### Complexity Calibration

| Plan complexity | Tasks | Estimated duration |
|-----------------|-------|--------------------|
| S (small) | 2 tasks | < 30 min agent session |
| M (medium) | 3 tasks | 30 min - 2h agent session |
| L (large) | 4 tasks | 2-4h agent session |

If a plan would exceed L: split it into two plans.

---

## Step 4: Verify Plans (skip with --skip-verify)

Run a verification loop against requirements. Maximum 3 iterations.

For each plan, check all 5 criteria:

**1. Requirements coverage**
Does this plan advance at least one REQ-ID from REQUIREMENTS.md?
- Pass: plan maps to one or more requirements
- Fail: plan is orphaned from all requirements

**2. Scope alignment**
Does the plan match the phase goal stated in ROADMAP.md?
- Pass: plan goal is a subset of the phase goal
- Fail: plan reaches into adjacent phases or unrelated concerns

**3. Completeness**
Are acceptance criteria verifiable?
- Pass: each criterion is checkable (file exists, function exported, test passes, command output matches)
- Fail: criteria are vague ("works correctly", "is implemented", "looks good")

**4. Dependency correctness**
Are wave assignments and `depends_on` fields accurate?
- Pass: Wave 2 plans only depend on Wave 1 plans; no circular deps
- Fail: incorrect dependency chain, missing dependency, or circular reference

**5. Lint gate present**
Does `done_when` include `/sunco:lint` passing?
- Pass: lint gate is in `done_when`
- Fail: lint gate is missing (add it automatically)

### Iteration Behavior

- If all checks pass: proceed to write plan files
- If issues found: revise affected plans and re-run checks
- After 3 iterations with unresolved issues: write plans with WARN flags on failing criteria and surface to user

---

## Step 5: Write Plan Files

Write each plan to `.planning/phases/[N]-[phase-name]/[N]-[M]-PLAN.md`.

Use the template at `packages/cli/templates/plan.md`.

---

## Step 6: Report and Route

Show summary:
```
Phase [N] plans created:
  [N]-01: [title] (Wave 1) — [S/M/L]
  [N]-02: [title] (Wave 1) — [S/M/L]
  [N]-03: [title] (Wave 2) — [S/M/L]  [if applicable]

Wave structure:
  Wave 1: [N]-01, [N]-02 — run in parallel
  Wave 2: [N]-03 — run after Wave 1

Verification: [all passed / N issues — see above]
```

Tell user: "Plans verified. Run `/sunco:execute [N]` to begin parallel execution."

If research was skipped: add "Note: --skip-research was used. Plans based on context only."
