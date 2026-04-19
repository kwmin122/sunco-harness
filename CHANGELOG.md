# Changelog

All notable changes to SUNCO-harness are recorded here. This file was introduced in Phase 35/M1.1 of the v1.4 Impeccable Fusion milestone (2026-04-18).

Prior releases (v1.0 through v1.3) are summarized from git history and `ROADMAP.md`; they are not reconstructed entry-by-entry. See `.planning/ROADMAP.md` for full phase-level history.

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
