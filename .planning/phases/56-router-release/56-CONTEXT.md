# Phase 56 — Release-Router Hardening (10 sub-stage approval envelopes + smoke Section 32)

- **Spec alias**: v1.5/M6 Phase 56 (sixth phase of v1.5 committed set; first post-dogfood hardening phase; release-router approval-envelope surface for `/sunco:release` 10 sub-stage decomposition)
- **Milestone**: M6 SUNCO Workflow Router
- **Design source**: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at commit `30e2041`; IMMUTABILITY extended through Phase 56 per Gate 52b B2 / Phase 53 L16 / Phase 54 L16 / Phase 55 L14 continuation — drift observed during Phase 56 absorbed in this CONTEXT under "DESIGN errata / ROADMAP drift" section, NOT patched into `DESIGN-v1.md` or `ROADMAP.md`)
- **Requirement**: IF-21 (cross-cut; approval-boundary-enforced auto-execution — release-router as the canonical 10-sub-stage surface where `auto_safe`/`requires_user_ack`/`remote_mutate`/`external_mutate` distinctions become operational per sub-stage)
- **Status**: Gate 56 v1 convergent GREEN-CONDITIONAL absorbed (Reviewer Claude + Codex; both GREEN-CONDITIONAL with 2 absorb-before-build wording conditions AB1 + AB2; 4 drift findings D1/D2/D3/D4 disposition logged; no RED; no divergent-blocking requiring v2 relay). Mid-milestone gate PASS-WITH-CONDITIONS absorbed upstream (C1 + C2 folded into v1.5 maintenance backlog). Construction proceeding; 2-commit pre-planned split (scaffold + runtime).

## Phase 56 character

**First post-dogfood hardening phase in v1.5; first phase where Phase 52a/52b/53/54/55 assets become operationally connected by the release workflow surface.** Phase 52a shipped router contracts (5 reference docs + route-decision schema). Phase 52b shipped the runtime engine (4 modules + `/sunco:router` thin command + `workflows/router.md`). Phase 53 connected 4 entry-point wrappers + mode hook. Phase 54 added compound-router as post-stage durable-decision consumer. Phase 55 dogfood exercised the producer-consumer contract end-to-end across 5 fixture scenarios + retroactive v1.4 compound artifact.

Phase 56 **does not add** new runtime modules or new module exports. It adds:

1. **`packages/cli/workflows/release.md`** — NEW workflow file that decomposes `/sunco:release` execution into 10 deterministic sub-stages with per-sub-stage `approval_envelope` metadata (class + risk_level + mode + ACK shape). Mirrors the deterministic-pipeline shape of `workflows/router.md` (Phase 52b) and `workflows/compound.md` (Phase 54) — no new runtime code, pure contract document.
2. **10 sub-stage risk_level mapping** locked per G2: PRE_FLIGHT → VERSION_BUMP → CHANGELOG → COMMIT → TAG → PUSH → PUBLISH → VERIFY_REGISTRY → TAG_PUSH → COMPOUND_HOOK, with each sub-stage carrying a named `approval_envelope` classification and the rationale linking back to `references/router/APPROVAL-BOUNDARY.md` (L26 class-by-purpose, L47 local_mutate exceptions, L63 blessed orchestrator batched-ACK).
3. **PRE_FLIGHT workspace consistency check separation** (G3): the workspace consistency check (Phase 51 Flag 1 lineage) runs as an independent sub-stage distinct from VERSION_BUMP, so a workspace-mismatch failure does not contaminate VERSION_BUMP attempt semantics.
4. **TAG_PUSH failure clause** (G4): `workflows/release.md` encodes that TAG_PUSH failure is post-semantic-completion git-metadata reconciliation failure; compound trigger timing is NOT moved. The compound artifact has already been written at `status=proposed` reflecting registry-verified release when TAG_PUSH runs; TAG_PUSH retry sub-stage is separately invocable.
5. **COMPOUND_HOOK wiring sentence** (G2 + G4 continuation): COMPOUND_HOOK sub-stage invokes the Phase 54 `compound-router.runCompound(ctx)` post-VERIFY_REGISTRY success (DESIGN §11 30e literal). COMPOUND_HOOK risk_level is `local_mutate` by explicit exception per APPROVAL-BOUNDARY.md L47.
6. **artifact-gate release-mode reference** (G5 + AB1): `workflows/release.md` references `commands/sunco/artifact-gate.md` by name as the sub-stage contract target consumed by downstream invocations. The artifact-gate command file itself is NOT opened by Phase 56 (hard-lock; separate phase required to modify it per AB1 scope boundary).
7. **Smoke Section 32 `[56-release]` additive block** (~18-22 checks) asserting workflow file presence, 10 sub-stage marker presence, risk_level enum literal presence per G2 mapping, DESIGN §11 30c/30d/30e literals, AB1/AB2 wording preservation, Section 27/28/29/30/31 byte-stability parity grep, and Phase 52a-55 runtime assets byte-stability parity grep.

Phase 56 is the **immediately post-mid-milestone-gate construction phase**. Mid-milestone gate PASS-WITH-CONDITIONS conditions C1 (dogfood producer-consumer chain wiring) + C2 (54-CONTEXT + references/compound/README.md doc drift) are folded into the v1.5 maintenance backlog (not Phase 56 scope). Phase 57 (`/sunco:auto` integration) remains frozen pending Phase 56 landed + explicit gate opening.

Full Gate 5 scrutiny inherited (novel risk vectors per DESIGN §14): sub-stage approval-envelope accuracy, class-by-purpose vs enumeration-drift reconciliation (AB2 absorption), artifact-gate.md scope boundary discipline (AB1 absorption), mid-milestone gate absorption completeness, 3-role strict-side union continuation.

## Gate 56 v1 — convergent absorption log

### Round 1 — Implementer v1 request (11 axes G1-G11 + pre-first-mutation anchor + 4 drift findings)

