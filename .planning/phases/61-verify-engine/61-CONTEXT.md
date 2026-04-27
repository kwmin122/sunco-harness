# Phase 61 Context — Verify Engine

Status: Complete
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Requirement: IF-27

## Output

Implemented `@sunco/verifier`.

Primary files:

- `packages/verifier/src/index.ts`
- `packages/verifier/src/__tests__/verifier.test.ts`

## Contract

The Verify Engine detects JavaScript/TypeScript package-manager and package-script signals, selects `typecheck`, `test`, `lint`, and `build` checks deterministically, runs commands, captures stdout/stderr, writes task-scoped logs, and updates `evidence.json`.

## Verification

- `npm test --workspace @sunco/verifier`
- Covered project detection, check selection, pass/fail classification, and evidence-store integration.
