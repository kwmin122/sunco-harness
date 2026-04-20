# Phase 52b — Router Classifier Runtime + Evidence Collector + Confidence Module + Decision Writer + Router Command + Workflow + Vitest

- **Spec alias**: v1.5/M6 Phase 52b (second phase of v1.5 committed set; first runtime commit)
- **Milestone**: M6 SUNCO Workflow Router
- **Design source**: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at commit `30e2041`; 4-round convergent review; **IMMUTABLE through Phase 52b** per Gate 52b v2 Reviewer B2 — drift discovered during 52b absorbed in this file under "DESIGN errata" section, NOT patched into DESIGN-v1.md)
- **Requirement**: (runtime) IF-19, (enforcement) IF-21
- **Status**: Gate 52b v2 convergent absorbed (Codex + Reviewer GREEN-CONDITIONAL; no divergent blocking; Phase 47/48/49/51/52a precedent — no v2 relay); Commit 1 + 2 landed (metadata + hygiene); Commit 3 (this phase's runtime atomic) pending

## Phase 52b character

**First runtime commit in v1.5**. Phase 52a shipped contracts (schemas + 5 reference docs); Phase 52b operationalizes them:

- 4 pure/IO-split runtime modules under `packages/cli/references/router/src/`
- 4 vitest test files under `packages/skills-workflow/src/shared/__tests__/`
- `/sunco:router` command (thin wrapper) + `workflows/router.md` (internal deterministic pipeline)
- Smoke Section 28 "Router Classifier Runtime (Phase 52b)" with `[52b-runtime]` prefix (Section 27 `[52a-static]` byte-stable per Gate 52b C4)

Full Gate 5 scrutiny (novel risk vectors per DESIGN §14): state machine correctness, evidence parser robustness, approval boundary enforcement, confidence honesty, classifier determinism, clean-room integrity.

## Gate 52b v2 — convergent absorption log

### Round 1 — Implementer v1 request (12 axes + Commit 1 drift observations)

Axes G1-G12 submitted inline with proposals. 6 point-8 freshness drifts (D1-D6) reported alongside as Commit 1/Commit 2 pre-runtime cleanup candidate.

### Round 2 — Two-judge convergent (Codex + Reviewer)

Both validators returned **GREEN-CONDITIONAL**. No RED. No blocking divergence on G1-G12. Absorbed per Phase 47/48/49/51/52a precedent (no v2 relay).

Judge-added items:
- **Reviewer 3 blocking (B1, B2, B3)**: narrative isolation extension (B1), DESIGN immutability scope extension (B2), Commit 1 commit message classification (B3).
- **Codex NEW risk axis (G13)**: IO boundary + testability.
- **Codex C1-C6**: adapter pattern, pure-classifier, local structural validator, Section 28 naming, writer path allowlist, thin command file.
- **Codex + Reviewer non-blocking drift addendum**: D7 (STATE.md Current-phase vs Status self-contradiction), D8 (HEAD-symbol-as-fixed-SHA prose decay), Codex line-34 "Phase 52a entry" wording. All three **folded into Commit 3 STATE.md update** per both judges' guidance (not a separate drift-cleanup commit).

### Locked decisions (Phase 52b v2)

| # | Decision | Rationale |
|---|----------|-----------|
| L1 | **4-file module split (spec-bound, not discretionary)** (G1 Reviewer note) | DESIGN §5.2 + CONFIDENCE-CALIBRATION.md L37 require `confidence.mjs` isolated for 27s path-exact grep. Clean separation: `classifier.mjs` (pure stage inference + narrative render), `evidence-collector.mjs` (IO boundary), `confidence.mjs` (pure frozen-weight math, no LLM SDK imports), `decision-writer.mjs` (fs write with path allowlist). |
| L2 | **Narrative reason[] rendering lives in `classifier.mjs` as private helper** (G8 + Reviewer B1) | 5th dedicated `narrative.mjs` would expand module count past spec-bound 4 for a single small pure function. `classifier.mjs` satisfies 27s because 27s greps ONLY `references/router/src/confidence.mjs` path. `classifier.mjs` is deterministic and has no LLM SDK imports either (verified in Section 28). |
| L3 | **IO adapter pattern (injected)** (G13 + Codex C1) | `collectEvidence({ repoRoot, execGit, readFile, statFile, now })` + `runFreshnessGate(evidence)`. Defaults resolve to Node `child_process.execFileSync`, `fs.readFileSync`, `fs.statSync`, `Date.now()` when any adapter field is undefined. Tests stub all 5 adapters — no shell spawn, no live repo reads, no clock dependency. |
| L4 | **No `process.cwd()` implicit dependency** (G3 Codex) | `runFreshnessGate(evidence, ctx)` + `collectEvidence(ctx)` require explicit `ctx.repoRoot`. Router command wrapper resolves `repoRoot = findRepoRoot(process.cwd())` at entry and passes downward. Modules themselves never read `process.cwd()`. |
| L5 | **Atomic tmp-in-same-dir rename** (G4 Codex) | `writeFile(final + '.tmp-<rand>')` + `rename(tmp, final)` both in same filesystem directory (POSIX atomic rename guarantee). No `fsync` in v1 (D2 candidate). Promotion produces dual-write (ephemeral + durable) in one invocation, each using same pattern. |
| L6 | **Writer path allowlist enforced** (Codex C5) | `decision-writer.mjs` accepts only target paths matching one of: `<repoRoot>/.sun/router/session/`, `<repoRoot>/.planning/router/decisions/`, `<repoRoot>/.planning/router/paused-state.json`. Path outside allowlist throws `RouterWriterPathError`; never writes STATE.md / ROADMAP.md / CONTEXT.md / any `.planning/phases/` file. |
| L7 | **Local structural validator, NO AJV** (Codex C3) | Tiny `validateRouteDecision(obj)` helper in `classifier.mjs` checks top-level required keys + enum memberships against the schema's constants. Avoids Phase 48 yaml-style packaging debt (AJV would introduce a new prod dependency). |
| L8 | **Static JSON fixtures + injected adapters** (G5 Codex) | Vitest fixtures = static JSON evidence dicts + string stubs for git-status lines; no git-init fixture repo; no real `child_process.spawn`. Integration end-to-end router runs deferred to Phase 55 dogfood. |
| L9 | **Commit shape = single atomic Phase 52b runtime commit** (G12 + Codex Q3) | Vitest fixtures are static JSON ≤ 2 KB each; fixture volume does NOT force a runtime-vs-fixture split. Single atomic commit preferred. If during implementation fixture volume exceeds 5 KB, revisit pre-planned split. Classification per commit message: "pre-planned scope separation NOT SDI-2 per Gate 52b v2 B4 (precedent Phase 47/48/49/51/52a)". |
| L10 | **Drift D7/D8/Codex-line-34 folded into Commit 3 STATE.md update** (both judges) | No separate drift-cleanup commit between Commit 2 and Commit 3. Commit 3 STATE.md update naturally overwrites affected prose with post-Phase-52b-landed state. |
| L11 | **Section 28 naming = "Router Classifier Runtime (Phase 52b)"** (Codex C4) | `[52b-runtime]` prefix on every assertion. Section 27 byte-stable (35 `[52a-static]` checks unchanged; no additions, no removals, no reordering). |
| L12 | **`/sunco:router` command is a thin wrapper** (Codex C6) | Frontmatter + short body that invokes `workflows/router.md`. No stage policy duplication; no evidence-collection logic. Command file's role is input surface + approval boundary pointer. Workflow file carries the deterministic pipeline. |
| L13 | **Confidence formula frozen weights** (G2) | `const WEIGHTS = Object.freeze({ phase_artifacts_complete: 0.25, git_state_matches_stage: 0.20, state_md_alignment: 0.15, test_state_known: 0.15, precondition_coverage: 0.15, recent_user_intent_match: 0.10 })` at top of `confidence.mjs`. No `.sun/router.toml` override. Weight sum = 1.00 (assertable in smoke 28). |
| L14 | **`remote_mutate` / `external_mutate` NEVER `auto_safe`** (G8 Codex) | Regardless of HIGH confidence band. Classifier refuses to emit `action.mode = auto_safe` for either risk level; forced to `requires_user_ack`. Enforced in `classifier.mjs` + asserted in Section 28. |
| L15 | **Stage commands byte-identical vs `4b1e093`** (G9 Reviewer) | Phase 52b touches ZERO files under `packages/cli/commands/sunco/` matching `brainstorm|plan|execute|verify|proceed-gate|ship|release|compound`. Verified pre-commit via `git diff --name-only 4b1e093..HEAD -- packages/cli/commands/sunco/{brainstorm,plan,execute,verify,proceed-gate,ship,release,compound}.md \| wc -l == 0`. |
| L16 | **`/sunco:auto` frozen** (G10) | No file named `packages/cli/commands/sunco/auto.md` created or modified. Negative grep in Section 28. Router modules contain no reference to `auto`. |
| L17 | **DESIGN-v1.md + Phase 52a assets byte-stable** (G11 Reviewer B2) | Hash-lock: schema + 5 reference docs + `.keep` + DESIGN-v1.md unchanged from `4b1e093` baseline. Immutability extends through Phase 52b. Drift recorded here, not in DESIGN. Asserted in Section 28 via content-marker grep. |

### DESIGN errata (absorbed here, NOT patched into DESIGN-v1.md per L17)

**E1 — Narrative rendering location clarified**:
DESIGN §5 "Confidence" section left the narrative `reason[]` rendering location implicit. Phase 52b locks: narrative render = private helper in `classifier.mjs` (`_renderNarrativeReasons(signals, weights)`), NOT in `confidence.mjs`. Preserves 27s's strict path-exact grep on `confidence.mjs` for LLM SDK isolation.

**E2 — Writer path allowlist made explicit**:
DESIGN §6.1.1 declared `decision-writer.mjs` target classes (`.sun/router/session/` ephemeral + `.planning/router/decisions/` durable) but did not declare what happens if code tries to write elsewhere. Phase 52b adds: explicit path allowlist enforced at write time; out-of-allowlist calls throw `RouterWriterPathError`. Protects against accidental STATE.md mutation.

**E3 — Local structural validator**:
DESIGN §4.1 declares the JSON Schema; DESIGN did not specify runtime validation implementation. Phase 52b locks: tiny hand-written `validateRouteDecision` in `classifier.mjs` (not AJV). Phase 48 yaml-packaging debt precedent informed this choice.

### Scope lock (Commit 3 deliverables)

**Commit 3 — `feat(router): add Phase 52b runtime classifier and router command`** (single atomic, ~12 files):

1. `.planning/phases/52b-router-classifier/52b-CONTEXT.md` — this file (populated in Commit 3, NOT pre-written; preserves scope discipline)
2. `packages/cli/references/router/src/classifier.mjs` — pure stage classifier + narrative render helper + local RouteDecision validator (~300 LOC + self-tests)
3. `packages/cli/references/router/src/evidence-collector.mjs` — IO boundary with adapter pattern + 7-point Freshness Gate with 7 sub-predicates (~350 LOC + self-tests)
4. `packages/cli/references/router/src/confidence.mjs` — frozen-weight pure-function confidence + I1-I4 invariants (~150 LOC + self-tests)
5. `packages/cli/references/router/src/decision-writer.mjs` — ephemeral/durable tier writer with atomic tmp+rename, 5-criterion promotion, path allowlist (~200 LOC + self-tests)
6. `packages/cli/commands/sunco/router.md` — **NEW** thin command wrapper, frontmatter `name: sunco:router`
7. `packages/cli/workflows/router.md` — **NEW** internal deterministic pipeline invoking the 4 modules in order
8. `packages/skills-workflow/src/shared/__tests__/router-classifier.test.ts` — ≥15 classification cases covering all stages + UNKNOWN + regress edges
9. `packages/skills-workflow/src/shared/__tests__/router-evidence.test.ts` — 7 sub-predicate tests + 3 freshness verdict scenarios (fresh/drift/conflicted) + adapter injection pattern tests
10. `packages/skills-workflow/src/shared/__tests__/router-confidence.test.ts` — I1 determinism (100-iter), I2 bounds, I3 monotonicity (6 signals), I4 no-LLM-SDK content grep
11. `packages/skills-workflow/src/shared/__tests__/router-promotion.test.ts` — 5 promotion criteria deterministic × 10 fixture verdicts + Y1 class-definition 10-path classifier (5 in-class / 5 exception) + path-allowlist refuse cases
12. `packages/cli/bin/smoke-test.cjs` — Section 28 `Router Classifier Runtime (Phase 52b)` added (Section 27 byte-stable)
13. `.planning/STATE.md` — Phase 52b landed declaration + frontmatter progress bump + D7/D8/line-34 drift resolution (natural overwrite)

### Hard-locks (Phase 52b)

From Gate 52b v2 absorption + 52a hard-lock extension:
- `.github/workflows/ci.yml` **untouched** (v1.4 Path-A continuation)
- `packages/cli/schemas/` — all existing schemas (`finding.schema.json`, `cross-domain.schema.json`, `ui-spec.schema.json`, `route-decision.schema.json` from 52a) untouched
- `packages/cli/references/router/` Phase 52a assets (5 reference docs) — byte-stable; addition is `src/` subdirectory only
- `packages/cli/commands/sunco/` existing commands (`brainstorm/plan/execute/verify/proceed-gate/ship/release/compound.md`) untouched; only NEW `router.md` added
- `packages/cli/workflows/` existing workflows untouched; only NEW `router.md` added
- `.claude/rules/` unchanged (architecture.md namespace note deferred to Phase 54 or v1.5 backlog per G7; 52b namespace clarification lives in this CONTEXT under §Namespace below)
- `.planning/router/DESIGN-v1.md` **unchanged through Phase 52b** (B2 immutability extension); drift → this CONTEXT's DESIGN errata section
- `.planning/router/decisions/.keep` preserved (Phase 52a asset)
- `.planning/router/paused-state.json` NOT created by Phase 52b (comes at first `/sunco:pause` invocation)
- Memory unchanged beyond necessary v1.5-status update entries
- `/sunco:auto` family untouched (frozen until Phase 57)
- No runtime code outside `packages/cli/references/router/src/`
- No new npm dependency (follow Phase 48 yaml-packaging debt precedent; local validator only)

### Namespace clarification (G7)

SUNCO has two distinct "router" concepts:

| Name | Path | Purpose | Introduced |
|------|------|---------|------------|
| **Agent Router** | `packages/core/src/agent/router.ts` | Vercel AI SDK provider-selection (Claude / OpenAI / Gemini / Ollama) for LLM calls | Phase 01 (v1.0) |
| **Workflow Router** | `packages/cli/references/router/src/*.mjs` | 10-stage state machine classifier for SUNCO workflow (BRAINSTORM → PLAN → WORK → REVIEW → VERIFY → PROCEED → SHIP → RELEASE → COMPOUND, plus PAUSE) | Phase 52a/52b (v1.5) |

Namespaces are separate packages; test filenames distinguish (`router.test.ts` for Agent Router, `router-*.test.ts` for Workflow Router). No collision. No `.claude/rules/architecture.md` mutation in Phase 52b. Documentation update deferred to Phase 54 compound-router doc bundle or v1.5 maintenance backlog.

### Done-when criteria

1. Commit 3 landed locally: all 13 deliverables committed atomically; no amend; no force-push
2. Full verify-lite green **pre-commit**: smoke (654 + Section 28 additions), self-tests (10/22/17/33 + router self-tests), turbo lint (89/0), turbo build (5/5)
3. Vitest all green: 4 new router test files pass under `packages/skills-workflow` vitest pickup (existing include pattern `src/**/__tests__/**/*.test.ts`)
4. Section 28 [52b-runtime] counterparts present for DESIGN §11 list: 27a, 27h, 27i, 27p, 27q, 27r, 27s, 27u, 27v2, 27v3, 27w, 27x
5. Section 27 [52a-static] byte-stable (35 checks unchanged; no additions/removals/reorder)
6. Phase 52a frozen assets byte-identical to `4b1e093` baseline (schema + 5 reference docs + `.keep` + DESIGN-v1.md)
7. `git diff --name-only 4b1e093..HEAD -- packages/cli/commands/sunco/{brainstorm,plan,execute,verify,proceed-gate,ship,release,compound}.md | wc -l` == 0 (G9)
8. `grep -r "auto" packages/cli/references/router/src/ packages/cli/commands/sunco/router.md packages/cli/workflows/router.md` returns 0 command-level references (G10)
9. `confidence.mjs` content grep for `anthropic|openai|@ai-sdk|vercel|agent-sdk` returns 0 matches (L2 + I4)
10. `decision-writer.mjs` path allowlist refuses writes outside allowed paths (unit-tested)
11. Atomic rename pattern uses tmp-in-same-dir (unit-tested via injected fs adapter)
12. `runFreshnessGate` returns exactly 7 checks; test asserts `checks.length === 7` (L3 EVIDENCE-MODEL.md L73 enforcement)
13. `computeConfidence` determinism: 100-iter byte-identical output on fixture signals (I1, vitest)
14. `computeConfidence` bounds: empty-signals → 0, all-positive-signals → 1.0 (I2)
15. `computeConfidence` monotonicity: removing each of 6 signals → non-increasing (I3)
16. Y1 class-definition: 10 file path fixtures classified per APPROVAL-BOUNDARY.md definition (5 in-class in `.planning/phases/*/N-*.md` etc., 5 exceptions like `.planning/router/decisions/*.json`) — deterministic
17. `remote_mutate` / `external_mutate` never emit `action.mode = auto_safe` regardless of confidence band (L14)
18. STATE.md updated: Phase 52b landed declaration; D7 Current-phase vs Status harmonized; D8 HEAD-as-SHA prose removed; Codex line-34 "Phase 52a entry" replaced with Phase 52b landed wording; frontmatter `progress.completed_phases: 1 → 2`, `progress.percent: 14 → 28`
19. SDI-2 counter preserved at **2** post-Phase-52b (pre-planned single-atomic commit; no reactive additive fix)
20. `sunco-pre-dogfood` branch preserved at `3ac0ee9` (unchanged)

### Next phase handoff

**Phase 53 (post-52b-landed)** — Router wrappers (minus `/sunco:auto`). Updates `commands/sunco/{router,do,next,mode,manager}.md` to route through Phase 52b classifier. Existing stage commands byte-identical. `/sunco:auto` remains frozen until Phase 57. Smoke Section 29 reserved. Phase 53 impact analysis + CONTEXT drafting begins after 52b landed + reviewer diff cleared.

**Phase 54 (post-53-landed)** — Compound-router. `schemas/compound.schema.json`, `references/compound/src/{compound-router,sink-proposer}.mjs`, `commands/sunco/compound.md`, `workflows/compound.md`, post-stage hook integration. May include `.claude/rules/architecture.md` namespace doc update as part of compound-router doc bundle (deferred from Phase 52b per G7).

### Verify-lite snapshot at Phase 52b entry (Commit 2 landed)

- HEAD: `29ddb3f` (local; 2 commits ahead of origin/main at `4b1e093`)
- origin/main: `4b1e093` (v1.5 push-landed state — Phase 52a 3-commit unit endpoint)
- Smoke: 654/654 (619 baseline + 35 Section 27 `[52a-static]`)
- Self-tests: injector 10/10, adapter 22/22, backend-detector 17/17, extract-spec-block 33/33
- Turbo lint: 89/0 (expected; last-verified at `4b1e093`)
- Turbo build: 5/5 (expected; last-verified at `4b1e093`)
- `sunco-pre-dogfood` branch preserved at `3ac0ee9`
- SDI-2 counter: **2** (unchanged)
