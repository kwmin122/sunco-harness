# Phase 70 Context — Version and Release Truth

Milestone: M8 Productization Gate
Date: 2026-04-27

## Purpose

Phase 70 aligns all release-facing claims around one artifact:
`popcoru@0.14.0`, the v1.6 proof-first runtime plus M8 productization gate.

## Decisions

- SUNCO product milestone labels remain decoupled from npm SemVer.
- v1.6 maps to npm `0.14.0` because `popcoru` is still pre-1.0.
- The release claim must distinguish source-tree gate, packed artifact gate,
  registry verification, git tag, and npm publish.
- Missing npm credentials are an external release blocker, not a source-tree
  correctness issue.

## Implemented

- `packages/cli/package.json` and `package-lock.json` are bumped to `0.14.0`.
- README and CHANGELOG now describe v0.14.0/v1.6/M8 as the active release.
- Package repository, homepage, and bug tracker metadata point at the actual
  `kwmin122/sunco-harness` repository.
- `docs/runtime/v1.6-release-hardening.md` documents the local gate, registry
  gate, and current npm-auth blocker.
- `.planning/STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` distinguish
  delivered local productization from external publish authority.

## External Blocker

`npm whoami` currently returns `E401`, and `gh secret list --repo
kwmin122/sunco-harness` shows no configured `NPM_TOKEN`. npm publish and
registry verification cannot honestly be marked complete until one of those
credentials exists.
