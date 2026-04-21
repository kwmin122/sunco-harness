# Router Dogfood Fixtures (Phase 55)

This directory holds the 5 deterministic fixture scenarios that exercise the SUNCO Workflow Router (Phase 52a/52b classifier + evidence + confidence + decision-writer) and the compound-router (Phase 54 schema + runtime + sink-proposer) end-to-end.

## Fixture tree layout (Gate 55 L2 γ hybrid)

```
test/fixtures/router/
  README.md                           — this file
  01-greenfield-brainstorm/
    route-decisions/*.json            — input RouteDecisions (Phase 52a schema-valid)
    expected.json                     — unified oracle (stage + confidence band + risk_level + compound decision)
  02-bugfix-work/
    route-decisions/*.json
    expected.json
  03-release-compound/
    route-decisions/*.json
    expected.json
    expected-compound.md              — rendered compound artifact oracle (WRITE scenarios only)
  04-incident-recovery/
    route-decisions/*.json
    expected.json
    expected-compound.md
  05-milestone-close/
    route-decisions/*.json
    expected.json
    expected-compound.md
  retroactive-v1.4/
    route-decisions/*.json            — ≥5 retroactive RouteDecision entries for v1.4 window (Gate 55 L5 fixture-only backfill)
    BACKFILL-PROVENANCE.md            — Codex U2 provenance marker (fixture tree, NOT .planning/router/decisions/)
```

## Scenario index (DESIGN §10)

| # | Scenario | current_stage | confidence | compound trigger |
|---|----------|---------------|------------|------------------|
| 1 | greenfield new feature | BRAINSTORM | ≥0.80 | SKIP |
| 2 | bugfix mid-phase | WORK | ≥0.80 | SKIP |
| 3 | release completion | COMPOUND | 1.00 | WRITE (always-on RELEASE +6) |
| 4 | incident recovery | COMPOUND | ≥0.75 | WRITE (score ≥5 via CI-recovery + rollback + post-judge fix) |
| 5 | milestone close | COMPOUND | 1.00 | WRITE (always-on MILESTONE CLOSED +5) |

All 5 scenarios' `expected.json.risk_level` is `local_mutate` for the COMPOUND stage (Gate 55 U1 Codex-strict per APPROVAL-BOUNDARY.md L18+L47 + commands/sunco/compound.md L89). Scenarios 1/2 use the value emitted by the live classifier on fixture inputs (Gate 55 L6).

## Retroactive v1.4 backfill (Gate 55 L5)

`retroactive-v1.4/route-decisions/*.json` contains ≥5 RouteDecision fixture entries spanning the v1.4 window (2026-03-27 → 2026-04-20). These are **fixture-only** — not written to `.planning/router/decisions/` (durable tier). Provenance declared at `retroactive-v1.4/BACKFILL-PROVENANCE.md`.

The retroactive compound artifact at `.planning/compound/release-v0.12.0-20260420.md` references these fixture paths in its `source_evidence[]` array (prefixed `test/fixtures/router/retroactive-v1.4/...` per Gate 55 L17 naming convention).

## Consumer: `packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts`

The vitest runner reads each scenario's `route-decisions/*.json` + `expected.json` and asserts classifier + compound-router output matches the oracle. Scenarios 3/4/5 additionally validate `expected-compound.md` structurally.

Fixtures are **deterministic**: same input → same output byte-identical across 100 iterations (parallels 27p confidence determinism + 30 compound-router scoring determinism).
