# Phase 26: Verification Signal Cleanup - Research

**Researched:** 2026-04-09
**Domain:** Verification pipeline, ESLint configuration, agent constraints
**Confidence:** HIGH

## Summary

Phase 26 addresses four signal-to-noise problems in the verification pipeline that produce false positives, wasted computation, and missed findings. The root causes are well-understood from analyzing the Phase 25 VERIFICATION.md output (546 findings, mostly noise) and the source code.

The highest-impact item is **excluding dist/ from Layer 2**: the lint skill currently scans `packages/**/*.{ts,tsx,js,jsx}` which matches bundled output in `packages/*/dist/`. This single issue accounts for ~500 of the 534 Layer 2 findings. The second item (phase-local scope) reduces noise further by restricting deterministic checks to files actually touched in the phase. The ESLint config normalization and --max-turns constraint are lower-effort fixes.

**Primary recommendation:** Fix all 4 items in a single plan. The changes are orthogonal and touch different code paths with minimal overlap.

## Project Constraints

From CLAUDE.md and .claude/rules/:
- **ESM-only**: `.js` extension in imports even for `.ts` files
- **Skill-Only**: All functionality delivered as skills via `defineSkill()`. No hardcoded commands
- **Deterministic First**: Lint/test/health are deterministic. LLM only where judgment needed
- **Clean Room**: GSD code copy forbidden. Concepts only
- **Quality**: Each skill is a finished product
- **Tech Stack**: ESLint 10.x (flat config only), TypeScript 6.x, Vitest 4.x

## Cleanup Item 1: Exclude dist/ from Layer 2

### Current State
- **File:** `packages/skills-harness/src/lint.skill.ts` line 72-73
- **Code:** `const sourceRoot = initResult.layers.sourceRoot ?? 'src';` then `[${sourceRoot}/**/*.{ts,tsx,js,jsx}]`
- **For SUNCO monorepo:** `sourceRoot` resolves to `'packages'` (via `packages/skills-harness/src/init/layer-detector.ts` line 16, SOURCE_ROOTS priority: src > lib > app > packages)
- **Result:** ESLint scans `packages/**/*.{ts,tsx,js,jsx}` which matches `packages/cli/dist/*.js`, `packages/core/dist/*.js`, `packages/skills-workflow/dist/*.js`

### Evidence from Phase 25 VERIFICATION.md
- 534 Layer 2 findings total
- Files like `packages/cli/dist/chunk-KGSD2HZ4.js:2694`, `packages/cli/dist/cli.js:8319`, `packages/core/dist/index.js:463`, `packages/skills-workflow/dist/execa-QO536OVM.js:2687` appear as lint violations
- Errors include "Definition for rule 'unicorn/text-encoding-identifier-case' was not found" -- this comes from bundled code containing inline `eslint-disable` comments referencing plugins not in the runner config
- Syntax errors at various lines -- bundled JS doesn't always parse cleanly with TS parser

### What's Wrong
The lint runner (`packages/skills-harness/src/lint/runner.ts`) uses ESLint's `lintFiles()` with glob patterns but does NOT set `ignorePatterns` to exclude dist/. The guard analyzer (`packages/skills-harness/src/guard/analyzer.ts` line 54) already properly excludes dist/ via `EXCLUDED_DIRS`, but lint does not.

### Fix Approach

**Option A (Recommended): Add ignorePatterns to ESLint config in runner.ts**
- File: `packages/skills-harness/src/lint/runner.ts` line 67
- Add `ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.sun/**']` to the overrideConfig array
- This is the ESLint 10 flat config pattern for excludes

**Option B: Filter the glob pattern**
- File: `packages/skills-harness/src/lint.skill.ts` line 73
- Change glob to exclude dist: `${sourceRoot}/**/!(dist)/**/*.{ts,tsx,js,jsx}`
- Less robust -- glob negation is fragile

**Recommendation:** Option A. ESLint's native `ignores` in flat config is the standard pattern.

### Risk
- LOW: Adding ignores to ESLint config is additive. No existing functionality broken.
- Verify that `ignores` at the config object level works in ESLint 10 flat config (it does -- confirmed pattern)

## Cleanup Item 2: Narrow Deterministic Verify to Phase-Local Scope

