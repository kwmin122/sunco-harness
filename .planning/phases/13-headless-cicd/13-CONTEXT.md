# Phase 13: Headless + CI/CD - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

## Phase Boundary

Add headless CLI mode for CI/CD pipelines, instant JSON state query, structured exit codes, and self-contained HTML report generation. This enables team adoption (CI runs sunco verify/auto) and automation (cron-based sunco next).

## Current State

### What exists:
- CLI entry: `packages/cli/src/cli.ts` — Commander.js with 39+ registered skills
- All skills use `ctx.ui` for output (entry, progress, result) — works in TTY
- `SilentUiAdapter` exists in core — suppresses all UI output
- `InkUiAdapter` exists — full Ink rendering for TTY
- `sunco status` / `sunco stats` — read state and display
- `auto.skill.ts` — full pipeline with crash recovery, stuck detection, budget

### What's missing:
- No way to run without TTY (CI environments have no interactive terminal)
- No JSON output mode for machine consumption
- No structured exit codes (always 0 or unhandled crash)
- No HTML report generation
- No `--timeout` flag for CI budget protection

## Implementation Decisions

### HLS-01: sunco headless

**New CLI entry mode, not a new skill:**
- `sunco headless <command> [args]` — runs any existing skill with SilentUiAdapter + JSON stdout
- Implementation: add `headless` subcommand to cli.ts that:
  1. Forces `SilentUiAdapter` (no Ink, no TTY)
  2. Captures SkillResult from skill execution
  3. Prints JSON to stdout: `{ success, summary, data, warnings, exitCode }`
  4. Sets process.exitCode based on result
- All existing skills work unchanged — headless is a transport layer, not a skill change

### HLS-02: sunco headless query

**Instant state snapshot without LLM:**
- Read STATE.md + ROADMAP.md + last verification + cost data
- Return JSON object: `{ phase, status, progress, nextAction, costs }`
- Target: <100ms (no agent dispatch, pure file reads)
- Implementation: deterministic skill `workflow.query` that reads files and returns structured data

### HLS-03: Exit code convention

- `process.exitCode = 0` — skill succeeded (result.success === true)
- `process.exitCode = 1` — skill failed or error/timeout
- `process.exitCode = 2` — blocked (needs human input, or agent not available)
- Determined from SkillResult: success → 0, !success + data.blocked → 2, !success → 1

### HLS-04: Timeout flag

- `sunco headless --timeout <ms>` — maximum execution time
- Implementation: setTimeout + process.exit(1) as hard stop
- Default: no timeout (run until completion)

### HLS-05: HTML Report

**New deterministic skill: `sunco export --html`**
- Read .planning/ artifacts: ROADMAP, STATE, VERIFICATION files, SUMMARY files
- Generate self-contained HTML with:
  - Project summary
  - Phase progress tree
  - Per-phase verification results
  - Cost metrics (if available)
  - Timeline (from git log)
- All CSS/JS inlined (zero external deps)
- Output to .sun/reports/{milestone}-{date}.html

### Claude's Discretion
- HTML template styling details
- Whether to add `--format json|text` to non-headless mode too
- Whether query skill should also show git status

## Files to Modify

### CLI:
- `packages/cli/src/cli.ts` — add headless subcommand

### New skills:
- `packages/skills-workflow/src/query.skill.ts` — instant state snapshot
- `packages/skills-workflow/src/export.skill.ts` — HTML report generation

### Skill registration:
- `packages/cli/src/cli.ts` — register query + export
- `packages/skills-workflow/src/index.ts` — export new skills
- `packages/skills-workflow/tsup.config.ts` — add entry points

### Tests:
- `packages/skills-workflow/src/__tests__/query.test.ts`
