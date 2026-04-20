# Phase 52a — Router Core Schemas + State Machine Docs

- **Spec alias**: v1.5/M6 Phase 52a (first phase of v1.5 committed set)
- **Milestone**: M6 SUNCO Workflow Router
- **Design source**: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at commit `30e2041`; 4-round convergent review; **IMMUTABLE in Phase 52a** per Codex hard-lock)
- **Requirement**: IF-18 (state machine), IF-20 (route decision schema), (partial spec) IF-19 (evidence model), (partial spec) IF-21 (approval boundary)
- **Status**: Phase 52a LANDED 2026-04-20 as 3-commit unit (`5b8094e` planning kickoff + `13c110d` static contracts + `4b1e093` pre-push metadata align; `origin/main == HEAD == 4b1e093`). Gate 52a v2 convergent: Codex GREEN + plan-verifier GREEN-CONDITIONAL → post-absorption GREEN at `4b1e093`.

## Phase 52a character

**Static subset only**. No runtime code. No command files. No workflow files. No vitest runtime tests. 52a is the **schema + contract documentation** layer that 52b will consume. See scope lock below for exact boundary.

## Gate 52a v2 — convergent absorption log

### Round 1 — Implementer v1 request (12 axes + 3 drifts)

Axes G1-G12 submitted with inline proposals. Drifts D1 (27a command file check belongs to 52b), D2 (APPROVAL-BOUNDARY.md as separate reference doc — not in original DESIGN §Patch G), D3 (`.gitignore .sun/router/session/` unnecessary, `.sun/` already covered) flagged.

### Round 2 — Two-judge convergent (Codex + plan-verifier)

Both validators returned **GREEN-CONDITIONAL**. Conditions merged (no divergence; Codex 5 conditions + plan-verifier 4 blocking subset-convergent). Absorbed in this Phase 52a execution per Phase 47/48/49/51 precedent (no v2-relay).

### Locked decisions (Phase 52a v2)

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | **2-commit pre-planned split** (Codex G1-b + plan-verifier G6 deliverable size) | Commit A = milestone kickoff (ROADMAP + REQUIREMENTS + STATE + 52a-CONTEXT populate); Commit B = static deliverables (schema + 5 reference docs + `.planning/router/decisions/.keep` + smoke Section 27 static subset). Total projected ~1300 lines; splitting avoids 1500-line monolithic commit and separates artifact classes. NOT SDI-2 (pre-planned scope separation per L5/v1.4 policy). |
| L2 | **APPROVAL-BOUNDARY.md as Phase 52a reference doc** (Codex G2 + plan-verifier G2) | DESIGN §6 kept as source-of-truth in DESIGN-v1.md; APPROVAL-BOUNDARY.md is repo-local operational mirror with **definitional class** (Patch K verbatim) + exceptions + blessed orchestrator batched-ACK + forbidden-without-ACK hard-lock list. Contract language ("contract requires..."); no runtime language ("classifier will..."). |
| L3 | **10 stages full contract in STAGE-MACHINE.md** (plan-verifier G6) | DESIGN §2.3 obligates "full table is Phase 52a deliverable". BRAINSTORM/PLAN/WORK/REVIEW/VERIFY/PROCEED/SHIP/RELEASE/COMPOUND/PAUSE all receive entry_preconditions / exit_conditions / authorized_mutations / forbidden_mutations; PAUSE additionally has persistence_location + resume_trigger + re_entrance per J2. |
| L4 | **Smoke Section 27 naming** = "Router Core Static Contract (Phase 52a)" (Codex condition 3) | Check name prefix `[52a-static]` on each assertion. Section 28 reserved for 52b with name "Router Classifier Runtime (Phase 52b)"; no placeholder emitted by 52a. |
| L5 | **Clean-room notice verbatim on 5 reference docs** (Codex G10 + plan-verifier G10) | README + STAGE-MACHINE + EVIDENCE-MODEL + CONFIDENCE-CALIBRATION + APPROVAL-BOUNDARY — all top-of-file. Consistency with J5 10-path grep scope-set (notice presence required to pass smoke 27n verbatim check). |
| L6 | **DESIGN-v1.md unchanged** (Codex new hard-lock) | Phase 52a decisions recorded in this 52a-CONTEXT.md "DESIGN errata" section; DESIGN-v1.md NOT patched. Future drift discovered during 52a absorbed here, not in DESIGN. This prevents "design baseline drift loop" (Codex concern). |
| L7 | **27a command file existence check → 52b scope** (D1 absorbed) | `commands/sunco/router.md` is 52b deliverable per DESIGN §9. Smoke 52a Section 27 drops 27a. |
| L8 | **27v3 Y1 class-definition test → 52b scope** (plan-verifier G3) | Runtime test with 10-fixture classification; belongs with 52b runtime enforcement. 52a includes only the class definition text in APPROVAL-BOUNDARY.md, not a runtime test. |
| L9 | **27t `.sun/` gitignore grep → 52a static** (D3 + plan-verifier G3) | `.sun/` is already in `.gitignore` (line 12 pre-52a). Smoke 27t asserts this existing entry satisfies "ephemeral tier gitignored" invariant; no new `.gitignore` mutation in 52a. |
| L10 | **52b/53 drafts = handoff notes only** (Codex condition 5) | Section "Next phase handoff" below includes 1-2 lines per phase; no planning artifact bloat. Full 52b/53 plans deferred to those phases' CONTEXT.md. |
| L11 | **REQUIREMENTS.md IF-18~IF-23 + phase mapping table** (plan-verifier non-blocking recommendation accepted) | Cross-phase IF coverage table at end of v1.5 section improves independent readability. |

