# Phase 23a: Debug Iron Law Engine — Context

**Gathered**: 2026-04-07
**Mode**: autonomous (assumptions confirmed)
**Status**: Ready for planning

## Phase Boundary

Extend the existing debug ecosystem with 6 mechanisms from gstack's /investigate pattern:
Iron Law Gate, 3-Strike Rule extension, Freeze Scope, Prior Learnings, 9-pattern classification, Error Sanitizer.

**Not in scope**: New CLI commands. This phase extends existing debug/diagnose/forensics skills.

## Assumptions (Confirmed)

### Safe
1. debug.skill.ts (250 lines) is extended, not replaced
2. FailureType union grows from 3 to 9 values
3. StuckDetector already implements 3-strike logic — extend for debug-specific escalation
4. lifecycle-hooks.ts supports new HookEvent types
5. skill-profile.ts provides prior learning storage mechanism
6. ESM-only with .js extension imports

### Risky (with decisions)
1. **Iron Law Gate**: HookRunner currently silently catches failures. Decision: add `canAbort` flag to HookDefinition. When a PreToolUse hook throws `HookAbortError`, the tool call is blocked. Backward compatible — existing hooks don't set canAbort.
2. **Error Sanitizer**: New utility. Decision: standard PII patterns (IP addresses, file paths with /Users/, API keys matching common formats, email addresses). Configurable via .sun/config.toml `debug.sanitize_patterns`.
3. **Freeze Scope**: guard.skill.ts is in skills-harness package. Decision: don't cross package boundary. Instead, debug.skill.ts dynamically narrows PermissionSet.writePaths to the investigation scope. This is simpler and respects the monorepo boundary.

## Existing Code Map

| File | Package | Lines | Role |
|------|---------|-------|------|
| debug.skill.ts | skills-workflow | 250 | Main debug skill (extend) |
| diagnose.skill.ts | skills-workflow | 335 | Deterministic error parsing |
| forensics.skill.ts | skills-workflow | 358 | Post-mortem analysis |
| debug-types.ts | skills-workflow/shared | 102 | Type contracts (extend) |
| debug-analyze.ts | skills-workflow/prompts | 126 | Prompt builder (extend) |
| stuck-detector.ts | skills-workflow/shared | 158 | 3-strike detection (extend) |
| lifecycle-hooks.ts | skills-workflow/shared | 89 | Hook runner (extend) |
| skill-profile.ts | skills-workflow/shared | 114 | Usage profiling (extend) |
| guard.skill.ts | skills-harness | 211 | Watch mode (reference only) |

## Dependencies

- Phase 10 (debugging) — base skills
- Phase 12 (operational resilience) — StuckDetector
- Phase 19 (Hook System v2) — lifecycle hooks
- Phase 21 (Cross-Session Intelligence) — skill profiles

## New Files to Create

| File | Purpose |
|------|---------|
| shared/error-sanitizer.ts | PII/internal info removal before web search |
| shared/iron-law-gate.ts | PreToolUse hook that blocks Edit/Write without root cause |
| shared/bug-patterns.ts | 9-pattern classification with examples |
| prompts/debug-ironlaw.ts | Enhanced prompt with Iron Law constraints |
| shared/debug-learnings.ts | Prior learnings storage and retrieval |

## 6 Mechanisms Mapping

| # | Mechanism | Implementation |
|---|-----------|----------------|
| 1 | Iron Law Gate | iron-law-gate.ts + lifecycle-hooks.ts extension |
| 2 | 3-Strike Rule | stuck-detector.ts extension for debug escalation |
| 3 | Freeze Scope | debug.skill.ts permission narrowing |
| 4 | Prior Learnings | debug-learnings.ts + .sun/debug/learnings/ |
| 5 | 9 Bug Patterns | bug-patterns.ts + debug-types.ts extension |
| 6 | Error Sanitizer | error-sanitizer.ts |
