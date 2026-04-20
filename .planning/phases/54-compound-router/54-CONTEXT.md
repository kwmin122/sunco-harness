# Phase 54 — Compound-Router (post-stage durable-decision consumer)

- **Spec alias**: v1.5/M6 Phase 54 (fourth phase of v1.5 committed set; first compound artifact generation)
- **Milestone**: M6 SUNCO Workflow Router
- **Design source**: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at commit `30e2041`; IMMUTABILITY extended through Phase 54 per Gate 52b B2 / Phase 53 L16 continuation — drift observed during Phase 54 absorbed in this CONTEXT under "DESIGN errata / ROADMAP drift" section, NOT patched into `DESIGN-v1.md` or `ROADMAP.md`)
- **Requirement**: IF-22 (compound-router; post-stage hook with trigger-score model; sink proposals; `compound.schema.json` status lifecycle)
- **Status**: Gate 54 v1 convergent absorbed (Reviewer Claude GREEN-CONDITIONAL with 4 blocking B1/B2/B3/B4 + 3 drift dispositions D1/D2/D3 + architecture.md defer; Codex GREEN-CONDITIONAL with 4 required conditions G5-naming/JSON-$comment/Section-29-amendments/2-commit-split + 11-axis disposition + stricter G5 phrasing union-absorbed; no RED; no divergent-blocking requiring v2 relay; strict-side union on G5 naming + G6 `$comment` + wrapper-hint removal + architecture.md no-touch); construction proceeding; 2-commit pre-planned split (scaffold + runtime).

## Phase 54 character

**First compound artifact phase in v1.5; first real consumer of the durable-tier RouteDecision log.** Phase 52a shipped router contracts (schemas + 5 reference docs). Phase 52b shipped the runtime engine (4 modules + `/sunco:router` thin command + `workflows/router.md` deterministic pipeline). Phase 53 connected 4 entry-point wrappers (`/sunco:do`, `/sunco:next`, `/sunco:mode`, `/sunco:manager`) + mode hook to that engine.

Phase 54 adds a **post-stage durable-decision consumer** — *not* an automatic hook wired into the router pipeline. Distinction is load-bearing: installing an automatic hook (DESIGN §8.1 literal reading) would require mutating `workflows/router.md`, `/sunco:router`, wrapper rendering, or `decision-writer.mjs`, all of which are byte-stable per Phase 52b/53 hard-lock (L5/L16). The compound-router instead reads durable RouteDecision files under `.planning/router/decisions/` on demand, scores whether to produce a compound artifact, and (when the score crosses threshold) writes a `.planning/compound/*.md` artifact and emits sink proposals for user ACK. `/sunco:compound` is a standalone user-invoked command; the 4 wrappers do NOT surface compound hints in Phase 54 (Codex-strict naming; automatic hook integration deferred until Phase 55 dogfood or later gate).

Phase 54 deliverables:

- 1 new schema (`packages/cli/schemas/compound.schema.json`) with draft-07 + `$comment` clean-room notice
- 2 new runtime modules (`packages/cli/references/compound/src/{compound-router,sink-proposer}.mjs`) — pure deterministic; adapter-injected IO (Phase 52b pattern); local structural validator (Phase 52b L7)
- 1 new command (`packages/cli/commands/sunco/compound.md`) — thin wrapper; byte-identical invocation semantics regardless of router state
- 1 new workflow (`packages/cli/workflows/compound.md`) — deterministic 6-step pipeline mirroring `workflows/router.md` shape
- 1 template + 2 READMEs (`references/compound/{README,template}.md` + `.planning/compound/README.md`)
- Smoke Section 30 `[54-compound]` additive block (~22 checks)
- Section 29 29o + 29q amendments (compound.md absence → presence; command count 88 → 89)
- `product-contract.md` command count 88 → 89
- 8-command R1 stage protection set (adds `compound` to the existing 7: `brainstorming/plan/execute/verify/proceed-gate/ship/release`)

Full Gate 5 scrutiny inherited (novel risk vectors per DESIGN §14): auto-write discipline, sink-proposal boundary, clean-room invariant extension to 9-path scope, JSON schema clean-room via `$comment` (not inline comments), 3-role strict-side union on "post-stage hook" naming.

## Gate 54 v1 — convergent absorption log

### Round 1 — Implementer v1 request (11 axes G1-G11 + pre-first-mutation anchor + 3 drift findings)

11 axes submitted inline (G1 trigger score / G2 auto-write boundary / G3 sink proposer / G4 schema+lifecycle / G5 hook integration / G6 clean-room scope / G7 command count / G8 Section 29 amendment / G9 smoke Section 30 / G10 commit shape + SDI-2 / G11 Phase 55 handoff). 3 drift findings surfaced: D1 STATE.md "pre-planned 2-commit" vs 3-commit actual, D2 DESIGN §11 Section 29 assignment vs actual Section 30, D3 29q hardcoded 88 needing flip to 89. Rollback anchor recommended: `git branch sunco-pre-53-landed 72a391a` pre-first-mutation.