### DESIGN errata (absorbed here, NOT patched into DESIGN-v1.md per L6)

**E1 — Smoke 27a scope correction** (DESIGN §11 original placement error):
Original `27a  commands/sunco/router.md exists + frontmatter name=sunco:router` listed under Section 27 as if 52a-executable. Correction: 27a is a Phase 52b deliverable check because `commands/sunco/router.md` is itself a 52b file. 52a Section 27 drops 27a. Section 28 (52b) will re-host it as `[52b-runtime]` check.

**E2 — APPROVAL-BOUNDARY.md added as 52a reference doc** (Drift D2 → L2 absorbed):
DESIGN §Patch G original "Clean-room notice on README/STAGE-MACHINE/CROSS-DOMAIN" list did not enumerate APPROVAL-BOUNDARY.md because the file was not in the original file layout. Convergent review upgraded it to a 52a deliverable for operational value (runtime enforcement in 52b needs a stable contract doc). Clean-room notice applies per L5.

**E3 — `.gitignore` `.sun/router/session/` entry unnecessary** (Drift D3 → L9 absorbed):
Existing `.gitignore` entry `.sun/` (line 12) already covers all subdirectories. DESIGN §9 Phase 52a listing of "`.sun/router/` gitignore entry" is satisfied by the parent entry; no mutation.

**E4 — Clean-room notice scope extension** (Round 2 absorbed as J5 evidence):
Original DESIGN §Patch G listed 3 files for verbatim notice. J5 expansion to 10-path grep scope required notice on 5 reference docs. 52a honors J5 scope (this is implementation guidance, not DESIGN re-spec; recorded here per plan-verifier Q3 answer).

### Scope lock (committed deliverables)

**Commit A — `planning(router): register v1.5 SUNCO Workflow Router kickoff`** (landed as `5b8094e`):
1. `.planning/ROADMAP.md` — v1.5 M6 section append (7 phase entries; timeline; success criteria)
2. `.planning/REQUIREMENTS.md` — v1.5 IF-18~IF-23 + phase mapping table
3. `.planning/STATE.md` — v1.4→v1.5 transition (milestone, current_phase, progress, previous_milestone retrospective)
4. `.planning/phases/52a-router-core-schemas/52a-CONTEXT.md` — this file

**Commit B — `feat(router): add Phase 52a route decision schema and static references`** (landed as `13c110d`):
5. `packages/cli/schemas/route-decision.schema.json` — DESIGN §4.1 verbatim (JSON Schema draft-07)
6. `packages/cli/references/router/README.md` — clean-room notice + purpose + file index
7. `packages/cli/references/router/STAGE-MACHINE.md` — 10 stages full contract + forward/regress/reset transitions
8. `packages/cli/references/router/EVIDENCE-MODEL.md` — 4 source tiers + 7-point Freshness Gate + UNKNOWN policy
9. `packages/cli/references/router/CONFIDENCE-CALIBRATION.md` — 4 bands + deterministic formula + frozen weights + enforcement invariants + failure-fallback mode
10. `packages/cli/references/router/APPROVAL-BOUNDARY.md` — 6 risk levels + `repo_mutate_official` definitional class + exceptions + blessed orchestrator batched-ACK + forbidden-without-ACK hard-lock list; contract language only
11. `.planning/router/decisions/.keep` — directory reservation
12. `packages/cli/bin/smoke-test.cjs` — Section 27 "Router Core Static Contract (Phase 52a)" with static-only checks (27b, 27c, 27d, 27e, 27f, 27g, 27j, 27k, 27l, 27m, 27n, 27o, 27t, 27v doc-only, 27y, 27z, 27aa)
13. `packages/cli/package.json` files[] — **no mutation** (`schemas/` and `references/` already included; verified during Gate 52a)

