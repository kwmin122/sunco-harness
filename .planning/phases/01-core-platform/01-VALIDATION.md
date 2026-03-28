# Phase 1: Core Platform - Validation Architecture

**Derived from:** 01-RESEARCH.md Validation Architecture section
**Created:** 2026-03-28

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.workspace.ts` (workspace root) + per-package `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx turbo run test` |

## Phase Requirements -> Test Map

**NOTE on test paths:** Plans use `__tests__/` co-located pattern (e.g., `packages/core/src/config/__tests__/loader.test.ts`). RESEARCH.md referenced `tests/` at package root. Plans are authoritative -- co-located `__tests__/` is the convention for this project.

| Req ID | Behavior | Test Type | Automated Command | Plan |
|--------|----------|-----------|-------------------|------|
| CLI-01 | npm install + bin entry point works | integration | `npx vitest run packages/cli/src/__tests__/install.test.ts -x` | 01-08 |
| CLI-02 | Subcommand routing matches skills | unit | `npx vitest run packages/core/src/cli/__tests__/skill-router.test.ts -x` | 01-08 |
| CLI-03 | --help output includes all active skills | unit | `npx vitest run packages/core/src/cli/__tests__/skill-router.test.ts -x` | 01-08 |
| CLI-04 | Unknown command shows suggestion | unit | `npx vitest run packages/core/src/cli/__tests__/skill-router.test.ts -x` | 01-08 |
| CFG-01 | Three-layer TOML merge | unit | `npx vitest run packages/core/src/config/__tests__/loader.test.ts -x` | 01-02 |
| CFG-02 | Array replace + object deep merge | unit | `npx vitest run packages/core/src/config/__tests__/merger.test.ts -x` | 01-02 |
| CFG-03 | Zod validation with defaults | unit | `npx vitest run packages/core/src/config/__tests__/schema.test.ts -x` | 01-02 |
| CFG-04 | Settings skill reads/writes config | integration | `npx vitest run packages/core/src/config/__tests__/settings.test.ts -x` | 01-10 |
| SKL-01 | defineSkill() validates metadata | unit | `npx vitest run packages/core/src/skill/__tests__/define.test.ts -x` | 01-05 |
| SKL-02 | SkillContext provides all APIs | unit | `npx vitest run packages/core/src/skill/__tests__/context.test.ts -x` | 01-05 |
| SKL-03 | Scanner discovers skills from convention paths | unit | `npx vitest run packages/core/src/skill/__tests__/scanner.test.ts -x` | 01-05 |
| SKL-04 | Deterministic skill cannot access agent | unit | `npx vitest run packages/core/src/skill/__tests__/context.test.ts -x` | 01-05 |
| SKL-05 | Prompt skill dispatches through router | integration | `npx vitest run packages/core/src/skill/__tests__/context.test.ts -x` | 01-05 |
| SKL-06 | ctx.run() chains skills, detects circular | unit | `npx vitest run packages/core/src/skill/__tests__/context.test.ts -x` | 01-05 |
| STE-01 | .sun/ directory creation + structure | unit | `npx vitest run packages/core/src/state/__tests__/directory.test.ts -x` | 01-03 |
| STE-02 | SQLite WAL mode + schema creation | unit | `npx vitest run packages/core/src/state/__tests__/database.test.ts -x` | 01-03 |
| STE-03 | Flat file read/write in .sun/ | unit | `npx vitest run packages/core/src/state/__tests__/file-store.test.ts -x` | 01-03 |
| STE-04 | Concurrent write safety | integration | `npx vitest run packages/core/src/state/__tests__/database.test.ts -x` | 01-03 |
| STE-05 | State save/restore API | unit | `npx vitest run packages/core/src/state/__tests__/database.test.ts -x` | 01-03 |
| AGT-01 | AgentProvider interface contract | unit | `npx vitest run packages/core/src/agent/__tests__/router.test.ts -x` | 01-06 |
| AGT-02 | Claude CLI provider execution | integration | `npx vitest run packages/core/src/agent/__tests__/claude-cli.test.ts -x` | 01-06 |
| AGT-03 | PermissionSet enforcement | unit | `npx vitest run packages/core/src/agent/__tests__/permission.test.ts -x` | 01-06 |
| AGT-04 | Role-based permission presets | unit | `npx vitest run packages/core/src/agent/__tests__/permission.test.ts -x` | 01-06 |
| AGT-05 | Cross-validation with multiple providers | unit (mock) | `npx vitest run packages/core/src/agent/__tests__/router.test.ts -x` | 01-06 |
| AGT-06 | Token/cost tracking persistence | unit | `npx vitest run packages/core/src/agent/__tests__/tracker.test.ts -x` | 01-06 |
| REC-01 | Rule engine: state + result -> recommendations | unit | `npx vitest run packages/core/src/recommend/__tests__/engine.test.ts -x` | 01-09 |
| REC-02 | Recommendations display after skill | integration | `npx vitest run packages/core/src/recommend/__tests__/engine.test.ts -x` | 01-09 |
| REC-03 | State-based routing rules | unit | `npx vitest run packages/core/src/recommend/__tests__/rules.test.ts -x` | 01-09 |
| REC-04 | 20-50 rules, sub-ms response | unit (perf) | `npx vitest run packages/core/src/recommend/__tests__/engine.test.ts -x` | 01-09 |
| UX-01 | Interactive choice with Recommended tag | unit | `npx vitest run packages/core/src/ui/__tests__/patterns.test.ts -x` | 01-07 |
| UX-02 | Recommendation display in result pattern | unit | `npx vitest run packages/core/src/ui/__tests__/patterns.test.ts -x` | 01-07 |
| UX-03 | Progress bar, spinner, error box rendering | unit | `npx vitest run packages/core/src/ui/__tests__/SilentUiAdapter.test.ts -x` | 01-04 |

## Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (relevant package)
- **Per wave merge:** `npx turbo run test` (full suite)
- **Phase gate:** Full suite green before verification

## Test Path Convention

All test files use co-located `__tests__/` directories within source:
```
packages/core/src/config/__tests__/loader.test.ts
packages/core/src/skill/__tests__/define.test.ts
packages/core/src/state/__tests__/database.test.ts
packages/core/src/agent/__tests__/router.test.ts
packages/core/src/recommend/__tests__/engine.test.ts
packages/core/src/ui/__tests__/SilentUiAdapter.test.ts
packages/core/src/ui/__tests__/patterns.test.ts
packages/core/src/cli/__tests__/skill-router.test.ts
packages/core/src/cli/__tests__/lifecycle.test.ts
```

## Wave 0 Gaps

The following must be created by the first plans that touch each area:
- [ ] `vitest.workspace.ts` -- workspace-level Vitest config (Plan 01-01)
- [ ] `packages/core/vitest.config.ts` -- core package Vitest config (Plan 01-02, first TDD plan)
- [ ] `packages/cli/vitest.config.ts` -- CLI package Vitest config (Plan 01-08)
- [ ] `packages/core/src/__tests__/fixtures/` -- shared test fixtures (sample TOML configs, mock skills, mock providers)
- [ ] Framework install: `vitest@4.1.2` in root dev dependency (Plan 01-01)
