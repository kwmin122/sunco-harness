# Phase 55 — Router Dogfood (5 fixture scenarios + retroactive v1.4 backfill)

- **Spec alias**: v1.5/M6 Phase 55 (fifth phase of v1.5 committed set; first end-to-end dogfood of producer-consumer contract across Phase 52a/52b/53/54 assets)
- **Milestone**: M6 SUNCO Workflow Router
- **Design source**: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at commit `30e2041`; IMMUTABILITY extended through Phase 55 per Gate 52b B2 / Phase 53 L16 / Phase 54 L16 continuation — drift observed during Phase 55 absorbed in this CONTEXT under "DESIGN errata / ROADMAP drift" section, NOT patched into `DESIGN-v1.md` or `ROADMAP.md`)
- **Requirement**: IF-23 (router dogfood: 5 fixture scenarios + retroactive v1.4 compound artifact + route decision log backfill)
- **Status**: Gate 55 v1 convergent GREEN-CONDITIONAL absorbed (Reviewer Claude: 4 blocking B1/B2/B3/B4 + 3 drift dispositions D1/D2/D3 + rollback anchor approval + mid-milestone gate recognition; Codex: 1 blocking U1 risk_level misclassification + 1 medium U2 provenance-location + layout disposition confirmations + non-blocking D3 README drift observation; no RED; no divergent-blocking requiring v2 relay; strict-side union on U1 risk_level correction + U2 provenance relocation). Construction proceeding; 2-commit pre-planned split (scaffold + runtime).

## Phase 55 character

**First dogfood phase in v1.5; first end-to-end exercise of the Phase 52a/52b/53/54 producer-consumer contract.** Phase 52a shipped router contracts (schemas + 5 reference docs). Phase 52b shipped the runtime engine (4 modules + `/sunco:router` thin command + `workflows/router.md` deterministic pipeline). Phase 53 connected 4 entry-point wrappers (`/sunco:do`, `/sunco:next`, `/sunco:mode`, `/sunco:manager`) + mode hook to that engine. Phase 54 added the compound-router as a post-stage durable-decision consumer (schema + 2 src + command + workflow + 2 READMEs + template).

Phase 55 **does not add** new producer/consumer code. It adds:

1. **5 deterministic fixture scenarios** under `test/fixtures/router/<scenario>/` that exercise the Phase 52b classifier + confidence + Phase 54 compound-router + sink-proposer on scenario-specific RouteDecision inputs.
2. **Vitest runner** `packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts` with 5 `describe` blocks asserting `current_stage` + `confidence` band + `approval_envelope.risk_level` + compound trigger expectation per DESIGN §10.
3. **Retroactive v1.4 compound artifact** `.planning/compound/release-v0.12.0-20260420.md` — schema-valid (conforms to `schemas/compound.schema.json` locked in Phase 54) with `status: proposed` and 8 populated sections drawn from real v1.4 M1-M5 retrospective content.
4. **Retroactive RouteDecision log backfill** (≥5 entries per DESIGN §11 31d) under `test/fixtures/router/retroactive-v1.4/route-decisions/*.json` — **fixture-only** (per Gate 55 B1 Codex-strict; durable tier `.planning/router/decisions/` preserved empty with a `BACKFILL-PROVENANCE.md` placed in the fixture tree, NOT in the durable directory).
5. **Smoke Section 31** `[55-dogfood]` additive block (~22-28 checks) asserting fixture presence + schema validity of retroactive artifact + RouteDecision count + Phase 52a/52b/53/54 byte-stability (content-marker parity).

Phase 55 is the **mid-milestone review gate** event per DESIGN §9. Phase 55 closure drives Phase 56/57 scope confirmation. FAIL → replan; no auto-continue.

Full Gate 5 scrutiny inherited (novel risk vectors per DESIGN §14): dogfood determinism, producer-consumer contract preservation, historical-accuracy vs synthetic-reconstruction discipline, audit-integrity of durable telemetry namespace, 3-role strict-side union continuation.

## Gate 55 v1 — convergent absorption log

### Round 1 — Implementer v1 request (12 axes G1-G12 + pre-first-mutation anchor + 3 drift findings)

12 axes submitted inline (G1 5 scenarios / G2 vitest runner / G3 retroactive v1.4 artifact / G4 backfill path / G5 artifact status / G6 fixture layout / G7 smoke Section 31 / G8 self-test vs vitest / G9 hard-locks / G10 commit shape + SDI-2 / G11 mid-milestone gate / G12 Phase 56 handoff). 3 drift findings surfaced: D1 ROADMAP L541 "Section 30" offset (Phase 54 D2 continuation), D2 kickoff-proposed fixture layout vs 54-CONTEXT L203 "route-decisions/*.json + expected-compound.md" contract, D3 54-CONTEXT L3/L20 2-section commentary vs workflows/compound.md L14 + schema.sections 3-bucket runtime (plus references/compound/README.md L76-L77 same 2-section phrasing). Pre-first-mutation rollback anchor recommendation: `git branch sunco-pre-54-landed 8e22c9d` (4th iteration).

### Round 2 — Two-gate convergent (Codex + Reviewer Claude)

Both verdict: **GREEN-CONDITIONAL**. No RED. No divergent-blocking requiring v2 relay. Strict-side union applied on 2 axes where Codex tightened Reviewer's positions:

**U1 — G1 risk_level misclassification (Codex strict, BLOCKING)**:
- Reviewer + Implementer v1: scenarios 3/4/5 `approval_envelope.risk_level = repo_mutate_official` (COMPOUND stage → official class)
- Codex: **WRONG contract**. `.planning/compound/*.md` draft artifact writes are explicitly `local_mutate` per `APPROVAL-BOUNDARY.md` L18 ("local_mutate: ... `.planning/compound/*.md` draft artifact writes") + L47 ("explicit exceptions: ... `.planning/compound/*.md` **draft** writes by compound-router — `local_mutate`") + `commands/sunco/compound.md` L89 ("Only `.planning/compound/*.md` auto-write is authorized"). Setting scenarios 3/4/5 risk_level to `repo_mutate_official` would encode the wrong contract in the dogfood oracles and propagate a false invariant into future consumers.
- **Absorbed (Codex strict)**: All 5 scenarios have `risk_level: local_mutate` in expected.json. The COMPOUND stage action (auto-write of `.planning/compound/*.md`) is semantically `local_mutate` by explicit class exemption; post-approval sink writes (back into memory/rules/backlog) would cross back into `repo_mutate_official` but are OUT OF SCOPE for Phase 55 dogfood (sink proposals remain proposal-only; no sink writes in the fixture pipeline).

**U2 — G4 BACKFILL-PROVENANCE location (Codex strict, MEDIUM)**:
- Reviewer + Implementer v1: Place `BACKFILL-PROVENANCE.md` inside `.planning/router/decisions/` directory to mark the deliberate emptiness of real durable telemetry for the v1.4 window
- Codex: Even a sidecar README inside the durable-tier directory "muddies the real promoted telemetry namespace". Durable tier must remain pure — runtime-written entries only. Provenance belongs in the fixture tree or in 55-CONTEXT.md.
- **Absorbed (Codex strict)**: `BACKFILL-PROVENANCE.md` lives at `test/fixtures/router/retroactive-v1.4/BACKFILL-PROVENANCE.md` (fixture tree). `.planning/router/decisions/` continues to hold only `.keep` (no sidecar). This CONTEXT.md also documents the provenance decision in the "Locked decisions" section below for discoverability.

Codex layout disposition (G6) confirms γ hybrid (flat `route-decisions/` per 54-CONTEXT L203 + `expected.json` unified oracle + `expected-compound.md` for scenarios 3/4/5 only + **no per-scenario README.md** by default; top-level `test/fixtures/router/README.md` only).