### Current State
- **File:** `packages/skills-workflow/src/shared/verify-layers.ts` lines 375-453
- **Code:** `runLayer2Deterministic(ctx)` calls `ctx.run('harness.lint', { json: true })` and `ctx.run('harness.guard', { json: true })` with NO file scope restriction
- Both skills run across the ENTIRE codebase
- Meanwhile, the verify skill (verify.skill.ts lines 231-248) already computes a git diff scoped to phase commits but never passes it to Layer 2

### What's Wrong
- Running lint + guard on the entire codebase produces hundreds of findings unrelated to the current phase
- A developer working on Phase 25 (help surface changes) sees 500+ guard anti-pattern findings from Phase 1 code they never touched
- This makes the VERIFICATION.md report nearly useless for actionable feedback

### Fix Approach

**Step 1: Pass phase-scoped file list to Layer 2**
- Modify `runLayer2Deterministic` signature to accept a `changedFiles: string[]` parameter
- Extract changed file paths from git diff (already available in verify.skill.ts)
- Pass `{ json: true, files: changedFilesGlob }` to `ctx.run('harness.lint', ...)`

**Step 2: Extract changed files from diff**
- File: `packages/skills-workflow/src/verify.skill.ts`
- After computing `diff`, extract file paths via regex on diff headers: `/^diff --git a\/(.*?) b\//gm`
- Or use `simple-git` `diffSummary` which returns structured file list

**Step 3: Pass to guard skill**
- The guard skill runs `analyzeProject` which scans all files
- Add `--files` option to guard.skill.ts matching lint.skill.ts pattern
- When `--files` is passed, guard analyzes only those files

**Key detail:** The lint skill already supports `--files <glob>` option (lint.skill.ts line 39, used at line 73). Layer 2 just needs to pass it.

### Risk
- MEDIUM: Narrowing scope means some cross-cutting issues may be missed
- **Mitigation:** Keep full-project lint as a separate `sunco lint` invocation (unchanged). Only the verify pipeline's Layer 2 is scoped.
- Edge case: if phase touches config/shared files that affect many modules, phase-local scope may miss downstream breakage. This is acceptable because Layer 3 (BDD) and Layer 5 (adversarial) catch cross-cutting issues.

## Cleanup Item 3: Normalize ESLint Config Contract

### Current State
- **File:** `packages/skills-harness/src/lint/runner.ts` lines 64-95
- ESLint runner uses `overrideConfigFile: true` to bypass filesystem config search
- Uses only `eslint-plugin-boundaries` with `typescript-eslint` parser
- No standard ESLint rules are enabled (no `@typescript-eslint/*`, no `unicorn/*`)
- The guard's incremental linter (`packages/skills-harness/src/guard/incremental-linter.ts`) creates a SEPARATE ESLint instance with the same boundaries-only config

### What's Wrong
1. **Missing standard rules:** The lint runner only checks boundaries, not standard TypeScript rules. When bundled dist/ files reference `@typescript-eslint/no-explicit-any` in eslint-disable comments, ESLint errors because that plugin isn't loaded.
2. **Duplicate config construction:** Both runner.ts and incremental-linter.ts build ESLint configs independently -- they should share a config factory.
3. **No project-level ESLint config file:** SUNCO has no eslint.config.js at root. The runner generates config programmatically, which is fine but means `npx eslint` at the root doesn't work independently.

### Fix Approach

**Step 1: Create shared ESLint config factory**
- New file: `packages/skills-harness/src/lint/eslint-config.ts`
- Export `buildFlatConfig(opts: { boundariesConfig, ignorePatterns })` that returns the full ESLint flat config array
- Both runner.ts and incremental-linter.ts import and use this factory
- This is also where the `ignores` for dist/ goes (cleanup item 1)

**Step 2: Add `@typescript-eslint/no-explicit-any` rule (optional)**
- If the project wants standard TS-eslint rules beyond boundaries, add them to the shared config
- However, the current design is "boundaries-only by default" (architecture linter, not style linter)
- **Recommendation:** Do NOT add standard rules. Instead, ensure dist/ exclusion prevents the error. The "rule not found" error only happens because dist/ files have inline `eslint-disable @typescript-eslint/no-explicit-any` comments and ESLint tries to look up the rule.

**Step 3: Document the contract**
- The ESLint config contract: "SUNCO's lint skill uses boundaries-only ESLint. Standard style/type rules are NOT enforced via ESLint. TypeScript compiler (`tsc --noEmit`) handles type errors."
- Add this to the lint skill's JSDoc header