11 axes submitted inline (G1 workflow file scope / G2 10 sub-stage risk_level mapping / G3 PRE_FLIGHT workspace consistency separation / G4 TAG_PUSH failure clause / G5 artifact-gate reference scope / G6 smoke Section 32 coverage / G7 commit shape + SDI-2 / G8 hard-locks / G9 architecture.md defer 6th iteration / G10 done-when criteria / G11 per-phase anchor 5th iteration formalization deferral). 4 drift findings surfaced: D1 APPROVAL-BOUNDARY.md L32 literal-path reading vs L26 inclusive-class intent for CHANGELOG.md, D2 DESIGN §11 L586 Section offset pattern extension (Phase 55 D1 continuation; Section 32 assignment vs phase-table token), D3 54-CONTEXT L65 prose + references/compound/README.md L76-L77 doc drift (C2 carryover), D4 MEMORY.md post-Phase-55 accuracy observation (5-phase → 6-phase landed delta). Pre-first-mutation rollback anchor recommendation: `git branch sunco-pre-55-landed 97af2c3` (5th iteration).

### Round 2 — Two-gate convergent (Codex + Reviewer Claude)

Both verdict: **GREEN-CONDITIONAL**. No RED. No divergent-blocking requiring v2 relay. 2 absorb-before-build wording conditions applied:

**AB1 — G5 artifact-gate scope wording (Codex-strict + Reviewer-concur, absorb-before-build)**:
- Implementer v1: workflows/release.md references `commands/sunco/artifact-gate.md` by name as the sub-stage contract consumer target.
- Risk flagged: "references by name" read loosely could license modifying artifact-gate.md within Phase 56 scope. Must harden to "references without opening".
- **Absorbed (verbatim wording)**: "G5 scope = workflows/release.md sub-stage contract + smoke Section 32 assertions that reference how /sunco:artifact-gate consumes release-grade artifacts. packages/cli/commands/sunco/artifact-gate.md is NOT opened by Phase 56 (hard-lock through Phase 56 per explicit scope line). Opening the command file requires a separate phase or explicit scope expansion." Paired with hard-lock byte-identical assertion in Phase 56 hard-locks section + smoke Section 32 content-marker parity check.

**AB2 — G2 CHANGELOG class derivation wording (Codex-strict absorption; D1 drift folded into policy sentence)**:
- Implementer v1: CHANGELOG sub-stage classified `repo_mutate_official` (blessed batched-ACK via `/sunco:release`).
- D1 risk: APPROVAL-BOUNDARY.md L32 literal bullet ("Any file under `.planning/` ... `CHANGELOG.md`") reads narrower than L26 inclusive-class intent (class-by-purpose, not by file list). L63 blessed-orchestrator `/sunco:release` explicitly names `CHANGELOG.md` as batched-covered, which requires CHANGELOG to be in the `repo_mutate_official` class by intent. Mis-read of L32 could re-classify CHANGELOG as `repo_mutate` and break L63 batched-ACK coverage.
- **Absorbed (verbatim wording, placed directly after the 10-row risk_level mapping table)**: "For Phase 56, CHANGELOG.md is treated as repo_mutate_official by purpose within the /sunco:release release-record class. This classification derives from APPROVAL-BOUNDARY.md L26 class-by-purpose rationale + L63 blessed orchestrator explicit CHANGELOG.md naming. The L32 literal-path reading is narrower than the L26-intended class; D1 errata below logs the spec gap for v1.5 maintenance backlog."

**Drift dispositions (observational; not patched)**:

- **D1 APPROVAL-BOUNDARY.md L32 literal-path reading vs L26 inclusive-class intent**: AB2 policy sentence absorbs the gap in-phase; DESIGN-v1.md / APPROVAL-BOUNDARY.md NOT patched (L16 immutability extension). Candidate for v1.5 maintenance backlog spec-clarification sweep.
- **D2 DESIGN §11 Section offset pattern continuation**: DESIGN §9 L488 phase table allocates Section 31 to Phase 55 but phase-split pushed each phase's Section allocation by +1 (Phase 54 landed Section 30; Phase 55 landed Section 31; Phase 56 lands Section 32). Same pattern as Phase 55 D1 errata. Disposition: errata logged in this CONTEXT only.
- **D3 54-CONTEXT L65 prose + references/compound/README.md L76-L77 doc drift (C2 mid-milestone carryover)**: 3 documentation sources use "2 sections" phrasing (54-CONTEXT L3 L20 + L65; references/compound/README.md L76-L77); runtime reality is 3 buckets per workflows/compound.md L14 + schema.sections. Mid-milestone gate C2 carryover. Disposition: errata logged; NOT patched in Phase 56. Candidate for v1.5 maintenance backlog doc-consistency sweep.
- **D4 MEMORY.md post-Phase-55 landed state accuracy**: MEMORY.md project memory needs post-Phase-56-landing update from "5-phase landed" → "6-phase landed". Post-landing housekeeping; not a Phase 56 code change.

