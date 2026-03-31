---
name: sunco:plan
description: Convert phase context into 1-3 verified, atomic execution plans. Run after /sunco:discuss. Each plan has YAML frontmatter, XML task structure, and a done_when checklist.
argument-hint: "<phase> [--skip-research] [--skip-verify] [--gaps]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.

**Flags:**
- `--skip-research` — Skip implementation research. Use when you already know the approach or are iterating quickly.
- `--skip-verify` — Skip plan verification loop. Use when iterating after a previous verify found gaps.
- `--gaps` — Gap closure mode. Read `[N]-VERIFICATION.md`, create gap-closure plans only. Skips research.
</context>

<objective>
Turn phase context into 1-3 atomic, executable task plans that a fresh agent can follow without asking questions. Each plan is self-contained: it specifies what to build, which files to touch, what the acceptance criteria are, and when it's done.

**Orchestrator role:** Load context → research approach (unless skipped) → decompose into plans → verify each plan against requirements → write plan files → update STATE.md → commit.

**Creates:**
- `.planning/phases/[N]-[name]/[N]-RESEARCH.md` — implementation approach notes (unless --skip-research or --gaps)
- `.planning/phases/[N]-[name]/[N]-01-PLAN.md` — first atomic plan
- `.planning/phases/[N]-[name]/[N]-02-PLAN.md` — second atomic plan (if needed)
- `.planning/phases/[N]-[name]/[N]-03-PLAN.md` — third atomic plan (if needed)

**After this command:** Run `/sunco:execute [N]` to execute plans in wave order.
</objective>

<process>

## Step 1: Parse arguments and initialize

Extract phase number from $ARGUMENTS (first positional token).

If no phase number: output "Phase number required. Usage: /sunco:plan <phase>" and stop.

Parse flags:
- `--skip-research` active if literal token appears in $ARGUMENTS
- `--skip-verify` active if literal token appears in $ARGUMENTS
- `--gaps` active if literal token appears in $ARGUMENTS

