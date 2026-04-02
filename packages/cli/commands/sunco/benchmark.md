---
name: sunco:benchmark
description: Performance baseline and regression detection. Measures build time, bundle size, test speed, and custom benchmarks with trend tracking.
argument-hint: "[--baseline] [--compare] [--trend]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Flags:**
- `--baseline` — Capture baseline measurements (run before changes).
- `--compare` — Compare current metrics against saved baseline.
- `--trend` — Show performance trends from historical data.

**Examples:**
- `/sunco:benchmark --baseline` — Save current performance as baseline
- `/sunco:benchmark --compare` — Compare against baseline
- `/sunco:benchmark` — Full benchmark with comparison if baseline exists
- `/sunco:benchmark --trend` — Show historical trends
</context>

<objective>
Measure and track performance metrics: build time, bundle size, test execution speed, and vitest bench results. Detect regressions by comparing against baselines.

**After this command:** Review regression alerts and optimize if needed.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/benchmark.md end-to-end.
</process>

<success_criteria>
- Build time measured (tsup/turbo)
- Bundle size measured (per-package and total)
- Test execution time measured (vitest)
- Vitest bench results if bench files exist
- Baseline saved or comparison produced
- Regression thresholds applied (build: >25%, bundle: >10%, tests: >50%)
- Report saved to `.sun/benchmarks/`
- Trend analysis if historical data exists
</success_criteria>
