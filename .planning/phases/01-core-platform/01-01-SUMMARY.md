---
phase: 01-core-platform
plan: 01
subsystem: infra
tags: [turborepo, npm-workspaces, tsup, typescript-6, commander, monorepo]

# Dependency graph
requires: []
provides:
  - "Monorepo scaffold with 5 workspace packages (core, cli, skills-harness, skills-workflow, skills-extension)"
  - "Turborepo build pipeline (build, test, lint, clean)"
  - "TypeScript 6.0.2 strict mode base config"
  - "tsup ESM bundling for all packages"
  - "CLI binary stub (sunco --help, --version)"
affects: [01-01b, 01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: [turborepo@2.5.4, typescript@6.0.2, tsup@8.5.0, commander@14.0.3, smol-toml@1.6.1, zod@3.24.4, better-sqlite3@12.8.0, execa@9.6.1, glob@13.0.6, picomatch@4.0.2, chalk@5.4.1, vitest@3.1.2]
  patterns: [npm-workspaces, turborepo-pipeline, esm-only, tsup-node22-target]

key-files:
  created:
    - package.json
    - turbo.json
    - tsconfig.base.json
    - vitest.workspace.ts
    - packages/core/package.json
    - packages/core/src/index.ts
    - packages/cli/package.json
    - packages/cli/src/cli.ts
    - packages/skills-harness/package.json
    - packages/skills-workflow/package.json
    - packages/skills-extension/package.json
  modified: []

key-decisions:
  - "Used TypeScript 6.0.2 (latest stable) instead of 5.8.x -- aligns with CLAUDE.md spec for TS 6.0.x"
  - "Set tsconfig target to esnext (not es2025) -- esbuild 0.25.x does not support es2025 target; esnext provides equivalent modern output"
  - "Set tsup target to node22 -- matches runtime requirement, esbuild-compatible"
  - "Added ignoreDeprecations: 6.0 to tsconfig -- tsup DTS build uses baseUrl internally which TS 6.0 deprecated"
  - "Used npm workspace * references instead of workspace:* protocol -- npm does not support workspace: protocol (that is pnpm/yarn)"
  - "Pinned glob@13.0.6 (not 11.x) -- glob 11.x is deprecated by author, 13.x is the current maintained version"

patterns-established:
  - "Monorepo structure: packages/* with npm workspaces + Turborepo"
  - "Package naming: @sunco/{name} with version 0.0.1"
  - "Build config: tsup with ESM format, node22 target, dts:true for libraries, dts:false for CLI"
  - "TypeScript config: extends tsconfig.base.json, include: [src]"
  - "CLI binary: tsup banner injection for shebang"

requirements-completed: [CLI-01]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 01 Plan 01: Monorepo Scaffold Summary

**Turborepo + npm workspaces monorepo with 5 packages, TypeScript 6.0.2 strict mode, tsup ESM bundling, and CLI binary stub**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T03:19:00Z
- **Completed:** 2026-03-28T03:25:46Z
- **Tasks:** 1
- **Files modified:** 27

## Accomplishments
- Scaffolded 5 workspace packages: @sunco/core, @sunco/cli, @sunco/skills-harness, @sunco/skills-workflow, @sunco/skills-extension
- Configured Turborepo pipeline with proper dependency ordering (build depends on ^build)
- TypeScript 6.0.2 strict mode with esnext target and nodenext module resolution
- CLI stub runs successfully with Commander.js 14 (sunco --help, --version)
- All core dependencies pinned per CLAUDE.md tech stack

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monorepo scaffold with all packages and build pipeline** - `aee57c3` (feat)

**Plan metadata:** [pending final commit]

## Files Created/Modified
- `package.json` - Workspace root with npm workspaces, Turborepo scripts, TS 6.0.2
- `turbo.json` - Turborepo task pipeline (build, test, lint, clean)
- `tsconfig.base.json` - Shared TypeScript config (strict, esnext, nodenext)
- `vitest.workspace.ts` - Vitest workspace discovery
- `.gitignore` - Standard ignores (node_modules, dist, .turbo, .sun)
- `.npmrc` - save-exact=true for deterministic installs
- `packages/core/package.json` - @sunco/core with all infrastructure dependencies
- `packages/core/tsup.config.ts` - ESM build with DTS, external better-sqlite3
- `packages/core/src/index.ts` - Barrel export with VERSION constant
- `packages/cli/package.json` - @sunco/cli with bin entry
- `packages/cli/tsup.config.ts` - ESM build with shebang banner
- `packages/cli/src/cli.ts` - Commander.js program stub
- `packages/skills-harness/package.json` - @sunco/skills-harness workspace package
- `packages/skills-workflow/package.json` - @sunco/skills-workflow workspace package
- `packages/skills-extension/package.json` - @sunco/skills-extension workspace package

## Decisions Made
- **TypeScript 6.0.2 over 5.8.3:** CLAUDE.md specifies TS 6.0.x. TS 6.0.2 is available on npm and used as the compiler. Required adding `ignoreDeprecations: "6.0"` for tsup DTS build compatibility (tsup uses baseUrl internally).
- **Target esnext instead of es2025:** esbuild (used by tsup) does not recognize `es2025` as a valid target. `esnext` provides equivalent modern JavaScript output and is supported by both TS and esbuild.
- **tsup target node22:** Explicit esbuild target matching the runtime requirement, avoiding tsconfig target inheritance issues.
- **glob 13.0.6 instead of 11.x:** CLAUDE.md research originally listed glob 11.x, but the author deprecated all pre-13.x versions. Updated to current stable.
- **npm workspace `*` references:** Plan specified `workspace:*` but that is a pnpm/yarn protocol. Standard npm workspaces use `*` which resolves to the local workspace package.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed workspace reference protocol**
- **Found during:** Task 1 (npm install)
- **Issue:** Plan specified `workspace:*` dependency references which are a pnpm/yarn protocol, not supported by npm
- **Fix:** Changed all workspace references from `workspace:*` to `*` for npm compatibility
- **Files modified:** packages/cli/package.json, packages/skills-harness/package.json, packages/skills-workflow/package.json, packages/skills-extension/package.json
- **Verification:** npm install succeeds
- **Committed in:** aee57c3 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed @types/better-sqlite3 version**
- **Found during:** Task 1 (npm install)
- **Issue:** @types/better-sqlite3@7.6.14 does not exist on npm (latest is 7.6.13)
- **Fix:** Pinned to @types/better-sqlite3@7.6.13
- **Files modified:** packages/core/package.json
- **Verification:** npm install succeeds
- **Committed in:** aee57c3 (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed esbuild es2025 target incompatibility**
- **Found during:** Task 1 (turbo build)
- **Issue:** esbuild 0.25.x does not support `es2025` target, causing build failure
- **Fix:** Changed tsconfig target to `esnext`, set tsup target to `node22` explicitly
- **Files modified:** tsconfig.base.json, all tsup.config.ts files
- **Verification:** turbo build succeeds across all 5 packages
- **Committed in:** aee57c3 (Task 1 commit)

**4. [Rule 3 - Blocking] Added TS 6.0 deprecation suppression**
- **Found during:** Task 1 (turbo build DTS generation)
- **Issue:** tsup DTS build uses baseUrl internally, which TS 6.0 deprecated, causing error
- **Fix:** Added `"ignoreDeprecations": "6.0"` to tsconfig.base.json
- **Files modified:** tsconfig.base.json
- **Verification:** DTS build succeeds
- **Committed in:** aee57c3 (Task 1 commit)

**5. [Rule 3 - Blocking] Added packageManager field to root package.json**
- **Found during:** Task 1 (turbo build)
- **Issue:** Turborepo 2.5.4 requires `packageManager` field in root package.json
- **Fix:** Added `"packageManager": "npm@10.9.2"`
- **Files modified:** package.json
- **Verification:** turbo build resolves workspaces
- **Committed in:** aee57c3 (Task 1 commit)

---

**Total deviations:** 5 auto-fixed (1 bug, 4 blocking)
**Impact on plan:** All fixes necessary for build pipeline functionality. No scope creep. Version adjustments reflect actual npm availability vs plan assumptions.

## Issues Encountered
- glob 11.x deprecation warning from npm (author's aggressive deprecation policy) -- resolved by updating to glob 13.0.6 (current maintained version per npm)
- TypeScript 5.8.3 was initially used due to root package.json default -- corrected to 6.0.2 per CLAUDE.md specification

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo foundation complete, all 5 packages build successfully
- Ready for Plan 01b (type contracts) to define core interfaces
- CLI binary stub ready for Commander.js subcommand registration
- Core package dependency tree established for config, state, skill system modules

## Self-Check: PASSED

All 23 created files verified present. Commit aee57c3 verified in git log.

---
*Phase: 01-core-platform*
*Completed: 2026-03-28*
