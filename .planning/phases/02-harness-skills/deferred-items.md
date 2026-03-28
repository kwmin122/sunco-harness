# Phase 02 Deferred Items

## Pre-existing: TS6059 rootDir mismatch in skills-harness package

**Discovered during:** 02-04 Task 2 verification
**Issue:** `tsconfig.base.json` sets `rootDir: "src"` which resolves to the monorepo root's `src/`, not the package's `src/`. All files in `packages/skills-harness/src/` trigger TS6059 "File is not under rootDir" errors during `tsc --noEmit`.
**Impact:** Type-checking via `npx tsc --noEmit` fails for ALL files in the package (not just new ones). Build via `tsup` works because it uses esbuild, not tsc.
**Fix:** Either add `"rootDir": "src"` to `packages/skills-harness/tsconfig.json` compilerOptions, or change `tsconfig.base.json` to use `"composite": true` with per-package rootDir overrides.
**Scope:** Pre-existing issue affecting ALL packages. Not in scope for 02-04.
