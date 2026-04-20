# Phase 53 — Router Wrappers (`/sunco:do` + `/sunco:next` + `/sunco:mode` + `/sunco:manager` + mode hook)

- **Spec alias**: v1.5/M6 Phase 53 (third phase of v1.5 committed set; first wrapper integration)
- **Milestone**: M6 SUNCO Workflow Router
- **Design source**: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at commit `30e2041`; IMMUTABILITY extended through Phase 53 per Gate 52b B2 continuation — drift observed during Phase 53 absorbed in this CONTEXT under "DESIGN errata / ROADMAP drift" section, NOT patched into DESIGN-v1.md or ROADMAP.md)
- **Requirement**: (integration) IF-18, IF-19, IF-20, IF-21
- **Status**: Gate 53 v1 convergent absorbed (Codex GREEN-CONDITIONAL with 3 blocking B1/B2/B3 + ROADMAP drift side-note + Reviewer Claude GREEN-CONDITIONAL with 7 required conditions; no RED, no divergent-blocking requiring v2 relay; convergence via DESIGN-literal reading on G1/G2 divergence axes per Phase 47/48/49/51/52a/52b precedent); construction pending; 2-commit pre-planned split (planning + runtime).

## Phase 53 character

**First wrapper integration in v1.5**. Phase 52a shipped contracts (schemas + 5 reference docs). Phase 52b shipped the runtime engine (4 modules + `/sunco:router` thin command + `workflows/router.md` deterministic pipeline + 4 vitest files + 8 self-tests). Phase 53 connects the existing user-facing commands to that engine:

- 4 command file updates under `packages/cli/commands/sunco/` (`do.md`, `next.md`, `mode.md`, `manager.md`) — each becomes a thin wrapper delegating routing decisions to the Phase 52b classifier; no wrapper contains its own classification/stage-inference logic.
- 1 hook file update under `packages/cli/hooks/` (`sunco-mode-router.cjs`) — switches mode's auto-routing directive from `/sunco:do` to `/sunco:router --intent <text>` (direct-to-router, G3a).
- Smoke Section 29 `[53-wrapper]` additive block; Section 27 `[52a-static]` and Section 28 `[52b-runtime]` remain byte-stable (no additions/removals/reorder).
- STATE.md D8 drift absorbed via natural overwrite (D8-style stale "push awaits ACK / On push LANDED" prose from `7791d33`-era when push was pending — push has since occurred).

Full Gate 5 scrutiny inherited (novel risk vectors per DESIGN §14): approval boundary enforcement at the wrapper surface, UX regression prevention, router-first spec compliance, /sunco:auto frozen invariant, stage commands byte-identical R1 regression.

## Gate 53 v1 — convergent absorption log

### Round 1 — Implementer v1 request (10 axes G1-G10 + 3 Reviewer Q absorbed + 6 cross-model Q)

10 axes submitted inline (G1-G10) covering wrapper compatibility, API consumption boundary, stage byte-identical, `/sunco:auto` frozen, UNKNOWN/HOLD fallback, L14 approval envelope propagation, smoke + commit shape + SDI-2. Additional Reviewer Q1/Q2/Q3 from Phase 52b closure absorbed (3-role boundary observation-only, rollback anchor pre-commit, router self-dogfood deferred to Phase 55). 6 cross-model Q posed to verifiers.

### Round 2 — Two-gate convergent (Codex + Reviewer Claude)

Both verdict: **GREEN-CONDITIONAL**. No RED. Two divergent axes resolved by DESIGN-literal reading (precedent Phase 47/48/49/51/52a/52b union absorption):

