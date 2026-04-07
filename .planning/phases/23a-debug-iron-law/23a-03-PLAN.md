# Plan 23a-03: Enhanced Prompt + Integration

**Phase**: 23a — Debug Iron Law Engine
**Wave**: 3 (depends on Plan 01 + 02)
**Estimated files**: 3 modified + 1 new

## Goal

Build the enhanced debug prompt with Iron Law constraints, update barrel exports, and verify build.

## Tasks

### Task 1: Create debug-ironlaw.ts prompt

**File**: `packages/skills-workflow/src/prompts/debug-ironlaw.ts` (NEW)

New prompt builder that wraps debug-analyze with Iron Law constraints:
```typescript
export function buildDebugIronLawPrompt(params: {
  gitLog: string;
  testOutput: string;
  buildOutput: string;
  stateSnapshot: string;
  recentErrors: string;
  bugClassification: FailureType;
  bugPattern: BugPattern;
  priorLearnings: DebugLearning[];
  ironLawState: IronLawState;
  sanitizedErrors: string;
}): string
```

Prompt structure:
1. **Iron Law Declaration**: "You MUST NOT suggest code changes until root cause is confirmed. First hypothesize, then verify."
2. **Bug Classification**: Pre-classified pattern with indicators
3. **Prior Learnings**: Similar past bugs and their resolutions
4. **Hypothesis Protocol**: "For each hypothesis: state it, describe verification step, report result (confirmed/rejected)"
5. **Sanitized Context**: Error output with PII removed
6. **Standard Context**: git log, test output, build output, state

Output format adds:
```json
{
  "hypotheses_tested": [
    { "description": "...", "verification": "...", "result": "confirmed|rejected" }
  ],
  "root_cause_confirmed": true,
  "prior_learnings_matched": ["learning-id-1"],
  ...existing DebugAnalysis fields
}
```

### Task 2: Update debug.skill.ts prompt selection

**File**: `packages/skills-workflow/src/debug.skill.ts`
**Action**: Modify

- When Iron Law mode is active (default for new sessions): use `buildDebugIronLawPrompt`
- When `--quick` flag: use original `buildDebugAnalyzePrompt` (skip Iron Law for quick diagnosis)
- Add `--quick` option to skill definition

### Task 3: Update barrel exports

**File**: `packages/skills-workflow/src/index.ts`
**Action**: Modify

Add exports for new modules:
- `export { classifyBug, getBugPattern } from './shared/bug-patterns.js'`
- `export { sanitizeForSearch } from './shared/error-sanitizer.js'`
- `export { saveLearning, searchLearnings } from './shared/debug-learnings.js'`
- `export { createIronLawGate, HookAbortError } from './shared/iron-law-gate.js'`
- `export type { IronLawState, BugPattern, DebugLearning, SanitizeResult } from './shared/debug-types.js'`

### Task 4: Update recommender rules

**File**: `packages/core/src/recommend/rules.ts`
**Action**: Modify

Add rules:
- After `debug` with `failure_type` in new 6 patterns → recommend specific follow-up
- After `debug` with `hypotheses_tested` all rejected → recommend `forensics`
- After `debug` with learning saved → recommend `verify` to confirm fix

### Task 5: Build verification

Run `npm run build` and `npm run test` to verify:
- All new files compile
- All existing tests still pass
- New tests pass
- Barrel exports resolve correctly

## Acceptance Criteria

1. `buildDebugIronLawPrompt` produces valid prompt with all 6 sections
2. `--quick` flag bypasses Iron Law for fast diagnosis
3. All new exports available from `@sunco/skills-workflow`
4. Recommender suggests appropriate follow-ups for new failure types
5. Full build passes with zero errors
6. All tests pass (existing + new)

## Tests

- `__tests__/debug-ironlaw-prompt.test.ts` — prompt structure validation
- Build verification (npm run build)
- Test suite (npm run test)
