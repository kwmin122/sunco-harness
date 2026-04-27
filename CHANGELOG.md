# Changelog

All notable changes to SUNCO-harness are recorded here. This file was introduced in Phase 35/M1.1 of the v1.4 Impeccable Fusion milestone (2026-04-18).

Prior releases (v1.0 through v1.3) are summarized from git history and `ROADMAP.md`; they are not reconstructed entry-by-entry. See `.planning/ROADMAP.md` for full phase-level history.

---

## [0.14.0] — 2026-04-27 — SUNCO v1.6 Proof-first Runtime + M8 Productization Gate

**Internal milestone**: v1.6 Proof-first Runtime Foundation (M7) plus M8 Productization Gate. M7 delivers the runtime contract and implementation slice; M8 proves the packaged and installed product executes the same runtime path.

**npm version rationale**: per the v1.4/v1.5 policy, v1.6 milestone → `0.14.0` (minor bump, pre-stable). `popcoru` remains pre-1.0; `1.0.0` is still reserved for a stable-API declaration.

### Added

**M7 — Proof-first Runtime Foundation**
- `@sunco/evidence` — task/evidence/check/decision storage under `.sunco/tasks/<task-id>/`.
- `@sunco/verifier` — JS/TS workspace check detection, execution, timeout/log capture, and verification evidence updates.
- `@sunco/runtime` — runtime loop MVP: task creation, edit evidence, verifier execution, Done Gate, and status transitions.
- `@sunco/edit-engine` — changed-file hashes, changed-file evidence, diff patches, and rollback patches.
- `packages/cli/src/runtime-cli.ts` + `bin/sunco-runtime.cjs` — installed front door for `sunco-runtime do/status/verify/ship`.
- Benchmark seeds for false-done prevention and a basic bugfix flow.

**M8 — Productization Gate**
- `sunco-runtime` is now an npm bin in `popcoru` and is installed into Claude, Codex, Cursor, and Antigravity runtime homes.
- The CLI bundle includes the runtime implementation; installed runtime directories do not depend on unpublished workspace packages.
- `packages/cli/bin/release-artifact-smoke.cjs` validates `npm pack -> clean npm prefix install -> temp HOME runtime install -> installed sunco-runtime do/status/verify/ship` across all supported runtimes.
- The artifact smoke also supports `--registry popcoru@<version>` so the published registry artifact can be verified with the same installed-product path.
- Root `npm run release:gate` now composes build, typecheck, tests, lint, whitespace, audit, and artifact smoke.
- GitHub Actions now runs Node 22/24 across Ubuntu/macOS, includes Antigravity smoke, runs the release artifact gate, triggers on `v*` tags, and verifies the registry artifact after publish.

### Fixed

- Package-level TypeScript checks now cover the runtime packages and tests.
- Untracked added files now produce non-empty diff and rollback evidence before Done Gate can pass.
- A `repo_mutate` task with zero changed files is blocked instead of being marked DONE.
- Dummy lint placeholders were removed; workspace lint now runs real checks.
- npm audit was reduced to 0 vulnerabilities.
- Package repository/homepage/bugs metadata now points at the actual `kwmin122/sunco-harness` repository.

### Verification

Release gate expected at the release commit:

| Suite | Result |
|-------|--------|
| `npm run build -- --force` | PASS |
| `npm run typecheck` | PASS |
| `npm test -- --force` | PASS |
| `npm run lint -- --force` | PASS |
| `npm run format:check` | PASS |
| `npm audit --json` | PASS, 0 vulnerabilities |
| `npm run test:codex --workspace popcoru` | PASS against installed Codex runtime |
| `npm run test:artifact --workspace popcoru` | PASS, packaged artifact across Claude/Codex/Cursor/Antigravity |

### Scope boundary

v0.14.0 closes the proof-first runtime foundation and installed-product release path. Approval UX, true stale-edit preflight authority, loop guardrails, evidence hash-chain durability, benchmark runner depth, and semantic PR/release ship integration are intentionally tracked as M9-M12 work rather than claimed as finished here.