### Locked decisions (Phase 55 v1)

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | **5 fixture scenarios per DESIGN §10 table** (G1 convergent; U1 risk_level correction absorbed) | Scenario dirs under `test/fixtures/router/`: `01-greenfield-brainstorm/` (BRAINSTORM, confidence ≥0.80, local_mutate, compound SKIP), `02-bugfix-work/` (WORK, ≥0.80, local_mutate, SKIP), `03-release-compound/` (COMPOUND, 1.00, local_mutate, WRITE always-on RELEASE +6), `04-incident-recovery/` (COMPOUND, ≥0.75, local_mutate, WRITE score ≥5 via CI-recovery +2 + rollback +2 + post-judge fix +3), `05-milestone-close/` (COMPOUND, 1.00, local_mutate, WRITE always-on MILESTONE CLOSED +5). All 5 scenarios use `local_mutate` (U1 Codex-strict correction). Deterministic: same fixture → byte-identical output per run (parallels 27p confidence + 30 scoring determinism). |
| L2 | **γ hybrid fixture layout** (G6 convergent; B3 Reviewer + Codex-confirmed) | `test/fixtures/router/<scenario>/route-decisions/*.json` (flat per 54-CONTEXT L203; 5+ schema-valid RouteDecision inputs per scenario) + `test/fixtures/router/<scenario>/expected.json` (unified oracle for all 5: `current_stage`, `confidence_band`, `risk_level`, `compound_decision` = SKIP\|WRITE\|CANDIDATE, `compound_score` range) + `test/fixtures/router/<scenario>/expected-compound.md` (scenarios 3/4/5 only; rendered compound artifact oracle for byte-compare or structural parse). Single `test/fixtures/router/README.md` top-level (no per-scenario READMEs per Codex G6 recommendation). |
| L3 | **Vitest runner at skills-workflow shared tests** (G2 convergent; Phase 51 location precedent) | File: `packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts`. 5 `describe` blocks (one per scenario). Each `it` block asserts oracle fields from `expected.json` against black-box invocation of `classifier.mjs` + `compound-router.mjs` + `sink-proposer.mjs` runtime modules (no new export surface added in Phase 55). Vitest count delta: 1099 → 1099+N (expected N ≈ 20-25 covering per-scenario assertions). |
| L4 | **Retroactive v1.4 compound artifact at `status: proposed`** (G3 + G5 convergent; Codex B2 confirmed) | Path: `.planning/compound/release-v0.12.0-20260420.md`. Frontmatter schema-valid: `kind: compound`, `version: 1`, `scope: release`, `ref: v0.12.0`, `window: {from: 2026-03-27T00:00:00Z, to: 2026-04-20T00:00:00Z}` (v1.4 M1 start → v1.4 shipping), `status: proposed` (matches compound-router natural auto-write lifecycle per schema L66 "proposed: auto-written by compound-router at status=proposed; awaits user review of sink proposals"), `source_evidence: [5 fixture paths under test/fixtures/router/retroactive-v1.4/route-decisions/...]`, `sections: [context, learnings, patterns_sdi, rule_promotions, automation, seeds, memory_proposals, approval_log]`, `clean_room_notice: true`, `generated_by: sunco-compound-router`. 8 populated markdown sections drawn from real v1.4 M1-M5 retrospective (8 learnings absorbed; real SDI patterns; real rule promotions — no synthetic hallucination). |
| L5 | **Fixture-only retroactive RouteDecision backfill** (G4 / B1 / U2 Codex-strict) | Path: `test/fixtures/router/retroactive-v1.4/route-decisions/*.json` (≥5 entries per DESIGN §11 31d). Each entry schema-valid per `schemas/route-decision.schema.json`. `.planning/router/decisions/` durable tier continues to hold ONLY `.keep` (no sidecar README, no synthetic entries). Provenance declared at `test/fixtures/router/retroactive-v1.4/BACKFILL-PROVENANCE.md` (U2 Codex-strict relocation — outside durable tier). IF-23 literal "route decision log backfill for v1.4 window" + DESIGN §11 31d "≥5 entries" satisfied via fixture path count. Audit integrity of durable-tier namespace preserved: real promoted telemetry only. |
| L6 | **Scenario risk_level uniformly `local_mutate`** (U1 Codex-strict) | All 5 scenarios have `expected.json.risk_level = local_mutate`. The classifier emits `approval_envelope.risk_level` based on the action command's write class. For BRAINSTORM (scenario 1) the action writes to `.sun/router/brainstorm-*.md` scratch (local_mutate per APPROVAL-BOUNDARY). For WORK (scenario 2) the action writes source code under `packages/` — **note**: raw WORK is `repo_mutate` not `local_mutate`; scenario 2 uses the classifier's PLAN-completed-WORK-starting flow where action recommends `/sunco:execute` which is a **blessed orchestrator** (batched-ACK exception). Risk_level in RouteDecision for that recommendation is `local_mutate` only if the next action is a local read/scratch step; otherwise the classifier may emit a higher level. **Oracle must match whatever the live classifier emits** — we will assert the expected.json against classifier's actual output on fixture inputs (not against a pre-written expected value that might drift). If the classifier emits `repo_mutate_official` for scenario 2, the oracle is updated to match; the uniformly-local_mutate claim above applies to the COMPOUND stage scenarios 3/4/5 (U1 Codex-strict; bounded class). **Scenarios 1/2 oracle: risk_level taken from classifier's actual deterministic output against fixture inputs.** |
| L7 | **NO new runtime code; NO new module exports** (G8 + G9 hard-lock) | Phase 55 adds ZERO runtime modules and ZERO new exports. Phase 54 self-tests (compound-router 42 + sink-proposer 21) already cover unit-level correctness. Phase 55 integration tests consume existing exports as black boxes via relative imports (`../../../../../packages/cli/references/router/src/classifier.mjs` + `../../../../../packages/cli/references/compound/src/compound-router.mjs` etc., same import pattern as existing 4 router vitest files). Self-test count stays at **249/249**. |
| L8 | **Smoke Section 31 `[55-dogfood]` ~22-28 checks** (G7 convergent) | Section name: `Section 31 — Router Dogfood (Phase 55)`. Coverage: 5 fixture dir presence (loop check) + each scenario has `route-decisions/` subdir + `expected.json` + (3/4/5 only) `expected-compound.md`; vitest file `router-dogfood.test.ts` present + 5 describe blocks; retroactive v1.4 compound artifact: file exists + schema-valid + 8 sections present + `status: proposed` + `clean_room_notice: true` + `source_evidence[]` non-empty; retroactive RouteDecision log ≥5 entries at fixture path; `.planning/router/decisions/` contains ONLY `.keep` (negative-write assertion; BACKFILL-PROVENANCE.md NOT in durable tier per U2); `BACKFILL-PROVENANCE.md` present at fixture path (positive presence); Section 27/28/29/30 byte-stable (content-marker parity grep, parallels 28r/29r/30s/30t/30u); Phase 52a+52b+53+54 runtime assets byte-stable (cumulative content-marker grep). Estimated 24 checks. |
| L9 | **Pre-planned 2-commit split; NOT SDI-2** (G10 convergent; B4 + Codex-confirmed) | **Commit A** = `docs(router): scaffold Phase 55 dogfood context and fixture skeleton` (planning scope; 55-CONTEXT + STATE prose D1-fix + smoke Section 31 header block only + 5 scenario directory scaffolds via `.keep` files + retroactive-v1.4 scaffold + top-level fixture README). **Commit B** = `feat(router): add Phase 55 dogfood vitest runner and retroactive v1.4 backfill` (runtime scope; vitest file + full fixture route-decisions + expected.json × 5 + expected-compound.md × 3 + retroactive v1.4 compound artifact + fixture retroactive RouteDecisions × 5 + BACKFILL-PROVENANCE.md + Section 31 populated + STATE progress bump 4→5 / 57→71). Classification in both commits: **NOT SDI-2** per Gate 52b B4 + Phase 53/54 precedent. SDI-2 counter stays at **2**. |
| L10 | **Rollback anchor `sunco-pre-54-landed @ 8e22c9d`** (Gate approved; pre-first-mutation) | Created before first file write. Non-destructive local branch ref; 4th iteration of per-phase-landed anchor pattern (parallels `sunco-pre-dogfood @ 3ac0ee9` + `sunco-pre-52b-landed @ 4b1e093` + `sunco-pre-53-landed @ 72a391a`). Branch ref is not file state; does not belong in any commit. Preserved across Phase 55 lifetime. |
| L11 | **Phase 52a+52b+53+54 runtime assets byte-stable** (L16 hard-lock extension) | Zero mutation to: 5 router ref docs + route-decision schema + .keep (52a); 4 router runtime modules + router.md command + workflows/router.md (52b); 4 wrappers + mode hook (53); compound schema + 2 compound src + compound.md command + workflows/compound.md + 2 compound READMEs + template + `.planning/compound/README.md` (54). Enforced via Section 31 content-marker parity grep. |
| L12 | **R1 regression guarantee — 8-command stage protection** (Phase 54 L11 extension) | Phase 55 ADDS zero stage commands. R1 protection covers 8 stage commands (`brainstorming/plan/execute/verify/proceed-gate/ship/release/compound`) byte-identical from `8e22c9d`. Pre-commit invariant: `git diff --name-only 8e22c9d..HEAD -- packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release,compound}.md \| wc -l == 0`. |
| L13 | **Namespace clarification continuation (architecture.md DEFER NO TOUCH)** (Codex U4 Phase 54 5th iteration) | Agent Router + Workflow Router + compound-router namespaces unchanged. `.claude/rules/architecture.md` **NOT touched** in Phase 55 (5th consecutive defer iteration; Phase 56 provisional or v1.5 maintenance backlog target). Observational: 5 consecutive defers is a strong signal; formalization candidate for v1.5-closure meta-retrospective. |
| L14 | **DESIGN / ROADMAP errata absorbed in this CONTEXT, not patched** (L16 immutability extension) | DESIGN §11 L586 Section 31 assignment vs L488 phase table "Section 30" for Phase 55 = internal DESIGN inconsistency, resolved in favor of L586 (actual Section 31 implementation). ROADMAP L541 "smoke Section 30" = same pre-split offset. DESIGN-v1.md NOT modified. ROADMAP.md NOT modified. Drift recorded under D1 below. |
| L15 | **3-role cross-phase learning: observational-only** (Phase 53 N1/N2 + Phase 54 L15 continuation) | Gate 55 Codex-strict union count = 2 (U1 risk_level correction + U2 provenance relocation). This is a smaller delta than Phase 54 (4 strict-side unions) because Phase 55 scope is narrower (dogfood, no new runtime). Pattern accumulation: Phase 53 (2 unions) + Phase 54 (4) + Phase 55 (2) = 8 fixture instances of Codex tightening Reviewer positions. **Formalization STILL deferred** to v1.5-closure meta-retrospective per L15 precedent continuation. Observational-only in Phase 55. |
| L16 | **STATE.md bookkeeping pattern** (Phase 53/54 precedent) | Commit A = prose update only (Current Position narrative for Phase 55 entry; frontmatter unchanged at `completed_phases: 4` / `percent: 57`). Commit B = frontmatter bump (`completed_phases: 4 → 5`, `percent: 57 → 71`) + final prose confirmation. git-state-determined wording preserved (no "push awaits" / "On push LANDED" current-tense claims). |
| L17 | **Retroactive v1.4 `source_evidence[]` fixture path naming (Codex O2 absorbed)** | Entries in `source_evidence[]` use fixture paths with `retroactive-` prefix (e.g., `test/fixtures/router/retroactive-v1.4/route-decisions/2026-03-27T010000-PLAN.json`). The naming convention makes provenance self-evident at evidence enumeration — no need for a schema field addition (which would violate L16 immutability). Paired with BACKFILL-PROVENANCE.md marker at fixture tree root for additional discoverability. |
| L18 | **Mid-milestone gate is a separate event from Gate 55** (G11 convergent) | Gate 55 = Phase 55 pre-construction gate (this round; completed). Mid-milestone gate = post-Phase-55-landing convening event per DESIGN §9 (between Phase 55 and Phase 56). Phase 55 closure triggers mid-milestone gate convening, which drives Phase 56/57 scope confirmation. FAIL at mid-milestone → replan 56/57. Temporal separation critical: Phase 55 Gate operates on dogfood design correctness; mid-milestone operates on dogfood outcome quality. |

