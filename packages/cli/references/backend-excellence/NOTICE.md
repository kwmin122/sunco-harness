# NOTICE — Backend Excellence

## Clean-room declaration

All content in this directory (reference documents and detector source) is original SUNCO authorship. This pack is released under **MIT** under the SUNCO-harness project license (see root `LICENSE`).

**Structural inspiration**: The per-surface reference organization (api-design, data-modeling, and so on) is structurally inspired by Paul Bakaus's Apache-2.0 Impeccable design-craft library (https://github.com/pbakaus/impeccable), but this directory contains **no content derived** from Impeccable or from other external sources without explicit attribution. The MIT license on this pack is independent of Impeccable's Apache-2.0 — no derivative-work obligations flow from structural inspiration alone.

## No third-party content

No anti-pattern taxonomies, code examples, or prose are copied or translated from external sources. Where common industry patterns are described (e.g., circuit breakers, N+1 queries, raw SQL interpolation), they reflect generally known software engineering concepts not subject to copyright; the specific wording, taxonomy ordering, and accompanying code examples are SUNCO-original.

## Detector rules

The 7 high-confidence deterministic detector rules (Phase 43/M3.2) — raw-sql-interpolation, missing-timeout, swallowed-catch, any-typed-body, missing-validation-public-route, non-reversible-migration, logged-secret — are authored from scratch by SUNCO. Regex patterns and AST matchers are original. No rule is ported from ESLint plugins, SonarQube rules, or other third-party static analysis tools.

## Third-party attribution (when added)

If any content ever requires attribution to an external source (e.g., a specific academic paper, a quoted industry report, or a referenced blog post), attribution will be added in a dedicated "Attributions" subsection with specific file references and license compatibility notes.

---

*Clean-room authorship begins with Phase 35/M1.1 scaffold (2026-04-18). Primary reference documents **populated in Phase 42/M3.1** (2026-04-18). Detector source populated in Phase 43/M3.2.*