## [0.13.0] — 2026-04-22 — SUNCO v1.5 SUNCO Workflow Router

**Internal milestone**: v1.5 SUNCO Workflow Router (7/7 phases committed: 52a + 52b + 53 + 54 + 55 + 56 + 57; M6 committed set complete). Design captured at commit `30e2041` in `.planning/router/DESIGN-v1.md` (678 lines, 4-round convergent review: plan-verifier + Codex; no v2 divergence relay; clean-room design inspired only by the general workflow idea of recurring stages).

**npm version rationale**: per v1.4 CHANGELOG policy, v1.5 milestone → `0.13.0` (minor bump, pre-stable). `popcoru` remains pre-1.0; `1.0.0` is reserved for stable-API declaration.

### Added

**Phase 52a — Router contracts (static)**
- `schemas/route-decision.schema.json` — 10-stage enum + `UNKNOWN` + `HOLD`; strict JSON Schema draft-07.
- 5 router reference docs under `packages/cli/references/router/`: `README.md`, `STAGE-MACHINE.md`, `EVIDENCE-MODEL.md`, `CONFIDENCE-CALIBRATION.md`, `APPROVAL-BOUNDARY.md` (clean-room notices verbatim in every doc).
- `.planning/router/decisions/.keep` — durable tier placeholder; kept `.keep`-only through entire v1.5 for audit-integrity (U2 Codex-strict).
- REQUIREMENTS `IF-18..IF-23` + ROADMAP v1.5 M6 section.
- Smoke Section 27 `[52a-static]` +35 checks.

**Phase 52b — Router runtime**
- 4 runtime modules under `packages/cli/references/router/src/`: `classifier.mjs` (pure stage classifier), `evidence-collector.mjs` (adapter-injected IO + 7-point Freshness Gate), `confidence.mjs` (frozen-weight confidence math; zero LLM SDK imports per I4 invariant), `decision-writer.mjs` (path-allowlist writer; atomic tmp-rename).
- `/sunco:router` command + `workflows/router.md` deterministic pipeline (7 steps).
- 4 vitest files at `packages/skills-workflow/src/shared/__tests__/router-{classifier,evidence,confidence,promotion}.test.ts` (79 tests).
- Writer path-allowlist — only `.sun/router/session/*.json`, `.planning/router/decisions/*.json`, `.planning/router/paused-state.json` accepted (Codex C5 / Gate 52b L6).
- Hard invariant L14: `remote_mutate` and `external_mutate` NEVER `auto_safe`; structurally enforced in `validateRouteDecision`.
- Smoke Section 28 `[52b-runtime]` +27 checks.

**Phase 53 — Router wrappers (minus /sunco:auto)**
- 4 wrapper command updates: `/sunco:do`, `/sunco:next`, `/sunco:mode`, `/sunco:manager` — thin-wrap the 52b router engine (L12 engine-sharing; no wrapper duplicates routing logic).
- Mode hook (`packages/cli/hooks/sunco-mode-router.cjs`) — direct-to-router (`/sunco:router --intent`); no `/sunco:do` intermediate dispatch.
- R1 regression guarantee extended to 7 stage commands byte-identical (brainstorming/plan/execute/verify/proceed-gate/ship/release).
- Smoke Section 29 `[53-wrapper]` +24 checks.

**Phase 54 — Compound-router (post-stage durable-decision consumer)**
- `packages/cli/schemas/compound.schema.json` — draft-07 + top-level `$comment` clean-room; 8 required sections enum; 5-state lifecycle (`draft` / `proposed` / `partially-approved` / `approved` / `archived`).
- `packages/cli/references/compound/{README,template}.md` + `src/{compound-router,sink-proposer}.mjs` — adapter-injected IO, pure scoring, auto-write path-allowlist `.planning/compound/*.md` only; sink-proposer zero-fs-imports (proposal-only boundary); structural validator no AJV (Phase 52b L7 precedent).
- `/sunco:compound` command + `workflows/compound.md` 6-step pipeline.
- Trigger score model: SDI-observational (+2) / spec-rule-prescriptive (+3) / already-codified (-1) / memory-candidate (score=0); always-on for `stage_exit === 'RELEASE'` or `event.milestone_closed === true`.
- R1 8-command extension: `compound.md` added to protection set.
- Smoke Section 30 `[54-compound]` +39 checks.