## DESIGN errata / ROADMAP drift (observational; not patched)

**D1 — DESIGN §11 L586 Section 31 vs DESIGN §9 L488 "Section 30" for Phase 55 (and ROADMAP L541 "smoke Section 30")**: DESIGN-v1.md has internal inconsistency between L488 phase table ("Phase 55 | Router dogfood | ... smoke Section 30") and L586 header ("Section 31 — Dogfood (Phase 55)"). ROADMAP L541 follows L488 ("smoke Section 30"). Actual implementation follows L586 (Section 31) because Phase 54 took Section 30 ([54-compound] landed at `8e22c9d`). This is a continuation of the Phase 54 D2 errata pattern: pre-split DESIGN §11 allocation assumed 1 section per phase including 52a/52b as a single Phase 52; the split pushed each downstream section by +1. Known absorbed offset. Disposition: DESIGN-v1.md NOT modified (L16 immutability); ROADMAP.md NOT modified (L16). Errata logged here. Non-blocking.

**D2 — 54-CONTEXT L203 fixture contract absorbed via γ hybrid**: 54-CONTEXT L203 Phase 55 compatibility contract prescribes `test/fixtures/router/<scenario>/route-decisions/*.json` + `expected-compound.md`. Kickoff G6 proposed `inputs/route-decisions/*.json` + `expected.json` + per-scenario `README.md`. Gate 55 γ hybrid (L2): flat `route-decisions/` (literal L203) + `expected.json` unified oracle (kickoff usability; all 5 scenarios) + `expected-compound.md` for 3/4/5 only (literal L203) + no per-scenario README (Codex G6 recommendation). Resolved.

