# Phase 42 — backend reference docs

- **Spec alias**: v1.4/M3.1
- **Milestone**: M3 Backend Excellence
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` § Phase 3.1 (under §7)
- **Requirement**: IF-08 (see `.planning/REQUIREMENTS.md` § v1.4)
- **Status**: **Populated 2026-04-18.** Gate 42 (Backend Clean-Room) passed GREEN-CONDITIONAL; conditions absorbed.

## Goal

Author 8 clean-room backend-excellence reference documents (`packages/cli/references/backend-excellence/reference/*.md`) covering the backend surfaces that the M3.4–M3.6 agents (`backend-phase-*`, `backend-review-*`) will consume. No detector code, no workflow wiring, no Impeccable content derivation — structural inspiration only.

## Scope in

- 8 reference files under `reference/` subdirectory:
  - `api-design.md`
  - `data-modeling.md`
  - `boundaries-and-architecture.md`
  - `reliability-and-failure-modes.md`
  - `security-and-permissions.md`
  - `performance-and-scale.md`
  - `observability-and-operations.md`
  - `migrations-and-compatibility.md`
- `NOTICE.md` status-line update + MIT license clarification
- `README.md` status flip + Phase 43 one-liner + load-strategy table
- Smoke test Section 17 (backend-excellence authoring verification) — does not touch Sections 1–16

## Scope out (do not pull in)

- Phase 43/M3.2 — deterministic detector `src/detect-backend-smells.mjs` (7 rules)
- Phase 44/M3.3 — discuss-backend teach (populates `SUNCO:DOMAIN-BACKEND` marker)
- Phase 45–47 — `backend-phase-{api,data,event,ops}` + `backend-review-{api,data,event,ops}` activation
- Backend dispatcher (Phase 37) / R3 domain-backend marker — **frozen**
- Frontend surfaces (`ui-phase-web`, `ui-review-web`, `sunco-ui-*`) — **frozen**
- Impeccable vendored source under `references/impeccable/source/` — **pristine, R5 hard**
- PIL 999.1 backlog — deferred to Phase 52/M5

## Key decisions (Gate 42 outcomes)

### Clean-room boundary (A1)
- Structural inspiration from Impeccable only (per-domain reference organization, anti-pattern/principles/rubric layout)
- **No Impeccable text copied or paraphrased.** Common industry vocabulary (N+1, circuit breaker, CSRF) is OK; Impeccable-specific frontend phrases are blacklisted.
- Reverse-R5: backend refs MUST NOT reference paths inside `packages/cli/references/impeccable/source/` or the `.impeccable.md` sentinel.

### Structure (A2 — spec-locked)
- **8 files exactly** (spec §7 Phase 3.1 table)
- Each file: `## Overview` / `## Anti-patterns` / `## Principles` / `## Rubric` / `## References`
- Each anti-pattern (`### <kebab>`): `**Smell:**` / `**Example (bad):**` (fenced code) / `**Why wrong:**` / `**Fix:**` (fenced code) / `**Detection:**` (deterministic candidate | heuristic | human-review only)
- Anti-patterns: cover spec §7 required kebab list verbatim per file; additions allowed, omissions disallowed.

### Authorship + NOTICE (A3)
- **LICENSE: MIT** (root `LICENSE` is MIT; `packages/cli/package.json` is MIT — backend-excellence is SUNCO-original clean-room content, so MIT independent of Impeccable's Apache-2.0)
- NOTICE.md: "MIT under project license, structurally inspired by pbakaus/impeccable; no content derived" — updated 2026-04-18
- No derivative-work obligations flow from structural inspiration alone

### Token/context budget (A4)
- Authoring scope only — actual loader wiring is Phase 45–47
- README includes recommended load strategy per surface (primary 2–3 refs + secondary 2 per invocation; no "always load all 8" pattern)
- Full-8 load reserved for cross-domain audits (Phase 48–49)

### Quality bar (A5)
- **Spec-required (hard):** ≥5 anti-patterns incl. spec §7 baseline list; ≥3 principles; rubric; 1500–3000 words; code examples in anti-patterns.
- **Author-added (negotiable):** ≥3 credible references per file (RFCs where directly relevant, otherwise canonical books/papers/official docs/vendor-neutral standards; **no blog posts as primary authority**); determinism label per anti-pattern; principles in positive framing; rubric items binary yes/no.
- Judge A5 relaxed from "RFCs with numbers, min 3" to the above — rationale: not all backend domains are RFC-centric (data modeling, observability practice often depend on books/standards rather than IETF drafts).

### Smoke / provenance (A6 — Section 17)
- Sections 1–16 frozen. Smoke delta = Section 17 additions only.
- Verification:
  1. 8 files exist at `reference/<name>.md`
  2. Each has all 5 section headers (`## Overview` through `## References`)
  3. Each has ≥5 `### ` anti-pattern sub-headers
  4. Each includes spec §7 required kebab names (verbatim match)
  5. Each has ≥3 items under `## Principles`
  6. Word count 1500–3000 per file
  7. Each anti-pattern has a `**Detection:**` label
  8. Reverse-R5: no `references/impeccable/source/` path strings and no `.impeccable.md` inside `reference/*.md`
  9. Impeccable-term blacklist (exact finite strings): `side-tab`, `overused-font`, `gradient-text`, `dark-glow`, `icon-tile-stack` — grep 0 hits
  10. NOTICE.md footer contains "populated in Phase 42" marker
- Blacklist policy: exact-match, finite, Impeccable-specific frontend phrases only. No broad industry terms (pagination/cache/contrast/layout remain allowed).

## Escalate triggers

If any of the following surface during authoring, STOP and report to user:
1. Pressure to copy/paraphrase Impeccable text
2. Backend detector code requested inside Phase 42 (that's Phase 43)
3. Existing command/workflow behavior change requested (Phase 35–41 frozen)
4. Token budget pressure → "always load all 8" strategy
5. NOTICE/license status becomes ambiguous
6. Phase 37 backend dispatcher / R3 marker edits requested
7. Additional reference files beyond the 8 (e.g., glossary, principles-only doc)

## Rollback anchor

Pre-Phase-42 HEAD: `cff6eac` (Phase 41 merged) — stable checkpoint. `rollback/pre-v1.3-decision` tag remains.

## Judge relay summary

Two independent judges (plan-verifier + impl-judge) converged GREEN-CONDITIONAL with identical conditions:
- A5 References: relax RFC-number requirement → accept RFCs/books/papers/standards, minimum 3, no blogs
- A6 Blacklist: exact finite Impeccable-specific strings only, no broad industry terms
- A3 LICENSE: MIT confirmed (both judges verified root LICENSE + package.json)
- Determinism label per anti-pattern: approved (Phase 43 detector-scoping input)
- Phase 43 forward-ref: README one-liner only, no `src/` stub creation

Gate 42 → GREEN (after conditions absorbed).