**Phase 55 — Router dogfood (IF-23)**
- 5 fixture scenarios under `test/fixtures/router/{01..05}/` with γ hybrid layout (flat `route-decisions/*.json` + unified `expected.json` + `expected-compound.md` for WRITE scenarios 3/4/5 only; no per-scenario README per Codex G6).
- `packages/skills-workflow/src/shared/__tests__/router-dogfood.test.ts` — 6 describe blocks, 14 tests; black-box consumer of Phase 52b classifier + Phase 54 compound-router (no new exports per L7).
- Retroactive v1.4 compound artifact at `.planning/compound/release-v0.12.0-20260420.md` — schema-valid, `status: proposed`, 8 populated sections, `source_evidence[]` references fixture paths (L17 `-retroactive.json` naming).
- Retroactive RouteDecision backfill (≥5 entries per DESIGN §11 31d) at `test/fixtures/router/retroactive-v1.4/route-decisions/*-retroactive.json` + `BACKFILL-PROVENANCE.md` (Gate 55 U2 Codex-strict relocation; durable tier `.planning/router/decisions/` preserved `.keep`-only).
- Codex U1 strict correction: scenarios 3/4/5 `risk_level: local_mutate` per APPROVAL-BOUNDARY.md L18 + L47 (compound auto-write is explicit local_mutate exception).
- Smoke Section 31 `[55-dogfood]` +27 checks.

**Phase 56 — Release-router hardening (DESIGN §11 30a)**
- `packages/cli/workflows/release.md` **NEW** — 10-sub-stage decomposition with per-sub-stage `approval_envelope` block (class + risk_level + mode + ACK shape + failure_semantics + rationale).
- 10 sub-stages with locked risk_level mapping per Gate 56 L2:
  - `PRE_FLIGHT` → `read_only` (auto_safe)
  - `VERSION_BUMP` → `repo_mutate_official` (blessed batched-ACK via /sunco:release)
  - `CHANGELOG` → `repo_mutate_official` (blessed batched-ACK; AB2 class-by-purpose per APPROVAL-BOUNDARY L26+L63)
  - `COMMIT` → `repo_mutate` (per-write ACK)
  - `TAG` → `repo_mutate` (per-write ACK)
  - `PUSH` → `remote_mutate` (per-invocation, never cached; APPROVAL-BOUNDARY L21)
  - `PUBLISH` → `external_mutate` (per-invocation, never cached, never `--batch-ack`; DESIGN §11 30c literal; APPROVAL-BOUNDARY L22)
  - `VERIFY_REGISTRY` → `read_only` (auto_safe)
  - `TAG_PUSH` → `remote_mutate` (per-invocation, never cached)
  - `COMPOUND_HOOK` → `local_mutate` (APPROVAL-BOUNDARY L47 explicit exception for compound-router draft auto-write)
- PRE_FLIGHT workspace consistency check enumerated as independent sub-step (DESIGN §11 30d).
- COMPOUND_HOOK runs after VERIFY_REGISTRY success and BEFORE TAG_PUSH (DESIGN §11 30e; Gate 56 L7 ordering ensures compound `source_evidence[]` references registry-verified release).
- TAG_PUSH failure clause: post-semantic-completion git-metadata reconciliation failure; compound trigger timing NOT moved; retry separately invocable (Gate 56 L6; prevents double-write).
- Gate 56 AB1 artifact-gate scope boundary: `workflows/release.md` references `commands/sunco/artifact-gate.md` by name only; command file itself is NOT opened in Phase 56 (hard-lock extended through Phase 57).
- Smoke Section 32 `[56-release]` +22 checks.

