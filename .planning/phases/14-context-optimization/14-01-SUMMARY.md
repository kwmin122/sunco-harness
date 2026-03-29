---
phase: 14-context-optimization
plan: "01"
subsystem: verify + lint + health
tags: [output-discipline, acceptance-criteria, garbage-collection, quality-gate]
dependency_graph:
  requires: []
  provides: [verify-output-discipline, acceptance-criteria-auto-link, health-deep-entropy]
  affects: [skills-workflow, skills-harness]
tech_stack:
  added: []
  patterns: [fail-loudly-succeed-silently, spec-first-verification, openai-garbage-collection]
key_files:
  created:
    - packages/skills-workflow/src/prompts/health-deep.ts
  modified:
    - packages/skills-workflow/src/verify.skill.ts
    - packages/skills-workflow/src/shared/verify-layers.ts
    - packages/skills-harness/src/lint.skill.ts
    - packages/skills-harness/src/health.skill.ts
decisions:
  - "health --deep uses inline prompt building in skills-harness to avoid cross-package dependency; canonical buildHealthDeepPrompt lives in skills-workflow"
  - "acceptance_criteria extraction from raw PLAN.md text via regex — no changes to ParsedPlan type needed"
  - "GREPPABLE and EXPORTABLE patterns only; non-greppable criteria skip deterministic check silently"
metrics:
  duration: "~15 min"
  completed: "2026-03-29"
  tasks_completed: 3
  files_changed: 5
---

# Phase 14 Plan 01: Quality Gap Closure Summary

Close three quality gaps from the code audit: output discipline, plan→verify acceptance_criteria auto-link, and garbage collection agent in health skill.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | fail loudly succeed silently — verify + lint output discipline | 1dca5fc | verify.skill.ts, lint.skill.ts |
| 2 | acceptance_criteria auto-link in Layer 3 | 27ded98 | verify-layers.ts |
| 3 | garbage collection — health --deep | 3af02f2 | health-deep.ts (new), health.skill.ts |

## What Was Built

### Task 1: Output Discipline

**verify.skill.ts** — Verdict-aware details array replaces the hardcoded 4-line summary:
- PASS: single line — `N findings across 5 layers — all within quality gate`
- WARN: brief summary + top-10 findings with `[severity] source: description`
- FAIL: full report with `[SEVERITY.UPPER] Layer N (source)` + file + `Fix: suggestion`

**lint.skill.ts** — 0-violations path now outputs `['All architecture boundaries respected']` instead of an empty terminal table.

### Task 2: Acceptance Criteria Auto-Link

**verify-layers.ts Layer 3** extended with acceptance_criteria parsing:
- `extractAcceptanceCriteria()` pulls `<acceptance_criteria>` XML blocks from raw PLAN.md text
- `checkAcceptanceCriteria()` runs deterministic checks per criterion:
  - `GREPPABLE` pattern: `file contains string` → `readFile + includes()`
  - `EXPORTABLE` pattern: `file exports symbol` → `readFile + regex for export.*symbol`
  - Non-greppable: silently skipped (agent-handled)
- Failed checks produce `VerifyFinding` with `source: 'acceptance'`, `severity: 'high'`
- Runs before existing done-criteria file-existence checks

### Task 3: Garbage Collection

**health-deep.ts** (new) — `buildHealthDeepPrompt()` exported from `skills-workflow/src/prompts/`. Takes README, CLAUDE.md, git log, source file list, existing health report. Instructs agent to find doc-code mismatches, dead imports, stale TODOs, convention drift, and dead code. Output format: JSON array of `{ type, file, description, suggestion, severity }`.

**health.skill.ts** — `--deep` flag added. After deterministic health checks, calls `runDeepAnalysis()` which:
1. Collects README.md, CLAUDE.md, last 50 git log entries, source file list
2. Builds inline prompt (mirrors health-deep.ts, avoids cross-package import)
3. Dispatches to `ctx.agent` via defensive cast (gracefully handles deterministic skill context)
4. Parses JSON findings and outputs formatted deep analysis report

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cross-package import removed from health.skill.ts**
- **Found during:** Task 3
- **Issue:** Initial implementation imported `buildHealthDeepPrompt` from `@sunco/skills-workflow/prompts/health-deep.js` which would create a circular/invalid cross-package dependency (skills-harness does not and should not depend on skills-workflow)
- **Fix:** Inline the equivalent prompt building function `buildDeepPromptInline()` in health.skill.ts; the canonical `buildHealthDeepPrompt` remains in skills-workflow per plan spec
- **Files modified:** packages/skills-harness/src/health.skill.ts
- **Commit:** 3af02f2

## Known Stubs

None — all three features are wired end-to-end. The `--deep` agent path is gracefully guarded for the deterministic context (warns if no agent provider configured, does not stub the output).

## Verification

- `npx turbo build`: 5 tasks successful
- `npx vitest run`: 82 test files, 839 tests — all pass
- Acceptance criteria verified:
  - verify.skill.ts contains `verdict === 'PASS'` conditional
  - verify.skill.ts PASS branch has 1 detail line
  - verify.skill.ts FAIL branch includes `f.suggestion` and `f.severity.toUpperCase()`
  - lint.skill.ts 0-violations path: `['All architecture boundaries respected']`
  - verify-layers.ts Layer 3 contains `acceptanceCriteria` parsing (via `extractAcceptanceCriteria`)
  - verify-layers.ts contains `GREPPABLE` regex for `contains` pattern matching
  - verify-layers.ts creates VerifyFinding with source `'acceptance'` on failure
  - health-deep.ts exports `buildHealthDeepPrompt`
  - health.skill.ts contains `--deep` option
  - Prompt includes "dead imports", "stale TODO", "doc-code mismatch" detection

## Self-Check: PASSED

- packages/skills-workflow/src/prompts/health-deep.ts: FOUND
- packages/skills-workflow/src/verify.skill.ts: FOUND (modified)
- packages/skills-workflow/src/shared/verify-layers.ts: FOUND (modified)
- packages/skills-harness/src/lint.skill.ts: FOUND (modified)
- packages/skills-harness/src/health.skill.ts: FOUND (modified)
- Commits: 1dca5fc, 27ded98, 3af02f2 — all present in git log