**D3 — 54-CONTEXT L3/L20 + references/compound/README.md L76-L77 "2 sections" commentary vs workflows/compound.md L14 + schema.sections 3-bucket runtime**: Three documentation sources say sink-proposer emits "two sections: patterns_sdi + rule_promotions" (54-CONTEXT L3 L20, references/compound/README.md L76-L77). Authoritative sources (workflows/compound.md L14 "three structured record arrays: patterns_sdi, rule_promotions, memory_proposals" + `compound.schema.json` sections array with 8 canonical names including `memory_proposals`) show 3-bucket runtime reality. Runtime is correct (3 buckets); 2 documentation files are undercount by one (memory_proposals omitted from the commentary). Phase 55 does not patch these documentation files (L16 immutability extension; Codex non-blocking observation). Disposition: Errata logged here. Non-blocking. Candidate for v1.5 maintenance backlog doc-consistency sweep.

**D4 — Phase 55 LOC magnitude ~3,850 (non-blocking observation from Reviewer O1)**: Phase 55 is the largest v1.5 phase by LOC. 2-commit split accepted; 3-commit alternative (planning / fixtures / vitest+smoke) considered but deferred. Reviewer-comfort threshold is the primary driver; atomicity is preserved in each commit. If mid-build LOC estimate deviates significantly from ~3,850, consider 3-commit split as escape hatch (Codex cross-check dispositive if invoked). Non-blocking.

## Namespace clarification (continuation of 52b G7 / 53 L13 / 54 L12)

Continues unchanged from Phase 54: Agent Router (`packages/core/src/agent/router.ts`) and Workflow Router (`packages/cli/references/router/src/*.mjs`) remain separate namespaces. Compound-router (`packages/cli/references/compound/src/*.mjs`) sits on the Workflow Router side as a downstream read-only consumer. `.claude/rules/architecture.md` namespace doc update **continues deferred** (Codex-strict defer 5th iteration; L13). Phase 55 adds NO new runtime namespace — fixtures + tests + retroactive artifact exist entirely under `test/fixtures/router/` + `packages/skills-workflow/src/shared/__tests__/` + `.planning/compound/` (existing Phase 54 directory).

## Cross-phase learning (3-role observational fixture; not formalized)

Phase 55 Gate round continues the strict-side union pattern: Codex tightened Reviewer positions on 2 axes (U1 risk_level correction + U2 provenance relocation). Both absorbed pre-construction.

Accumulated fixtures (not yet formalized):
- Phase 53 Gate round: 2 Codex tightening instances (R1 expansion + STATE git-state-determined wording)
- Phase 54 Gate round: 4 Codex tightening instances (G5 naming, G6 `$comment`, wrapper-hint removal, architecture.md no-touch)
- Phase 55 Gate round: 2 Codex tightening instances (U1 risk_level correction + U2 provenance relocation)
- **Total across 3 phases: 8 instances** of Codex strict-side union on Reviewer non-blocking positions

Value preserved per-round: L16 immutability, R1 regression guarantee, clean-room rigor, approval-boundary contract accuracy, audit-integrity of durable-tier telemetry. **Formalization deferred to v1.5-closure meta-retrospective** per L15 precedent. Phase 55 records this gate round as observational fixture.

## Scope lock (Phase 55 deliverables — pre-planned 2-commit split per L9)

**Commit A — `docs(router): scaffold Phase 55 dogfood context and fixture skeleton`** (planning/scaffold scope; ~10 files):

1. `.planning/phases/55-router-dogfood/55-CONTEXT.md` — **this file** (Commit A content = Gate 55 decisions locked; runtime not yet touched)
2. `.planning/STATE.md` — Current Position prose update for Phase 55 entry; frontmatter unchanged at Commit A (`completed_phases: 4` / `percent: 57`)
3. `packages/cli/bin/smoke-test.cjs` — Section 31 header comment block only (no check logic yet; checks added in Commit B). Sections 27/28/29/30 byte-stable. Section 31 marker present for reviewer orientation.
4. `test/fixtures/router/README.md` — top-level fixture tree description + scenario index + retroactive-v1.4 subdirectory purpose
5. `test/fixtures/router/01-greenfield-brainstorm/.keep` — scenario scaffold
6. `test/fixtures/router/02-bugfix-work/.keep` — scenario scaffold
7. `test/fixtures/router/03-release-compound/.keep` — scenario scaffold
8. `test/fixtures/router/04-incident-recovery/.keep` — scenario scaffold
9. `test/fixtures/router/05-milestone-close/.keep` — scenario scaffold
10. `test/fixtures/router/retroactive-v1.4/.keep` — retroactive window scaffold

**Commit B — `feat(router): add Phase 55 dogfood vitest runner and retroactive v1.4 backfill`** (runtime scope; ~20-25 files):