**Phase 57 — /sunco:auto classifier-gated autonomous execution (IF-21)**
- `packages/cli/commands/sunco/auto.md` **opened** — first previously-frozen command file modified in v1.5.
- `--allow <level>` flag: permitted literal set `{read_only, local_mutate, repo_mutate}` **ONLY** (Gate 57 AB-57-1 strict-side converged across Codex + Reviewer Claude).
- `repo_mutate_official` / `remote_mutate` / `external_mutate` EXCLUDED from `--allow`; always require explicit ACK per APPROVAL-BOUNDARY L19 (per-write) / L21 (per-invocation, never cached) / L22 (per-invocation, never cached, never `--batch-ack`).
- Classifier-first invocation at each phase boundary: `/sunco:auto` calls `/sunco:router --intent` BEFORE any stage execution (Step 5a.5 in `auto.md`).
- Band gating with thin-HIGH degradation (Gate 57 AB-57-2): HIGH auto-execute requires frozen-weight HIGH **AND** ≥2/3 primary evidence signals (state machine / freshness gate / ephemeral log). Thin-HIGH (1 signal) → MEDIUM treatment. MEDIUM → HOLD regardless of `--allow`. LOW → HOLD + `/sunco:debug` recommendation. UNKNOWN/HOLD → hard halt.
- Compound-hook path chain (Gate 57 AB-57-3): explicit chain `/sunco:auto → /sunco:release → COMPOUND_HOOK → existing Phase 56 workflow writes artifact`; NO generic router-pipeline auto-hook installed.
- 3 dogfood fixtures (Gate 57 AB-57-4): `06-auto-conservative-allow` (HIGH + 3/3 signals + `--allow=local_mutate` → auto_execute); `07-auto-halt-remote` (remote_mutate → halt regardless); `08-auto-halt-medium-band` (MEDIUM band → halt regardless; AB-57-2 oracle).
- `packages/skills-workflow/src/shared/__tests__/router-auto.test.ts` — 3 describe blocks, 8 tests; `evaluateAutoGate` policy simulator mirrors `auto.md` Step 5a.5.
- Stuck detector + `.sun/auto.lock` + 3-retry + `--budget` preserved byte-identical; classifier halts are additive.
- Smoke Section 33 `[57-auto]` +25 checks.

**Cross-phase infrastructure**
- CI-portable byte-identical tripwire (Commit `46ab5ff`): SHA-256 content-hash comparison replaces `git show <sha>:<path>` in `smoke-test.cjs` — works under any checkout depth (shallow or full); no fetch-depth dependency. Hard-locked file baseline table covers 15 byte-stable files across Phases 52a-57.
- Pre-planned 2-commit split pattern preserved across all 6 phases; SDI-2 counter stayed at **2** throughout v1.5 (zero scope-drift-instigated decompositions).
- 6 rollback anchors preserved: `sunco-pre-dogfood @ 3ac0ee9` + `sunco-pre-52b-landed @ 4b1e093` + `sunco-pre-53-landed @ 72a391a` + `sunco-pre-54-landed @ 8e22c9d` + `sunco-pre-55-landed @ 97af2c3` + `sunco-pre-56-landed @ 99c8934`.

### Coverage metrics at v1.5 release

- Workflow tests: **1635/1635** across 145 files (up from 1099 at v1.4 ship).
- Smoke: **818/818** (up from 619 at v1.4 ship).
- Self-tests: **249/249** across 10 modules (compound-router 42 + sink-proposer 21 added in v1.5).
- Turbo lint+build: **10/10** FULL TURBO.
- Contract-lint: **89/89**.

### Observational patterns (not formalized; deferred to v1.5-closure retrospective)

- **Strict-side union accumulation**: 15 instances of Codex strict-side tightening / Reviewer absorb-before-build wording conditions across 5 consecutive phases (Phase 53: 2 / Phase 54: 4 / Phase 55: 2 / Phase 56: 2 / Phase 57: 5).
- **Per-phase-landed anchor iterations**: 6 consecutive iterations of `sunco-pre-<N>-landed @ <sha>` pre-first-mutation anchor pattern (Phases 52b/53/54/55/56/57).
- **architecture.md namespace defer**: 7 consecutive iterations of `.claude/rules/architecture.md` byte-identical from Phase 53 `72a391a` — namespace clarification for Agent Router / Workflow Router / compound-router / release-router / auto-loop-router deferred to v1.5-closure.
- **DESIGN/ROADMAP/REQUIREMENTS immutability**: locked at Phase 52a commit `30e2041` (DESIGN) / `55565ad` (ROADMAP) / `5b8094e` (REQUIREMENTS); all errata absorbed in phase CONTEXTs, never patched upstream (L15 invariant).

