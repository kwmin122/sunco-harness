# Phase 51 — dogfood test coverage

- **Spec alias**: v1.4/M5.2
- **Milestone**: M5 Rollout Hardening (final)
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §9 Phase 5.2
- **Requirement**: IF-17 (see `.planning/REQUIREMENTS.md` § v1.4)
- **Status**: scoped + executed (2026-04-20)

## Gate 51 v2 (two-judge convergent)

Full Gate 5 (NOT Focused+). Mandatory gate registered alongside Phase 36/38/48/49. Two-judge convergent absorbed (plan-verifier Claude + Codex); divergent resolved without v2 clarification round.

### Locked decisions

| Axis | Decision | Rationale |
|------|----------|-----------|
| G1 Dogfood target | `/sunco:proceed-gate` single surface | Phase 49 owner of finding lifecycle; most representative; rejects REST framing |
| G1 API mapping | Slash-command → synthetic REST mapping in API-SPEC.md with explicit disclaimer | Spec-literal compliance + CLI semantic honesty |
| G2 Fixture data root | `test/fixtures/*/` (repo root) | Spec §9 literal; isolation |
| G2 Test runner location | `packages/skills-workflow/src/shared/__tests__/phase51-*.test.ts` | Existing vitest convention; `src/**/__tests__/**/*.test.ts` include picks up |
| G2 Fixture count | 5 (4 spec + lifecycle split) | G6/G7 separation |
| G3 CI strategy | Path-A: zero CI file change (existing `npx vitest run` auto-picks up) | SDI-2 counter protection |
| G3 Fallback | Path-B: vitest config include extension only if Path-A fails; ci.yml direct touch last-resort | Atomic blast-radius containment |
| G4 BS2 closure | Measurement-only in `DOGFOOD-RUNTIME.md` (token_count or `unavailable, reason: ...`) | Honest partial closure; 30k enforcement → v2 |
| G5 Dogfood scope | `/sunco:proceed-gate` only; `/sunco:verify` deferred to v2 | Bounded scope |
| G6 Cross-domain fixture | `test/fixtures/cross-domain-conflict/` — 4 check types only | Codex: failure-cause isolation |
| G7 Lifecycle fixture | `test/fixtures/proceed-gate-lifecycle/` — severity × state separated from G6 | Codex: failure-cause isolation |
| G8 SDI-2 policy | Pre-planned scope separation OK; post-CI reactive additive fix allowed but triggers counter=3 → PIL 999.1 auto-promote | Codex: rework-only too strict |
| G9 Hard-lock | Unchanged (Phase 35-50 assets, schemas, hardguards, docs substantive edits, commit --amend all blocked) | v1.4 closing discipline |
| G10 v1.4 complete criterion | "active release-blocking debt 0" (wording relaxed from "active debt 0") | Codex: 20l non-blocking carry possible |
| G11 BS3 preflight (NEW) | `git branch sunco-pre-dogfood` @ `3ac0ee9` snapshot before execution | Spec §9 literal requirement; Claude Flag 3 |

### Divergent resolutions absorbed

- **G6/G7**: Codex separation wins over Claude integration (failure-cause traceability)
- **G8 SDI-2**: Codex relaxation wins over Claude strict rework-only (reactive fix allowed; PIL promotion sufficient deterrent)
- **G10 20l debt**: Codex "release-blocking" wording + Claude Path-B 2-commit fallback merged — if Path-A succeeds, 20l carries as non-blocking maintenance (PIL/v1.5 candidate); if Path-B triggered, Section 20l close opportunity handled in same atomic commit

### Flag 2 resolution (spec verbatim check)

Spec §9 L782-786 lists 4 fixtures at equal indent; "optional" qualifier does NOT appear. `ui-review-regression` is spec-mandated, NOT author addition. 4 fixtures GREEN under spec authority.

## Deliverables (Phase 51 execution)

1. **BS3 preflight**: `git branch sunco-pre-dogfood` (done 2026-04-20)
2. **Dogfood artifacts** (`.planning/phases/51-dogfood-test-coverage/`):
   - `API-SPEC.md` (/sunco:proceed-gate CLI API mapping)
   - `BACKEND-AUDIT.md` (≥5 findings processed, all explicit state)
   - `DOGFOOD-RUNTIME.md` (measurement-only BS2 closure)
3. **Fixture data** (`test/fixtures/`):
   - `frontend-web-sample/` — minimal HTML+CSS fixture with ≥10 intentional antipattern triggers (pure-black-white, single-font, flat-type-hierarchy, gradient-text, bounce-easing, dark-glow, tiny-text, all-caps-body, tight-leading, cramped-padding, ...) drawn from Impeccable's 54-antipattern pool; invokes `runDetector` via adapter; asserts ≥7 rules fire (spec §9 L782 literal)
   - `backend-rest-sample/` — 7 smells + negative case; asserts scanTarget ≥5 rules positive
   - `cross-domain-conflict/` — UI-SPEC + API-SPEC with intentional FE/BE mismatches; 4 check types fire with correct severity
   - `proceed-gate-lifecycle/` — BACKEND-AUDIT with HIGH/MED/LOW × open/resolved/dismissed lifecycle
   - `ui-review-regression/` — CLI-surface snapshot (text manifest + expected invocation shape)
4. **Test runners** (`packages/skills-workflow/src/shared/__tests__/`):
   - `phase51-frontend-web.test.ts`
   - `phase51-backend-rest.test.ts`
   - `phase51-cross-domain-conflict.test.ts`
   - `phase51-proceed-gate-lifecycle.test.ts`
   - `phase51-ui-review-regression.test.ts`
5. **51-CONTEXT.md**: this document
6. **(Optional) Smoke Section 26**: fixture manifest assertion

## Done-when (from spec §9 Phase 5.2)

- CI green on all fixtures (Path-A confirmed or Path-B applied)
- Dogfood findings ≥5 processed in `BACKEND-AUDIT.md`
- Token usage measurement recorded in `DOGFOOD-RUNTIME.md` (actual count or documented unavailability)
- Rollback procedure tested (sunco-pre-dogfood branch exists for `git reset --hard` recovery path)
- 4 fixture categories + 1 lifecycle fixture all assert green via existing smoke self-tests and vitest

## v1.4 complete declaration criteria (G10)

1. Phase 51 single atomic commit created
2. User push approval → origin reflection
3. Active release-blocking debt 0
4. Memory project_sunco_harness_v1_4.md updated: 17/17 phases, v1.4 DONE
5. `sunco-pre-dogfood` branch preserved as v1.4 complete tag candidate

## Out-of-scope (G9 hard-lock verbatim)

- finding.schema.json / cross-domain.schema.json / ui-spec.schema.json mutation
- /sunco:proceed-gate severity policy changes
- Phase 47 sunco-backend-reviewer hardguard weakening
- Phase 48-50 asset signature mutation
- Phase 50 4 docs substantive edits
- Phase 36 BS3 recovery procedure changes
- PIL 999.1 backlog pull-in (except SDI-2 3rd-trigger auto-promote)
- `git commit --amend`
- New feature creep (detector rule additions, ops-surface replacement, token enforcement)
- Full-repo self-dogfood (scope explosion)