### Locked decisions (Phase 56 v1)

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | **10 sub-stage release workflow per DESIGN §11 30a** (G1 + G2 convergent) | Sub-stages (ordered): PRE_FLIGHT → VERSION_BUMP → CHANGELOG → COMMIT → TAG → PUSH → PUBLISH → VERIFY_REGISTRY → TAG_PUSH → COMPOUND_HOOK. Each sub-stage in `workflows/release.md` carries an `approval_envelope` block with class name + risk_level + mode + ACK shape + failure semantics. |
| L2 | **Per-sub-stage risk_level mapping** (G2 convergent; AB2 CHANGELOG class-by-purpose absorbed) | PRE_FLIGHT `read_only`; VERSION_BUMP `repo_mutate_official` (blessed batched-ACK via `/sunco:release`); CHANGELOG `repo_mutate_official` (blessed batched-ACK; AB2 class-by-purpose sentence applies); COMMIT `repo_mutate` (per-write ACK); TAG `repo_mutate` (per-write ACK); PUSH `remote_mutate` (per-invocation; never cached); PUBLISH `external_mutate` (per-invocation; never cached; never `--batch-ack`; DESIGN §11 30c literal); VERIFY_REGISTRY `read_only`; TAG_PUSH `remote_mutate` (per-invocation; never cached); COMPOUND_HOOK `local_mutate` (APPROVAL-BOUNDARY.md L47 exception; compound-router auto-writes `.planning/compound/*.md` draft). |
| L3 | **AB2 CHANGELOG class-by-purpose policy sentence** (AB2 absorbed; D1 deferred to backlog) | Verbatim policy sentence placed directly after the 10-row risk_level mapping table in `workflows/release.md`: "For Phase 56, CHANGELOG.md is treated as repo_mutate_official by purpose within the /sunco:release release-record class. This classification derives from APPROVAL-BOUNDARY.md L26 class-by-purpose rationale + L63 blessed orchestrator explicit CHANGELOG.md naming. The L32 literal-path reading is narrower than the L26-intended class; D1 errata below logs the spec gap for v1.5 maintenance backlog." |
| L4 | **AB1 artifact-gate.md scope boundary** (AB1 absorbed) | Verbatim scope line in `workflows/release.md`: "G5 scope = workflows/release.md sub-stage contract + smoke Section 32 assertions that reference how /sunco:artifact-gate consumes release-grade artifacts. packages/cli/commands/sunco/artifact-gate.md is NOT opened by Phase 56 (hard-lock through Phase 56 per explicit scope line). Opening the command file requires a separate phase or explicit scope expansion." Enforced via hard-lock byte-identical assertion + smoke Section 32 content-marker parity. |
| L5 | **PRE_FLIGHT workspace consistency check separation** (G3 convergent) | PRE_FLIGHT sub-stage runs workspace consistency check (Phase 51 Flag 1 lineage) as an independent step. Failure = PRE_FLIGHT failed; VERSION_BUMP not yet attempted (so VERSION_BUMP semantics are not contaminated by workspace-mismatch). PRE_FLIGHT risk_level `read_only` because the check is read-only. Separate from `commands/sunco/release.md` pre-flight checklist (which covers lint/tsc/tests/branch); workflow document makes the workspace consistency check an enumerated sub-stage. |
| L6 | **TAG_PUSH failure clause** (G4 convergent) | `workflows/release.md` encodes: TAG_PUSH failure is post-semantic-completion git-metadata reconciliation failure; compound trigger timing is NOT moved. Compound artifact already written at `status=proposed` reflects registry-verified release. TAG_PUSH retry is separately invocable as a sub-stage. This prevents TAG_PUSH retry from re-triggering COMPOUND_HOOK (double-write guard). |
| L7 | **COMPOUND_HOOK post-VERIFY_REGISTRY wiring** (DESIGN §11 30e literal) | COMPOUND_HOOK sub-stage invokes `compound-router.runCompound(ctx)` after VERIFY_REGISTRY success and BEFORE TAG_PUSH. Ordering ensures compound artifact's `source_evidence[]` references registry-verified release (VERIFY_REGISTRY must succeed before compound write). TAG_PUSH failure post-COMPOUND_HOOK does not rewrite the compound artifact (L6). |
| L8 | **NO new runtime code; NO new module exports** (G8 + G9 hard-lock extension) | Phase 56 adds ZERO runtime modules and ZERO new exports. `workflows/release.md` is a contract document (markdown). Smoke Section 32 adds ~18-22 checks but ZERO new helper modules. Self-test count stays at **249/249**. Vitest count stays at **1627/1627** (no new vitest file). |
| L9 | **Smoke Section 32 `[56-release]` ~18-22 checks** (G6 convergent) | Section name: `Section 32 — Router Release Hardening (Phase 56)`. Coverage: workflow file presence + 10 sub-stage marker presence (loop check) + risk_level enum literals per L2 mapping (2-3 consolidated checks) + DESIGN §11 30c literal (PUBLISH risk_level === external_mutate) + DESIGN §11 30d literal (PRE_FLIGHT workspace consistency) + DESIGN §11 30e literal (COMPOUND_HOOK post-VERIFY_REGISTRY) + G4 TAG_PUSH failure clause presence + G5 artifact-gate release-mode reference (AB1 wording preserved) + Section 27/28/29/30/31 byte-stable content-marker parity (1 grep) + Phase 52a+52b+53+54+55 runtime assets byte-stable (1 grep) + R1 8-command stage protection continuation (1 grep) + .claude/rules/architecture.md byte-identical from `72a391a` (1 check; 6th defer iteration) + commands/sunco/artifact-gate.md byte-identical (1 check; AB1) + .planning/router/DESIGN-v1.md + .planning/ROADMAP.md + .planning/REQUIREMENTS.md byte-identical (1 grep). Estimated 20 checks. |
| L10 | **Pre-planned 2-commit split; NOT SDI-2** (G7 convergent; Phase 55 L9 precedent) | **Commit A** = `docs(router): scaffold Phase 56 release-router context and workflow stub` (planning/scaffold scope; 56-CONTEXT + STATE prose update + smoke Section 32 header comment block only + workflows/release.md skeleton top notice + 10 sub-stage name-only list). **Commit B** = `feat(router): populate Phase 56 release sub-stage approval envelopes and smoke coverage` (runtime scope; workflows/release.md populated 10 approval_envelope blocks + PRE_FLIGHT workspace consistency + COMPOUND_HOOK wiring + TAG_PUSH failure clause + Section 32 checks populated + STATE frontmatter bump 5→6 / 71→86). Classification in both commits: **NOT SDI-2** per Gate 52b B4 + Phase 53/54/55 precedent. SDI-2 counter stays at **2**. |
| L11 | **Rollback anchor `sunco-pre-55-landed @ 97af2c3`** (G11 approved; pre-first-mutation) | Created before first file write. Non-destructive local branch ref; **5th iteration** of per-phase-landed anchor pattern (parallels `sunco-pre-dogfood @ 3ac0ee9` + `sunco-pre-52b-landed @ 4b1e093` + `sunco-pre-53-landed @ 72a391a` + `sunco-pre-54-landed @ 8e22c9d`). Branch ref is not file state; does not belong in any commit. Preserved across Phase 56 lifetime. **Codex O2 formalization observational continuation**: 5 iterations reached; NOT action-trigger per Gate 56 G11 convergent (6th iteration would trigger formalization conversation at v1.5-closure meta-retrospective). |
| L12 | **Phase 52a+52b+53+54+55 runtime assets byte-stable** (Phase 55 L11 hard-lock extension) | Zero mutation to: 5 router ref docs + route-decision schema + .keep (52a); 4 router runtime modules + router.md command + workflows/router.md (52b); 4 wrappers + mode hook (53); compound schema + 2 compound src + compound.md command + workflows/compound.md + 2 compound READMEs + template + `.planning/compound/README.md` (54); 5 scenario fixtures + retroactive-v1.4 fixture tree + retroactive v1.4 compound artifact + dogfood vitest (55). Enforced via Section 32 content-marker parity grep + Phase 52a-55 runtime assets byte-stability check. |
| L13 | **R1 regression guarantee — 8-command stage protection** (Phase 55 L12 extension) | Phase 56 ADDS zero stage commands; modifies zero stage commands. R1 protection covers 8 stage commands (`brainstorming/plan/execute/verify/proceed-gate/ship/release/compound`) byte-identical from `7791d33`. **R1 hard-lock includes `/sunco:release` command file** — Phase 56 adds `workflows/release.md` (new file; peer to router.md / compound.md) WITHOUT modifying `commands/sunco/release.md` (byte-identical; 8-command set member). Pre-commit invariant: `git diff --name-only 7791d33..HEAD -- packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release,compound}.md \| wc -l == 0`. |
| L14 | **Namespace clarification continuation (architecture.md DEFER NO TOUCH)** (Codex U4 Phase 55 L13 6th iteration) | Agent Router + Workflow Router + compound-router + release-router (conceptual: workflow document only, no runtime namespace added) unchanged. `.claude/rules/architecture.md` **NOT touched** in Phase 56 (**6th** consecutive defer iteration; v1.5 maintenance backlog target). Observational: 6 consecutive defers is a strong signal; formalization still deferred to v1.5-closure meta-retrospective per L15 precedent. |
| L15 | **DESIGN / ROADMAP / REQUIREMENTS errata absorbed in this CONTEXT, not patched** (L16 immutability extension through Phase 56) | D1 APPROVAL-BOUNDARY.md L32 literal-path vs L26 inclusive-class gap — absorbed via AB2 policy sentence in `workflows/release.md`; APPROVAL-BOUNDARY.md NOT patched (L16). D2 DESIGN §11 Section offset — Section 32 assignment vs phase-table token; same pattern as Phase 55 D1; absorbed here; DESIGN-v1.md NOT modified. D3 54-CONTEXT + references/compound/README.md doc drift — C2 mid-milestone carryover; NOT patched in Phase 56 (v1.5 maintenance backlog). D4 MEMORY.md post-Phase-55 landed state — post-landing housekeeping, not a Phase 56 code change. |
| L16 | **3-role cross-phase learning: observational-only** (Phase 55 L15 continuation) | Gate 56 Codex-strict absorb-before-build count = 2 (AB1 artifact-gate scope wording + AB2 CHANGELOG class-by-purpose wording). Pattern accumulation: Phase 53 (2 unions) + Phase 54 (4) + Phase 55 (2) + Phase 56 (2) = **10 fixture instances** of Codex strict-side union / wording absorption across 4 consecutive phases. **Formalization STILL deferred** to v1.5-closure meta-retrospective per L15 precedent continuation. Observational fixture accumulated; crossing 10 is a strong signal for v1.5-closure formalization. |
| L17 | **STATE.md bookkeeping pattern** (Phase 53/54/55 precedent) | Commit A = prose update only (Current Position narrative for Phase 56 entry; frontmatter unchanged at `completed_phases: 5` / `percent: 71`). Commit B = frontmatter bump (`completed_phases: 5 → 6`, `percent: 71 → 86`) + final prose confirmation. git-state-determined wording preserved (no "push awaits" / "On push LANDED" current-tense claims). |
| L18 | **Phase 55 retroactive artifacts preserved untouched** (Phase 55 L4/L5/L17 continuation) | `.planning/compound/release-v0.12.0-20260420.md` + `test/fixtures/router/retroactive-v1.4/**` + `test/fixtures/router/{01..05}/**` all byte-identical from Phase 55 (`97af2c3`). Phase 56 does not exercise or modify dogfood fixtures. |
| L19 | **Mid-milestone gate absorption (PASS-WITH-CONDITIONS)** (upstream; preceded Phase 56 planning) | Mid-milestone gate ran post-Phase-55-landing. Verdict: PASS-WITH-CONDITIONS. C1 = dogfood producer-consumer chain wiring gap (Codex observation; dogfood tested individual modules but chain edges not E2E-wired in CI). C2 = doc drift (54-CONTEXT L65 + references/compound/README.md L76-L77 "2 sections" phrasing). Both C1 + C2 folded into v1.5 maintenance backlog (post-Phase 56); neither blocks Phase 56 construction. Phase 57 deferral posture confirmed. Architecture.md namespace update deferred to v1.5-closure. Phase 56 scope confirmed (release-router hardening per DESIGN §11 30a). |
| L20 | **artifact-gate.md byte-lock extension** (AB1 hard-lock) | `packages/cli/commands/sunco/artifact-gate.md` byte-identical (last commit `fa4eb52`; 235 lines; unchanged through Phase 56). AB1 scope boundary: workflows/release.md references artifact-gate by name only; command file itself is NOT opened. Enforced via hard-lock + smoke Section 32 byte-identical check. |