### v1.5 maintenance backlog (not release-blocking; harvested at v1.5-closure)

1. `.claude/rules/architecture.md` namespace update (7th iteration defer).
2. Codex O1 README + product-contract cascade flag formalization.
3. Codex O2 per-phase anchor convention formalization (6 iterations reached).
4. 54-CONTEXT + `references/compound/README.md` "2 sections" → "3 buckets" doc drift sweep (C2 mid-milestone carryover).
5. 3-role strict-side union rule formalization (15 accumulated fixtures).
6. C1 dogfood producer-consumer chain wiring (mid-milestone gate carryover).
7. APPROVAL-BOUNDARY.md L32 inclusive class literal clarification (D1 spec-gap).

---

## [0.12.0] — 2026-04-20 — SUNCO v1.4 Impeccable Fusion

**Internal milestone**: v1.4 Impeccable Fusion (17/17 phases; all 5 milestones CLOSED: M1 Foundation, M2 Frontend Web Fusion, M3 Backend Excellence, M4 Cross-Domain Integration, M5 Rollout Hardening).

**npm version rationale**: `popcoru` is pre-1.0; `0.11.1 → 0.12.0` (minor bump) is the honest SemVer signal for a large feature release under a pre-stable package. The `v1.4` naming is the SUNCO product milestone label, decoupled from npm SemVer. A future `v1.5` milestone maps to `0.13.0`; `1.0.0` will be reserved for a stable-API declaration.

### Added

**M2 Frontend Web Fusion (Phases 38-41)**
- `/sunco:ui-phase --surface web` — vendored pbakaus/impeccable (Apache-2.0) wrapper with DESIGN-CONTEXT.md injection and SUNCO-canonical output normalization; vendored source byte-identical to upstream, SUNCO modifications live entirely in `packages/cli/references/impeccable/wrapper/`.
- `/sunco:ui-review --surface web` — 6-pillar UI audit + Impeccable antipattern scan → `IMPECCABLE-AUDIT.md` + `UI-REVIEW.md` dual output. R1 regression guarantee: `--surface cli` (default/omitted) is byte-identical to pre-v1.4 behavior.
- `detector-adapter.mjs`: category → severity translation (slop=HIGH, quality/typography/accessibility/color/contrast=MEDIUM, else LOW); `runDetector` + `writeAuditReport` + `DetectorUnavailableError` sentinel.

**M3 Backend Excellence (Phases 42-47)**
- 8 reference documents under `packages/cli/references/backend-excellence/` (clean-room authorship; structurally inspired by Impeccable but independently written): api-design, data-modeling, boundaries-and-architecture, reliability-and-failure-modes, security-and-permissions, performance-and-scale, observability-and-operations, migrations-and-compatibility.
- 7 deterministic detector rules: `raw-sql-interpolation`, `missing-timeout`, `swallowed-catch`, `any-typed-body`, `missing-validation-public-route`, `non-reversible-migration`, `logged-secret` (HIGH/MEDIUM severity per rule).
- `/sunco:backend-phase --surface {api|data|event|ops}` — 4 surface-specific workflows producing `{API,DATA,EVENT,OPS}-SPEC.md` with SPEC-BLOCK YAML.
- `/sunco:backend-review --surface {api|data|event|ops}` — deterministic detector + LLM heuristic review → `BACKEND-AUDIT.md` with 4 surface sections.
- BACKEND-CONTEXT teach flow — `/sunco:discuss --domain backend` surfaces domain-specific question prompts.
- `audit_version: 1` state-enum discipline.

