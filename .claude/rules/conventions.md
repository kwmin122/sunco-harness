---
description: File naming, skill patterns, import patterns, testing conventions
globs:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
  - "packages/**/*.test.ts"
---

### File Naming
- Skill implementations: `*.skill.ts` with `export default defineSkill({...})`
- Test files: `*.test.ts` in `__tests__/` directories
- Shared utilities: `shared/` directory per package (e.g. `shared/phase-reader.ts`)
- Prompt builders: `prompts/` directory (e.g. `prompts/debug-analyze.ts`)
- Type contracts: `shared/*-types.ts` for cross-skill interfaces (e.g. `shared/debug-types.ts`)

### Skill Patterns
- Two kinds: `kind: 'deterministic'` (zero LLM cost) and `kind: 'prompt'` (agent-powered)
- Every skill follows: entry -> progress -> gather -> process -> state.set -> ui.result -> return
- Cross-skill invocation: `await ctx.run('workflow.diagnose')` via skill ID
- State persistence: `ctx.state.set('skillName.lastResult', data)` for recommender integration
- Graceful degradation: unstructured agent output returns `success: true` with `warnings[]`
- Partial failure: `success: true` with `warnings[]` when at least 1 subtask succeeds
- Agent output parsing: extract last JSON code block from ``` json ... ``` with raw JSON fallback
- Permissions: `PermissionSet` with role, readPaths, writePaths, allowTests, allowNetwork, allowGitWrite

### Import Patterns
- ESM-only (`.js` extension in imports even for `.ts` files)
- Dynamic imports for optional deps: `await import('execa')`, `await import('ai')`
- CJS interop: `createRequire` for CJS-only packages (e.g. picomatch)
- Barrel exports: `index.ts` per package with explicit re-exports

### Testing
- Vitest with in-source test colocation
- Parser functions exported for unit testability (e.g. `export function parseDebugOutput()`)
- Mock pattern: `vi.hoisted()` for mock variables in `vi.mock()` factories
- State/config tests: in-memory adapters, no filesystem mocking