## DESIGN errata / ROADMAP drift (observational; not patched)

**D1 — APPROVAL-BOUNDARY.md L32 literal-path reading vs L26 inclusive-class intent for CHANGELOG.md**: L32 enumerates `CHANGELOG.md` implicitly under "any file under `.planning/`" bullet, but CHANGELOG.md lives at repo root, not under `.planning/`. L26 class-by-purpose rationale + L63 blessed orchestrator explicit CHANGELOG.md naming require CHANGELOG in the `repo_mutate_official` class. L32 literal reading narrower than L26-intended class. Disposition: AB2 policy sentence absorbs the gap in `workflows/release.md`; APPROVAL-BOUNDARY.md NOT patched. Non-blocking. Candidate for v1.5 maintenance backlog spec-clarification sweep.

**D2 — DESIGN §11 Section offset pattern continuation**: DESIGN §9 L488 phase table allocates Sections by pre-split assumption (Phase 55 = Section 30 in phase table; actual implementation = Section 31 because Phase 54 took Section 30). Phase 56 extends the pattern: phase table token would read Section 31 for Phase 56; actual = Section 32 because Phase 55 took Section 31. Known absorbed offset; same pattern as Phase 55 D1 errata. Disposition: DESIGN-v1.md NOT modified (L16 immutability). Errata logged. Non-blocking.

