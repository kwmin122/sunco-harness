# Phase 72 Context — Dogfood Release Evidence

Milestone: M8 Productization Gate
Date: 2026-04-27

## Purpose

SUNCO's own release should pass through the proof-first runtime before publish.
The dogfood task proves the release changes produce edit evidence, verification
evidence, and a Done Gate decision.

## Contract

- Task id: `release-v0.14.0`.
- Evidence root: `.sunco/tasks/release-v0.14.0/`.
- Required command: `sunco-runtime do "release popcoru 0.14.0" --task release-v0.14.0 --json`.
- Required follow-up: `sunco-runtime verify release-v0.14.0 --json`.
- Publish must not be claimed complete until registry credentials exist and the
  registry artifact smoke passes.

## Verification Evidence

Completed locally on 2026-04-27:

- `node packages/cli/bin/sunco-runtime.cjs do "release popcoru 0.14.0" --task release-v0.14.0 --json` — DONE.
- `node packages/cli/bin/sunco-runtime.cjs verify release-v0.14.0 --json` — DONE, Done Gate passed.
- Evidence path: `.sunco/tasks/release-v0.14.0/`.
- Required checks recorded: typecheck, test, lint, build.
- Edit evidence recorded: changed-file hashes, `diffs/changes.patch`, and
  `diffs/rollback.patch`.

## Current Status

The dogfood release evidence is recorded. External npm publish remains blocked
by missing npm authentication.