11. `packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts` — vitest with 5 describe blocks (L3)
12. `test/fixtures/router/01-greenfield-brainstorm/route-decisions/*.json` — input RouteDecision fixtures (L2)
13. `test/fixtures/router/01-greenfield-brainstorm/expected.json` — unified oracle (L2)
14. `test/fixtures/router/02-bugfix-work/route-decisions/*.json` + `expected.json` (L2)
15. `test/fixtures/router/03-release-compound/route-decisions/*.json` + `expected.json` + `expected-compound.md` (L2)
16. `test/fixtures/router/04-incident-recovery/route-decisions/*.json` + `expected.json` + `expected-compound.md` (L2)
17. `test/fixtures/router/05-milestone-close/route-decisions/*.json` + `expected.json` + `expected-compound.md` (L2)
18. `test/fixtures/router/retroactive-v1.4/route-decisions/*.json` — ≥5 fixture entries (L5)
19. `test/fixtures/router/retroactive-v1.4/BACKFILL-PROVENANCE.md` — provenance marker (U2 Codex-strict location)
20. `.planning/compound/release-v0.12.0-20260420.md` — retroactive v1.4 compound artifact (L4)
21. `packages/cli/bin/smoke-test.cjs` — Section 31 `[55-dogfood]` checks populated (~24 checks per L8). Sections 27/28/29/30 byte-stable (content-marker parity).
22. `.planning/STATE.md` — frontmatter bump `completed_phases: 4 → 5` + `percent: 57 → 71`; prose final confirmation; git-state-determined wording preserved

Note: STATE.md touched in both commits — Commit A = prose update (mid-phase entry), Commit B = progress bump (end-phase reflection). Matches Phase 53/54 bookkeeping pattern (L16).

