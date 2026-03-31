---
name: sunco:diagnose
description: Analyze build/test/lint output and extract structured diagnostics. Paste error output or point to a log file to get categorized findings with fix recommendations.
argument-hint: "[--output <file>] [--type build|test|lint|runtime]"
allowed-tools:
  - Read
  - Bash
  - Write
---

<context>
**Flags:**
- `--output <file>` — Path to a log file to analyze. If omitted, runs diagnostics now.
- `--type build|test|lint|runtime` — Type of output to analyze. Default: auto-detect.
</context>

<objective>
Analyze build/test/lint output and produce a structured diagnostic report with categorized issues and actionable fix recommendations.

**Creates:**
- `.sun/diagnostics/[timestamp]-report.md` — structured diagnostic report
</objective>

<process>
## Step 1: Gather output

If `--output` in $ARGUMENTS: read the specified file.

Otherwise run diagnostics:

```bash
# TypeScript check
npx tsc --noEmit 2>&1

# Lint check
npx eslint packages/ --format json 2>&1

# Test run
npx vitest run --reporter=json 2>&1
```

Collect all output.

## Step 2: Auto-detect type

If `--type` not specified, detect from output:
- Contains "error TS" → TypeScript errors
- Contains "ESLint" or rule names → Lint errors
- Contains "PASS" / "FAIL" / "× " → Test failures
- Contains stack traces → Runtime errors

## Step 3: Categorize issues

Parse output and categorize:

**TypeScript errors:**
- Missing type annotation
- Type mismatch
- Import/module resolution
- Strict null checks

**Lint errors:**
- Architecture boundary violations (eslint-plugin-boundaries)
- Import extension missing (.js)
- Unused variables
- Custom rule violations

**Test failures:**
- Assertion failures
- Timeout
- Setup/teardown errors
- Mock misconfigurations

**Runtime errors:**
- Unhandled promise rejection
- Module not found
- Permission denied
- Network errors

## Step 4: Generate fix recommendations

For each issue:
1. Category: [type]
2. Location: [file:line]
3. Issue: [description]
4. Fix: [specific action to take]
5. Priority: [CRITICAL/HIGH/MEDIUM/LOW]

## Step 5: Write report

```markdown
# Diagnostic Report [timestamp]

## Summary
- Total issues: [N]
- Critical: [N] | High: [N] | Medium: [N] | Low: [N]
- Type: [build/test/lint/runtime]

## Critical Issues
[list with fix recommendations]

## High Issues
[list]

## Quick Fixes (Low effort, high impact)
[subset sorted by ease of fixing]

## Full Issue List
| # | Category | File | Line | Issue | Fix |
|---|----------|------|------|-------|-----|
```

## Step 6: Report

Show summary table.
Tell user: "Run `/sunco:debug` to investigate the root cause of critical issues."
</process>
