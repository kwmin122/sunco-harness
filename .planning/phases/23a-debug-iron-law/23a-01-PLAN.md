# Plan 23a-01: Type Contracts + New Utilities

**Phase**: 23a — Debug Iron Law Engine
**Wave**: 1 (no dependencies on other plans)
**Estimated files**: 5 new + 1 modified

## Goal

Create the foundational types and new utility modules that the rest of Phase 23a depends on.

## Tasks

### Task 1: Extend debug-types.ts

**File**: `packages/skills-workflow/src/shared/debug-types.ts`
**Action**: Modify

Add 6 new failure types to FailureType union:
```typescript
type FailureType =
  | 'context_shortage' | 'direction_error' | 'structural_conflict'  // existing
  | 'state_corruption' | 'race_condition' | 'type_mismatch'         // new
  | 'dependency_conflict' | 'boundary_violation' | 'silent_failure'; // new
```

Add new interfaces:
```typescript
interface IronLawState {
  rootCauseConfirmed: boolean;
  hypotheses: { description: string; tested: boolean; result: 'confirmed' | 'rejected' | 'pending' }[];
  editBlocked: boolean;
  phase: number;
}

interface BugPattern {
  type: FailureType;
  category: 'structural' | 'behavioral' | 'environmental';
  description: string;
  indicators: string[];
  commonFixes: string[];
}

interface DebugLearning {
  id: string;
  pattern: FailureType;
  symptom: string;
  rootCause: string;
  fix: string;
  files: string[];
  createdAt: string;
  hitCount: number;
}

interface SanitizeResult {
  text: string;
  redactions: { type: string; count: number }[];
  totalRedacted: number;
}
```

### Task 2: Create bug-patterns.ts

**File**: `packages/skills-workflow/src/shared/bug-patterns.ts` (NEW)

Define the 9-pattern classification with:
- Each pattern's indicators (regex or string patterns in error output)
- 2-tier classification: first by category (structural/behavioral/environmental), then by specific type
- `classifyBug(errors: DiagnoseError[], context: string): FailureType` function
- `getBugPattern(type: FailureType): BugPattern` lookup

Pattern classification logic:
| Pattern | Category | Key Indicators |
|---------|----------|----------------|
| context_shortage | structural | "undefined", "null reference", missing imports |
| direction_error | structural | repeated same-file changes, revert patterns |
| structural_conflict | structural | circular deps, layer violations |
| state_corruption | behavioral | stale cache, inconsistent state files |
| race_condition | behavioral | intermittent failures, timing-dependent |
| type_mismatch | environmental | TS errors, schema validation failures |
| dependency_conflict | environmental | version conflicts, peer dep warnings |
| boundary_violation | structural | cross-package imports, layer breaches |
| silent_failure | behavioral | no errors but wrong output, missing side effects |

### Task 3: Create error-sanitizer.ts

**File**: `packages/skills-workflow/src/shared/error-sanitizer.ts` (NEW)

Functions:
- `sanitizeForSearch(text: string, extraPatterns?: RegExp[]): SanitizeResult`
- `defaultPatterns: RegExp[]` — built-in PII patterns

Default patterns to redact:
- Absolute paths containing /Users/ or /home/ → `[PATH]`
- IP addresses (v4 and v6) → `[IP]`
- Email addresses → `[EMAIL]`
- API keys (AWS, GitHub tokens, etc. common formats) → `[API_KEY]`
- JWT tokens → `[TOKEN]`
- UUIDs → keep (useful for error lookup)

Config: read `debug.sanitize_patterns` from .sun/config.toml for additional patterns.

### Task 4: Create debug-learnings.ts

**File**: `packages/skills-workflow/src/shared/debug-learnings.ts` (NEW)

Functions:
- `saveLearning(cwd: string, learning: DebugLearning): Promise<void>` — write to `.sun/debug/learnings/{id}.json`
- `searchLearnings(cwd: string, query: { pattern?: FailureType; files?: string[]; symptom?: string }): Promise<DebugLearning[]>`
- `incrementHitCount(cwd: string, id: string): Promise<void>`

Storage: JSON files in `.sun/debug/learnings/` directory.
Search: in-memory scan (learnings count expected < 1000).

### Task 5: Create iron-law-gate.ts

**File**: `packages/skills-workflow/src/shared/iron-law-gate.ts` (NEW)

The Iron Law: "No fixes without confirmed root cause."

Functions:
- `createIronLawGate(state: IronLawState): HookDefinition` — returns a PreToolUse hook
- `isEditBlocked(state: IronLawState): boolean`
- `confirmRootCause(state: IronLawState, hypothesis: string): IronLawState`
- `rejectHypothesis(state: IronLawState, hypothesis: string): IronLawState`

Hook behavior:
- Registered as PreToolUse hook with `canAbort: true`
- When Edit or Write tool is invoked during debug session:
  - If `rootCauseConfirmed === false`: throw `HookAbortError('Iron Law: confirm root cause before editing')`
  - If `rootCauseConfirmed === true`: allow
- State tracked in `debug.ironLaw` state key

Export `HookAbortError` class for the hook system.

## Acceptance Criteria

1. All new types compile with strict TypeScript
2. `classifyBug()` correctly classifies at least 3 patterns from sample error output
3. `sanitizeForSearch()` redacts paths, IPs, emails, API keys from sample text
4. `saveLearning()` + `searchLearnings()` round-trip works
5. `createIronLawGate()` returns a valid HookDefinition that blocks when not confirmed
6. All functions are unit testable (pure or with minimal I/O)

## Tests

- `__tests__/bug-patterns.test.ts` — classification accuracy
- `__tests__/error-sanitizer.test.ts` — redaction completeness
- `__tests__/debug-learnings.test.ts` — save/search/hit-count
- `__tests__/iron-law-gate.test.ts` — block/allow logic