**D3 — 54-CONTEXT L3/L20/L65 + references/compound/README.md L76-L77 "2 sections" commentary vs workflows/compound.md L14 + schema.sections 3-bucket runtime**: Three documentation sources use "2 sections" phrasing for sink-proposer output; runtime reality is 3 buckets (`patterns_sdi`, `rule_promotions`, `memory_proposals`). Mid-milestone gate C2 carryover. Phase 56 does NOT patch these documentation files (L16 immutability extension). Disposition: errata logged here; candidate for v1.5 maintenance backlog doc-consistency sweep.

**D4 — MEMORY.md post-Phase-55 landed state accuracy (observational)**: User-scope MEMORY.md (`project_sunco_harness_v1_4.md`) references "v1.5 Phase 52a+52b+53+54+55 LANDED" and progress "5/7 (71%)". Post-Phase-56-landing update from 5/7 → 6/7 / 71% → 86% is post-landing housekeeping (memory-file edit), not a Phase 56 repo code change. Not a drift finding in the repo sense; noted for session handoff continuity.

## Namespace clarification (continuation of 52b G7 / 53 L13 / 54 L12 / 55 L13)

Continues unchanged from Phase 55: Agent Router (`packages/core/src/agent/router.ts`) and Workflow Router (`packages/cli/references/router/src/*.mjs`) remain separate namespaces. Compound-router (`packages/cli/references/compound/src/*.mjs`) sits on the Workflow Router side as a downstream read-only consumer. **Release-router is a conceptual label** (the 10-sub-stage release-workflow surface) — **no new runtime namespace** is introduced by Phase 56. `workflows/release.md` is a contract document consumed by `/sunco:release` command execution; it does not correspond to a `packages/cli/references/release/` directory or `src/*.mjs` module. `.claude/rules/architecture.md` namespace doc update **continues deferred** (Codex-strict defer **6th iteration**; L14). Phase 56 adds NO new runtime namespace — workflow document lives at `packages/cli/workflows/release.md` only.

## Cross-phase learning (3-role observational fixture; not formalized)

Phase 56 Gate round continues the strict-side union / wording absorption pattern: Codex + Reviewer together produced 2 absorb-before-build wording conditions (AB1 artifact-gate scope + AB2 CHANGELOG class-by-purpose). Both absorbed verbatim pre-construction.

Accumulated fixtures (not yet formalized):
- Phase 53 Gate round: 2 Codex tightening instances (R1 expansion + STATE git-state-determined wording)
- Phase 54 Gate round: 4 Codex tightening instances (G5 naming, G6 `$comment`, wrapper-hint removal, architecture.md no-touch)
- Phase 55 Gate round: 2 Codex tightening instances (U1 risk_level correction + U2 provenance relocation)
- Phase 56 Gate round: 2 absorb-before-build wording conditions (AB1 artifact-gate scope + AB2 CHANGELOG class-by-purpose)
- **Total across 4 phases: 10 instances** of Codex strict-side union / wording absorption on Reviewer non-blocking / Implementer v1 positions

Value preserved per-round: L16 immutability, R1 regression guarantee, clean-room rigor, approval-boundary contract accuracy, audit-integrity of durable-tier telemetry, scope-boundary discipline (AB1), class-by-purpose spec-intent accuracy (AB2). **Formalization deferred to v1.5-closure meta-retrospective** per L16 precedent. Phase 56 records this gate round as observational fixture; crossing 10 fixtures is a strong formalization signal.

## Scope lock (Phase 56 deliverables — pre-planned 2-commit split per L10)

**Commit A — `docs(router): scaffold Phase 56 release-router context and workflow stub`** (planning/scaffold scope; ~4 files):

1. `.planning/phases/56-router-release/56-CONTEXT.md` — **this file** (Commit A content = Gate 56 decisions locked; AB1 + AB2 absorbed; runtime envelope content deferred to Commit B via workflow stub)
2. `.planning/STATE.md` — Current Position prose update for Phase 56 entry; frontmatter unchanged at Commit A (`completed_phases: 5` / `percent: 71`)
3. `packages/cli/bin/smoke-test.cjs` — Section 32 header comment block only (no check logic yet; checks added in Commit B). Sections 27/28/29/30/31 byte-stable. Section 32 marker present for reviewer orientation.
4. `packages/cli/workflows/release.md` — NEW file; scaffold skeleton: top clean-room notice (parallels workflows/router.md L3 + workflows/compound.md L3) + 10 sub-stage name-only list (no full approval_envelope content yet). Content populated in Commit B.