**Load context in order:**

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}[-_]* 2>/dev/null | head -1)
```

1. `.planning/ROADMAP.md` — Phase N goal, deliverables, milestone
2. `.planning/REQUIREMENTS.md` (if exists) — requirement IDs this phase must address
3. `${PHASE_DIR}/${PHASE}-CONTEXT.md` — decisions from /sunco:discuss
4. `.planning/STATE.md` — current status, blockers
5. `${PHASE_DIR}/*-PLAN.md` files (if any exist) — to avoid duplicating completed work

**If CONTEXT.md does not exist (and --gaps not active):**

Use AskUserQuestion:
- header: "Missing context"
- question: "Phase [N] has no CONTEXT.md. Run /sunco:discuss [N] first to capture decisions, or continue without it?"
- options:
  - "Run /sunco:discuss [N] first" — recommended
  - "Continue without context" — plans may miss user preferences

If "Run /sunco:discuss [N] first": output "Run `/sunco:discuss [N]` first, then come back." and exit.

**If --gaps is active:**

Read `${PHASE_DIR}/${PHASE}-VERIFICATION.md`. If it doesn't exist: output "No VERIFICATION.md found for Phase [N]. Run /sunco:verify [N] first." and exit.

Extract the gaps section — list of unmet criteria. These become the scope of gap-closure plans. Skip to Step 3 (no research needed for gap closure).

## Step 2: Research implementation approach (skip if --skip-research or --gaps)

Spawn a research agent to investigate implementation approaches.

**Agent name:** `sunco-planner` — description: `Research Phase [N]: [phase name]`

**Research agent prompt:**
```
Research implementation approaches for Phase [N]: [phase goal].

Context from discussion:
[Decisions from CONTEXT.md — paste the Decisions Made table]

Requirements to address:
[Requirement IDs from REQUIREMENTS.md for this phase]

Tech stack constraints:
[Relevant items from CLAUDE.md — TypeScript, Node.js, the specific libs]

For each viable approach, evaluate:
1. High-level architecture — what components, how they connect
2. Key files/modules to create or modify
3. External dependencies needed (check if already in package.json first)
4. Estimated complexity: S (< 1hr), M (1-3hr), L (> 3hr)
5. Risks — what could go wrong

Recommend the best approach. Explain why over alternatives.
```

Write findings to `${PHASE_DIR}/${PHASE}-RESEARCH.md`.

Read RESEARCH.md before proceeding to Step 3.

## Step 3: Decompose into atomic plans

Break the phase work into 1-3 atomic plans. Rules:
- Each plan should be completable in one focused agent session (target M or smaller)
- Plans should have minimal coupling — each plan's output is a clean unit
- Assign to waves based on dependencies: Wave 1 plans can run in parallel, Wave 2 plans depend on Wave 1 output
- For gap-closure mode: one plan per gap cluster (group related gaps)

**Plan structure — write EXACTLY this format:**

```markdown
---
phase: [N]
plan: [M]
title: [descriptive title — what this builds]
wave: [1 or 2]
depends_on: []
gap_closure: false
files_modified:
  - [path/to/file.ts]
  - [path/to/file.ts]
---

<objective>
[2-3 sentences: what this plan achieves, why it matters for the phase goal, what it enables for dependent plans]
</objective>

<tasks>
<task type="auto">
  <name>[Task name]</name>
  <files>
    - [file to create or modify]
  </files>
  <action>
    [Detailed instructions for what to do. Be specific enough that a fresh agent can follow without asking questions.
    Include: what to create/modify, what the logic should do, what imports to add, what interfaces to implement.
    Reference exact function names, type signatures, or interface contracts where relevant.]
  </action>
  <acceptance_criteria>
    - [Verifiable criterion — can be checked by reading the code or running a command]
    - [Verifiable criterion]
  </acceptance_criteria>
</task>

<task type="auto">
  <name>[Task name]</name>
  <files>
    - [file]
  </files>
  <action>
    [Detailed instructions]
  </action>
  <acceptance_criteria>
    - [Criterion]
  </acceptance_criteria>
</task>
</tasks>

<done_when>
- [ ] [Top-level completion criterion 1 — observable, binary]
- [ ] [Top-level completion criterion 2]
- [ ] All task acceptance criteria verified
- [ ] `npx eslint . --max-warnings 0 2>/dev/null || npx tsc --noEmit 2>/dev/null` passes
</done_when>
```

**Wave assignment rules:**
- `wave: 1` — no dependencies on other plans in this phase
- `wave: 2` — depends on output from one or more Wave 1 plans (set `depends_on: [1]` etc.)
- Never create more than 2 waves unless the phase is explicitly sequential by nature

**For gap-closure plans:** Set `gap_closure: true` in frontmatter. The `<objective>` must reference the specific verification criteria that were not met.

## Step 4: Verify plans against requirements (skip if --skip-verify)

Run verification loop (max 3 iterations). For each plan, check:

1. **Requirements coverage** — Does this plan address at least one requirement ID from REQUIREMENTS.md? If REQUIREMENTS.md doesn't exist, does it advance the phase goal?
2. **Scope alignment** — Does each plan stay within the phase goal? No scope creep.
3. **Completeness** — Are acceptance criteria binary and verifiable (not vague like "works correctly" or "is good")?
4. **Dependency correctness** — If wave: 2, is there a legitimate output from wave: 1 that this plan needs?
5. **File list accuracy** — Are the files_modified realistic for the task described? No missing files, no files from other phases.
6. **Lint gate present** — Does done_when include the lint/tsc check command?

If issues found: revise the plan and re-check. After 3 iterations, write the best version and note any remaining issues.

## Step 5: Write plan files

Write each plan to:
```
.planning/phases/[N]-[phase-name]/[N]-[M]-PLAN.md
```

Use zero-padded plan numbers: `01`, `02`, `03`.

## Step 6: Update STATE.md

```bash
node $HOME/.claude/sunco/bin/sunco-tools.cjs state-update \
  --phase ${PHASE} \
  --status "planned" \
  --next "/sunco:execute ${PHASE}" \
  2>/dev/null || true
```

If the command fails, update STATE.md directly:
- Set phase status to `planned`
- Set `next_step` to `/sunco:execute [N]`
- Update `updated:` to today's date

## Step 7: Commit plan files

```bash
git add .planning/phases/${PHASE}-*/
git commit -m "docs(phase-${PHASE}): create execution plans"
```

## Step 8: Report and route

Show summary:
```
Phase [N] plans created:

  Plan [N]-01: [title] (Wave 1)
  Plan [N]-02: [title] (Wave 1)  [if applicable]
  Plan [N]-03: [title] (Wave 2)  [if applicable]

Wave structure:
  Wave 1: Plans [list] — run in parallel
  Wave 2: Plans [list] — run after Wave 1 completes

[N] plan(s) ready.

Run /sunco:execute [N] to begin execution.
```

</process>
