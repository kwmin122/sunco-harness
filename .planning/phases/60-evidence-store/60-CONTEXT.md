# Phase 60 Context — Evidence Store

Status: Complete
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Requirement: IF-26

## Output

Implemented `@sunco/evidence`.

Primary files:

- `packages/evidence/src/index.ts`
- `packages/evidence/src/__tests__/evidence-store.test.ts`

## Contract

Evidence is persisted under:

```text
.sunco/tasks/<task-id>/
  task.json
  evidence.json
  checks/
  diffs/
  decisions.jsonl
```

## Verification

- `npm test --workspace @sunco/evidence`
- Covered task/evidence creation, append-only decisions JSONL, check logs, diff records, and evidence updates.
