# SUNCO Runtime Foundation

Status: Phase 58 architecture contract
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Date: 2026-04-26

## 1. Product Constitution

SUNCO is a proof-first AI coding runtime.

It prevents AI coding agents from silently failing by requiring evidence before a task can be marked done.

Product laws:

1. No evidence, no done.
2. No approval, no risky mutation.
3. No stale context, no edit.
4. No hidden failure, no ship.
5. No uncontrolled loop, no auto.
6. No undocumented decision, no trust.

## 2. Runtime Definition

SUNCO v1.5 completed the Workflow Router foundation: stage classification, approval boundaries, compound learning, release envelopes, and constrained `/sunco:auto`.

M7 moves SUNCO from a skill pack with strong workflow policy into a runtime that owns task state, evidence, edit records, verification results, and done decisions.

The first runtime slice is intentionally narrow:

```text
sunco do "task"
-> create task record
-> detect changed files
-> record before hashes
-> record diff and rollback patch
-> run verifier
-> store evidence
-> run done gate
-> block done when evidence is missing or failed
```

The runtime does not need full agent editing, full LSP, TUI, studio UI, marketplace, or multi-agent execution in M7.

## 3. Package Boundaries

M7 opens only the packages needed for the first working runtime slice.

```text
packages/core
packages/runtime
packages/evidence
packages/verifier
packages/edit-engine
packages/cli
```

Responsibilities:

| Package | M7 responsibility |
| --- | --- |
| `packages/core` | Shared types, schemas, risk levels, runtime errors, provider interfaces |
| `packages/runtime` | Task lifecycle, runtime decisions, done gate orchestration, loop shell |
| `packages/evidence` | `.sunco/tasks/<task-id>/` store, evidence read/write, decisions log |
| `packages/verifier` | Project detection, check selection, check execution, check result parsing |
| `packages/edit-engine` | File hash capture, changed-file detection, diff records, rollback patch records, stale check |
| `packages/cli` | Existing CLI and command surfaces; wires runtime packages into user commands |

Deferred packages:

| Surface | M7 handling |
| --- | --- |
| `policy` | Keep risk and approval types in `core`; runtime helpers live in `runtime` until the surface grows |
| `agent-adapter` | Interface only in `core`; first implementation may be local/manual |
| `code-intel` | Interface only in `core`; first provider may be basic changed-file and script detection |
| `benchmark` | Seed under `test/benchmarks/`; package split deferred |
| `memory` | Extend existing compound learning later; no new package in M7 |
| `apps/tui`, `apps/studio` | Out of M7 scope |

## 4. Core Data Model

M7 defines these canonical records:

```ts
type TaskStatus =
  | "intake"
  | "planned"
  | "approved"
  | "executing"
  | "verifying"
  | "blocked"
  | "done"
  | "shipped";

type RiskLevel =
  | "read_only"
  | "local_mutate"
  | "repo_mutate"
  | "repo_mutate_official"
  | "remote_mutate"
  | "external_mutate";

type CheckStatus = "pass" | "fail" | "skipped" | "blocked";
```

Required records:

| Record | Purpose |
| --- | --- |
| `Task` | User goal, status, risk, created/updated timestamps, active evidence pointer |
| `EvidenceRecord` | Aggregated proof for a task: checks, diffs, approvals, decisions |
| `CheckResult` | One verification command result with command, status, duration, log path, summary |
| `DoneGateResult` | Pass/block verdict with reasons and next actions |
| `ApprovalRecord` | Explicit user approval for risk boundaries |
| `EditTransaction` | Changed files, before/after hashes, patch, rollback patch, stale status |
| `RuntimeDecision` | Append-only reasoned decision emitted by router/runtime/verifier/done gate |

## 5. Task Lifecycle

Task status flow:

```text
intake
-> planned
-> approved
-> executing
-> verifying
-> done
```

Blocking transitions:

```text
executing -> blocked
verifying -> blocked
blocked -> executing
blocked -> verifying
done -> shipped
```

Invariant:

```text
Task cannot become "done" unless DoneGate passes.
```

## 6. Evidence Lifecycle

Evidence is stored under a task-scoped runtime directory:

```text
.sunco/tasks/<task-id>/
  task.json
  evidence.json
  checks/
  diffs/
  decisions.jsonl
```

Rules:

1. `decisions.jsonl` is append-only.
2. Check logs live under `checks/`.
3. Diff and rollback files live under `diffs/`.
4. Evidence can reference external artifacts, but task completion is judged from the task evidence record.
5. Missing evidence is a blocking condition, not a warning.

## 7. Done Gate Contract

Done Gate is the authority that decides whether a task may be marked done.

It fails when:

1. No evidence record exists.
2. Required checks were not run.
3. Required checks failed.
4. A required approval record is missing.
5. The task risk exceeds the approved boundary.
6. There is an unresolved failure.
7. The edit transaction is stale, failed, or lacks rollback evidence when mutation occurred.

Example output:

```text
DONE BLOCKED
Reason:
- test failed
- build not run
Next:
- run sunco verify
- fix failing check and re-run done gate
```

