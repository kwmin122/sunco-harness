# Phase 50 — documentation + migration guide (M5.1)

- **Spec alias**: v1.4/M5.1
- **Milestone**: M5 Rollout Hardening
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` (§9 Phase 5.1)
- **Requirement**: IF-16 (see `.planning/REQUIREMENTS.md` § v1.4)
- **Status**: **Populated** (2026-04-20) — Focused+ docs gate (internal self-check), 0 code behavior changes, 4 docs + README section + smoke Section 25.

---

## Phase 50 character — docs phase, not implementation

Phase 50 is the first M5 phase. Character is **fundamentally different** from M1-M4: no new code behavior, no new skills, no new workflows, no new commands. Only user-facing documentation that closes charter drift trails and establishes rollout readiness. Gate level: **Focused+** (NOT Full Gate) — 10 scope axes (user-provided), no novel risk vector, no breaking schema change, no cross-phase policy invention. Spec §9 Phase 5.1 is prescriptive on deliverables.

Rollout hardening = make existing v1.4 surface (M1-M4) discoverable, explainable, and safely adoptable by users who didn't implement it.

---

## Phase 50 deliverables

### Core docs (spec §9 Phase 5.1 — 3 files named)

1. **`packages/cli/docs/impeccable-integration.md`** — Impeccable skill integration: when to use `/sunco:ui-phase --surface web`, what DESIGN-CONTEXT.md contains, how Impeccable findings flow into IMPECCABLE-AUDIT.md + UI-REVIEW.md (Phase 38-41 surface).

2. **`packages/cli/docs/backend-excellence.md`** — Backend Excellence (M3): 8 reference docs (Phase 42), 7 detector rules (Phase 43), BACKEND-CONTEXT teach (Phase 44), 4 backend-phase surfaces (Phase 45-46) + 4 backend-review surfaces (Phase 47), audit_version:1 state discipline.

3. **`packages/cli/docs/migration-v1.4.md`** — Migration guide: what changed from v0.11.x, non-breaking adoption path, `/sunco:ui-review` behavior preserved, `--surface` flag semantics, yaml direct dependency note, new commands inventory.

### 4th doc (scope-justified addition)

4. **`packages/cli/docs/cross-domain.md`** — Cross-Domain Integration (M4): CROSS-DOMAIN.md generation (Phase 48), verify-gate cross-domain layer (Phase 49), `/sunco:proceed-gate` severity × state policy, audit_version:2 + CROSS-DOMAIN-FINDINGS.md lifecycle, `--allow-low-open` flag, charter citation (A6-i deterministic-first over spec §8 L685 agent wording), future heuristic extension slot.

**Justification for 4th doc:** Spec §9 names 3 docs anticipating M4 as M3-adjacent. M4 actually emerged as a distinct 2-phase milestone (Phase 48 + Phase 49) with (a) its own contract file format (CROSS-DOMAIN.md + CROSS-DOMAIN-FINDINGS.md), (b) its own severity × state policy (new proceed-gate behavior), (c) charter drift trail requiring documentation closure (Spec §8 L685 amendment debt). Folding into migration-v1.4.md would bury depth; folding into backend-excellence.md would misclassify a cross-domain topic as backend-only. Dedicated file is the cleanest scope + user-discoverability path.

### README section

5. **`packages/cli/README.md`** — add v1.4 Highlights section above v0.11.0 section (additive, no regression to older version histories); command list updated to reference new gates; links to 4 new docs added.

### Package metadata

6. **`packages/cli/package.json`** — `files` array includes `"docs/"` so published tarball ships the docs directory.

### Smoke coverage

7. **`packages/cli/bin/smoke-test.cjs`** — Section 25 (~20 checks): 4 docs exist + contain must-mention markers (proceed-gate, CROSS-DOMAIN-FINDINGS, audit_version:2, yaml direct dep, L685 amendment rationale, --surface flags); README v1.4 section present + links the 4 docs; package.json files[] contains docs/.

---

## Gate 50 — Focused+ internal self-check (not Full Gate, not two-judge relay)

**Rationale for internal self-check:** User explicitly directed Phase 50 to proceed without external judge relay ("이거 다 너가해"). Docs-only scope + 10 user-provided axes + spec §9 prescriptive = low novel-risk surface. Focused+ internal rigor maintained: spec-literal fidelity + M1-M4 cross-phase consistency + plan debt closure + no code behavior change discipline.

### Gate 50 axes (user-provided, 10)

| # | Axis | Disposition |
|---|---|---|
| 1 | Impeccable integration docs | GREEN — impeccable-integration.md (M2 surface) |
| 2 | Backend Excellence docs | GREEN — backend-excellence.md (M3 surface, all 8 ref docs + 7 detector rules + 4 surfaces) |
| 3 | Cross-domain / proceed-gate docs | GREEN — cross-domain.md (4th file justified above; includes proceed-gate severity policy) |
| 4 | Migration guide | GREEN — migration-v1.4.md (non-breaking adoption + yaml dep note) |
| 5 | README command usage updates | GREEN — v1.4 Highlights section + 4 doc links |
| 6 | Spec §8 L685 deterministic-only narrowing rationale | GREEN — covered in cross-domain.md (closes NEW plan debt from Phase 49 A6-iii) |
| 7 | audit_version:2 + CROSS-DOMAIN-FINDINGS lifecycle docs | GREEN — covered in cross-domain.md |
| 8 | yaml direct dependency rationale | GREEN — covered in migration-v1.4.md |
| 9 | No code behavior changes except docs/help text | GREEN — hard invariant; only README.md, 4 new docs, package.json files[], smoke-test.cjs Section 25 |
| 10 | Smoke/docs checks | GREEN — Section 25 ~20 checks |

### Out-of-scope (hard lock)

- Any change to `packages/cli/schemas/*.json`
- Any change to `packages/cli/workflows/*.md` (verify-phase, ship, proceed-gate, cross-domain-sync, etc.)
- Any change to `packages/cli/agents/*.md`
- Any change to `packages/cli/commands/sunco/*.md` (no frontmatter tweaks, no command body edits)
- Any change to `packages/cli/references/**` (Phase 42/43/45/46/47/48/49 assets IMMUTABLE)
- Any change to hooks / scripts / build tooling
- `install.cjs` modification (Phase 49 precedent: gate commands are frontmatter-based; docs/ may or may not install to runtime — defer that decision to Phase 51 or later)
- Phase 51 dogfood/fixture work pre-empted
- `ajv` introduction
- PIL 999.1 backlog pull-in
- `git commit --amend`
- History-dependent CI

### Plan debt closure on Phase 50 commit

- **Spec §8 L685 agent-wording amendment — CLOSING** (A6-iii from Phase 49; rationale documented in cross-domain.md)
- README "85 commands" stale count correction — opportunistic update alongside v1.4 section
- No NEW plan debt introduced by Phase 50

### Remaining carry debts post-Phase-50

- BS2 runtime token logging (→ Phase 51 dogfood)
- Smoke Section 20l CI strict-mode restore (→ CI config touch, not Phase 50 scope)

---

## Done-when (10 criteria)

1. `packages/cli/docs/impeccable-integration.md` exists, covers M2 surface (Phase 38-41): vendored skill wrapper, DESIGN-CONTEXT, `/sunco:ui-phase --surface web`, `/sunco:ui-review --surface web`, IMPECCABLE-AUDIT.md + UI-REVIEW.md output.
2. `packages/cli/docs/backend-excellence.md` exists, covers M3 surface (Phase 42-47): 8 reference docs, 7 detector rules, BACKEND-CONTEXT teach, 4 backend-phase surfaces + 4 backend-review surfaces, audit_version:1 discipline.
3. `packages/cli/docs/cross-domain.md` exists, covers M4 surface (Phase 48-49): CROSS-DOMAIN.md generation, 4 verify checks, CROSS-DOMAIN-FINDINGS.md 3-region structure, audit_version:2 lifecycle, `/sunco:proceed-gate` severity × state policy, `--allow-low-open` flag, charter citation (L685 deterministic-only), future heuristic extension slot.
4. `packages/cli/docs/migration-v1.4.md` exists, covers v0.11.x → v1.4 non-breaking adoption, yaml direct dep rationale, `--surface` flag semantics, new commands inventory, `/sunco:proceed-gate` user-facing flow.
5. `packages/cli/README.md` contains v1.4 Highlights section above v0.11.0, with 4 doc links.
6. `packages/cli/package.json` `files` array includes `"docs/"`.
7. `packages/cli/bin/smoke-test.cjs` Section 25 added, Sections 1-24 unchanged.
8. Smoke 544 + N/544 + N passes (N = Section 25 additions); injector 10/10, adapter 22/22, detector 17/17, extract-spec-block 33/33 unchanged (Phase 50 no code behavior change).
9. Zero code behavior change — git diff restricted to docs/, README.md, package.json files[], smoke-test.cjs Section 25, 50-CONTEXT.md.
10. Single atomic commit; SDI-2 counter remains 2.

---

## Requirements covered

- **IF-16** (see `.planning/REQUIREMENTS.md:298`): Documentation and migration guide — `docs/impeccable-integration.md`, `docs/backend-excellence.md`, `docs/migration-v1.4.md` (spec named `migration-v0.X.md`; v1.4 is the actual version being released), README update with v1.4 usage, plus `docs/cross-domain.md` scope-justified addition for M4 integration depth.

---

*Phase 50/M5.1 — docs phase, Focused+ internal self-check, 0 code behavior changes, 4 new docs + README section + smoke Section 25. Spec §8 L685 amendment plan debt CLOSES on commit. Proceeds to Phase 51 dogfood.*