### Round 2 — Two-gate convergent (Codex + Reviewer Claude)

Both verdict: **GREEN-CONDITIONAL**. No RED. No divergent-blocking requiring v2 relay. Strict-side union applied on 4 axes where Codex tightened Reviewer's positions:

**U1 — G5 naming (Codex strict)**:
- Reviewer: "(b') standalone compound-router; wrappers MAY surface compound candidate hint when score ≥2; no auto-invoke"
- Codex: "post-stage hook" phrasing FORBIDDEN. Replace with "post-stage durable-decision consumer". Wrappers do NOT surface compound hints (auto-visible signalling in wrappers still requires wrapper mutation → L5/L16 violation). `/sunco:compound` is fully user-invoked standalone. Automatic hook integration deferred to Phase 55 dogfood or later gate.
- **Absorbed (Codex strict)**: No wrapper-visible compound hints in Phase 54. Wrappers byte-stable from `72a391a`. `/sunco:compound` reads durable-tier RouteDecision logs on invocation; user decides when to run it. Phase 55+ re-evaluates whether automatic surfacing is safe.

**U2 — G6 JSON schema clean-room notice (Codex strict)**:
- Reviewer: `description` field in schema carries "Clean-room design" marker + sibling `README.md` carries verbatim 10-sentence notice; 10-path scope → 9-path
- Codex: JSON-with-comments is tooling-incompatible; `description` is a user-facing field not suitable for clean-room attribution; use JSON Schema draft-07 **`$comment`** field (reserved annotation) to carry the clean-room notice; 9-path scope for verbatim notice (schema excluded; schema carries its own `$comment`)
- **Absorbed (Codex strict)**: `compound.schema.json` uses `"$comment": "Clean-room notice: SUNCO Compound Router is independently authored; no code, prompts, schemas, or documentation text from compound-engineering-plugin is copied, vendored, or adapted."` at top level. Strict JSON preserved (no comment syntax). Verbatim 10-sentence notice lives in `references/compound/README.md` + 8 other `.md`/`.mjs` files (9-path scope for verbatim).

**U3 — G8 Section 29 amendment scope (both converge, Codex tightens alternative)**:
- Reviewer: 29o + 29q both flip in Section 29 (scope-additive from kickoff G8)
- Codex: Section 29 amendment YES; **do NOT duplicate same assertions in Section 30**; the old Phase 53 guard must evolve now that compound exists
- **Absorbed (convergent)**: 29o flip (compound.md absence → presence + frontmatter + 8-command stage set) + 29q flip (88 → 89) in Section 29 with minimal 1-line changes. Section 30 adds new [54-compound] coverage only, does not mirror 29o/29q.

**U4 — Architecture.md namespace bundle (both converge, Codex hardens defer)**:
- Reviewer: defer recommend (scope creep + R1-critical area)
- Codex: "Defer. Do not touch `.claude/rules/architecture.md`."
- **Absorbed**: `.claude/rules/architecture.md` **NO TOUCH** in Phase 54. Namespace clarification lives in this 54-CONTEXT.md + `references/compound/README.md`. Coordinated update deferred to Phase 56 provisional or v1.5 maintenance backlog.

