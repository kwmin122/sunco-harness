# Diagnose Issues Workflow

Parse raw build, test, or lint output to produce a structured diagnosis. Categorizes errors by type, identifies root causes, suggests concrete fixes, and writes a DIAGNOSIS.md file. Used by `/sunco:diagnose`.

---

## Overview

Five steps:

1. **Collect output** — from arguments, clipboard, or by running commands
2. **Parse and categorize** — classify each error by type
3. **Group by root cause** — cluster errors that share a common fix
4. **Suggest fixes** — concrete, file-specific instructions
5. **Write DIAGNOSIS.md** — structured report, optionally commit

---

## Step 1: Collect Output

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--build` | `RUN_BUILD` | false |
| `--test` | `RUN_TEST` | false |
| `--lint` | `RUN_LINT` | false |
| `--file <path>` | `INPUT_FILE` | — |
| Remaining text | `RAW_INPUT` | — |

**If `--build` flag:**

```bash
npm run build 2>&1 | tee /tmp/sunco-build-output.txt
```

**If `--test` flag:**

```bash
npm run test 2>&1 | tee /tmp/sunco-test-output.txt
```

**If `--lint` flag:**

```bash
npm run lint 2>&1 | tee /tmp/sunco-lint-output.txt
```

**If `--file <path>`:** Read the file directly.

**If raw text in arguments:** Use that as input.

**If no flags and no input:**

```
Provide output to diagnose:
  /sunco:diagnose --build     run build and diagnose
  /sunco:diagnose --test      run tests and diagnose
  /sunco:diagnose --lint      run lint and diagnose
  /sunco:diagnose --file out.txt   diagnose from file
  Or paste the output directly after the command.
```

---

## Step 2: Parse and Categorize

Parse the collected output. Identify each discrete error or warning.

**Error type classification:**

| Type | Pattern | Example |
|------|---------|---------|
| `typescript-error` | `TS[0-9]+:` or `error TS` | `TS2345: Argument of type 'string' is not assignable` |
| `type-missing` | `Cannot find name`, `does not exist on type` | `Property 'resolve' does not exist on type 'SkillRegistry'` |
| `import-error` | `Cannot find module`, `has no exported member` | `Cannot find module './skill-loader'` |
| `test-failure` | `FAIL` in test runner output, `AssertionError` | `expect(received).toBe(expected) — Received: undefined` |
| `lint-rule` | ESLint rule name in output | `no-explicit-any: Unexpected any. Specify a different type` |
| `lint-boundary` | Architecture boundary violation | `boundaries: import from 'infra' is not allowed in 'domain'` |
| `build-error` | Bundler error not from TypeScript | `[esbuild] Could not resolve "@/utils"` |
| `runtime-error` | Stack traces, unhandled errors in test output | `TypeError: Cannot read properties of undefined` |

For each error, extract:
- `type` — one of the categories above
- `file` — absolute path if present
- `line` — line number if present
- `message` — the raw error message
- `rule` — lint rule name if type is `lint-*`

---

## Step 3: Group by Root Cause

Cluster errors that share a root cause:

**Common clustering patterns:**

- Multiple `type-missing` errors in the same file → likely a single import or type definition missing
- Multiple `import-error` for the same module → module doesn't exist or export is wrong
- Multiple `test-failure` in the same test file → likely a shared setup issue (beforeEach, mock)
- Multiple `lint-boundary` violations from the same source file → one file in wrong layer
- Multiple `typescript-error TS2345` for the same type → one type definition incorrect

**Deduplication:** If 8 errors all say "Cannot find module './state-engine'", that's ONE root cause: `state-engine.ts` doesn't exist or has wrong path.

Build clusters:

```
Root Cause 1 (explains 8 errors): state-engine module missing or misnamed
Root Cause 2 (explains 3 errors): SkillRegistry type missing 'resolve' method
Root Cause 3 (explains 1 error):  lint boundary: skill-loader imports from infra
```

---

## Step 4: Suggest Fixes

For each root cause cluster, generate a specific fix:

**Fix instruction format:**
- File path (absolute if possible)
- Line number (if applicable)
- Exact change to make (not "fix the import" but "change `./state-engine` to `./core/state-engine`")
- Whether this is a one-file fix or a multi-file refactor

**Fix templates by type:**

| Type | Fix pattern |
|------|-------------|
| `import-error` for missing module | Check if file exists: `ls src/core/state-engine.ts`. If not, create it. If yes, verify the export name. |
| `type-missing` property | Add the property to the interface/type definition at [file:line]. |
| `lint-boundary` | Move the file to the correct layer OR change the import to use the allowed path. |
| `test-failure` shared setup | Check `beforeEach` in [test file]. Async setup may not be awaited. |
| `typescript-error TS2345` | Cast, narrow, or update the type definition to match actual usage. |
| `runtime-error` in test | The error occurs at [file:line]. Add null check or ensure async resolution completes before assertion. |

---

## Step 5: Write DIAGNOSIS.md

If errors are from a specific phase, write to that phase directory. Otherwise write to `.sun/diagnose/`:

```bash
PHASE_DIR=$(ls -d .planning/phases/*-* 2>/dev/null | tail -1)
OUTPUT_PATH="${PHASE_DIR}/DIAGNOSIS.md"
# fallback:
OUTPUT_PATH=".sun/diagnose/$(date +%Y-%m-%d-%H%M)-DIAGNOSIS.md"
mkdir -p "$(dirname $OUTPUT_PATH)"
```

Write the file:

```markdown
# Diagnosis Report

Date: [ISO date]
Source: build | test | lint | mixed
Total errors: N
Root causes identified: M

## Summary

[2-3 sentences: what's broken, why, what to fix first]

## Root Causes

### Root Cause 1 — [short label]

**Explains:** N errors
**Type:** import-error | type-missing | test-failure | lint-boundary
**Location:** [file:line]
**Description:** [what's actually wrong]

**Fix:**
  File: src/core/state-engine.ts
  Action: File is missing. Create it with a basic export matching the import.
  OR
  File: src/core/skill-loader.ts line 12
  Change: `import { StateEngine } from './state-engine'`
       to: `import { StateEngine } from './core/state-engine'`

### Root Cause 2
[same structure]

## Error Inventory

| # | Type | File | Line | Message |
|---|------|------|------|---------|
| 1 | import-error | skill-loader.ts | 12 | Cannot find module './state-engine' |
| 2 | import-error | skill-registry.ts | 8 | Cannot find module './state-engine' |
...

## Quick Fix Order

Fix in this order (each unblocks the next):
1. Create src/core/state-engine.ts (fixes 8 import errors)
2. Add `resolve(id: string): Skill | undefined` to SkillRegistry interface (fixes 3 type errors)
3. Move skill-loader.ts out of infra/ layer (fixes 1 lint error)
```

Display inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► DIAGNOSIS  N errors → M root causes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Root cause 1 (8 errors): missing state-engine module
Root cause 2 (3 errors): SkillRegistry missing resolve()
Root cause 3 (1 error):  boundary violation in skill-loader.ts

Fix order:
  1. Create src/core/state-engine.ts
  2. Add resolve() to SkillRegistry
  3. Move skill-loader.ts to correct layer

Report: [path/to/DIAGNOSIS.md]
```

---

## Success Criteria

- [ ] All errors from input parsed and categorized by type
- [ ] Errors grouped into root cause clusters (not listed individually)
- [ ] Fix instructions are file-specific and actionable (not "fix the types")
- [ ] Fix order accounts for dependencies (fixing A unblocks B)
- [ ] DIAGNOSIS.md written
- [ ] User shown quick fix order inline
