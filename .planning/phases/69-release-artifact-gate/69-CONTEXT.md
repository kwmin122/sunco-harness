# Phase 69 Context — Release Artifact Gate CI

Milestone: M8 Productization Gate
Date: 2026-04-27

## Purpose

Phase 69 promotes the installed-product smoke from an ad-hoc local command into
the official release gate. The gate must exercise the artifact a user installs,
not only the monorepo source tree.

## Decisions

- CI must trigger on `v*` tags; otherwise the publish job is dead code.
- The release gate must include `sunco-runtime`, not only legacy installer files.
- The same artifact smoke should support both local tarballs and published
  registry packages.
- Antigravity is part of the supported runtime set and must be included in CI
  smoke coverage.

## Implemented

- `.github/workflows/ci.yml` now runs on `main`, PRs, and `v*` tags.
- CI matrix covers Node 22 and Node 24 on Ubuntu and macOS.
- CI runs build, typecheck, tests, lint, whitespace check, audit, runtime smoke,
  contract lint, and `npm run test:artifact --workspace popcoru`.
- The publish job runs the release gate before npm publish and verifies the
  registry artifact afterward.
- `packages/cli/bin/release-artifact-smoke.cjs` supports
  `--registry popcoru@<version>`.

## Verification

Local verification command:

```text
npm run test:artifact --workspace popcoru
```

Registry verification command after publish:

```text
npm run test:artifact --workspace popcoru -- --registry popcoru@0.14.0
```
