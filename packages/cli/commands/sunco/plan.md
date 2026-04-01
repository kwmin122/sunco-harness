---
name: sunco:plan
description: Convert phase context into 1-3 verified, atomic execution plans. Run after /sunco:discuss. Each plan has YAML frontmatter, XML task structure, and a done_when checklist.
argument-hint: "<phase> [--skip-research] [--skip-verify] [--gaps] [--cross-model]"
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
- `--cross-model` — Enable design pingpong: spawn two models in parallel, merge PLAN.md outputs. WARNING: ~2.4x token cost.
</context>

<objective>
Turn phase context into 1-3 atomic, executable task plans that a fresh agent can follow without asking questions. Each plan is self-contained with what to build, which files to touch, acceptance criteria, and done_when checklist.

Creates `.planning/phases/[N]-[name]/[N]-RESEARCH.md` (unless skipped) and `[N]-01-PLAN.md` through `[N]-03-PLAN.md`.

After completion: run `/sunco:execute [N]` to execute plans in wave order.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/plan-phase.md end-to-end.
</process>

<success_criteria>
- 1-3 `[N]-[M]-PLAN.md` files written with valid YAML frontmatter, `<tasks>`, and `<done_when>` checklist
- Each plan's `done_when` includes the lint/tsc gate command
- Wave assignments correct: Wave 1 plans are independent, Wave 2 plans list dependencies
- All plans verified against REQUIREMENTS.md (or phase goal if no requirements file)
- STATE.md updated: phase status set to `planned`, next_step set to `/sunco:execute [N]`
- Changes committed: `docs(phase-[N]): create execution plans`
- User shown wave structure and instructed to run `/sunco:execute [N]`
</success_criteria>