### Risk
- LOW: Refactoring config into a shared factory is safe -- behavior unchanged
- The decision to NOT add standard ESLint rules should be explicit (not accidental)

## Cleanup Item 4: Revisit Cross-Model --max-turns Constraint

### Current State
- **File:** `packages/core/src/agent/providers/claude-cli.ts` line 124
- **Code:** `const args: string[] = ['-p', '--output-format', 'json', '--max-turns', '1'];`
- This hardcodes `--max-turns 1` for ALL Claude CLI agent calls
- Layer 6 (cross-model verification) uses `ctx.agent.crossVerify()` or `ctx.agent.run()` which both go through this provider

### What's Wrong
- `--max-turns 1` means the agent cannot use tools (Bash, Read, etc.) -- it can only respond to the prompt
- For verification tasks, the agent CANNOT read code files, run tests, or check actual behavior
- This limits cross-model verification to "opinion-based review of the diff text" rather than "investigative verification"
- The VERIFICATION.md shows Layer 1 experts all failed with PermissionDeniedError -- related but separate issue (permission-harness provider denies npx vitest)

### Fix Approach

**Option A (Recommended): Make --max-turns configurable per request**
- Add optional `maxTurns?: number` to `AgentRequest` type (in `packages/core/src/agent/types.ts`)
- In `buildArgs`, use `request.maxTurns ?? 1` as default
- Layer 6 (cross-model) can set `maxTurns: 3` or `maxTurns: 5` for investigative verification
- Other callers (Layer 1 experts, quick queries) keep `maxTurns: 1` for speed

**Option B: Global config**
- Add `agent.maxTurns` to SunConfig TOML schema
- Less granular -- all calls use same turns

**Recommendation:** Option A. Per-request granularity is essential since verification needs more turns than simple queries.

### Risk
- MEDIUM: Increasing max-turns increases cost and latency
- **Mitigation:** Only Layer 6 (cross-model) uses higher turns. Keep default at 1.
- Increased max-turns means agent can execute commands -- ensure VERIFICATION_PERMISSIONS in verify-layers.ts is appropriately scoped (currently: readPaths: ['**'], writePaths: [], allowTests: true, allowNetwork: false, allowGitWrite: false -- this is correct)
- Test the timeout: EXPERT_TIMEOUT is 120_000ms (2 min). With max-turns 3, agent may need more time. Consider bumping Layer 6 timeout to 180_000ms.

## Recommended Approach

Implement all 4 items in **one plan with 4 tasks** (one per cleanup item). The changes are orthogonal:

1. **Task 1: dist/ exclusion + ESLint config factory** (Items 1 + 3)
   - Create `packages/skills-harness/src/lint/eslint-config.ts` shared factory
   - Add `ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.sun/**']`
   - Refactor runner.ts and incremental-linter.ts to use the factory
   - Tests: verify dist/ files excluded from lint results

2. **Task 2: Phase-local verify scope** (Item 2)
   - Modify `runLayer2Deterministic` to accept `changedFiles` parameter
   - Use `git.diffSummary()` in verify.skill.ts to extract changed file list
   - Pass `--files` to lint and guard skill invocations
   - Add `--files` option to guard.skill.ts
   - Tests: verify only changed files are checked

3. **Task 3: Configurable --max-turns** (Item 4)
   - Add `maxTurns?: number` to AgentRequest type
   - Update claude-cli.ts buildArgs to use `request.maxTurns ?? 1`
   - Update Layer 6 to pass `maxTurns: 3`
   - Bump Layer 6 timeout to 180_000ms
   - Tests: verify buildArgs respects maxTurns parameter

4. **Task 4: Integration verification**
   - Run `sunco verify --phase 25` and confirm Layer 2 findings drop from 534 to <20
   - Confirm dist/ files absent from findings
   - Confirm guard anti-patterns are phase-scoped
   - Update VERIFICATION.md

## Alternative(s) Considered

1. **Project-level eslint.config.js file**: Could create a root eslint.config.js with proper ignores. Rejected because SUNCO uses programmatic ESLint (no config file by design -- `overrideConfigFile: true`). Adding a config file would create two sources of truth.

2. **tsup `outDir` change to avoid collision**: Moving dist/ output outside packages/ tree. Rejected -- too invasive, standard convention is `dist/` inside each package.

3. **Full codebase verify with diff-based filtering post-hoc**: Run lint on everything, then filter findings to only phase-touched files. Rejected -- wasteful computation (lint scans thousands of files) and the root dist/ problem remains.

