---
name: sunco:execute
description: Wave-based parallel execution of phase plans. Spawns sunco-executor agents per plan, runs mandatory lint-gate after each, writes SUMMARY.md per plan. Run after /sunco:plan.
argument-hint: "<phase> [--wave N] [--interactive] [--gaps-only]"
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
- `--wave N` — Execute only Wave N. Use for pacing, quota management, or staged rollout.
- `--interactive` — Execute plans sequentially inline (no subagents). Lower token usage.
- `--gaps-only` — Execute only plans with `gap_closure: true` in frontmatter. Use after `/sunco:verify` creates gap plans.
</context>

<objective>
Execute all plans in a phase using wave-based parallelization. Orchestrator spawns one `sunco-executor` agent per plan, enforces mandatory lint-gate after each plan, writes per-plan SUMMARY.md, atomic commit per plan, then aggregates results.

Creates `[N]-[M]-SUMMARY.md` per plan and `[N]-VERIFICATION.md` for the phase.

After completion: run `/sunco:verify [N]` for 6-layer verification.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/execute-phase.md end-to-end.
</process>

<success_criteria>
- One `[N]-[M]-SUMMARY.md` written per executed plan with tasks, files modified, lint status, and commit hash
- Lint-gate passed after each plan (non-negotiable — no skipping)
- Atomic git commit exists for each completed plan
- `[N]-VERIFICATION.md` written with execution summary and lint gate results
- STATE.md updated: phase status set to `executed`, next_step set to `/sunco:verify [N]`
- Planning artifacts committed: `docs(phase-[N]): execution complete — summaries and verification checklist`
- User informed of next step: `/sunco:verify [N]`
</success_criteria>
