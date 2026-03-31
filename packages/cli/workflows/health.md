# Health Check Workflow

Composite codebase health scoring across 5 dimensions. Tracks score over time to make degradation visible. Used by `/sunco:health`.

---

## Overview

Health score = weighted average of 5 dimension scores, 0–100.

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Architecture | 25% | Import direction violations, layer compliance, circular deps |
| Tests | 25% | Coverage %, test count trend, test file ratio |
| Complexity | 20% | Cyclomatic complexity, file length, function length |
| Documentation | 15% | Exported function doc coverage, README existence |
| Dependencies | 15% | Outdated deps, audit vulnerabilities, unused deps |

**Grade scale:**
- 90–100: A — Excellent
- 80–89: B — Good
- 70–79: C — Acceptable
- 60–69: D — Needs attention
- 0–59: F — Critical

---

## Check 1: Node.js Version

```bash
node --version
```

**Pass condition:** Node.js >= 22 (SUNCO requires 22+, recommends 24 LTS)

| Result | Score impact |
|--------|-------------|
| 24.x | +0 (full score) |
| 22.x | -5 points (acceptable, recommend upgrade) |
| 20.x | -15 points (warn, approaching EOL) |
| < 20 | -30 points (fail, security risk) |

---

## Check 2: TypeScript Compilation

```bash
npx tsc --noEmit 2>&1
```

**Pass condition:** Zero errors. Warnings do not affect score.

| Result | Score impact |
|--------|-------------|
| Zero errors | Architecture +20 points |
| 1-5 errors | Architecture -10 points |
| 6-20 errors | Architecture -20 points |
| > 20 errors | Architecture -30 points (critical) |

Record error count by category (type errors, module resolution, config errors).

---

## Check 3: ESLint (Architecture Dimension)

```bash
npx eslint packages/ --format=json 2>&1
```

Parse JSON output to extract:
- Total error count
- Total warning count
- Errors by rule ID

**Architecture boundary violations** (via `eslint-plugin-boundaries`):
- Count import direction violations
- Count layer crossings
- Flag any circular dependencies

| Result | Architecture score |
|--------|--------------------|
| Zero errors | 100 |
| 1-3 errors | 75 |
| 4-10 errors | 50 |
| 11-20 errors | 25 |
| > 20 errors | 0 |

**Architecture violation severity:**
- `boundaries/element-types` error = high (layer violation)
- `no-circular-dependency` = high (circular import)
- Standard lint error = medium
- Warning = low

---

## Check 4: Test Suite (Tests Dimension)

```bash
npx vitest run --coverage --reporter=json 2>&1
```

Extract:
- Test pass/fail count
- Coverage percentage (lines, branches, functions)
- Test file count vs source file count

**Tests score formula:**
```
tests_score = (coverage_pct * 0.6) + (pass_rate * 0.3) + (file_ratio * 0.1 * 100)
```

Where:
- `coverage_pct` = line coverage percentage (0-100)
- `pass_rate` = passing tests / total tests (0.0-1.0)
- `file_ratio` = test files / source files (capped at 1.0)

| Coverage | Score contribution |
|----------|--------------------|
| >= 80% | Full points |
| 60-79% | 75% of points |
| 40-59% | 50% of points |
| 20-39% | 25% of points |
| < 20% | 0 points |

---

## Check 5: Code Complexity (Complexity Dimension)

Scan source files for complexity indicators.

### File length check

```bash
find packages/*/src -name "*.ts" ! -name "*.test.ts" -exec wc -l {} \;
```

| Condition | Score impact |
|-----------|-------------|
| All files < 200 lines | 0 (good) |
| 1-3 files 200-500 lines | -5 |
| Any file > 500 lines | -15 |
| Any file > 1000 lines | -25 (flag as critical) |

### Function length (heuristic)

Count functions with > 50 lines (grep for function bodies):
```bash
# Approximate: count occurrences of multi-line function signatures followed by long bodies
```