**M4 Cross-Domain Integration (Phases 48-49)**
- `CROSS-DOMAIN.md` auto-generation from UI-SPEC + API-SPEC SPEC-BLOCK extraction (deterministic grep + YAML parse).
- 4 cross-domain check types with severity × state lifecycle:
  - `missing-endpoint` (HIGH) — UI consumes endpoint not defined in API
  - `type-drift` (HIGH) — UI/API type contract mismatch on shared field path
  - `error-state-mismatch` (MEDIUM) — API error code without explicit UI mapping
  - `orphan-endpoint` (LOW) — API defines endpoint no UI consumer declares
- `finding.schema.json` — `audit_version: 2` expanded state enum: `open`, `resolved` (with `resolved_commit` SHA), `dismissed-with-rationale` (with `dismissed_rationale` ≥50 chars); `oneOf` 3 lifecycle branches; HIGH + `dismissed-with-rationale` structurally rejected.
- `/sunco:proceed-gate --allow-low-open` — severity × state policy: HIGH open = HARD BLOCK (no override), MED open = BLOCK (dismissible with ≥50-char rationale), LOW open = BLOCK by default (pass-through with flag).
- Cross-domain verify-gate layer — additive, non-regressive; single-domain phases see zero behavior change.

**M5 Rollout Hardening (Phases 50-51)**
- 4 integration docs under `packages/cli/docs/`: `impeccable-integration.md`, `backend-excellence.md`, `cross-domain.md`, `migration-v1.4.md`.
- README `v1.4 Highlights` section added above v0.11.0 Highlights.
- 5 test fixtures under `test/fixtures/`: `frontend-web-sample/`, `backend-rest-sample/`, `cross-domain-conflict/`, `proceed-gate-lifecycle/`, `ui-review-regression/`.
- 5 vitest runners under `packages/skills-workflow/src/shared/__tests__/phase51-*.test.ts` (19 tests, picked up via the existing `src/**/__tests__/**/*.test.ts` include pattern — `.github/workflows/ci.yml` unchanged).
- Dogfood artifacts for `/sunco:proceed-gate` surface: `API-SPEC.md`, `BACKEND-AUDIT.md`, `DOGFOOD-RUNTIME.md` (BS2 measurement-only closure).
- Smoke Section 25 (Phase 50 docs) + Section 26 (Phase 51 dogfood/fixtures) added.

### Dependencies

- `yaml` promoted to direct dependency of `popcoru` (`^2.4.2`) — runtime SPEC-BLOCK parsing reliability.
- `files[]` in `packages/cli/package.json` now includes `docs/` — tarball ships the 4 integration docs.

### Verification

All tests green at release commit:

| Suite | Result |
|-------|--------|
| Smoke | 619/619 |
| Vitest (91 files) | 1020/1020 |
| Impeccable injector self-test | 10/10 |
| Impeccable adapter self-test | 22/22 |
| Backend detector self-test | 17/17 |
| Extract-spec-block self-test | 33/33 |
| Contract lint (turbo lint) | 89/0 |
| Turbo build | 5/5 tasks, ESM ~797 KB |

### Known non-blocking mitigations

Six known issues documented as out-of-scope for this release (G9 Phase 51 hard-lock) and tracked in the v1.5/v2 backlog. All user-acknowledged during the `/sunco:proceed-gate` step of the release process.

| # | Issue | Severity | Target |
|---|-------|----------|--------|
| 1 | `raw-sql-interpolation` false-positive @ `extract-spec-block.mjs:559` — template literal in `fix_hint` message (not SQL) | HIGH | v1.5 — detector heuristic hardening (SQL keyword content-domain guard) |
| 2 | `raw-sql-interpolation` false-positive @ `extract-spec-block.mjs:576` — paired FP class as #1 | HIGH | v1.5 — detector heuristic hardening |
| 3 | `swallowed-catch` @ `extract-spec-block.mjs:1213` — true-positive, `catch {}` block | HIGH | v1.5 — code-quality review (rationale comment vs handling improvement) |
| 4 | `swallowed-catch` @ `detector-adapter.mjs:355` — true-positive, paired with #3 | HIGH | v1.5 — code-quality review |
| 5 | dogfood-semantic-fidelity — CLI-as-REST-API mapping is a semantic stretch | MEDIUM | v2 — ops-surface replacement candidate |
| 6 | BS2 runtime token enforcement — measurement-only closure in v1.4; the 30k per-spawn ceiling is currently a design budget, not a runtime guard | LOW | v2 — runtime enforcement |

