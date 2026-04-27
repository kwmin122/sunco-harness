# Phase 68 Context — M8 Productization Gate

Milestone: M8 Productization Gate
Date: 2026-04-27

## Purpose

M8 moves the proof-first runtime from source-tree RC to installed-product RC.
The gate is simple: source-tree green is not enough. `sunco-runtime` must run
from the packaged and installed product.

## Decisions

- M8 is a productization gate, not a new runtime architecture milestone.
- `sunco-runtime` must be a real npm bin and a real installed runtime front door.
- Installed runtime directories must not depend on unpublished `@sunco/*`
  workspace packages.
- The release artifact gate must test `npm pack -> clean npm prefix install ->
  temp HOME runtime install -> sunco-runtime do/status/verify/ship`.
- Package semver remains `popcoru@0.13.0` until an explicit release phase bumps,
  tags, publishes, and verifies the registry artifact.

## Implemented in Phase 68

- `packages/cli/src/runtime-cli.ts` contains the runtime CLI implementation.
- `packages/cli/bin/sunco-runtime.cjs` is now a thin loader for the bundled
  `runtime-cli.js`.
- `packages/cli/tsup.config.ts` builds `src/runtime-cli.ts` and bundles
  `@sunco/runtime`, `@sunco/evidence`, `@sunco/verifier`, and
  `@sunco/edit-engine`.
- `packages/cli/bin/install.cjs` copies `sunco-runtime.cjs` into every runtime
  install target alongside the bundled engine.
- `packages/cli/package.json` exposes `sunco-runtime` as an npm bin and adds
  `test:artifact`.
- `packages/cli/bin/release-artifact-smoke.cjs` validates the packaged product
  path across Claude, Codex, Cursor, and Antigravity.
- `packages/cli/bin/smoke-test.cjs` now asserts installed
  `sunco-runtime do/status/verify/ship`.

## Verification Evidence

Completed on 2026-04-27:

- `npm run build -- --force` — PASS, 9/9 packages.
- `npm run typecheck` — PASS, all workspaces.
- `npm test -- --force` — PASS, 18/18 turbo tasks.
- `npm run lint -- --force` — PASS, 9/9 packages; contract lint 94 passed.
- `npm run format:check` — PASS.
- `npm run format:check:base` — PASS.
- `npm audit --json` — PASS, 0 vulnerabilities.
- `npm run test:codex --workspace popcoru` — PASS, 823 passed, 0 failed,
  0 warnings against the installed Codex runtime.
- `npm run test:artifact --workspace popcoru` — PASS, 28 passed, 0 failed.

## Remaining M8 Work

- Version/release truth: package version, release notes, changelog, tag, publish
  policy, and registry verification must be aligned before calling this a full
  published release.
- CI should run the artifact smoke in a clean HOME and clean npm prefix.
- Dogfood release evidence should be recorded under `.sunco/tasks/<release-id>/`
  before publishing.

## Out of Scope

- Approval UX, stale-edit preflight authority, and runtime loop guardrails are
  M9 Runtime Authority Gate work.
- Evidence hash-chain durability is M10 work.
- Benchmark runner and CI matrix breadth are M11 work.