### Locked decisions (Phase 54 v1)

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | **Trigger score model is pure deterministic** (G1 convergent GREEN) | `scoreCompound({stage_exit, event, window}) → {score: number, reasons: string[]}` in `compound-router.mjs`. No LLM in scoring path (mirrors `confidence.mjs` I4 invariant). L3 split: SDI-observational +2 vs spec-rule-prescriptive +3 (sinks separate; 1:1 mapping with `patterns_sdi` vs `rule_promotions` artifact sections per Codex non-blocking observation). Always-on: RELEASE +6 / MILESTONE CLOSED +5. Conditional +3/+2/+1. Dampeners -3/-2/-2. Threshold ≥5 auto-write `status: proposed`; 2-4 "candidate" note; <2 silent. RELEASE/MILESTONE override threshold. |
| L2 | **Auto-write boundary: `.planning/compound/*.md` ONLY** (G2 convergent GREEN; L6 decision-writer precedent extended) | `compound-router.mjs` writer uses path-allowlist: `<repoRoot>/.planning/compound/<scope>-<ref>-<date>.md` AND `<repoRoot>/.planning/compound/*.md` (drafts). Any other path throws `CompoundWriterPathError`. `memory/`, `.claude/rules/`, `.planning/backlog/` (999.x), SDI counter state, REQUIREMENTS.md, ROADMAP.md, STATE.md, CHANGELOG.md, phase CONTEXT/PLAN/VERIFICATION/SUMMARY — all rejected at the writer boundary. |
| L3 | **Sink proposer boundary: proposal-only** (G3 convergent GREEN) | `sink-proposer.mjs` emits proposals as 2 sections within the compound artifact: `## patterns_sdi` (L3 +2 source; SDI-observational; occurrence count + suggested SDI counter delta) and `## rule_promotions` (L3 +3 source; spec-rule-prescriptive; `.claude/rules/<file>` diff preview as code-fenced block). Sink proposer NEVER writes to `memory/`, `.claude/rules/`, `.planning/backlog/`, or SDI counter state. Smoke Section 30 negative-write grep asserts this: source code has zero matches for `writeFile.*memory\|\.claude/rules\|backlog` (excluding comments referencing the hard-lock). |
| L4 | **Compound schema: draft-07 + `$comment` clean-room + 8 required sections** (G4 GREEN-CONDITIONAL → Codex-strict `$comment` absorbed per U2) | `packages/cli/schemas/compound.schema.json`: `kind: const "compound"`, `version: const 1`, `scope: enum [release, milestone, phase, incident, ad_hoc]`, `ref: string`, `window: {from: date-time, to: date-time}`, `status: enum [draft, proposed, partially-approved, approved, archived]`, `source_evidence: array`, `sections: array (8 required names)`, `clean_room_notice: const true`, `generated_by: const "sunco-compound-router"`. Top-level `$comment` carries the clean-room attribution. Strict JSON preserved. Local structural validator (no AJV per Phase 52b L7; Phase 48 yaml-packaging debt). |
| L5 | **G5 = Option (b') standalone post-stage durable-decision consumer** (U1 strict-side union; Codex naming) | `/sunco:compound` is a user-invoked standalone command. It reads durable-tier RouteDecision logs under `.planning/router/decisions/*.json` (any matching `<ref>` pattern or `--window` flag). It computes the trigger score per L1. It writes the compound artifact under L2 auto-write boundary if score ≥ threshold. It emits sink proposals per L3. It does NOT install an automatic hook into the router pipeline. `workflows/router.md` / `classifier.mjs` / `evidence-collector.mjs` / `confidence.mjs` / `decision-writer.mjs` / `/sunco:router` / 4 wrapper command files — all byte-stable from Phase 52b/53. Wrappers do NOT surface compound hints. Automatic hook integration deferred until Phase 55 dogfood or later gate. |
| L6 | **G6 = 9-path verbatim clean-room notice scope + `$comment` in schema** (U2 strict-side union) | Verbatim 10-sentence clean-room notice identical to Phase 52a/52b/53 applied at: (1) `references/compound/README.md`, (2) `references/compound/template.md`, (3) `references/compound/src/compound-router.mjs` (JS comment block), (4) `references/compound/src/sink-proposer.mjs`, (5) `commands/sunco/compound.md`, (6) `workflows/compound.md`, (7) `.planning/compound/README.md`, (8) this `54-CONTEXT.md`, (9) reserved (any new src file added during impl). Schema excluded from verbatim scope; schema carries `$comment` attribution only. Clean-room grep (Section 30 `[54-compound]`) asserts 0 matches of `compound-engineering-plugin` outside notice blocks across the 9-path set + existing 10-path set from Phase 52a/52b/53. |
| L7 | **Section 29 amendment: 29o + 29q flip in-place** (G8 / U3 convergent; minimal-change) | 29o transition: (a) remove `compound.md absent (29o; Phase 54 scope; Phase 53 hard-lock)` check, (b) expand `stageNames` array from 7 to 8 (add `compound` after `release`), (c) update check label from "7 stage commands present incl. brainstorming" to "8 stage commands present incl. brainstorming+compound". 29q transition: single-integer edit `=== 88` → `=== 89` plus label text update. Section 29 header comment preserved. All other Section 29 checks (29a-29n, 29p, 29r) byte-stable. Section 27 + Section 28 byte-stable. |
| L8 | **Pre-planned 2-commit split** (G10 / U4 split accepted; LOC estimate 1700-2000 exceeds reviewer-comfort threshold) | **Commit A** = `docs(router): scaffold Phase 54 compound-router context and namespace` (planning/scaffold scope; 54-CONTEXT + STATE prose D1-fix + smoke Section 30 header block). **Commit B** = `feat(router): add Phase 54 compound-router schema command workflow and smoke coverage` (runtime scope; schema + 2 src modules + command + workflow + 2 READMEs + template + smoke Section 30 populated + Section 29 29o/29q flip + product-contract 88→89 + STATE progress bump 3→4 / 42→57). Classification in both commit messages: **NOT SDI-2** per Gate 52b B4 + Phase 53 Codex precedent. SDI-2 counter stays at **2**. |
| L9 | **Rollback anchor `sunco-pre-53-landed @ 72a391a`** (Gate approved; pre-first-mutation) | Created before first file write. Non-destructive local branch ref; parallels `sunco-pre-dogfood @ 3ac0ee9` + `sunco-pre-52b-landed @ 4b1e093`. Branch ref is not file state; does not belong in any commit. Preserved across Phase 54 lifetime. |
| L10 | **Phase 52b + 53 runtime assets byte-stable** (L16 hard-lock extension; B1/U1 derived) | Zero mutation to: `packages/cli/references/router/src/{classifier,evidence-collector,confidence,decision-writer}.mjs`, `packages/cli/references/router/{README,STAGE-MACHINE,EVIDENCE-MODEL,CONFIDENCE-CALIBRATION,APPROVAL-BOUNDARY}.md`, `packages/cli/commands/sunco/router.md`, `packages/cli/workflows/router.md`, `packages/cli/commands/sunco/{do,next,mode,manager}.md`, `packages/cli/hooks/sunco-mode-router.cjs`, `packages/cli/schemas/route-decision.schema.json`. Enforced via Section 30 content-marker parity grep (parallels 28r/29r pattern). |
| L11 | **8 stage commands byte-identical R1 guard expansion** (expansion of Phase 53 L15 7-command set) | After Phase 54 Commit B lands: R1 regression guarantee covers 8 stage commands (`brainstorming/plan/execute/verify/proceed-gate/ship/release/compound`). Phase 54 ADDS `compound.md` as a net-new file (not a mutation of existing files). Existing 7 stage command files byte-identical from `7791d33`. Pre-commit invariant: `git diff --name-only 72a391a..HEAD -- packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release}.md | wc -l == 0`. |
| L12 | **Namespace clarification continuation (architecture.md DEFER NO TOUCH)** (U4 Codex strict) | Agent Router (`packages/core/src/agent/router.ts`, Phase 01/v1.0) and Workflow Router (`packages/cli/references/router/src/*.mjs`, Phase 52a/52b/v1.5) remain separate namespaces. Compound-router (`packages/cli/references/compound/src/*.mjs`, Phase 54/v1.5) sits on the Workflow Router side as a downstream consumer. `.claude/rules/architecture.md` **NOT touched** in Phase 54 — Codex-strict defer per U4. Namespace clarification documented here + `references/compound/README.md`. Deferred update target: Phase 56 provisional or v1.5 maintenance backlog. |
| L13 | **Adapter-injected IO for determinism (Phase 52b pattern extended)** | `compound-router.mjs` + `sink-proposer.mjs` accept `ctx = { readFile, readdirSync, writeFile, statFile, now, repoRoot }` with defaults using `node:fs` / `Date`. Self-tests inject fixtures. Mirrors `evidence-collector.mjs` / `decision-writer.mjs` adapter pattern. Enables Section 30 determinism assertion (100-iteration scoring byte-identical on fixture input, parallels 27p). |
| L14 | **Structural validator local (no AJV)** (Phase 52b L7 / Phase 48 yaml-packaging debt) | `compound-router.mjs` exports `validateCompoundArtifact(artifact) → void | throw CompoundArtifactInvalidError`. Checks: `kind === "compound"`, `version === 1`, `scope` enum match, `status` enum match, all 8 required sections present, `clean_room_notice === true`, `generated_by === "sunco-compound-router"`, `window.from` / `window.to` are ISO date-time strings. No schema library dep. |
| L15 | **3-role cross-phase learning: observational-only** (Phase 53 N1/N2 precedent continuation) | Gate 54 round surfaced Codex strict-side union on G5 naming / G6 `$comment` / wrapper-hint removal / architecture.md no-touch. This matches the Phase 53 pattern where Codex second-pass blocking (C commit `72a391a` R1 expansion + STATE git-state-determined wording) caught a class of issues Reviewer non-blocking observations flagged non-critically. Phase 54 54-CONTEXT records these as observational fixtures for Phase 55+ meta-work; **no rule formalization in Phase 54**. Formalization of the "3-role strict-side union" boundary remains deferred to Phase 55 dogfood cycle (accumulating more fixtures) or a v1.5-closure meta-retrospective. |
| L16 | **DESIGN / ROADMAP errata absorbed in this CONTEXT, not patched** (B2/L16 immutability extension continued) | DESIGN §11 Section 29 assignment (L572) vs actual Section 30 = known absorbed offset since Phase 52a/52b split. DESIGN-v1.md NOT modified. ROADMAP.md NOT modified. Drift recorded here under "DESIGN errata / ROADMAP drift" section. |
| L17 | **`/sunco:compound` scope: read durable-tier decisions + score + emit artifact** (L5 operational spec) | Invocation surface: `/sunco:compound [--ref <scope-ref>] [--window <ISO-from>..<ISO-to>] [--dry-run]`. Reads durable-tier RouteDecision files matching `--ref` or `--window`. Computes score per L1. If score ≥5 (or RELEASE/MILESTONE override), writes `.planning/compound/<scope>-<ref>-<date>.md` at `status: proposed`. If 2-4, emits "compound candidate" note to stdout (no write). If <2 AND not RELEASE/MILESTONE, exits silently. `--dry-run` skips the write step (recommendation preview only). |
| L18 | **Command count increment: 88 → 89** (G7 convergent GREEN) | Phase 54 adds `/sunco:compound` (1 new command). `product-contract.md` L92 updated: `Total commands: 88` → `89` with Phase 54/M6 attribution. 29q check amended (L7). Section 30 `[54-compound]` asserts `89` positive presence. |
| L19 | **STATE.md D1 natural overwrite in Commit A** (drift disposition from Gate round) | STATE.md "Current Position" prose line "Phase 53-router-wrappers delivered as pre-planned 2-commit unit" overwritten in Commit A to "Phase 53 delivered as 3-commit unit (A+B+C; Commit C added per Codex second-pass pre-push blocking)". Frontmatter unchanged at Commit A (still `completed_phases: 3` / `percent: 42`). Commit B bumps to `completed_phases: 4` / `percent: 57`. git-state-determined wording preserved (no "push awaits" / "On push, LANDED"). |
| L20 | **Section 30 coverage ~22 checks** (G9 convergent GREEN) | `[54-compound]` prefix on every assertion. Coverage: schema parse + draft-07 + `$comment` clean-room, 8 template section markers, compound-router.mjs `--test` self-test, sink-proposer.mjs `--test` self-test, scoring determinism (100-iter), artifact path-allowlist positive+negative, sink-proposer no-write negative grep, 9-path clean-room verbatim, `.planning/compound/README.md` exists, commands/sunco/compound.md frontmatter `name: sunco:compound`, workflows/compound.md clean-room, command count === 89, product-contract.md L92 contains "89", Section 27/28 byte-stable (content-marker parity grep), Section 29 amended (29o presence + 29q === 89 verified in Section 30 as cross-section assertion). |

## DESIGN errata / ROADMAP drift (observational; not patched)

**D1 — STATE.md "Current Position" self-contradiction (Phase 53)**: Line 39 of STATE.md at `72a391a` says "Phase 53-router-wrappers delivered as pre-planned 2-commit unit" but the same block then enumerates 3 commits (A `9377607` + B `4a5427f` + C `72a391a`). Pre-planned scope was 3 commits per Phase 53 Codex second-pass blocking. Disposition: Phase 54 Commit A overwrites the prose (natural update). Non-blocking.

**D2 — DESIGN §11 Section 29 vs actual Section 30**: DESIGN-v1.md §11 L572 asserts "Section 29 — Compound-router (Phase 54)". Actual smoke-test.cjs implementation: Section 27 = [52a-static], Section 28 = [52b-runtime], Section 29 = [53-wrapper], Section 30 = [54-compound]. This +1 offset was introduced when Phase 52 split into 52a/52b and the smoke section allocation followed execution order (one section per delivered phase), not the pre-split DESIGN §11 allocation. Known absorbed offset. Disposition: DESIGN-v1.md NOT modified (L16 immutability). Errata logged here. Non-blocking.

**D3 — 29q hardcoded command count 88**: Section 29 29q check hardcodes `allMdFiles.length === 88`. Phase 54 adds `compound.md` → count becomes 89. Disposition: L7 (Section 29 amendment in-place). 29q flip is scope-additive to kickoff G8 but unavoidable for smoke baseline preservation. Converted to B3 Reviewer blocking on Gate 54 v1 round. Resolved pre-construction.

**D4 — Phase 53 L15 phrasing vs Phase 54 L11 invariant scope**: Phase 53 done-when #13 refers to `7791d33..HEAD` as the byte-identical baseline. Phase 54 L11 updates this to `72a391a..HEAD` (Phase 53 endpoint). Natural baseline progression per-phase; no cross-phase conflict. Non-blocking; informational.

## Namespace clarification (continuation of 52b G7 / 53 L13)

Continues unchanged from Phase 53: Agent Router (`packages/core/src/agent/router.ts`) and Workflow Router (`packages/cli/references/router/src/*.mjs`) remain separate namespaces. Phase 54 adds compound-router (`packages/cli/references/compound/src/*.mjs`) as a downstream **read-only consumer of Workflow Router durable telemetry**. Compound-router does NOT interact with Agent Router. `.claude/rules/architecture.md` namespace doc update **continues deferred** (Codex-strict defer per U4; Phase 56 provisional or v1.5 maintenance backlog target).

## Cross-phase learning (3-role observational fixture; not formalized)

Phase 53 closure recorded the 3-role non-blocking↔blocking boundary (Codex second-pass blocking elevating Reviewer non-blocking observations to blocking). Phase 54 Gate round continues the pattern: Codex tightened Reviewer positions on 4 axes (G5 naming, G6 `$comment`, wrapper-hint removal, architecture.md no-touch). All 4 absorbed strict-side union pre-construction.

Phase 54 does NOT formalize the strict-side union rule — formalization remains deferred to Phase 55 dogfood cycle (additional fixtures) or v1.5-closure meta-retrospective per Phase 53 L15. Phase 54 records this gate round as an observational fixture:

- **Fixture**: Gate 54 v1 strict-side union count = 4 (G5 / G6 / wrappers / architecture.md)
- **Pattern**: Codex reads DESIGN / precedent literally and tightens phrasing even when Reviewer converges structurally
- **Value preserved**: L16 immutability (no workflows/router.md mutation), R1 regression guarantee (4 wrappers byte-identical), R1 expansion (8-command stage protection), clean-room rigor (JSON `$comment` not description)

## Scope lock (Phase 54 deliverables — pre-planned 2-commit split)

**Commit A — `docs(router): scaffold Phase 54 compound-router context and namespace`** (planning/scaffold scope; 3 files):

1. `.planning/phases/54-compound-router/54-CONTEXT.md` — **this file** (commit A content = Gate 54 decisions locked; runtime not yet touched)
2. `.planning/STATE.md` — D1 prose overwrite (L19; "2-commit unit" → "3-commit unit"); frontmatter unchanged at Commit A (`completed_phases: 3` / `percent: 42`)
3. `packages/cli/bin/smoke-test.cjs` — Section 30 header comment block only (no check logic yet; checks added in Commit B). Section 27, 28, 29 byte-stable. Section 30 marker present for reviewer orientation.

**Commit B — `feat(router): add Phase 54 compound-router schema command workflow and smoke coverage`** (runtime scope; ~11 files):

4. `packages/cli/schemas/compound.schema.json` — draft-07 + `$comment` clean-room + 8 required sections (L4)
5. `packages/cli/references/compound/README.md` — verbatim 10-sentence clean-room notice + file index + consumer map (mirrors `references/router/README.md` shape)
6. `packages/cli/references/compound/template.md` — 8-section artifact template with section headings
7. `packages/cli/references/compound/src/compound-router.mjs` — `scoreCompound` + `runCompound` + `validateCompoundArtifact` + adapter-injected IO + `--test` self-test
8. `packages/cli/references/compound/src/sink-proposer.mjs` — `proposeSinks` (emits `patterns_sdi` + `rule_promotions` sections) + adapter-injected IO + `--test` self-test
9. `packages/cli/commands/sunco/compound.md` — thin wrapper; frontmatter `name: sunco:compound`; clean-room notice; `<objective>` + `<process>` + `<constraints>`
10. `packages/cli/workflows/compound.md` — deterministic 6-step pipeline docs; clean-room notice
11. `.planning/compound/README.md` — compound artifact directory README; clean-room notice
12. `packages/cli/bin/smoke-test.cjs` — Section 30 `[54-compound]` checks populated (~22 checks per L20) + Section 29 29o + 29q amendments in-place (L7). Sections 27 + 28 byte-stable.
13. `packages/cli/references/product-contract.md` — L92 command count 88 → 89 (L18)
14. `.planning/STATE.md` — frontmatter bump `completed_phases: 3 → 4` + `percent: 42 → 57`; prose confirms Phase 54 Commit A + Commit B landed locally; git-state-determined wording preserved (no "push awaits")

Note: STATE.md is touched in both commits — Commit A = D1 prose fix (mid-phase reflection), Commit B = progress bump (end-phase reflection). Matches Phase 53 bookkeeping pattern.

## Hard-locks (Phase 54)

From Gate 54 v1 convergent absorption + strict-side union + Phase 52a/52b/53 hard-lock extensions:

- `.github/workflows/ci.yml` **untouched** (v1.4 Path-A continuation; unchanged through 52a/52b/53/54)
- `.claude/rules/` **NOT touched** (U4 Codex-strict defer; architecture.md namespace update deferred to Phase 56 / v1.5 maintenance backlog)
- `packages/cli/references/router/src/{classifier,evidence-collector,confidence,decision-writer}.mjs` **byte-identical from Phase 52b** (L10; L16 immutability extension)
- `packages/cli/references/router/{README,STAGE-MACHINE,EVIDENCE-MODEL,CONFIDENCE-CALIBRATION,APPROVAL-BOUNDARY}.md` **byte-identical from Phase 52a** (L10)
- `packages/cli/commands/sunco/router.md` **byte-identical from Phase 52b**
- `packages/cli/workflows/router.md` **byte-identical from Phase 52b**
- `packages/cli/commands/sunco/{do,next,mode,manager}.md` **byte-identical from Phase 53 (`72a391a`)** (L10; no wrapper-visible compound hints per U1)
- `packages/cli/hooks/sunco-mode-router.cjs` **byte-identical from Phase 53**
- `packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release}.md` **byte-identical from `7791d33`** (R1 regression continuation; L11 expansion path adds compound.md as new file, does not mutate existing 7)
- `packages/cli/commands/sunco/auto.md` **byte-identical from `7791d33`** (frozen until Phase 57)
- `packages/cli/commands/sunco/where-am-i.md` **byte-identical from `7791d33`** (Phase 53 L6 deferred)
- `packages/cli/schemas/{finding,cross-domain,ui-spec,api-spec,data-spec,event-spec,ops-spec,route-decision}.schema.json` **untouched** (8 existing schemas unchanged)
- `.planning/router/DESIGN-v1.md` **unchanged through Phase 54** (L16 immutability; D2 errata logged here)
- `.planning/router/README.md` unchanged (Phase 52a asset)
- `.planning/router/decisions/` unchanged (content; `.keep` preserved)
- `.planning/router/paused-state.json` NOT created by Phase 54 (first `/sunco:pause` invocation owns creation)
- `.planning/ROADMAP.md` **unchanged through Phase 54** (L16; D2 errata logged here)
- `.planning/REQUIREMENTS.md` unchanged (IF-22 already marked "Covered by Phase 54" at definition point)
- Memory files unchanged (sink-proposer surfaces memory candidates as proposals within compound artifacts; no memory write)
- `/sunco:auto` frozen (auto.md byte-identical)
- SDI counter unchanged at **2** (pre-planned split is NOT SDI-2 per Gate 52b B4 + Phase 53 precedent)
- No new npm dependency (local structural validator; no AJV)
- No Phase 52b runtime API consumption outside read-only durable-tier file reads (compound-router does NOT import runtime module functions; reads RouteDecision JSON files directly)

## Done-when criteria (24 items)

1. Rollback anchor `sunco-pre-53-landed @ 72a391a` created pre-file-write (L9) — verifiable via `git rev-parse sunco-pre-53-landed`
2. Commit A landed locally: 54-CONTEXT scaffold + STATE D1 prose overwrite + smoke Section 30 header; no amend; no force-push
3. Commit B landed locally: schema + 2 src modules + command + workflow + 2 READMEs + template + smoke Section 30 populated + Section 29 29o/29q amendments + product-contract 89 + STATE progress bump; no amend; no force-push
4. Full verify-lite green POST-Commit-B: smoke (706 baseline + Section 30 additions), 10 self-tests (186 baseline + 2 new: compound-router + sink-proposer), turbo lint+build (10/10), vitest (1099/1099 unchanged; no new vitest file required for Phase 54 since self-tests cover determinism)
5. `schemas/compound.schema.json` parses as valid JSON + draft-07 `$schema` + top-level `$comment` contains "Clean-room notice" + "compound-engineering-plugin" (negation form)
6. `references/compound/README.md` verbatim 10-sentence clean-room notice present (L6)
7. `references/compound/template.md` contains 8 section headings: `context`, `learnings`, `patterns_sdi`, `rule_promotions`, `automation`, `seeds`, `memory_proposals`, `approval_log`
8. `references/compound/src/compound-router.mjs` `--test` passes ≥10 self-tests covering scoring determinism, threshold gating, L3 split bucket separation, RELEASE always-on, artifact path-allowlist
9. `references/compound/src/sink-proposer.mjs` `--test` passes ≥8 self-tests covering sink section emission (patterns_sdi vs rule_promotions), negative-write assertions (no memory/rules/backlog writes)
10. `commands/sunco/compound.md` frontmatter `name: sunco:compound` + clean-room notice
11. `workflows/compound.md` clean-room notice + 6-step pipeline docs
12. `.planning/compound/README.md` exists + clean-room notice
13. Command count === 89 (Section 30 assertion + 29q amended assertion both verify)
14. `product-contract.md` L92 contains literal "89" + "Phase 54" attribution
15. Section 30 populated with ~22 `[54-compound]` checks; all pass
16. Section 29 29o flipped: compound.md presence + frontmatter + 8-command stage set `{brainstorming,plan,execute,verify,proceed-gate,ship,release,compound}`
17. Section 29 29q flipped: `allMdFiles.length === 89`
18. Section 27 + Section 28 byte-stable (content-marker parity grep in Section 30 verifies)
19. Phase 52b + 53 runtime assets byte-stable (L10 enforcement; content-marker parity grep)
20. 9-path clean-room scope grep: 0 matches of `compound-engineering-plugin` outside verbatim notice blocks
21. `git diff --name-only 72a391a..HEAD -- packages/cli/commands/sunco/{brainstorming,plan,execute,verify,proceed-gate,ship,release,do,next,mode,manager,router,auto,where-am-i}.md packages/cli/workflows/router.md packages/cli/references/router/ packages/cli/hooks/sunco-mode-router.cjs packages/cli/schemas/route-decision.schema.json .planning/router/DESIGN-v1.md .planning/ROADMAP.md | wc -l == 0` (L10 + L11 enforcement)
22. STATE.md prose uses git-state-determined wording (no "push awaits" / "On push, LANDED"); frontmatter `completed_phases: 4` / `percent: 57` post-Commit-B
23. `.claude/rules/architecture.md` byte-identical from `72a391a` (U4 Codex-strict NO TOUCH)
24. `sunco-pre-dogfood @ 3ac0ee9`, `sunco-pre-52b-landed @ 4b1e093`, `sunco-pre-53-landed @ 72a391a` all preserved (unchanged)

## Next phase handoff

**Phase 55 (post-54-landed)** — Router dogfood. 5 fixture scenarios per DESIGN §10: (1) greenfield new feature → BRAINSTORM skip, (2) bugfix mid-phase → WORK skip, (3) release completion → COMPOUND always-on, (4) incident recovery → COMPOUND score ≥5 + SDI candidate, (5) milestone close → COMPOUND always-on. Retroactive v1.4 compound artifact at `.planning/compound/release-v0.12.0-20260420.md` per DESIGN §10 row 3 expectation. Retroactive route decision log backfill for v1.4 window (≥5 entries per DESIGN §11 31d).

**Phase 55 compatibility contract** (schema field list; stable from Phase 54):
- `kind: const "compound"` + `version: const 1`
- `scope: enum [release, milestone, phase, incident, ad_hoc]`
- `ref: string` (e.g., `v0.12.0` for release scope)
- `window: { from: ISO-date-time, to: ISO-date-time }`
- `status: enum [draft, proposed, partially-approved, approved, archived]` (Phase 55 fixtures use `proposed`)
- `source_evidence: array of strings` (RouteDecision paths)
- `sections: array of 8 names` = `[context, learnings, patterns_sdi, rule_promotions, automation, seeds, memory_proposals, approval_log]`
- `clean_room_notice: const true`
- `generated_by: const "sunco-compound-router"`
- Trigger score model frozen in compound-router.mjs (L1 scoring function pure; no weight changes in Phase 55)
- Auto-write boundary frozen (L2 path-allowlist; Phase 55 fixtures do not exercise sink writes)
- Fixture path convention: `test/fixtures/router/<scenario>/route-decisions/*.json` (inputs) + `test/fixtures/router/<scenario>/expected-compound.md` (oracle)

**Phase 56 (provisional, post-55-landed)** — Release-router hardening. Scope confirmed at mid-milestone gate per DESIGN §9. May include `.claude/rules/architecture.md` namespace update (coordinated with other Phase 56 doc updates). May include `/sunco:where-am-i` router-integration per Phase 53 L6 (a) option.

**Phase 57 (deferred, explicit gate post-56)** — `/sunco:auto` integration. Frozen through Phase 56. Phase 54 automatic hook integration deferred until here or later (per U1 strict-side union).

## Verify-lite snapshot at Phase 54 entry (pre-Commit A)

- HEAD: `72a391a` (Phase 53 3-commit unit endpoint: A `9377607` + B `4a5427f` + C `72a391a`)
- origin/main: `72a391a` (Phase 53 push-landed state)
- `sunco-pre-53-landed`: `72a391a` (newly created pre-Commit-A; non-commit ref; rollback anchor per L9)
- `sunco-pre-52b-landed`: `4b1e093` (preserved)
- `sunco-pre-dogfood`: `3ac0ee9` (preserved)
- Smoke: **706/706** (619 baseline + 35 Section 27 [52a-static] + 27 Section 28 [52b-runtime] + 24 Section 29 [53-wrapper] + 1 other uncategorized)
- Self-tests: **186/186** (injector 10 + adapter 22 + backend-detector 17 + extract-spec-block 33 + confidence 21 + classifier 30 + evidence 21 + writer 32)
- Turbo lint+build: **10/10** (8 cached, 2 ran)
- Vitest: 1099/1099 across 95 files (Phase 53 baseline; not re-run at Phase 54 entry since Phase 54 adds no vitest file)
- SDI-2 counter: **2** (unchanged through Phase 54 pre-planned split per Gate 52b B4 + Phase 53 precedent)
- v1.5 progress (at Commit A snapshot): 3/7 phases delivered (42%); Phase 54 in-flight

## Gate 54 v1 cross-model verification metadata

- **Implementer Claude**: Step 1 verify-lite (5/5 green) + Step 2 freshness 8-point (3 drifts D1/D2/D3 surfaced) + Step 3 Gate request (11 axes G1-G11 + pre-first-mutation anchor recommendation) + scope-check (4 NEW assets ABSENT)
- **Reviewer Claude**: GREEN-CONDITIONAL; 4 blocking B1 (G5 b' standalone) + B2 (G6 description + sibling README; scope reduction 10→9 paths) + B3 (G8 29o/29q amendments scope-additive) + B4 (G10 2-commit split); drift dispositions D1 natural-overwrite / D2 errata-only / D3 absorbed-into-B3; architecture.md defer recommendation; sunco-pre-53-landed anchor approval
- **Codex**: GREEN-CONDITIONAL; 4 required conditions C1 (G5 naming strict — "post-stage hook" FORBIDDEN → "post-stage durable-decision consumer"; no wrapper hints) + C2 (G6 `$comment` in JSON schema — strict; not description) + C3 (Section 29 amendment, not Section 30 duplication) + C4 (2-commit split preferred); architecture.md DEFER NO TOUCH; rollback anchor approved; 11-axis disposition with GREEN-CONDITIONAL on G4/G5/G6/G10
- **Convergence**: No RED, no v2 relay. Strict-side union on 4 axes (G5 naming → Codex strict; G6 `$comment` → Codex strict; wrapper-hint removal → Codex strict; architecture.md no-touch → Codex strict). Structural convergence on all other axes. Phase 47/48/49/51/52a/52b/53 convergent-absorption precedent applied.
- **Pattern logged**: Cross-phase 3-role strict-side union count = 4 (Gate 54 v1). Observational fixture accumulated for Phase 55 dogfood / v1.5 meta-retrospective (per L15).