### Cyclomatic complexity indicators

Count deeply nested code (heuristic via indentation depth):
```bash
grep -rn "        if\|        for\|        while\|        switch" packages/*/src --include="*.ts" | wc -l
```

High nesting count = complexity debt.

**Complexity score:**
- Start at 100
- Deduct based on violations above
- Floor at 0

---

## Check 6: Documentation (Documentation Dimension)

### Exported function coverage

```bash
# Count exported functions
grep -rn "^export function\|^export const\|^export class\|^export interface\|^export type" packages/*/src --include="*.ts" | wc -l

# Count those with JSDoc
grep -B1 "^export function\|^export const\|^export class" packages/*/src --include="*.ts" | grep -c "^\*\/"
```

**JSDoc coverage rate** = documented exports / total exports

| Coverage | Score |
|----------|-------|
| >= 70% | 100 |
| 50-69% | 70 |
| 30-49% | 40 |
| < 30% | 10 |

### README existence

```bash
ls packages/*/README.md 2>/dev/null
ls .planning/PROJECT.md 2>/dev/null
```

Each README found: +10 points to documentation score (capped at coverage score + 20).

---

## Check 7: Dependencies (Dependencies Dimension)

### Outdated packages

```bash
npm outdated --json 2>/dev/null
```

Count packages more than 1 major version behind.

### Security audit

```bash
npm audit --json 2>/dev/null
```

Count by severity:
- critical: -20 points each
- high: -10 points each
- moderate: -3 points each
- low: -1 point each (capped at -5 total)

### Unused dependencies (heuristic)

```bash
# Check if listed dependencies appear in source
```

**Dependencies score:**
- Start at 100
- Deduct audit findings
- Deduct for significantly outdated packages (-5 per major version gap > 1)

---

## Score Aggregation

```
health_score = round(
  (architecture_score * 0.25) +
  (tests_score * 0.25) +
  (complexity_score * 0.20) +
  (documentation_score * 0.15) +
  (dependencies_score * 0.15)
)
```

Apply Node.js version modifier at the end.

---

## Trend Tracking

When `--trend` flag is used:

Read history from `.sun/health-history.jsonl`:
```json
{"date": "2026-03-31", "score": 82, "architecture": 90, "tests": 75, ...}
```

Display trend table:
```
Date        Score  Architecture  Tests  Complexity  Docs  Deps
2026-03-29  78     85            70     80          65    82
2026-03-30  80     88            72     80          68    83
2026-03-31  82     90            75     81          70    84

Trend: +4 points over 3 days (+2.0 avg/day)
```

Flag regressions: if score dropped > 5 points since last run, show "REGRESSION DETECTED" in red.

Append new score to `.sun/health-history.jsonl` on every run.

---

## Output Format

```
SUNCO Health Score

Overall: 82/100 (B)

  Architecture  ████████░░  88/100  — 2 import direction warnings
  Tests         ███████░░░  75/100  — 62% coverage, 47 tests passing
  Complexity    ████████░░  81/100  — 1 file > 300 lines
  Documentation ███████░░░  70/100  — 54% exported function coverage
  Dependencies  ████████░░  84/100  — 0 vulnerabilities, 2 packages outdated

Critical issues: none

Next steps:
  - Increase test coverage from 62% → 80% (biggest impact: +6 points)
  - Document exported functions in packages/core/src/skill-registry.ts
  - Update commander (14.0.3 → 14.1.0)

Run /sunco:lint to address architecture warnings.
```

---

## Score-Based Routing

**Score >= 80**: "Score is healthy. Keep it high by running `/sunco:lint` before each commit."

**Score 60–79**: "Score needs attention. Top improvements:" [list top 2-3 dimension actions]

**Score < 60**: "Score is critical. Fix high-impact issues first:" [show top 3 critical findings]
Run `/sunco:lint --fix` to start.
