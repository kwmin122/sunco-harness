---
name: sunco:verify
description: 7-layer Swiss cheese verification for a completed phase. Run after /sunco:execute. Each layer catches different failure modes.
argument-hint: "<phase> [--layer N] [--skip-adversarial]"
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
- `--layer N` — Run only layer N (1-7). Use when re-running after fixing specific issues.
- `--skip-adversarial` — Skip Layer 5 (adversarial test). Use for non-security-critical phases.
- `--skip-codex` — Skip Layer 6 (cross-model). Use when Codex plugin is not installed.
- `--skip-human-eval` — Skip Layer 7 (human eval). Use only in fully automated/CI contexts.
</context>

<objective>
Run 7-layer Swiss cheese verification to catch defects that individual checks miss. Each layer targets a different failure mode: multi-agent review, guardrails, BDD criteria, permission audit, adversarial test, cross-model verification, and human eval.

Creates/updates `.planning/phases/[N]-*/[N]-VERIFICATION.md` with pass/fail per layer.

After completion: run `/sunco:ship [N]` if all layers pass, or fix issues and re-run.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/verify-phase.md end-to-end.
</process>

<success_criteria>
- All 7 layers run (or explicitly skipped with flags) and results recorded
- Layer 2 (Guardrails): lint zero errors + tsc zero errors + tests pass
- Layer 3 (BDD): every `done_when` criterion in every plan checked with pass/fail evidence
- `[N]-VERIFICATION.md` updated with per-layer summary table and Issues to Fix list
- Overall verdict clearly stated: PASS or NEEDS FIXES
- If PASS: user directed to run `/sunco:ship [N]`
- If NEEDS FIXES: specific issues listed with instructions to fix and re-run
</success_criteria>
