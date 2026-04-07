# Plan 23a-02: Extend Existing Code

**Phase**: 23a — Debug Iron Law Engine
**Wave**: 2 (depends on Plan 01 for types and utilities)
**Estimated files**: 4 modified

## Goal

Extend lifecycle-hooks, stuck-detector, and debug.skill.ts with Iron Law mechanisms.

## Tasks

### Task 1: Extend lifecycle-hooks.ts

**File**: `packages/skills-workflow/src/shared/lifecycle-hooks.ts`
**Action**: Modify

Changes:
1. Add `'PreToolUse'` to `HookEvent` type
2. Add `canAbort?: boolean` to `HookDefinition`
3. Add `toolName?: string` to `HookContext`
4. In `emit()`: if hook has `canAbort: true` and throws `HookAbortError`, re-throw instead of silently catching
5. Export `HookAbortError` from iron-law-gate.ts (or define here)

Backward compatible: existing hooks without `canAbort` continue to have failures silently caught.

### Task 2: Extend stuck-detector.ts

**File**: `packages/skills-workflow/src/shared/stuck-detector.ts`
**Action**: Modify

Changes:
1. Add `DebugStuckResult` extending `StuckResult`:
   ```typescript
   interface DebugStuckResult extends StuckResult {
     hypothesesTested: number;
     hypothesesRejected: number;
     escalationReason: 'max_retries' | 'all_hypotheses_rejected' | 'oscillation' | null;
   }
   ```
2. Add `analyzeDebugSession(state: IronLawState): DebugStuckResult` method
3. Escalation triggers:
   - All hypotheses rejected → escalate with reason
   - 3+ consecutive hypothesis rejections → escalate
   - Same hypothesis tested twice → warn (oscillation)

### Task 3: Extend debug.skill.ts

**File**: `packages/skills-workflow/src/debug.skill.ts`
**Action**: Modify (major extension)

Changes:
1. **Iron Law Gate integration**:
   - On skill entry: create IronLawState, register PreToolUse hook via iron-law-gate.ts
   - Pass `ironLaw` state through debug session
   - Agent prompt includes Iron Law constraint

2. **9-pattern classification**:
   - After diagnose runs, call `classifyBug()` from bug-patterns.ts
   - Include classification in agent prompt context
   - Store classification in debug analysis result

3. **Prior Learnings**:
   - Before dispatching to agent: `searchLearnings()` for similar patterns/files
   - Include relevant learnings in prompt context
   - After successful debug: `saveLearning()` with result

4. **Error Sanitizer**:
   - Before any web search context: `sanitizeForSearch()` on error output
   - Include sanitized version in prompt, original in local analysis

5. **Freeze Scope**:
   - Extract affected directories from diagnose errors
   - Narrow PermissionSet.writePaths to those directories only
   - Display: "Freeze scope: [dirs]"

6. **3-Strike escalation**:
   - Track hypotheses in IronLawState
   - After each hypothesis test: update state
   - If `analyzeDebugSession()` returns escalation: stop and report

Flow change (before → after):
```
BEFORE: gather → diagnose → build prompt → agent → parse → store
AFTER:  gather → diagnose → classify → search learnings → sanitize →
        register iron law gate → narrow scope → build enhanced prompt →
        agent (with iron law constraints) → parse → store → save learning
```

### Task 4: Extend parseDebugOutput

**File**: `packages/skills-workflow/src/debug.skill.ts`
**Action**: Modify

Update `parseDebugOutput()` to handle new fields:
- `failure_type` now accepts 9 values (not just 3)
- New optional field: `hypotheses_tested: { description, result }[]`
- New optional field: `prior_learnings_matched: string[]`

Graceful degradation: if agent returns old 3-type format, still works.

## Acceptance Criteria

1. PreToolUse hook with canAbort=true actually blocks tool calls (throws HookAbortError)
2. Existing hooks without canAbort continue silently catching errors
3. debug.skill.ts searches learnings before dispatching to agent
4. debug.skill.ts saves learnings after successful analysis
5. debug.skill.ts narrows writePaths based on diagnose errors
6. 3-Strike escalation triggers after 3 rejected hypotheses
7. parseDebugOutput handles both old (3-type) and new (9-type) format

## Tests

- `__tests__/lifecycle-hooks.test.ts` — PreToolUse + canAbort behavior
- `__tests__/stuck-detector.test.ts` — debug session escalation
- `__tests__/debug-skill.test.ts` — end-to-end with mock agent
