# Phase 62 Context — Done Gate

Status: Complete
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Requirement: IF-28

## Output

Implemented Done Gate authority in `@sunco/runtime`.

Primary files:

- `packages/runtime/src/index.ts`
- `packages/runtime/src/__tests__/done-gate.test.ts`

## Contract

Done Gate blocks completion when evidence is missing, required checks are missing or failed, approval is missing for high-risk mutation classes, unresolved failures remain, or edit evidence is stale/failed/missing rollback data.

## Verification

- `npm test --workspace @sunco/runtime`
- Covered missing evidence, missing/failed checks, missing approval, stale edit evidence, and passing gate.
