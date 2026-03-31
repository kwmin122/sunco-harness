---
name: sunco:plan
description: Create atomic execution plans for a phase. Run after /sunco:discuss to turn context into verified, executable task plans.
argument-hint: "<phase> [--skip-research] [--skip-verify]"
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
- `<phase>` — Phase number. Required.

**Flags:**
- `--skip-research` — Skip implementation research. Use when you already know the approach.
- `--skip-verify` — Skip plan verification loop. Use when iterating quickly.
</context>

<objective>
Create 2-3 atomic, executable task plans for a phase. Each plan passes a verification loop against REQUIREMENTS.md before being finalized.

**Creates:**
- `.planning/phases/[N]-*/[N]-RESEARCH.md` — implementation research notes (unless --skip-research)
- `.planning/phases/[N]-*/[N]-01-PLAN.md` — first atomic plan
- `.planning/phases/[N]-*/[N]-02-PLAN.md` — second atomic plan (if applicable)
- `.planning/phases/[N]-*/[N]-03-PLAN.md` — third atomic plan (if applicable)

**After this command:** Run `/sunco:execute [N]` to execute plans in parallel waves.
</objective>

<process>
## Step 1: Load context

Read in order:
1. `.planning/REQUIREMENTS.md`
2. `.planning/ROADMAP.md` — find Phase N goal and deliverables
3. `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions from /sunco:discuss
4. `.planning/STATE.md` — current decisions and blockers
5. Scan `.planning/phases/[N]-*/` for any existing plans (avoid duplication)

If `[N]-CONTEXT.md` does not exist: warn and ask if user wants to run `/sunco:discuss [N]` first.

## Step 2: Research implementation (skip if --skip-research)

Spawn a research agent to investigate implementation approaches:

**Agent name:** `sunco-planner` — description: `Plan Phase [N]`

**Research agent prompt:**
"Research the best implementation approach for: [phase goal].
Context: [decisions from CONTEXT.md]
Constraints: [tech stack from PROJECT.md]

For each approach identified:
1. High-level architecture
2. Key files/modules to create
3. Dependencies needed
4. Estimated complexity (S/M/L)
5. Risks

Recommend the best approach."

Write findings to `[N]-RESEARCH.md`.

## Step 3: Decompose into atomic plans

Break the phase into 2-3 independent atomic plans. Each plan should:
- Be completable in one focused agent session
- Have clear input/output boundaries
- Not require coordination with other in-progress plans

**Plan structure:**
```markdown
---
phase: [N]
plan: [M]
title: [descriptive title]
wave: [1 or 2 — parallel wave assignment]
depends_on: [list of plan IDs this depends on, or []]
files_modified:
  - [file path]
---

<objective>
[What this plan achieves in 2-3 sentences]
</objective>

<tasks>
<task id="[N]-[M]-01">
  <name>[Task name]</name>
  <description>[What to do]</description>
  <files>
    - [file to create/modify]
  </files>
  <acceptance_criteria>
    - [Verifiable criterion 1]
    - [Verifiable criterion 2]
  </acceptance_criteria>
</task>

<task id="[N]-[M]-02">
  ...
</task>
</tasks>

<done_when>
- [ ] [Top-level completion criterion 1]
- [ ] [Top-level completion criterion 2]
- [ ] All tasks pass acceptance criteria
- [ ] /sunco:lint passes with zero errors
</done_when>
```

## Step 4: Verify plans against requirements (skip if --skip-verify)

Run verification loop (max 3 iterations):

For each plan, check:
1. **Requirements coverage** — Does this plan advance at least one requirement from REQUIREMENTS.md?
2. **Scope alignment** — Does it match the phase goal in ROADMAP.md?
3. **Completeness** — Are acceptance criteria verifiable (not vague)?
4. **Dependency correctness** — Are wave assignments and depends_on accurate?
5. **Lint gate** — Does the plan include `/sunco:lint` in done_when?

If issues found: revise the plan and re-check. Max 3 iterations.

## Step 5: Write plan files

Write each plan to `.planning/phases/[N]-[phase-name]/[N]-[M]-PLAN.md`.

## Step 6: Report and route

Show summary:
```
Phase [N] plans created:
  Plan 1: [title] (Wave [W])
  Plan 2: [title] (Wave [W])
  Plan 3: [title] (Wave [W]) [if applicable]

Wave structure:
  Wave 1: Plans [list] — can run in parallel
  Wave 2: Plans [list] — run after Wave 1
```

Tell user: "Plans verified. Run `/sunco:execute [N]` to begin parallel execution."
</process>