**Commit B — `feat(router): populate Phase 56 release sub-stage approval envelopes and smoke coverage`** (runtime scope; ~3 files):

5. `packages/cli/workflows/release.md` — FULL 10-sub-stage `approval_envelope` per L2 locked mapping + AB2 CHANGELOG class-by-purpose policy sentence (verbatim, directly after the 10-row table) + AB1 artifact-gate scope line (verbatim) + PRE_FLIGHT workspace consistency details + COMPOUND_HOOK post-VERIFY_REGISTRY wiring + TAG_PUSH failure clause. Deterministic 10-step pipeline shape mirroring workflows/router.md + workflows/compound.md.
6. `packages/cli/bin/smoke-test.cjs` — Section 32 `[56-release]` populated (~18-22 checks per L9). Sections 27/28/29/30/31 byte-stable (content-marker parity). Section 32 replaces the "populated in Commit B" header comment with live check blocks.
7. `.planning/STATE.md` — frontmatter bump `completed_phases: 5 → 6` + `percent: 71 → 86` + prose final confirmation; git-state-determined wording preserved

Note: STATE.md touched in both commits — Commit A = prose update (mid-phase entry), Commit B = progress bump (end-phase reflection). Matches Phase 53/54/55 bookkeeping pattern (L17).

## Hard-locks (Phase 56)

From Gate 56 v1 convergent absorption + AB1/AB2 wording + Phase 52a/52b/53/54/55 hard-lock extensions:

- `.github/workflows/ci.yml` **untouched** (v1.4 Path-A continuation; unchanged through 52a/52b/53/54/55/56)
- `.claude/rules/` **NOT touched** (Codex-strict defer **6th iteration**; architecture.md namespace update deferred to v1.5-closure)
- `packages/cli/references/router/src/{classifier,evidence-collector,confidence,decision-writer}.mjs` **byte-identical from Phase 52b** (L12)
- `packages/cli/references/router/{README,STAGE-MACHINE,EVIDENCE-MODEL,CONFIDENCE-CALIBRATION,APPROVAL-BOUNDARY}.md` **byte-identical from Phase 52a** (L12)
- `packages/cli/commands/sunco/router.md` **byte-identical from Phase 52b**
- `packages/cli/workflows/router.md` **byte-identical from Phase 52b**
- `packages/cli/commands/sunco/{do,next,mode,manager}.md` **byte-identical from Phase 53 (`72a391a`)** (L12)
- `packages/cli/hooks/sunco-mode-router.cjs` **byte-identical from Phase 53**
- `packages/cli/schemas/compound.schema.json` **byte-identical from Phase 54** (L12)
- `packages/cli/references/compound/{README,template}.md` **byte-identical from Phase 54** (L12)
- `packages/cli/references/compound/src/{compound-router,sink-proposer}.mjs` **byte-identical from Phase 54** (L12)
- `packages/cli/commands/sunco/compound.md` **byte-identical from Phase 54** (L12)
- `packages/cli/workflows/compound.md` **byte-identical from Phase 54** (L12)
- `.planning/compound/README.md` **byte-identical from Phase 54** (L12)
- `.planning/compound/release-v0.12.0-20260420.md` **byte-identical from Phase 55** (L18)
- `test/fixtures/router/**` **byte-identical from Phase 55** (L18; 5 scenario fixtures + retroactive-v1.4 tree)
- `packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts` **byte-identical from Phase 55** (L18)
- `packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release}.md` **byte-identical from `7791d33`** (R1 regression continuation; L13 8-command set includes compound from Phase 54)
- `packages/cli/commands/sunco/auto.md` **byte-identical from `7791d33`** (frozen until Phase 57)
- `packages/cli/commands/sunco/where-am-i.md` **byte-identical from `7791d33`** (Phase 53 L6 deferred)
- `packages/cli/commands/sunco/artifact-gate.md` **byte-identical (last commit `fa4eb52`; 235 lines)** (L20; AB1 scope hard-lock)
- `packages/cli/schemas/{finding,cross-domain,ui-spec,api-spec,data-spec,event-spec,ops-spec,route-decision}.schema.json` **untouched** (8 existing schemas unchanged)
- `packages/cli/schemas/compound.schema.json` unchanged (9 total schemas unchanged through Phase 56)
- `.planning/router/DESIGN-v1.md` **unchanged through Phase 56** (L15 immutability; D1 + D2 errata logged here)
- `.planning/router/README.md` unchanged (Phase 52a asset)
- `.planning/router/decisions/` unchanged (content; `.keep` preserved; U2 Codex-strict durable-tier purity continuation)
- `.planning/router/paused-state.json` NOT created by Phase 56 (first `/sunco:pause` invocation owns creation)
- `.planning/ROADMAP.md` **unchanged through Phase 56** (L15; D2 errata logged here)
- `.planning/REQUIREMENTS.md` unchanged (IF-21 cross-cut; IF-23 marked Covered by Phase 55; Phase 56 deepens IF-21 enforcement without changing the requirement text)
- Memory files unchanged (MEMORY.md D4 post-landing housekeeping only)
- `/sunco:auto` frozen (auto.md byte-identical; Phase 57 deferred)
- SDI counter unchanged at **2** (pre-planned split is NOT SDI-2 per Gate 52b B4 + Phase 53/54/55 precedent; L10)
- No new npm dependency
- No runtime export additions (L8)
- No classifier / compound-router weight changes (Phase 56 frozen at Phase 52b/54 values)
- No new vitest file (L8; vitest count stays at 1627/1627)

## Done-when criteria (22 items)