**Commit C — `docs(router): align Phase 52a status metadata`** (landed as `4b1e093`):
14. `.planning/router/README.md` — Status prose alignment for post-kickoff state (superseded "Not yet registered in .planning/ROADMAP.md")
15. `.planning/STATE.md` — narrative paragraph alignment for post-commit-B state (superseded "Commit A in progress; Commit B next")

Reviewer classification: pre-push planning-consistency metadata alignment, **NOT SDI-2** (not a reactive post-push additive fix). Absorbed into same 3-commit atomic unit.

### Hard-locks (Phase 52a)

From DESIGN + Round 2 absorption:
- `.github/workflows/ci.yml` untouched (v1.4 Path-A continuation)
- `packages/cli/schemas/` existing schemas (`finding.schema.json`, `cross-domain.schema.json`, `ui-spec.schema.json`) untouched
- `packages/cli/commands/sunco/` existing commands untouched (router.md, compound.md are 52b/54 scope)
- `packages/cli/workflows/` existing workflows untouched
- `.claude/rules/` unchanged (router design is NOT promoted to rules in 52a; that happens through Phase 54 compound-router approval path or later)
- Memory unchanged beyond v1.4-shipped entries
- `/sunco:auto` related files untouched (frozen until Phase 57)
- Existing stage commands (brainstorm/plan/execute/verify/proceed-gate/ship/release/compound) untouched
- **NEW hard-lock (Codex)**: `.planning/router/DESIGN-v1.md` NOT modified in Phase 52a except by explicit user request; drift goes to this file's "DESIGN errata" section
- No runtime code (no .mjs/.ts under `references/router/src/` or elsewhere; those are 52b)
- No vitest test files for router (52b)

### Done-when criteria

1. Commit A landed: ROADMAP + REQUIREMENTS + STATE updated; 52a-CONTEXT.md populated; no other mutations
2. Commit B landed: 5 reference docs + schema + smoke Section 27 static + decisions/.keep; no runtime code
3. All 5 reference docs contain verbatim clean-room notice at top (27n verbatim check passes)
4. STAGE-MACHINE.md defines all 10 stages with full contract fields (27e check passes)
5. `route-decision.schema.json` is valid JSON Schema draft-07 with 10-stage enum + UNKNOWN in current_stage; HOLD in recommended_next (27b, 27c, 27d)
6. Smoke Section 27 static subset all pass (lint + build + smoke 619 baseline + **35 new Section 27 [52a-static] checks = 654/654** actual at Commit B `13c110d`)
7. Regression: smoke Sections 1-26 byte-stable (pre-52a baseline)
8. Self-tests 10/22/17/33 unchanged (injector/adapter/backend-detector/extract-spec-block)
9. Turbo lint 89/0 unchanged; turbo build 5/5 unchanged
10. Clean-room grep (10-path scope) returns 0 matches outside verbatim notices
11. No modification to DESIGN-v1.md
12. User ACK for both Commit A and Commit B pushes (v1.4 Push boundary rule L4)
13. SDI-2 counter preserved at 2 post-Phase-52a

### Next phase handoff

**Phase 52b (committed, post-52a-landed)** — Router classifier + evidence collector + decision writer + confidence module + router.md command + workflows/router.md + vitest runtime tests (15+ classifier cases, confidence invariants 27p-s, freshness parser, ephemeral/durable writer, Y1 class-definition 27v3). Full Gate 5 (runtime code entry; SDI-2 elevation risk at first runtime landing).

**Phase 53 (committed, post-52b-landed)** — Router wrappers for `/sunco:do`, `/sunco:next`, `/sunco:mode`, `/sunco:manager`. `/sunco:auto` explicitly excluded (Phase 57). Existing stage commands byte-identical guarantee. Phase 53 impact analysis deferred to its own CONTEXT.md.

### Verify-lite snapshot at Phase 52a entry

- HEAD: `30e2041` (v1.5 router design capture commit)
- origin/main == HEAD, working tree clean (pre-52a)
- Smoke: 619/619
- Self-tests: injector 10/10, adapter 22/22, backend-detector 17/17, extract-spec-block 33/33
- Turbo lint: 89/0 (5/5 tasks)
- Turbo build: 5/5 tasks, ESM ~797 KB
- `sunco-pre-dogfood` branch preserved at `3ac0ee9`
- SDI-2 counter: 2 (unchanged)
