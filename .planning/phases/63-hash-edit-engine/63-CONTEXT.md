# Phase 63 Context — Hash Edit Engine

Status: Complete
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Requirement: IF-29

## Output

Implemented `@sunco/edit-engine`.

Primary files:

- `packages/edit-engine/src/index.ts`
- `packages/edit-engine/src/__tests__/edit-engine.test.ts`

## Contract

The edit engine observes git changes, captures before/after SHA-256 hashes, records changed files, writes `changes.patch`, writes `rollback.patch`, and attaches the edit transaction to task evidence.

Runtime artifact paths under `.sunco/` and `.sun/` are ignored when observing user edits.

## Verification

- `npm test --workspace @sunco/edit-engine`
- Covered file hashing, changed-file detection, stale before-hash detection, diff patch creation, rollback patch creation, and evidence-store integration.