## 8. Verify Engine Contract

Verify Engine executes checks and writes `CheckResult` records.

M7 supports JavaScript/TypeScript first:

| Signal | Detection |
| --- | --- |
| package manager | `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `package.json` |
| typecheck | package script named `typecheck` |
| test | package script named `test` |
| lint | package script named `lint` |
| build | package script named `build` |

Verify Engine is not just a command runner. It must:

1. Select checks deterministically.
2. Execute checks with captured stdout/stderr.
3. Write logs to `.sunco/tasks/<task-id>/checks/`.
4. Summarize pass/fail into `evidence.json`.
5. Return a result consumable by Done Gate.

## 9. Edit Transaction Contract

Edit Engine records mutation evidence.

MVP requirements:

1. Capture before hash for changed files.
2. Detect changed files.
3. Store diff patch.
4. Store rollback patch.
5. Detect stale files before applying an edit transaction.
6. Mark transaction `failed` when stale context is found.

Initial M7 may observe user or host-agent edits rather than applying edits itself. The requirement is that changed files, hashes, diffs, and rollback evidence are task-scoped.

## 10. Approval / Policy Contract

Risk levels remain aligned with the v1.5 Approval Boundary:

```text
read_only
local_mutate
repo_mutate
repo_mutate_official
remote_mutate
external_mutate
```

M7 policy:

| Risk | Done/auto implication |
| --- | --- |
| `read_only` | No mutation approval required |
| `local_mutate` | Allowed when task policy permits local writes |
| `repo_mutate` | Requires edit evidence and rollback record |
| `repo_mutate_official` | Requires explicit approval |
| `remote_mutate` | Requires per-invocation explicit approval |
| `external_mutate` | Requires per-invocation explicit approval |

`remote_mutate` and `external_mutate` are never auto-safe.

## 11. Runtime Loop Contract

M7 loop shell:

```text
intake
-> plan or accept task text
-> execute or observe edits
-> collect edit evidence
-> verify
-> run done gate
-> done or blocked
```

Loop guardrails:

1. Max attempts must be finite.
2. Same failure repeated twice blocks.
3. Risk escalation blocks.
4. Missing evidence blocks.
5. Approval-required action blocks until approval exists.

## 12. CLI Command Contract

User-facing M7 commands focus on the narrow runtime path:

```text
sunco do
sunco verify
sunco status
sunco ship
```

Slash command equivalents remain:

```text
/sunco:do
/sunco:verify
/sunco:status
/sunco:ship
```

Existing advanced commands remain installed, but the product entry path should guide users through the smaller command set.

## 13. Benchmark Seed Contract

M7 creates benchmark seeds, not a benchmark brand.

Initial benchmark roots:

```text
test/benchmarks/false-done/
test/benchmarks/bugfix-basic/
```

Initial metrics:

| Metric | Meaning |
| --- | --- |
| `false_done_prevented` | Agent claimed done but Done Gate blocked due to missing/failed evidence |
| `checks_required` | Checks Done Gate required |
| `checks_passed` | Checks that passed |
| `user_interventions` | Explicit user approvals or corrections |
| `time_to_green` | Time until Done Gate passed |

## 14. Deferred Surfaces

Out of M7:

1. TUI.
2. Studio/web UI.
3. Full LSP.
4. Multi-agent runtime.
5. Marketplace.
6. All-language verifier support.
7. Full code-intel graph.
8. Agent capability registry implementation beyond a minimal interface.

These are valid later surfaces, but they must not block the first runtime slice.

## 15. M7 Phase Plan

| Phase | Name | Primary output |
| --- | --- | --- |
| 58 | Runtime Architecture Contract | This document + planning registration |
| 59 | Core Types + Schemas | `Task`, `EvidenceRecord`, `CheckResult`, `DoneGateResult`, `ApprovalRecord`, `EditTransaction`, `RuntimeDecision` |
| 60 | Evidence Store | `.sunco/tasks/<task-id>/` read/write + append-only decisions |
| 61 | Verify Engine | JS/TS check detection and execution into evidence |
| 62 | Done Gate | Evidence-based completion authority |
| 63 | Hash Edit Engine | Hash capture, changed-file detection, diff/rollback records, stale check |
| 64 | Runtime Loop MVP | `do -> observe/edit -> verify -> done gate -> status` |
| 65 | Simple UX | Front-door command flow and user-facing docs |
| 66 | Benchmark Seed | false-done and bugfix seed benchmarks |
| 67 | v1.6 Release Hardening | release docs, migration, final verification |

## 16. Done for M7

M7 is done when:

1. A task can be created.
2. Runtime evidence is stored under `.sunco/tasks/<task-id>/`.
3. Changed files can be tied to a task with hashes, diff, and rollback patch.
4. JS/TS verify checks can run and write evidence.
5. Done Gate blocks missing or failed evidence.
6. Runtime status shows task, risk, checks, changed files, and next action.
7. At least one false-done benchmark proves Done Gate blocks an invalid completion.