1. Rollback anchor `sunco-pre-55-landed @ 97af2c3` created pre-file-write (L11) — verifiable via `git rev-parse sunco-pre-55-landed`
2. Commit A landed locally: 56-CONTEXT + STATE prose + smoke Section 32 header + workflows/release.md skeleton; no amend; no force-push
3. Commit B landed locally: workflows/release.md populated + Section 32 populated + STATE frontmatter bump; no amend; no force-push
4. Full verify-lite green POST-Commit-B: smoke (771 baseline + ~18-22 Section 32 additions = ~790-795), 10 self-tests (249/249 unchanged), turbo lint+build (10/10), vitest (1627/1627 unchanged)
5. `packages/cli/workflows/release.md` exists with top clean-room notice + 10 sub-stage section headings + per-sub-stage `approval_envelope` block with class + risk_level + mode + ACK shape per L2
6. L2 risk_level mapping verified in `workflows/release.md`: PRE_FLIGHT read_only / VERSION_BUMP repo_mutate_official / CHANGELOG repo_mutate_official / COMMIT repo_mutate / TAG repo_mutate / PUSH remote_mutate / PUBLISH external_mutate / VERIFY_REGISTRY read_only / TAG_PUSH remote_mutate / COMPOUND_HOOK local_mutate
7. L3 AB2 CHANGELOG class-by-purpose policy sentence present verbatim in `workflows/release.md` directly after the 10-row risk_level mapping table
8. L4 AB1 artifact-gate scope line present verbatim in `workflows/release.md`
9. L5 PRE_FLIGHT workspace consistency check enumerated as independent sub-stage (separate from VERSION_BUMP)
10. L6 TAG_PUSH failure clause present: failure is post-semantic-completion reconciliation; compound trigger timing NOT moved; TAG_PUSH retry separately invocable
11. L7 COMPOUND_HOOK sub-stage documents `compound-router.runCompound(ctx)` invocation after VERIFY_REGISTRY success, before TAG_PUSH
12. L8 + L9 Section 32 `[56-release]` populated with ~18-22 checks; all pass
13. Section 27/28/29/30/31 byte-stable (content-marker parity grep; parallels Phase 55 31j/31k)
14. Phase 52a + 52b + 53 + 54 + 55 runtime assets byte-stable (L12 enforcement; content-marker parity grep in Section 32)
15. `git diff --name-only 97af2c3..HEAD -- packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release,compound,do,next,mode,manager,router,auto,where-am-i,artifact-gate}.md packages/cli/workflows/{router,compound}.md packages/cli/references/router/ packages/cli/references/compound/ packages/cli/hooks/sunco-mode-router.cjs packages/cli/schemas/ .planning/router/DESIGN-v1.md .planning/ROADMAP.md .planning/REQUIREMENTS.md .planning/compound/release-v0.12.0-20260420.md test/fixtures/router/ packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts | wc -l == 0` (L12 + L13 + L18 + L20 enforcement)
16. STATE.md prose uses git-state-determined wording (no "push awaits" / "On push, LANDED"); frontmatter `completed_phases: 6` / `percent: 86` post-Commit-B (L17)
17. `.claude/rules/architecture.md` byte-identical from `72a391a` (Codex-strict NO TOUCH; L14 **6th** iteration)
18. `packages/cli/commands/sunco/artifact-gate.md` byte-identical from `fa4eb52` (L20; AB1 scope hard-lock)
19. `sunco-pre-dogfood @ 3ac0ee9`, `sunco-pre-52b-landed @ 4b1e093`, `sunco-pre-53-landed @ 72a391a`, `sunco-pre-54-landed @ 8e22c9d`, `sunco-pre-55-landed @ 97af2c3` all preserved (unchanged)
20. No runtime module exports added in Phase 56 (L8; release-router is a workflow document surface, no new runtime namespace)
21. SDI-2 counter stays at **2** (L10; pre-planned split NOT SDI-2)
22. Phase 55 retroactive artifacts preserved untouched (L18; enforced via hard-locks + Section 32 byte-stability grep)

## Mid-milestone review gate absorption (DESIGN §9)

Mid-milestone gate ran post-Phase-55-landing as a separate convening event (not Gate 56). Verdict: **PASS-WITH-CONDITIONS**.

**C1 (dogfood producer-consumer chain wiring)** — Codex observation that Phase 55 dogfood tested individual modules (classifier + compound-router + sink-proposer) on fixture inputs but did not E2E-wire the producer-consumer chain edges in CI (e.g., evidence-collector → classifier → decision-writer → compound-router → sink-proposer end-to-end on a real fixture scenario producing both a durable RouteDecision AND a compound artifact in one test run). C1 folded into **v1.5 maintenance backlog** (post-Phase 56); NOT Phase 56 scope.

**C2 (doc drift 54-CONTEXT + references/compound/README.md "2 sections")** — 3 documentation sources use "2 sections" phrasing for sink-proposer output; runtime reality is 3 buckets. C2 folded into **v1.5 maintenance backlog** doc-consistency sweep; NOT Phase 56 scope. Phase 56 errata D3 logs the mid-milestone carryover.

**Phase 57 deferral posture confirmed**: `/sunco:auto` integration remains frozen through Phase 56 landed + explicit gate opening. Stage 1 Q8 convergent: do NOT touch `/sunco:auto` in Phase 56.

**Architecture.md namespace update deferred to v1.5-closure**: 5-iteration observational pattern (Phase 52-55) extended to 6th iteration in Phase 56 (L14). Formalization conversation at v1.5-closure meta-retrospective.

**Phase 56 scope confirmed**: Release-router hardening per DESIGN §11 30a; 10 sub-stage decomposition + approval envelopes + smoke Section 32 (~18-22 checks). Workflow file only; no new runtime.

## Next phase handoff (Phase 57 deferred; Phase 56 construction in-flight)