4. **Separate "verify-lint" config vs "dev-lint" config**: Having different ESLint configs for verification vs development. Rejected -- unnecessary complexity, one config factory serves both.

## Implementation Map

| File | Action | Description |
|------|--------|-------------|
| `packages/skills-harness/src/lint/eslint-config.ts` | CREATE | Shared ESLint flat config factory with ignores |
| `packages/skills-harness/src/lint/runner.ts` | MODIFY | Import config from factory, remove inline config |
| `packages/skills-harness/src/guard/incremental-linter.ts` | MODIFY | Import config from factory, remove inline config |
| `packages/skills-harness/src/lint/__tests__/eslint-config.test.ts` | CREATE | Test ignores, config shape |
| `packages/skills-workflow/src/shared/verify-layers.ts` | MODIFY | Add changedFiles param to runLayer2Deterministic, pass --files to lint/guard |
| `packages/skills-workflow/src/verify.skill.ts` | MODIFY | Extract changed files from diff, pass to Layer 2 |
| `packages/skills-harness/src/guard.skill.ts` | MODIFY | Add --files option for phase-scoped guard |
| `packages/core/src/agent/types.ts` | MODIFY | Add maxTurns?: number to AgentRequest |
| `packages/core/src/agent/providers/claude-cli.ts` | MODIFY | Use request.maxTurns ?? 1 in buildArgs |
| `packages/skills-workflow/src/shared/verify-layers.ts` | MODIFY | Set maxTurns: 3 for Layer 6, bump timeout |
| `packages/core/src/agent/__tests__/claude-cli.test.ts` | MODIFY | Test maxTurns parameter |

## Dependencies

No new packages needed. All changes use existing dependencies:
- ESLint 10.x (already installed) -- `ignores` in flat config
- simple-git 3.33.x (already installed) -- `diffSummary()` for file list
- typescript-eslint (already installed) -- parser in shared config

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phase-local scope misses cross-cutting issues | MEDIUM | Layers 3-5 still run full scope; standalone `sunco lint` unchanged |
| Higher --max-turns increases cost | LOW | Only Layer 6 uses 3 turns; timeout bumped accordingly |
| Shared ESLint config factory breaks existing tests | LOW | Factory is a pure refactor; run existing lint/guard tests to verify |
| Guard --files option regression | LOW | Guard already has EXCLUDED_DIRS; --files just narrows input |
| AgentRequest type change breaks providers | LOW | `maxTurns` is optional with default fallback; other providers ignore it |

## Open Questions

1. **Should `sunco lint` standalone also exclude dist/ by default?** Current research says YES -- dist/ is never authored code. The shared config factory handles this.
2. **Should Layer 6 use a higher maxTurns only when multiple providers are available?** If only one provider exists (skeptical reviewer), maxTurns: 1 may suffice since it's the same model playing devil's advocate. Worth testing both values.
3. **Should guard.skill.ts `--files` accept glob OR file list?** The lint skill uses glob. For verify pipeline integration, a comma-separated file list may be more precise. Recommendation: accept both (glob if contains `*`, else treat as file list).

## Sources

| Source | Confidence | What It Told Us |
|--------|-----------|-----------------|
| `packages/skills-workflow/src/verify.skill.ts` (source code) | HIGH | 7-layer pipeline structure, diff computation, layer invocation |
| `packages/skills-workflow/src/shared/verify-layers.ts` (source code) | HIGH | Layer 2 calls lint/guard with no scope, Layer 6 uses crossVerify |
| `packages/skills-harness/src/lint/runner.ts` (source code) | HIGH | ESLint programmatic config, no ignorePatterns |
| `packages/skills-harness/src/lint.skill.ts` (source code) | HIGH | sourceRoot-based glob, --files option exists |
| `packages/skills-harness/src/guard/analyzer.ts` (source code) | HIGH | Guard already excludes dist/ via EXCLUDED_DIRS |
| `packages/core/src/agent/providers/claude-cli.ts` (source code) | HIGH | --max-turns 1 hardcoded |
| `.planning/phases/25-workflow-surface-simplification/VERIFICATION.md` (artifact) | HIGH | 534 Layer 2 findings, dist/ files as evidence |
| Filesystem probe: no top-level `src/` dir, `packages/` detected as sourceRoot | HIGH | Root cause of dist/ inclusion |