**G1 divergence (/sunco:do ordering)**:
- Reviewer: static-table-first + router augment (UX preservation)
- Codex B1: router-first strict per DESIGN §7 table line `/sunco:do | Intent → router with intent_hint= | Thin wrapper`
- **Absorbed (spec-strict)**: router-first. Static-table match used ONLY as fallback when router returns `current_stage=UNKNOWN` OR `band=LOW` with no actionable recommendation. This satisfies both DESIGN §7.2 spec-literal reading (Codex) AND Reviewer UX continuity concern (existing keyword routes still fire via router's UNKNOWN-fallback path).

**G2 divergence (/sunco:next ephemeral write)**:
- Reviewer: write-free for `--recommend-only` (noise reduction)
- Codex: always ephemeral per DESIGN §4.2 (audit trail > I/O)
- **Absorbed (spec-strict)**: always ephemeral. DESIGN §4.2 declares ephemeral tier is "Default path for all read_only routing"; `.sun/router/session/*.json` is gitignored + 14-day-pruned so noise concern addressed structurally. `--durable` flag gates durable-tier write as before.

**User intervention on next/mode consolidation** (explicit design input after Gate round):
- "Phase 53은 wrapper 통합 phase. next/mode/do/manager가 각자 새 라우터를 만들면 안 됨. 전부 `/sunco:router` 또는 router runtime을 공유해야 함. 명령어 제거/폐지는 하지 않음."
- Interpreted: all 4 wrappers are thin wrappers over the single Phase 52b runtime engine. No wrapper duplicates stage-inference, evidence collection, confidence computation, or decision writing. User-facing command surface preserved (no deprecation). Consolidation/alias decision deferred to Phase 55 dogfood cycle + v1.6+ milestones.

### Locked decisions (Phase 53 v1)

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | **Router-first ordering for `/sunco:do`** (Codex B1 + DESIGN §7.2 strict) | Every `/sunco:do <text>` invocation calls `classifyStage(evidence, { intent_hint: text })` first. Static-table match from existing `do.md` table is used ONLY as fallback route when `current_stage === 'UNKNOWN'` OR `band === 'LOW'` without actionable recommendation. HIGH/MEDIUM bands follow `recommended_next` + `action.command`. Preserves Reviewer UX concern via router's fallback path, not via pre-router bypass. |
| L2 | **`/sunco:next` always writes ephemeral tier** (Codex + DESIGN §4.2) | `--recommend-only` and default path both write `<repoRoot>/.sun/router/session/<ts>-<stage>.json`. `--durable` flag additionally triggers durable-tier write per `shouldPromote` criteria. Noise handled by 14-day prune + gitignore; audit trail > I/O. |
| L3 | **`/sunco:mode` direct-to-router (G3a)** (both gates converge; Codex B2 adds hook update in Phase 53 scope) | When mode ON, `packages/cli/hooks/sunco-mode-router.cjs` directs non-slash input to `/sunco:router --intent <text>`. No intermediate `/sunco:do` layer (avoids 2-level nested dispatch). Mode OFF unchanged. Single routing surface invariant: one router invocation per user prompt in mode-ON sessions. |
| L4 | **`/sunco:manager` dashboard with `route_decision` block** (Reviewer + Codex converge) | Existing dashboard preserved. "Recommended Next Action" section sourced from RouteDecision (`recommended_next` + `reason[0]` + `action.command` + `approval_envelope.risk_level`). Drift banner when `freshness.status !== 'fresh'`. `--json` output adds `route_decision` key (inline extension; no `product-contract.md` command-count change). |
| L5 | **Phase 52b runtime APIs immutable** (both gates converge; Reviewer #7 + Codex G5) | No mutation to `classifier.mjs` / `evidence-collector.mjs` / `confidence.mjs` / `decision-writer.mjs` exported surface. Wrappers use: `collectEvidence`, `runFreshnessGate`, `classifyStage`, `writeDecision`, `classifyBand` — the public 4-module API. Any real API gap discovered during construction halts implementation and returns Gate CHANGE request; local wrapper helpers are preferred for mapping/presentation concerns. |
| L6 | **`where-am-i` explicit out-of-scope** (Codex B3; Reviewer converges) | DESIGN §7 table includes `/sunco:where-am-i (updated)` router-aware diagnostic, but ROADMAP.md line 539 Phase 53 scope restricts to `{router, do, next, mode, manager}.md`. ROADMAP-authoritative per Phase 47/48/49/51/52a/52b precedent. `where-am-i.md` untouched in Phase 53. Deferred target: Phase 56 release-router diagnostics OR v1.5 maintenance backlog (decided at Phase 56 scope confirmation). Rationale recorded here under "Scope narrowing vs DESIGN §7". |
| L7 | **STATE.md D8 drift natural overwrite with "COMPLETE locally" wording** (Reviewer #6; Codex converges; user approved wording pattern from `7791d33`) | Phase 53 commit updates STATE.md "Current Position" prose to describe Phase 53 local-complete / push-pending state. "LANDED" is NEVER used pre-push (Phase 52b Q5 preemptive-LANDED precedent). Use "COMPLETE locally" + "On push, this state becomes Phase 53 LANDED". Natural overwrite of the Phase 52b-era stale prose; no separate drift-cleanup commit. |
| L8 | **Rollback anchor `sunco-pre-52b-landed @ 4b1e093`** (Reviewer Q2; Codex converges) | Pre-commit local ref mutation executed as first Phase 53 mutation, BEFORE any file write. `git branch sunco-pre-52b-landed 4b1e093`. Non-destructive; parallels `sunco-pre-dogfood @ 3ac0ee9` precedent. Branch ref is not file state; does not belong in any commit. |
| L9 | **Hook `sunco-mode-router.cjs` update in Phase 53 scope** (Codex B2) | B2 condition: Phase 53 modifies `packages/cli/hooks/sunco-mode-router.cjs` to direct mode-active non-slash input to `/sunco:router --intent` (not `/sunco:do`). This is a runtime-behavior change required to realize G3a and is within Phase 53 scope. The hook file is in `packages/cli/hooks/`, not `packages/cli/commands/sunco/`, so it's outside the 8-stage-command byte-identical R1 guard but inside Phase 53's modification surface. |
| L10 | **Pre-planned 2-commit split** (Codex recommends; both gates permit) | Combined LOC estimate ~1200-1400 exceeds reviewer-comfort threshold. Split by scope class: **Commit 1** = 53-CONTEXT.md scaffold + STATE.md D8 overwrite + smoke Section 29 header scaffold (no check logic yet) — planning/scaffold scope. **Commit 2** = 4 wrapper file updates + hook update + smoke Section 29 checks populated — runtime/wrapper scope. Classification in both commit messages: **NOT SDI-2** per Gate 52b B4 precedent (pre-planned scope separation is not reactive additive fix; SDI-2 counter stays at 2). |
| L11 | **Smoke Section 29 name = "Router Wrappers (Phase 53)"** (Codex G10 + Reviewer smoke suggestions) | `[53-wrapper]` prefix on every assertion. Sections 27 + 28 byte-stable. Additive-only. ~16-18 checks covering 4 wrapper presence/frontmatter/router-delegation prose, hook update, 8 stage commands byte-identical, `/sunco:auto` frozen, command count stable at 88, UNKNOWN/HOLD fallback prose per wrapper, L14 approval-envelope propagation prose. |
| L12 | **Wrappers share router engine via command invocation** (user intervention) | Each of 4 wrappers delegates to `/sunco:router` (or its `workflows/router.md` pipeline). No wrapper re-implements stage classification, freshness gate, confidence compute, or decision writing. No runtime module imports in wrapper command `.md` files (those are Markdown prompt files; the delegation is via documented invocation of `/sunco:router` in the wrapper's `<process>` block). `router_core_shared` signal is the prose-level assertion in smoke. |
| L13 | **L14 approval envelope propagation invariant** (G9 mandatory) | Each wrapper's `<process>` block explicitly preserves `approval_envelope.{risk_level, triggers_required, forbidden_without_ack}` as emitted by classifier. Wrappers NEVER issue `remote_mutate` or `external_mutate` operations directly — they present the ACK prompt at the band the router indicated. Smoke Section 29 grep content-marker `approval_envelope` + `forbidden_without_ack` in each wrapper body. |
| L14 | **`/sunco:auto` frozen invariant (mandatory)** (G7 + hard-lock spec) | `packages/cli/commands/sunco/auto.md` byte-identical vs `7791d33`. Phase 53 wrapper bodies do NOT reference `/sunco:auto` as a dispatch target. Smoke Section 29 negative grep: `auto\\.md` untouched + 4 wrapper bodies contain zero `/sunco:auto` dispatch references (existing narrative mentions of the command name are grandfathered via content-marker position check). |
| L15 | **Stage commands byte-identical vs `7791d33`** (G6 mandatory; R1 regression continuation) | Pre-commit invariant: `git diff --name-only 7791d33..HEAD -- packages/cli/commands/sunco/{brainstorm,plan,execute,verify,proceed-gate,ship,release,compound}.md | wc -l == 0`. Smoke Section 29 content-marker parity grep as secondary verification. |
| L16 | **DESIGN-v1.md + Phase 52a/52b assets byte-stable** (continuation of 52a L17 + 52b L17) | Hash-lock through Phase 53: schema + 5 Phase 52a reference docs + `.keep` + 4 Phase 52b runtime modules + `router.md` command + `workflows/router.md` + DESIGN-v1.md unchanged from `7791d33` baseline. Immutability extends through Phase 53. Any drift observed during Phase 53 → this CONTEXT under "DESIGN errata / ROADMAP drift". |
| L17 | **Router vocabulary for static-table fallback** (L1 operationalization) | `/sunco:do`'s static keyword table entries from `do.md:27-57` remain in the wrapper body as the fallback-route lookup. They do NOT run before router; they run ONLY when router returns UNKNOWN/LOW-without-recommendation. This preserves the existing table content as prior-art documentation of user intent patterns without making it the primary dispatch path. |

### DESIGN errata / ROADMAP drift (absorbed here, NOT patched into DESIGN-v1.md or ROADMAP.md per L16)

**E1 — ROADMAP line 539 `router.md` inclusion**:
ROADMAP line 539 lists `commands/sunco/{router,do,next,mode,manager}.md` under Phase 53. `commands/sunco/router.md` was already CREATED in Phase 52b (commit `0b74055` per 52b-CONTEXT L12). Phase 53 does NOT modify `router.md`. Implementer scope correctly narrows to the 4 new wrappers (do/next/mode/manager). ROADMAP narrative is imprecise (lists the file without distinguishing "new" vs "modified"); non-blocking.

**E2 — ROADMAP line 539 "smoke Section 28"**:
ROADMAP says "smoke Section 28" for Phase 53, but Section 28 was already allocated to Phase 52b runtime. Phase 53 uses **Section 29** (`[53-wrapper]` prefix). Implementer correctly reads DESIGN §11 Section 29 allocation. ROADMAP narrative is stale; non-blocking; no ROADMAP mutation in Phase 53 (consistent with ROADMAP-immutability through Phase 53).

**E3 — DESIGN §7 `/sunco:where-am-i` inclusion vs ROADMAP exclusion**:
DESIGN §7 table line lists `/sunco:where-am-i (updated)` as router-aware diagnostic. ROADMAP line 539 Phase 53 scope omits it. ROADMAP-authoritative per precedent. Phase 53 leaves `where-am-i.md` byte-identical. Deferred: Phase 56 release-router diagnostics OR v1.5 maintenance backlog. Gate 53 B3 resolution = rationale documented here (above L6 + this E3 entry).

### Scope narrowing vs DESIGN §7

DESIGN §7 enumerates 6 commands for router reorganization: `/sunco:router` (NEW Phase 52b), `/sunco:mode`, `/sunco:do`, `/sunco:next`, `/sunco:where-am-i`, `/sunco:manager`, plus `/sunco:auto` deferred. ROADMAP narrows Phase 53 to 4 wrappers (`do`, `next`, `mode`, `manager`) since `/sunco:router` landed in Phase 52b and `where-am-i` is deferred. The narrowing reasons:

1. **ROADMAP is authoritative per Phase 47/48/49/51/52a/52b precedent** — when DESIGN and ROADMAP disagree on phase scope, ROADMAP wins. DESIGN is the strategic target; ROADMAP is the committed delivery plan.
2. **Scope-creep avoidance** — 4 wrappers + hook + smoke + STATE is already ~1200-1400 LOC; adding `where-am-i` would push beyond reviewer-comfort threshold.
3. **Dogfood-before-expand** — `where-am-i` is a diagnostic command; its router-integration design benefits from observing how the 4 primary wrappers behave under Phase 55 dogfood first.

Deferred target options (decided at Phase 56 scope confirmation / mid-milestone gate):
- (a) **Phase 56 bundle**: include `where-am-i` router-integration in the release-router-hardening phase as a co-traveling diagnostic update.
- (b) **v1.5 maintenance backlog**: register under backlog `999.x` for later milestone.

Gate 53 does not decide between (a)/(b); the decision is load-bearing only at Phase 56 entry.

### Namespace clarification (continuation of 52b G7)

Continues unchanged from Phase 52b: Agent Router (`packages/core/src/agent/router.ts`, Phase 01/v1.0) and Workflow Router (`packages/cli/references/router/src/*.mjs`, Phase 52a/52b/v1.5) remain separate namespaces. Phase 53 wrappers sit on the Workflow Router side. `.claude/rules/architecture.md` namespace doc update continues deferred (Phase 54 compound-router doc bundle OR v1.5 maintenance backlog).

### Cross-phase learning (Reviewer Q1 observation-only)

Phase 52b Gate round introduced the **3-role non-blocking↔blocking boundary** question (formalizing when Reviewer non-blocking + Codex blocking → apply blocking fix under strict-side union rule). The Phase 52b Q5 preemptive-LANDED case study is the reference fixture. Phase 53 does NOT formalize the boundary — formalization belongs to Phase 55+ meta-work (dogfood cycle experience accumulation). Phase 53 applies the rule: this gate round had 2 semantic divergences (G1 order, G2 write-gate) that were spec-strict-resolved rather than requiring v2 relay.

### Scope lock (Phase 53 deliverables — pre-planned 2-commit split)

**Commit 1 — `docs(router): scaffold Phase 53 router wrappers CONTEXT and absorb STATE D8 drift`** (planning scope; ~4 files):

1. `.planning/phases/53-router-wrappers/53-CONTEXT.md` — **this file** (commit 1 content = decisions locked; wrappers not yet touched)
2. `.planning/STATE.md` — D8 drift natural overwrite: Phase 52b-era stale "All commits local... On push... Phase 52b LANDED" → Phase 53 "local-complete / push-pending" prose using Codex-approved "COMPLETE locally" wording pattern from `7791d33`; frontmatter `progress.completed_phases: 2 → 2` unchanged (Phase 53 not yet landed at Commit 1 snapshot)
3. `packages/cli/bin/smoke-test.cjs` — Section 29 header scaffold only (no check logic yet; checks added in Commit 2). This keeps Section 29 boundary visible at Commit 1 for reviewer orientation.

**Commit 2 — `feat(router): route do/next/mode/manager wrappers through workflow router`** (runtime/wrapper scope; ~6 files):

4. `packages/cli/commands/sunco/do.md` — router-first delegation; static-table as UNKNOWN/LOW fallback (L1/L17); approval envelope propagation (L13); UNKNOWN/HOLD fallback prose (G8)
5. `packages/cli/commands/sunco/next.md` — thin wrapper over `/sunco:router --recommend-only`; always ephemeral write (L2); `--durable` flag preserved; `--dry-run` + `--list` preserved; approval envelope propagation (L13)
6. `packages/cli/commands/sunco/mode.md` — direct-to-router routing surface (L3); no intermediate `/sunco:do` layer; router loop over user prompts when mode ON; approval envelope propagation (L13)
7. `packages/cli/commands/sunco/manager.md` — dashboard preserved; "Recommended Next Action" block sourced from RouteDecision (L4); drift banner when `freshness.status !== 'fresh'`; `--json` adds `route_decision` key inline
8. `packages/cli/hooks/sunco-mode-router.cjs` — auto-routing directive switched from `/sunco:do` to `/sunco:router --intent <text>` (L9)
9. `packages/cli/bin/smoke-test.cjs` — Section 29 `[53-wrapper]` checks populated (~16-18 checks per L11); Sections 27 + 28 byte-stable
10. `.planning/STATE.md` — second-pass update at Commit 2: frontmatter `progress.completed_phases: 2 → 3` + `progress.percent: 28 → 42`; prose confirms 2-commit landing locally; pre-push preserved using "COMPLETE locally" wording (L7)

Note: STATE.md is touched in both commits (Commit 1 = D8 drift overwrite reflecting "Phase 53 kickoff in progress", Commit 2 = progress bump reflecting Phase 53 COMPLETE locally). This is deliberate bookkeeping — Commit 1's STATE reflects mid-phase state, Commit 2's STATE reflects end-phase state. Acceptable per planning-artifact natural-update pattern.

### Hard-locks (Phase 53)

From Gate 53 v1 convergent absorption + Phase 52a/52b hard-lock extensions:

- `.github/workflows/ci.yml` **untouched** (v1.4 Path-A continuation; unchanged through 52a/52b/53)
- `packages/cli/schemas/` all existing schemas untouched (`finding.schema.json`, `cross-domain.schema.json`, `ui-spec.schema.json`, `route-decision.schema.json` from 52a)
- `packages/cli/references/router/` **including Phase 52a + Phase 52b assets** byte-stable (5 reference docs + 4 runtime modules + `.keep`)
- `packages/cli/commands/sunco/router.md` **byte-identical from Phase 52b** (Phase 53 does NOT modify router.md; E1 ROADMAP drift clarification)
- `packages/cli/workflows/router.md` **byte-identical from Phase 52b**
- `packages/cli/commands/sunco/{brainstorm,plan,execute,verify,proceed-gate,ship,release,compound}.md` **byte-identical from `7791d33`** (R1 regression continuation)
- `packages/cli/commands/sunco/auto.md` **byte-identical from `7791d33`** (`/sunco:auto` frozen until Phase 57 gate opens)
- `packages/cli/commands/sunco/where-am-i.md` **byte-identical from `7791d33`** (L6 ROADMAP-narrowing; deferred)
- `.claude/rules/` unchanged (architecture.md namespace note continues deferred to Phase 54 compound-router doc bundle or v1.5 maintenance backlog)
- `.planning/router/DESIGN-v1.md` **unchanged through Phase 53** (B2/L16 immutability extension; drift → this CONTEXT DESIGN errata)
- `.planning/router/README.md` unchanged (Phase 52a asset)
- `.planning/router/decisions/.keep` preserved (Phase 52a asset)
- `.planning/router/paused-state.json` NOT created by Phase 53 (first `/sunco:pause` invocation creates it)
- `.planning/ROADMAP.md` **unchanged through Phase 53** (ROADMAP-immutability in-phase; drift observations → this CONTEXT DESIGN errata/ROADMAP drift section)
- `.planning/REQUIREMENTS.md` unchanged (IF-18/19/20/21 already marked "Covered by Phase 52a/52b/53" at their definition points)
- Memory unchanged beyond necessary v1.5-progress entry update (post-Phase-53-landed; user-controlled)
- SDI counter unchanged at **2** (pre-planned split is NOT SDI-2 per Gate 52b B4 precedent)
- No new npm dependency
- No Phase 52b runtime API mutation (L5)

### Done-when criteria (20 items)

1. Rollback anchor `sunco-pre-52b-landed @ 4b1e093` created pre-file-write (L8) — verifiable via `git rev-parse sunco-pre-52b-landed`
2. Commit 1 landed locally: 53-CONTEXT scaffold + STATE D8 overwrite + smoke Section 29 header; no amend; no force-push
3. Commit 2 landed locally: 4 wrapper updates + hook update + smoke Section 29 checks populated + STATE progress bump; no amend; no force-push
4. Full verify-lite green POST-Commit-2: smoke (681 baseline + Section 29 additions), 8 self-tests (186/186 unchanged from Phase 52b), turbo lint+build (10/10), vitest (1099/1099 unchanged from Phase 52b)
5. `/sunco:do` router-first delegation prose present in `do.md` `<process>` block + static-table fallback ONLY on UNKNOWN/LOW (L1/L17)
6. `/sunco:next` always-ephemeral-write prose + `--durable` gate for durable tier in `next.md` (L2)
7. `/sunco:mode` direct-to-router routing surface prose in `mode.md` + no `/sunco:do` intermediate dispatch reference (L3)
8. `/sunco:manager` RouteDecision-sourced "Recommended Next Action" prose + drift banner prose + `--json route_decision` key documentation in `manager.md` (L4)
9. Hook `sunco-mode-router.cjs` directive updated to `/sunco:router --intent <text>` (L9); mode-OFF path unchanged
10. Section 29 `[53-wrapper]` checks populated: 4 wrapper presence + frontmatter + router-delegation prose + hook update + 8 stage commands byte-identical + `/sunco:auto` frozen + command count 88 stable + UNKNOWN/HOLD fallback prose + L14 approval-envelope prose (L11)
11. Section 27 `[52a-static]` byte-stable (35 checks unchanged)
12. Section 28 `[52b-runtime]` byte-stable (27 checks unchanged)
13. `git diff --name-only 7791d33..HEAD -- packages/cli/commands/sunco/{plan,execute,verify,proceed-gate,ship,release,auto,where-am-i,router}.md | wc -l == 0` (L15 + L6 + L14). **Naming note**: DESIGN §7 lists 8 nominal stage commands (`brainstorm/plan/execute/verify/proceed-gate/ship/release/compound`); the repo ships `brainstorming.md` (not `brainstorm.md`) and `compound.md` does not yet exist (Phase 54 scope). Phase 53 R1 guard matches Phase 52b's 28q 6-command set (`plan/execute/verify/proceed-gate/ship/release`). `brainstorming.md` byte-stability is implicit (no wrapper touches it); `compound.md` absence is a no-op for R1.
14. `git diff --name-only 7791d33..HEAD -- packages/cli/workflows/router.md packages/cli/references/router/src/ packages/cli/references/router/{STAGE-MACHINE,EVIDENCE-MODEL,CONFIDENCE-CALIBRATION,APPROVAL-BOUNDARY,README}.md packages/cli/schemas/route-decision.schema.json .planning/router/DESIGN-v1.md .planning/router/README.md .planning/router/decisions/.keep | wc -l == 0` (L16)
15. `grep -l "approval_envelope\|forbidden_without_ack" packages/cli/commands/sunco/{do,next,mode,manager}.md | wc -l == 4` (L13)
16. `grep -l "UNKNOWN\|HOLD\|drift" packages/cli/commands/sunco/{do,next,mode,manager}.md | wc -l == 4` (G8)
17. `grep -l "sunco:router" packages/cli/commands/sunco/{do,next,mode,manager}.md | wc -l == 4` (L12 wrappers-share-router)
18. STATE.md prose uses "COMPLETE locally" wording pre-push; "LANDED" NEVER used pre-push (L7)
19. Command count remains 88 (no new commands; 4 modified + 1 hook updated = 5 files that already exist)
20. `sunco-pre-dogfood` @ `3ac0ee9` preserved (unchanged); `sunco-pre-52b-landed` @ `4b1e093` exists (newly created this phase)

### Next phase handoff

**Phase 54 (post-53-landed)** — Compound-router. `schemas/compound.schema.json`, `references/compound/src/{compound-router,sink-proposer}.mjs`, `commands/sunco/compound.md`, `workflows/compound.md`, post-stage hook integration, smoke Section 30. Compound-router reads RouteDecision emitted by wrappers; first real consumer of durable-tier router decisions in-milestone. May include `.claude/rules/architecture.md` namespace doc update as part of compound-router doc bundle (continuing 52b/53 deferral).

**Phase 55 (post-54-landed)** — Router dogfood. 5 fixture scenarios, vitest runner, retroactive v1.4 compound artifact, retroactive route decision backfill. Phase 55 will evaluate whether `/sunco:next` and `/sunco:mode` should be consolidated/aliased in v1.6+ (user intervention from Phase 53 Gate round records this as deferred decision).

**Phase 56 (provisional, post-55-landed)** — Release-router hardening. Scope confirmed at mid-milestone gate based on Phase 55 dogfood results. May include `/sunco:where-am-i` router-integration if (a) option chosen for L6 deferral.

### Verify-lite snapshot at Phase 53 entry (pre-Commit 1)

- HEAD: `7791d33` (Phase 52b 4-commit unit endpoint)
- origin/main: `7791d33` (Phase 52b push-landed state)
- `sunco-pre-52b-landed`: `4b1e093` (newly created pre-Commit-1; non-commit ref)
- `sunco-pre-dogfood`: `3ac0ee9` (preserved)
- Smoke: 681/681 (619 baseline + 35 Section 27 [52a-static] + 27 Section 28 [52b-runtime])
- Self-tests: 186/186 (injector 10 + adapter 22 + backend-detector 17 + extract-spec-block 33 + confidence 21 + classifier 30 + evidence 21 + writer 32)
- Turbo lint+build: 10/10 cached (full turbo)
- Vitest: 1099/1099 across 95 files (Phase 52b baseline)
- SDI-2 counter: **2** (unchanged through Phase 53 pre-planned split per Gate 52b B4 precedent)

### Gate 53 v1 cross-model verification metadata

- Implementer Claude: freshness 8-point + 10 axes + 3 Reviewer Q + 6 cross-model Q, spec-strict union on G1/G2 divergent axes, absorbed user intervention on next/mode engine-sharing
- Reviewer Claude: GREEN-CONDITIONAL, 7 conditions (rollback anchor first, static-table-first [overridden by spec-strict], write-free [overridden by spec-strict], G3a, where-am-i exclude, STATE "COMPLETE locally", no 52b API mutation)
- Codex: GREEN-CONDITIONAL, 3 blocking (B1 router-first strict, B2 G3a+hook in scope, B3 where-am-i rationale) + ROADMAP drift side-note + non-blocking disposition on remaining axes + Q1-Q6 answers
- Convergence: spec-strict on G1/G2 (Codex position absorbed; Reviewer UX concern addressed via router's UNKNOWN/LOW fallback path for G1 and gitignore+prune structure for G2); G3-G10 convergent; user intervention absorbed as L12 + Phase 55 dogfood deferral
- No RED, no v2 relay, Phase 47/48/49/51/52a/52b precedent applied
