---
phase: 11-planning-quality-pipeline
plan: 01
subsystem: skills-workflow
tags: [planning, quality, research, validation, deep-work]
dependency_graph:
  requires: [plan.skill.ts, plan-create.ts, plan-checker.ts]
  provides: [auto-research, coverage-gate, validation-md-gen, deep-work-rules]
  affects: [workflow.plan skill, plan-checker agent, plan-create agent]
tech_stack:
  added: []
  patterns: [auto-research-fallback, requirements-coverage-set, validation-md-extraction, deep-work-rules]
key_files:
  created:
    - packages/skills-workflow/src/__tests__/plan-coverage.test.ts
  modified:
    - packages/skills-workflow/src/plan.skill.ts
    - packages/skills-workflow/src/prompts/plan-create.ts
    - packages/skills-workflow/src/prompts/plan-checker.ts
decisions:
  - Auto-research runs when RESEARCH.md missing (unless --skip-research); explicit --research flag always reruns
  - Requirements coverage gate uses Set-based deduplication with two parsing modes (YAML array + line-by-line)
  - VALIDATION.md only generated when RESEARCH.md contains '## Validation Architecture' section
  - plan-checker dimension count updated from 6 to 7 (deep_work_rules as dimension 7)
metrics:
  duration: 2min
  completed: 2026-03-29
  tasks: 1
  files: 4
---

# Phase 11 Plan 01: Planning Quality Pipeline Summary

**One-liner:** Auto-research integration, requirements coverage gate, VALIDATION.md generation, and deep work rules (read_first + acceptance_criteria) enforced in plan create/checker prompts.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | PQP-01/03/04/05: All 5 PQP requirements | 6f75886 | plan.skill.ts, plan-create.ts, plan-checker.ts, plan-coverage.test.ts |

## Changes Made

### PQP-01: --research and --skip-research flags
- Added two new options to `plan.skill.ts` options array
- Auto-research logic: if RESEARCH.md missing and not `--skip-research`, calls `ctx.run('workflow.research', { phase })` and re-reads the produced RESEARCH.md
- Explicit `--research` flag: runs even when RESEARCH.md already exists

### PQP-03: Requirements coverage gate
- After plan files are written, builds a `Set<string>` of covered requirement IDs
- Two parsing modes: YAML array format `[PQP-01, PQP-02]` and line-by-line YAML `-  PQP-01`
- Uncovered requirements appended to `remainingWarnings` (non-blocking but visible)

### PQP-04: VALIDATION.md generation
- Triggered when `researchMd` contains `## Validation Architecture` section
- Extracts section text from RESEARCH.md and wraps in 6-dimension validation framework
- Written to same phase directory as PLAN.md files

### PQP-05: Deep work rules in prompts
- `plan-create.ts`: added `<read_first>` and `<acceptance_criteria>` to task structure description
- `plan-create.ts`: added rules 7-9 to Critical Rules section
- `plan-checker.ts`: added dimension 7 `deep_work_rules` with missing `read_first` and `acceptance_criteria` as blockers, vague action text as warning
- Updated dimension count from 6 to 7 in all references

## Tests

`plan-coverage.test.ts` — 5 tests covering:
- YAML array format extraction
- Quoted array format extraction
- Missing requirements field (null match)
- Uncovered requirements identification
- Empty requirements list edge case

All 5 tests pass.

## Build Verification

- `npx turbo build --filter=@sunco/skills-workflow` — PASSED
- `npx vitest run plan-coverage` — 5/5 PASSED
- `node packages/cli/dist/cli.js plan --help` — `--research` and `--skip-research` visible

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