**Phase 57 (deferred, explicit gate post-56)** — `/sunco:auto` integration. Frozen through Phase 56 + explicit gate opening. Gate condition: Phase 56 LANDED on origin + explicit mid-milestone-gate-2 (or v1.5-closure gate) opens Phase 57 planning window.

Phase 57 inherits from Phase 56:
- 10 sub-stage release approval-envelope contract (workflows/release.md)
- AB1/AB2 scope + class wording (verbatim; Phase 56 L3 L4)
- SDI-2 counter at 2 (unchanged through v1.5 to date)
- 6-iteration architecture.md defer pattern
- 10-fixture Codex strict-side union pattern (formalization candidate)

**v1.5 maintenance backlog (7 items; harvest at v1.5-closure meta-retrospective):**
1. (i) `.claude/rules/architecture.md` namespace update (compound-router + release-router labels; 6th iteration defer)
2. (ii) Codex O1 README + product-contract cascade flag formalization (Phase 54 observation)
3. (iii) Codex O2 per-phase anchor convention formalization (Phase 56 = 5th iteration; next iteration at 6 triggers formalization conversation)
4. (iv) D3 doc drift sweep: 54-CONTEXT L3/L20/L65 + references/compound/README.md L76-L77 update "2 sections" → "3 buckets" (C2 mid-milestone carryover folded in)
5. (v) 3-role strict-side union rule formalization (10 accumulated fixtures across Phases 53-56; L16 deferral target)
6. (vi) C1 dogfood producer-consumer chain wiring (mid-milestone gate carryover)
7. (vii) D1 APPROVAL-BOUNDARY.md L32 inclusive class literal clarification (spec-clarification sweep)

## Verify-lite snapshot at Phase 56 entry (pre-Commit A)

- HEAD: `97af2c3` (Phase 55 2-commit unit endpoint: A `3500d77` + B `97af2c3`)
- origin/main: `97af2c3` (Phase 55 push-landed state 2026-04-21)
- `sunco-pre-55-landed`: `97af2c3` (newly created pre-Commit-A; non-commit ref; rollback anchor per L11; 5th iteration)
- `sunco-pre-54-landed`: `8e22c9d` (preserved)
- `sunco-pre-53-landed`: `72a391a` (preserved)
- `sunco-pre-52b-landed`: `4b1e093` (preserved)
- `sunco-pre-dogfood`: `3ac0ee9` (preserved)
- Smoke: **771/771** (744 Phase 54 baseline + 27 Section 31 [55-dogfood] additions)
- Self-tests: **249/249** across 10 modules (injector 10 + adapter 22 + backend-detector 17 + extract-spec-block 33 + confidence 21 + classifier 30 + evidence 21 + writer 32 + compound-router 42 + sink-proposer 21)
- Turbo lint+build: **10/10** (FULL TURBO cache)
- Vitest: **1627/1627** across 144 files (Phase 55 added `router-dogfood.test.ts` with 14 tests)
- SDI-2 counter: **2** (unchanged through Phase 56 pre-planned split per L10)
- v1.5 progress (at Commit A snapshot): 5/7 phases delivered (71%); Phase 56 in-flight

## Gate 56 v1 cross-model verification metadata

- **Implementer Claude**: Step 1 verify-lite (5/5 green) + Step 2 freshness 8-point (4 drifts D1/D2/D3/D4 surfaced; D1 L32 literal vs L26 intent, D2 Section offset continuation, D3 54-CONTEXT + README doc drift C2 carryover, D4 MEMORY.md post-landing housekeeping) + Step 3 Gate request (11 axes G1-G11 + pre-first-mutation anchor recommendation + 2 absorb-before-build wording requests) + scope-check (1 NEW asset class: workflows/release.md; 1 touch class: smoke Section 32; 0 mutation classes to Phase 52a-55 runtime)
- **Reviewer Claude**: GREEN-CONDITIONAL; 2 absorb-before-build wording conditions AB1 (G5 artifact-gate scope wording) + AB2 (G2 CHANGELOG class-by-purpose wording); drift dispositions D1 errata-only / D2 errata-only / D3 errata-only (C2 mid-milestone carryover) / D4 post-landing housekeeping; architecture.md defer 6th iteration approval; sunco-pre-55-landed anchor approval (Codex O2 formalization deferred to 6th iteration / v1.5-closure); mid-milestone gate PASS-WITH-CONDITIONS absorption confirmed (C1 + C2 both to v1.5 maintenance backlog)
- **Codex**: GREEN-CONDITIONAL; strict-side on AB1 artifact-gate scope wording (must harden "references by name" → "references without opening" + explicit hard-lock + smoke assertion) + AB2 CHANGELOG class-by-purpose policy sentence (must place verbatim directly after the 10-row risk_level mapping table, not in prose commentary elsewhere); layout disposition confirms 10-sub-stage ordering per DESIGN §11 30a; non-blocking D1 observation extended to v1.5 maintenance backlog; Phase 56 start-implementation authorization; `/sunco:auto` explicit no-touch reaffirmed
- **Convergence**: No RED, no v2 relay. 2 absorb-before-build wording conditions on Reviewer + Codex joint positions (AB1 artifact-gate scope + AB2 CHANGELOG class-by-purpose). Structural convergence on G1/G2/G3/G4/G6/G7/G8/G9/G10/G11. Gate 56 GREEN-CONDITIONAL proceeding to construction. Phase 47/48/49/51/52a/52b/53/54/55 convergent-absorption precedent applied (L16).
- **Pattern logged**: Cross-phase 3-role strict-side union / wording-absorption count = **10 accumulated fixtures** (Phase 53: 2; Phase 54: 4; Phase 55: 2; Phase 56: 2). Observational fixture accumulated for v1.5-closure meta-retrospective (per L16). Crossing 10 is a strong formalization signal — v1.5-closure formalization conversation is the designated venue.