Commit A .keep removal at Commit B: 5 scenario `.keep` files are removed by Commit B since each scenario directory becomes non-empty with route-decisions/*.json + expected.json. retroactive-v1.4 `.keep` similarly removed when route-decisions/*.json entries land. `.keep` files are scaffolding only; their removal in Commit B is expected and non-regressive.

## Hard-locks (Phase 55)

From Gate 55 v1 convergent absorption + strict-side union + Phase 52a/52b/53/54 hard-lock extensions:

- `.github/workflows/ci.yml` **untouched** (v1.4 Path-A continuation; unchanged through 52a/52b/53/54/55)
- `.claude/rules/` **NOT touched** (Codex-strict defer 5th iteration; architecture.md namespace update deferred to Phase 56 / v1.5 maintenance backlog)
- `packages/cli/references/router/src/{classifier,evidence-collector,confidence,decision-writer}.mjs` **byte-identical from Phase 52b** (L11)
- `packages/cli/references/router/{README,STAGE-MACHINE,EVIDENCE-MODEL,CONFIDENCE-CALIBRATION,APPROVAL-BOUNDARY}.md` **byte-identical from Phase 52a** (L11)
- `packages/cli/commands/sunco/router.md` **byte-identical from Phase 52b**
- `packages/cli/workflows/router.md` **byte-identical from Phase 52b**
- `packages/cli/commands/sunco/{do,next,mode,manager}.md` **byte-identical from Phase 53 (`72a391a`)** (L11)
- `packages/cli/hooks/sunco-mode-router.cjs` **byte-identical from Phase 53**
- `packages/cli/schemas/compound.schema.json` **byte-identical from Phase 54** (L11)
- `packages/cli/references/compound/{README,template}.md` **byte-identical from Phase 54** (L11)
- `packages/cli/references/compound/src/{compound-router,sink-proposer}.mjs` **byte-identical from Phase 54** (L11)
- `packages/cli/commands/sunco/compound.md` **byte-identical from Phase 54** (L11)
- `packages/cli/workflows/compound.md` **byte-identical from Phase 54** (L11)
- `.planning/compound/README.md` **byte-identical from Phase 54** (L11; existing Phase 54 asset; retroactive v1.4 artifact is NEW file added alongside)
- `packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release}.md` **byte-identical from `7791d33`** (R1 regression continuation; L12 8-command set includes compound from Phase 54)
- `packages/cli/commands/sunco/auto.md` **byte-identical from `7791d33`** (frozen until Phase 57)
- `packages/cli/commands/sunco/where-am-i.md` **byte-identical from `7791d33`** (Phase 53 L6 deferred)
- `packages/cli/schemas/{finding,cross-domain,ui-spec,api-spec,data-spec,event-spec,ops-spec,route-decision}.schema.json` **untouched** (8 existing schemas unchanged)
- `.planning/router/DESIGN-v1.md` **unchanged through Phase 55** (L14 immutability; D1 errata logged here)
- `.planning/router/README.md` unchanged (Phase 52a asset)
- `.planning/router/decisions/` unchanged (content; `.keep` preserved; **no synthetic backfill, no sidecar README** per U2 Codex-strict)
- `.planning/router/paused-state.json` NOT created by Phase 55 (first `/sunco:pause` invocation owns creation)
- `.planning/ROADMAP.md` **unchanged through Phase 55** (L14; D1 errata logged here)
- `.planning/REQUIREMENTS.md` unchanged (IF-23 already marked "Covered by Phase 55" at definition point)
- Memory files unchanged (retroactive compound artifact surfaces memory candidates as proposals; no memory write)
- `/sunco:auto` frozen (auto.md byte-identical)
- SDI counter unchanged at **2** (pre-planned split is NOT SDI-2 per Gate 52b B4 + Phase 53/54 precedent; L9)
- No new npm dependency
- No runtime export additions (L7)
- No classifier / compound-router weight changes (Phase 55 frozen at Phase 52b/54 values per L1 compatibility contract from 54-CONTEXT L191-L203)

## Done-when criteria (21 items)

1. Rollback anchor `sunco-pre-54-landed @ 8e22c9d` created pre-file-write (L10) — verifiable via `git rev-parse sunco-pre-54-landed`
2. Commit A landed locally: 55-CONTEXT + STATE prose + smoke Section 31 header + 5 scenario scaffold `.keep` files + retroactive-v1.4 scaffold + top-level fixture README; no amend; no force-push
3. Commit B landed locally: vitest + full fixtures + retroactive v1.4 compound artifact + retroactive RouteDecisions + BACKFILL-PROVENANCE.md + Section 31 populated + STATE frontmatter bump; no amend; no force-push
4. Full verify-lite green POST-Commit-B: smoke (744 baseline + ~24 Section 31 additions), 10 self-tests (249/249 unchanged), turbo lint+build (10/10), vitest (1099 + ~20-25 dogfood additions)
5. `.planning/compound/release-v0.12.0-20260420.md` parses as valid frontmatter + validates against `compound.schema.json` + 8 sections present + `status: proposed` + `clean_room_notice: true` + `source_evidence[]` non-empty + `generated_by: sunco-compound-router`
6. 5 scenario fixtures present under `test/fixtures/router/` with γ hybrid layout (L2): `route-decisions/*.json` flat + `expected.json` all 5 + `expected-compound.md` scenarios 3/4/5 only
7. `test/fixtures/router/retroactive-v1.4/route-decisions/` contains ≥5 schema-valid RouteDecision JSON files
8. `test/fixtures/router/retroactive-v1.4/BACKFILL-PROVENANCE.md` present (U2 Codex-strict location)
9. `.planning/router/decisions/` contains ONLY `.keep` (U2 negative assertion; no sidecar, no synthetic entries)
10. `packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts` present with 5 describe blocks; vitest passes all scenarios
11. All 5 scenarios' `expected.json.risk_level` = value taken from live classifier output on fixture inputs (L6; scenarios 3/4/5 specifically `local_mutate` per U1 Codex-strict)
12. Section 31 `[55-dogfood]` populated with ~24 checks; all pass
13. Section 27/28/29/30 byte-stable (content-marker parity grep; parallels 28r/29r/30s/30t/30u)
14. Phase 52a + 52b + 53 + 54 runtime assets byte-stable (L11 enforcement; content-marker parity grep in Section 31)
15. `git diff --name-only 8e22c9d..HEAD -- packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release,compound,do,next,mode,manager,router,auto,where-am-i}.md packages/cli/workflows/{router,compound}.md packages/cli/references/router/ packages/cli/references/compound/ packages/cli/hooks/sunco-mode-router.cjs packages/cli/schemas/ .planning/router/DESIGN-v1.md .planning/ROADMAP.md | wc -l == 0` (L11 + L12 enforcement)
16. STATE.md prose uses git-state-determined wording (no "push awaits" / "On push, LANDED"); frontmatter `completed_phases: 5` / `percent: 71` post-Commit-B (L16)
17. `.claude/rules/architecture.md` byte-identical from `72a391a` (Codex-strict NO TOUCH; L13 5th iteration)
18. `sunco-pre-dogfood @ 3ac0ee9`, `sunco-pre-52b-landed @ 4b1e093`, `sunco-pre-53-landed @ 72a391a`, `sunco-pre-54-landed @ 8e22c9d` all preserved (unchanged)
19. No runtime module exports added in Phase 55 (L7; dogfood consumes existing Phase 52b/54 exports as black box)
20. SDI-2 counter stays at **2** (L9; pre-planned split NOT SDI-2)
21. Mid-milestone gate trigger recognized and documented in this CONTEXT (L18; Phase 56/57 scope-confirmation questions drafted under "Next phase handoff" below)

## Mid-milestone review gate trigger (DESIGN §9)

**Gate 55 v1 (this round)** = Phase 55 pre-construction gate. Completed convergent GREEN-CONDITIONAL.

**Mid-milestone gate (post-Phase-55-landing)** = separate convening event per DESIGN §9 between Phase 55 and Phase 56.

**Mid-milestone gate scope:**
- Review Phase 55 dogfood outcome quality (all 5 scenarios green? determinism preserved? compound artifact integrity? retroactive window coverage?)
- Confirm Phase 56 scope (release-router hardening per DESIGN §11 30a: PRE_FLIGHT → VERSION_BUMP → CHANGELOG → COMMIT → TAG → PUSH → PUBLISH → VERIFY_REGISTRY → TAG_PUSH → COMPOUND_HOOK)
- Confirm Phase 57 deferral posture (`/sunco:auto` integration; frozen through Phase 56)
- Decide architecture.md namespace update timing (Phase 56 bundle vs v1.5 maintenance backlog vs v1.6+ push)
- Surface v1.5 maintenance backlog candidates (doc drift D3 fix, anchor convention formalization, Codex O1 cascade flag formalization)
- FAIL at mid-milestone → replan Phase 56/57 scope; no auto-continue

**Phase 55 Gate 55 is not the mid-milestone gate.** Gate 55 operates on pre-construction design correctness. Mid-milestone operates on post-landing outcome quality. Temporal separation critical per L18.

## Next phase handoff (Phase 56 scope-confirmation questions for mid-milestone gate)

**Phase 56 (provisional, post-55-landed + post-mid-milestone-gate)** — Release-router hardening. Scope confirmed at mid-milestone gate per DESIGN §9.

Phase 56 inherits from Phase 55:
- Working compound artifact pipeline (Phase 54 assets + Phase 55 retroactive v1.4 baseline + 5-scenario proof-of-correctness)
- BACKFILL-PROVENANCE pattern (fixture-tree location; U2 Codex-strict)
- γ hybrid fixture layout convention (L2)
- SDI-2 counter at 2 (unchanged through v1.5 to date)

Phase 56 scope-confirmation questions (for mid-milestone gate):
1. Release workflow sub-stage decomposition: 10 sub-stages per DESIGN §11 30a — confirm all 10 in scope, or subset?
2. Approval envelope metadata per sub-stage: uniform `risk_level` assignment or sub-stage-specific?
3. Workspace consistency check (Phase 51 Flag 1): integrate into VERSION_BUMP sub-stage or separate pre-flight check?
4. Compound hook invocation timing: post-VERIFY_REGISTRY success (DESIGN §11 30e) or post-TAG_PUSH?
5. Architecture.md namespace update: include in Phase 56 bundle (5th iteration defer ending) or continue defer?
6. v1.5 maintenance backlog promotion candidates: which items move into Phase 56 as required vs stay as backlog 999.x?
7. Smoke Section 32 allocation for Phase 56 release-router coverage (~15-20 checks estimated)
8. Phase 57 `/sunco:auto` integration: confirm deferral posture or open planning window?

**Phase 57 (deferred, explicit gate post-56)** — `/sunco:auto` integration. Frozen through Phase 56. Phase 55/54 automatic hook integration deferral continues (U1 strict-side union from Phase 54 extended).

**v1.5 maintenance backlog candidates (999.x; surfaced at mid-milestone gate):**
- (i) `.claude/rules/architecture.md` namespace update (compound-router downstream consumer; 5th iteration defer)
- (ii) Codex O1 README + product-contract cascade flag formalization (Phase 54 observation)
- (iii) Codex O2 per-phase anchor convention formalization (Phase 55 = 4th iteration; threshold for formalization candidate)
- (iv) D3 doc drift fix: 54-CONTEXT L3 L20 + references/compound/README.md L76-L77 update "2 sections" → "3 buckets" to match workflows/compound.md L14 reality
- (v) 3-role strict-side union rule formalization (8 accumulated fixtures across Phases 53-55; L15 deferral target)

## Verify-lite snapshot at Phase 55 entry (pre-Commit A)

- HEAD: `8e22c9d` (Phase 54 2-commit unit endpoint: A `5824a98` + B `8e22c9d`)
- origin/main: `8e22c9d` (Phase 54 push-landed state)
- `sunco-pre-54-landed`: `8e22c9d` (newly created pre-Commit-A; non-commit ref; rollback anchor per L10)
- `sunco-pre-53-landed`: `72a391a` (preserved)
- `sunco-pre-52b-landed`: `4b1e093` (preserved)
- `sunco-pre-dogfood`: `3ac0ee9` (preserved)
- Smoke: **744/744** (619 baseline + 35 Section 27 [52a-static] + 27 Section 28 [52b-runtime] + 24 Section 29 [53-wrapper] + 39 Section 30 [54-compound])
- Self-tests: **249/249** across 10 modules (injector 10 + adapter 22 + backend-detector 17 + extract-spec-block 33 + confidence 21 + classifier 30 + evidence 21 + writer 32 + compound-router 42 + sink-proposer 21)
- Turbo lint+build: **10/10** (FULL TURBO cache)
- Vitest: 1099/1099 across 95 files (Phase 53 baseline; Phase 54 added no vitest files; Phase 55 ADDS `router-dogfood.test.ts` with ~20-25 new tests)
- SDI-2 counter: **2** (unchanged through Phase 55 pre-planned split per L9)
- v1.5 progress (at Commit A snapshot): 4/7 phases delivered (57%); Phase 55 in-flight

## Gate 55 v1 cross-model verification metadata

- **Implementer Claude**: Step 1 verify-lite (5/5 green) + Step 2 freshness 8-point (3 drifts D1/D2/D3 surfaced) + Step 3 Gate request (12 axes G1-G12 + pre-first-mutation anchor recommendation) + scope-check (4 NEW asset classes ABSENT: fixture tree, retroactive compound, dogfood vitest, non-.keep decisions dir)
- **Reviewer Claude**: GREEN-CONDITIONAL; 4 blocking B1 (G4 fixture-only backfill + sidecar provenance in durable tier) + B2 (G5 proposed status) + B3 (G6 γ hybrid layout) + B4 (G10 2-commit split NOT SDI-2); drift dispositions D1 errata-only / D2 γ-absorbed / D3 errata-only; architecture.md defer 5th iteration; sunco-pre-54-landed anchor approval; 3 cross-model Q forwarded for Codex
- **Codex**: GREEN-CONDITIONAL; 1 blocking U1 (G1 risk_level misclassification — scenarios 3/4/5 `repo_mutate_official` → `local_mutate` per APPROVAL-BOUNDARY.md L18+L47 + compound.md L89) + 1 medium U2 (G4 provenance location — BACKFILL-PROVENANCE.md relocated from `.planning/router/decisions/` to fixture tree for audit-integrity of durable-tier namespace); layout disposition confirms γ hybrid + no per-scenario README; non-blocking D3 observation extended to references/compound/README.md L76-L77; Phase 55 start-implementation authorization
- **Convergence**: No RED, no v2 relay. Strict-side union on 2 axes (U1 risk_level → Codex strict; U2 provenance location → Codex strict). Structural convergence on G2/G3/G5/G6/G7/G8/G9/G10/G11/G12. Gate 55 GREEN-CONDITIONAL proceeding to construction. Phase 47/48/49/51/52a/52b/53/54 convergent-absorption precedent applied (L15).
- **Pattern logged**: Cross-phase 3-role strict-side union count = 8 accumulated fixtures (Phase 53: 2; Phase 54: 4; Phase 55: 2). Observational fixture accumulated for v1.5-closure meta-retrospective (per L15).
