# Retroactive v1.4 RouteDecision Backfill — Provenance

> **Location note (Gate 55 U2 Codex-strict).** This provenance marker lives in the Phase 55 fixture tree — NOT in `.planning/router/decisions/` — to preserve audit-integrity of the durable-tier namespace. Real durable-tier RouteDecision entries are written by the runtime only (`decision-writer.mjs` promotion path per DESIGN §4.2). Synthetic retroactive entries under this directory are fixture-only and MUST NOT be copied into `.planning/router/decisions/`.

## Why retroactive backfill exists

- **Requirement source:** IF-23 (Phase 55) + DESIGN §11 31d ("Retroactive route decision log for v1.4 window; ≥5 entries")
- **Temporal context:** v1.4 Impeccable Fusion (`popcoru@0.12.0`, tag `v0.12.0`, release commit `94041a2`) completed 2026-04-20 BEFORE the Phase 52b router runtime was shipped (Phase 52b landed 2026-04-20 at `7791d33`; v1.4 shipping occurred in the same day but before the Phase 52b runtime was installed onto the main development path). v1.4 produced zero durable-tier RouteDecision entries at runtime because the classifier + decision-writer did not yet exist when v1.4 phases ran.
- **Phase 55 need:** The retroactive v1.4 compound artifact at `.planning/compound/release-v0.12.0-20260420.md` requires `source_evidence[]` entries to demonstrate the schema contract round-trips on a real historical window. Fixtures under this directory provide schema-valid RouteDecision entries that reconstruct what the classifier would have emitted for representative v1.4 events if it had existed.

## Scope of the backfill (Gate 55 L5)

- **Fixture-only.** Entries are JSON files under `retroactive-v1.4/route-decisions/*.json`. They are schema-valid per `schemas/route-decision.schema.json` (Phase 52a) but are NOT promoted to `.planning/router/decisions/`.
- **≥5 entries** spanning v1.4 M1-M5 key events (phase starts, phase closures, milestone closures, release).
- **Naming convention (Gate 55 L17):** filenames use the timestamp + stage + "-retroactive" marker suffix (e.g., `2026-04-18T120000-COMPOUND-retroactive.json`) to make provenance self-evident at evidence enumeration. No schema field added (schema remains immutable per L14).
- **Referenced by** `.planning/compound/release-v0.12.0-20260420.md`'s `source_evidence[]` array using `test/fixtures/router/retroactive-v1.4/...` paths.

## Durable tier integrity invariant

`.planning/router/decisions/` contains ONLY `.keep`. Phase 55 smoke Section 31 asserts this negatively (`.planning/router/decisions/` directory listing has exactly one entry: `.keep`). This invariant protects:

- **Data provenance**: real runtime telemetry remains cleanly distinguishable from historical reconstruction
- **Future compound-router invocations**: a user running `/sunco:compound --ref v0.12.0` against real `.planning/router/decisions/` would find no v1.4 entries (which is historically accurate — the runtime didn't exist yet)
- **Audit clarity**: post-v1.5 retrospectives can trust the durable tier as ground truth

## Why not `.planning/router/decisions/BACKFILL-PROVENANCE.md`?

Earlier Gate 55 drafts proposed this location. Codex U2 strict-side union rejected: even a sidecar README inside the durable-tier directory "muddies the real promoted telemetry namespace." The durable tier must remain pure — runtime-written entries only. Provenance belongs in the fixture tree (here) or in planning CONTEXT (55-CONTEXT.md L17).

## See also

- `.planning/phases/55-router-dogfood/55-CONTEXT.md` L5 + L17 — locked decisions for backfill path + naming convention
- `.planning/compound/release-v0.12.0-20260420.md` — consumer of these fixture entries via `source_evidence[]`
- `packages/cli/references/router/APPROVAL-BOUNDARY.md` L43 — `.planning/router/decisions/` is `local_mutate` durable log tier (runtime writes only)
