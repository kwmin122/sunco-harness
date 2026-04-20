# SUNCO Workflow Router — Reference Pack

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## Purpose

This reference pack defines the **contract** for the SUNCO Workflow Router: a 10-stage state machine that classifies the current workflow stage from repository evidence and recommends the next step, subject to an approval boundary that keeps auto-routing separate from auto-execution.

The reference pack is the source of truth that the Phase 52b runtime (classifier / evidence collector / confidence module / decision writer) will consume. Phase 52a ships contracts only; no runtime code lives here.

## File index

- `README.md` — this file. Purpose, file index, clean-room notice.
- `STAGE-MACHINE.md` — the 10-stage enum, forward + regress + reset transitions, and per-stage contract (entry preconditions, exit conditions, authorized mutations, forbidden mutations; PAUSE adds persistence + resume).
- `EVIDENCE-MODEL.md` — the 4 source tiers (deterministic required / deterministic derived / optional-pasted / unavailable), the 7-point Freshness Gate, and the UNKNOWN / drift policy keyed by invocation risk level.
- `CONFIDENCE-CALIBRATION.md` — the 4 confidence bands, deterministic formula with frozen weights, and enforcement invariants (determinism, monotonicity, bounds, no-LLM).
- `APPROVAL-BOUNDARY.md` — the 6 risk levels, the `repo_mutate_official` definitional class with explicit exceptions, the blessed orchestrator batched-ACK exception, and the forbidden-without-ACK hard-lock list.

## Consumer map

| Phase | Consumer | What it reads from here |
|-------|----------|-------------------------|
| 52a (this phase) | — | None; this pack is self-contained. |
| 52b | `references/router/src/classifier.mjs`, `references/router/src/evidence-collector.mjs`, `references/router/src/confidence.mjs`, `references/router/src/decision-writer.mjs`, `commands/sunco/router.md`, `workflows/router.md` | All five documents here. |
| 53 | `commands/sunco/{router,do,next,mode,manager}.md` wrappers | Stage enum + approval boundary risk levels. |
| 54 | `references/compound/src/compound-router.mjs` | Stage enum (post-stage hook target); approval boundary. |
| 55 | Router dogfood fixtures + vitest runners | All five documents (correctness reference). |
| 56 (provisional) | `workflows/release.md` sub-stage decomposition | Approval boundary (release sub-stage risk levels). |
| 57 (deferred) | `commands/sunco/auto.md` | Approval boundary + confidence bands (auto-execution gating). |

## Design source

Full design rationale, convergence history (4 rounds with plan-verifier and Codex), Patch J/K absorption, open decisions D1-D11, and v1.4 learnings incorporation table live in `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at commit `30e2041`). That file is **immutable during Phase 52a**; drift discovered during 52a is absorbed into `.planning/phases/52a-router-core-schemas/52a-CONTEXT.md` under "DESIGN errata" per Codex hard-lock.

## Phase 52a scope (what this pack is and is not)

**Is** — documentation-only contracts that Phase 52b will operationalize. Markdown + JSON Schema only. Static smoke assertions (Section 27 "Router Core Static Contract (Phase 52a)") check structural invariants: file existence, required sections, stage enum size, clean-room notice verbatim, definitional class text, etc.

**Is not** — runtime code, command files, workflows, vitest tests, skill implementations, or integration with existing SUNCO commands. Those land in Phases 52b (runtime + router command) and 53 (wrapper updates).

## Hard-locks honored in this pack

- `.github/workflows/ci.yml` untouched (v1.4 Path-A pattern continues)
- No mutations to `schemas/finding.schema.json`, `schemas/cross-domain.schema.json`, `schemas/ui-spec.schema.json`
- No mutations to existing `commands/sunco/*.md` or `workflows/*.md`
- `.claude/rules/` unchanged (router contracts are not yet promoted to enforced agent rules; that path opens via the Phase 54 compound-router approval flow)
- `/sunco:auto` family untouched (frozen until Phase 57)
- `.planning/router/DESIGN-v1.md` unchanged in Phase 52a
