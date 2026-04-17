# Changelog

All notable changes to SUNCO-harness are recorded here. This file was introduced in Phase 35/M1.1 of the v1.4 Impeccable Fusion milestone (2026-04-18).

Prior releases (v1.0 through v1.3) are summarized from git history and `ROADMAP.md`; they are not reconstructed entry-by-entry. See `.planning/ROADMAP.md` for full phase-level history.

---

## [Unreleased] — v1.4 Impeccable Fusion (in progress)

### Added

- **Phase 35 / M1.1 (2026-04-18)** — File layout + attribution scaffolding for v1.4 Impeccable Fusion milestone.
  - `packages/cli/references/impeccable/` directory skeleton with `README.md`, `SUNCO-ATTRIBUTION.md`, `NOTICE.md` placeholders. Actual Apache-2.0 vendoring of pbakaus/impeccable lands in Phase 38/M2.1.
  - `packages/cli/references/backend-excellence/` directory skeleton with `README.md`, `NOTICE.md` (clean-room declaration). 8 reference documents and 7-rule detector populated in Phase 42/M3.1 and Phase 43/M3.2.
  - `packages/cli/schemas/` directory skeleton with `README.md` explaining the SPEC-BLOCK convention and schema versioning (version 1 for v1.4). Individual schemas populated in Phases 40, 45, 46, 48.
  - `CHANGELOG.md` (this file) established as the canonical release log.

### Planning

- Planning artifacts reconciled — `docs(planning): reconcile v1.3 planning state` (commit `00b33c4`).
- v1.4 initialized — `docs(planning): initialize Impeccable Fusion v1.4 — 17 phases (35-51)` (commit `47393b7`).
- Spec locked at commit `6e6761a` (`docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md`, 1146 lines, 4-round cross-model ping-pong + gate pass).

## Historical summary

### v1.3 Consolidation & Pivot Absorption (closed 2026-04-18)

Phase 22 Ultraplan Integration → Phase 34 Codex Layer 6 Integration. Advanced through 2026-04-13. Candidate phases 23a (Debug Iron Law), 23b (Review Army), 29 (AST-Grep), 31 (Hashline Stale-Edit Guard) preserved as historical — closed as superseded by v1.4 Impeccable Fusion direction.

### v1.2 Light Harness (completed 2026-04-06)

Phase 17 Context Intelligence → Phase 21 Cross-Session Intelligence. Requirements LH-01 through LH-24.

### v1.1 Operational Resilience + CI/CD (completed 2026-03-30)

Phase 11 Planning Quality Pipeline → Phase 14 Context Optimization. Phases 15 Document Generation and 16 Skill Marketplace deferred past v1.2.

### v1.0 Core Platform → v1.0 Debugging (completed earlier)

Phases 1 Core Platform → 10 Debugging. CLI engine, skill system, state engine, agent router, recommender, verification pipeline, shipping and milestones lifecycle, composition and debug primitives.
