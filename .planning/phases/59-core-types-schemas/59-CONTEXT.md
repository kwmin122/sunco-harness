# Phase 59 — Core Types + Schemas

Status: implemented and verified
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Requirement: IF-25
Date: 2026-04-27

## Context

Phase 59 is the first implementation slice after the Phase 58 runtime architecture contract. Its job is to make the M7 runtime data model concrete without opening Evidence Store, Verify Engine, Done Gate, or Edit Engine behavior yet.

The implementation lives in `@sunco/core` because Phase 60-64 packages need one canonical source for task, evidence, check, approval, edit, decision, risk, and runtime-provider contracts.

## Delivered

- Added `packages/core/src/runtime/types.ts`.
- Added `packages/core/src/runtime/errors.ts`.
- Added `packages/core/src/runtime/index.ts`.
- Exported runtime contracts from `packages/core/src/index.ts`.
- Added `@sunco/core/runtime` subpath export in `packages/core/package.json`.
- Added `src/runtime/index.ts` to `packages/core/tsup.config.ts`.
- Added runtime schema tests at `packages/core/src/runtime/__tests__/types.test.ts`.

## Canonical Records

Phase 59 defines Zod schemas and TypeScript types for:

- `Task`, `TaskStatus`
- `RiskLevel`
- `CheckResult`, `CheckStatus`, `CheckKind`
- `DoneGateResult`
- `ApprovalRecord`
- `EditTransaction`, `ChangedFile`, `FileHash`
- `RuntimeDecision`
- `EvidenceRecord`
- `RuntimeArtifact`

The schemas are strict at the record level and additive through explicit `metadata` fields. This keeps persisted runtime records stable while leaving a controlled extension point for later packages.

## Interfaces Seeded

Future package interfaces were seeded inside core only:

- `RuntimeAgentAdapter`
- `RuntimeAgentRequest`
- `RuntimeAgentResult`
- `RuntimeCodeIntelProvider`
- `ProjectSignal`
- `VerificationCheckSpec`

No `agent-adapter` or `code-intel` package was created in Phase 59.

## Runtime Errors

Phase 59 adds runtime-specific errors extending the existing `SunError` hierarchy:

- `RuntimeError`
- `RuntimeSchemaError`
- `MissingEvidenceError`
- `DoneGateBlockedError`
- `RiskApprovalRequiredError`

## Verification

Completed on 2026-04-27:

- `npm test --workspace @sunco/core` — 27 files passed, 376 tests passed.
- `npm run build --workspace @sunco/core` — ESM + DTS build passed, including `dist/runtime/index.d.ts`.
- `node -e "import('@sunco/core/runtime')..."` — built subpath import passed.
- `npm test --workspace popcoru` — Claude runtime smoke passed: 818 passed, 0 failed, 0 warnings.
- `npm run test:codex --workspace popcoru` — Codex runtime smoke passed: 817 passed, 0 failed, 0 warnings.

## Scope Boundary

Phase 59 intentionally does not:

- Persist `.sunco/tasks/<task-id>/`.
- Execute verification commands.
- Decide done/blocked transitions.
- Compute file hashes, diffs, or rollback patches.
- Wire new user-facing CLI behavior.
- Create `packages/runtime`, `packages/evidence`, `packages/verifier`, or `packages/edit-engine`.

## Next

Phase 60 should implement the Evidence Store against the Phase 59 schemas:

```text
.sunco/tasks/<task-id>/
  task.json
  evidence.json
  checks/
  diffs/
  decisions.jsonl
```

The first Phase 60 acceptance target should be read/write of `task.json`, `evidence.json`, and append-only `decisions.jsonl` using the strict schemas from `@sunco/core/runtime`.