### Compatibility

- **Zero regression to v0.11.x**: all v1.4 capabilities are opt-in via `--surface` flags. Default invocation paths are byte-identical to pre-v1.4 behavior.
- **SDI-2 counter**: preserved at 2 throughout the v1.4 cycle (no reactive additive-fix commits introduced).
- **Rollback anchor**: `sunco-pre-dogfood` branch preserved at commit `3ac0ee9` (Phase 50 HEAD) for post-release recovery (`git reset --hard sunco-pre-dogfood`).

### Release trail

| Milestone | Final commit | Note |
|-----------|--------------|------|
| M1 Foundation | Phases 35-37 | scaffolding + domain discuss stub |
| M2 Frontend Web Fusion | Phases 38-41 | vendored Impeccable + wrapper |
| M3 Backend Excellence | Phases 42-47 | 8 refs + 7-rule detector + 4 surfaces |
| M4 Cross-Domain Integration | `f8982af` Phase 49 | cross-domain findings + proceed-gate policy |
| M5.1 Documentation + Migration | `3ac0ee9` Phase 50 | 4 integration docs + README v1.4 |
| M5.2 Dogfood + Test Coverage | `390e4027` Phase 51 | 5 fixtures + vitest runners + dogfood artifacts |
| Verification artifact | `f9dfa7a` | Pre-release 51-VERIFICATION.md |

### Historical — Phase 35 / M1.1 (2026-04-18)

File layout + attribution scaffolding that seeded the milestone.
- `packages/cli/references/impeccable/` directory skeleton with `README.md`, `SUNCO-ATTRIBUTION.md`, `NOTICE.md` placeholders. Actual Apache-2.0 vendoring of pbakaus/impeccable landed in Phase 38/M2.1.
- `packages/cli/references/backend-excellence/` directory skeleton with `README.md`, `NOTICE.md` (clean-room declaration). 8 reference documents and the 7-rule detector populated in Phases 42/M3.1 and 43/M3.2.
- `packages/cli/schemas/` directory skeleton with `README.md` explaining the SPEC-BLOCK convention and schema versioning (version 1 for v1.4). Individual schemas populated in Phases 40, 45, 46, 48.
- `CHANGELOG.md` (this file) established as the canonical release log.

### Planning trail

- Planning artifacts reconciled — `docs(planning): reconcile v1.3 planning state` (commit `00b33c4`).
- v1.4 initialized — `docs(planning): initialize Impeccable Fusion v1.4 — 17 phases (35-51)` (commit `47393b7`).
- Spec locked at commit `6e6761a` (`docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md`, 1146 lines, 4-round cross-model ping-pong + gate pass).

## Historical summary

### v1.3 Consolidation & Pivot Absorption (closed 2026-04-18)

Phase 22 Ultraplan Integration → Phase 34 Codex Layer 6 Integration. Advanced through 2026-04-13. Candidate phases 23a (Debug Iron Law), 23b (Review Army), 29 (AST-Grep), 31 (Hashline Stale-Edit Guard) preserved as historical — closed as superseded by v1.4 Impeccable Fusion direction.

### v1.2 Light Harness (completed 2026-04-06)

Phase 17 Context Intelligence → Phase 21 Cross-Session Intelligence. Requirements LH-01 through LH-24.

### v1.1 Operational Resilience + CI/CD (completed 2026-03-30)

Phase 11 Planning Quality Pipeline → Phase 14 Context Optimization. Phases 15 Document Generation and 16 Skill Marketplace deferred past v1.2.

### v1.0 Core Platform → v1.0 Debugging (completed earlier)

Phases 1 Core Platform → 10 Debugging. CLI engine, skill system, state engine, agent router, recommender, verification pipeline, shipping and milestones lifecycle, composition and debug primitives.
