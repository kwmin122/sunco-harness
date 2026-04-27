# Phase 58 — Runtime Architecture Contract

Status: implemented and registered
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Date: 2026-04-26

## Context

v1.5 completed the SUNCO Workflow Router: deterministic stage routing, approval-boundary enforcement, compound-router, release sub-stage envelopes, and constrained `/sunco:auto`.

The next milestone changes the center of gravity. SUNCO must stop presenting itself primarily as a large skill pack and become a proof-first runtime: a system that owns task state, evidence, edit records, verification results, and done decisions.

Phase 58 locks that architecture before runtime implementation begins.

## Product Definition

SUNCO is a proof-first AI coding runtime.

SUNCO blocks `done` unless the task has evidence.

Product laws:

1. No evidence, no done.
2. No approval, no risky mutation.
3. No stale context, no edit.
4. No hidden failure, no ship.
5. No uncontrolled loop, no auto.
6. No undocumented decision, no trust.

## Locked Decisions

| ID | Decision |
| --- | --- |
| L1 | M7 name is **Proof-first Runtime Foundation**. |
| L2 | M7 goal is: `SUNCO blocks "done" unless the task has evidence.` |
| L3 | Phase 58 produces an architecture contract, not runtime implementation. |
| L4 | Initial package set is limited to `core`, `runtime`, `evidence`, `verifier`, `edit-engine`, and existing `cli`. |
| L5 | `policy` remains inside `core/runtime` until it grows enough to justify a package split. |
| L6 | `agent-adapter`, `code-intel`, and `benchmark` start as interfaces or seeds, not full packages. |
| L7 | Evidence Store and Done Gate schemas precede Verify Engine implementation. |
| L8 | Verify Engine is a completion-evidence producer, not just a command runner. |
| L9 | Hash Edit Engine must land in M7; otherwise SUNCO becomes only a verification runtime, not a coding runtime. |
| L10 | M7 excludes TUI, Studio/web UI, full LSP, marketplace, multi-agent runtime, and all-language verifier support. |
| L11 | First vertical slice must run end to end: task -> edit evidence -> verify evidence -> done gate. |
| L12 | v1.5 router remains an input to runtime decisions; M7 does not re-implement the router. |

## Scope

In scope for Phase 58:

- `docs/architecture/runtime-foundation.md`
- M7 ROADMAP registration
- M7 REQUIREMENTS registration
- STATE transition to v1.6/M7 kickoff
- README positioning update from command-count framing to proof-first framing

Out of scope for Phase 58:

- New runtime package implementation
- New command behavior
- Smoke section additions
- Vitest additions
- npm publish
- TUI or web UI

## M7 Phase Plan

| Phase | Name | Output |
| --- | --- | --- |
| 58 | Runtime Architecture Contract | Architecture document + planning registration |
| 59 | Core Types + Schemas | Runtime core records |
| 60 | Evidence Store | `.sunco/tasks/<task-id>/` persistence |
| 61 | Verify Engine | JS/TS check detection and evidence-producing execution |
| 62 | Done Gate | Completion authority over evidence |
| 63 | Hash Edit Engine | Hash, diff, rollback, stale detection |
| 64 | Runtime Loop MVP | `do -> verify -> done gate -> status` |
| 65 | Simple UX | Front-door command flow |
| 66 | Benchmark Seed | false-done and bugfix benchmarks |
| 67 | v1.6 Release Hardening | release docs and final verification |

## Done When

1. Runtime architecture contract exists.
2. Architecture contract includes product constitution.
3. Architecture contract defines package boundaries.
4. Architecture contract defines task lifecycle.
5. Architecture contract defines evidence lifecycle.
6. Architecture contract defines Done Gate.
7. Architecture contract defines Verify Engine.
8. Architecture contract defines Edit Transaction.
9. Architecture contract defines approval/policy relation.
10. Architecture contract defines runtime loop MVP.
11. Architecture contract defines CLI command contract.
12. Architecture contract defines benchmark seed contract.
13. Deferred surfaces are explicit.
14. ROADMAP registers M7 phases 58-67.
15. REQUIREMENTS registers IF-24 and later M7 requirements.
16. STATE points to v1.6/M7 Phase 58 kickoff.
17. README top-level positioning says proof-first runtime, not command-count-first skill pack.

## Handoff

Phase 59 should implement core runtime types and schemas only. It should not open the Evidence Store or Verify Engine until the data model is stable.
