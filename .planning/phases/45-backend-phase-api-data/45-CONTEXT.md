# Phase 45 — backend phase api + data

- **Spec alias**: v1.4/M3.4
- **Milestone**: M3 Backend Excellence
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.4
- **Requirement**: IF-11 (see `.planning/REQUIREMENTS.md`:287)
- **Precedent**: Phase 40/M2.3 frontend researcher @ commit `bebdd55`
- **Status**: **Populated 2026-04-19.** Focused+ Gate 45 passed GREEN-CONDITIONAL; 7 convergent conditions absorbed + 1 A7 compromise on hash scope (see Judge relay summary).

## Goal

Activate the two API/DATA backend workflow surfaces. Mirror Phase 40's 6-step ui-phase-web behavioral pattern for `/sunco:backend-phase --surface api|data`. Spawn one shared `sunco-backend-researcher` agent (routed via `--surface` flag) that reads BACKEND-CONTEXT.md (Phase 44 schema — first real consumer), loads clean-room Phase 42 backend-excellence reference subset per surface, and writes API-SPEC.md / DATA-SPEC.md with `<!-- SUNCO:SPEC-BLOCK -->` YAML that validates against per-surface JSON schemas.

## Scope in

- `packages/cli/workflows/backend-phase-api.md`: stub 28 → behavioral 6-step
- `packages/cli/workflows/backend-phase-data.md`: stub 28 → behavioral 6-step
- `packages/cli/agents/sunco-backend-researcher.md`: NEW, 3-stage protocol with `--surface api|data` routing (singular per spec §7)
- `packages/cli/schemas/api-spec.schema.json`: NEW, draft-07, lenient-additive, `version: 1` required (BS1 compliance from Phase 45 forward)
- `packages/cli/schemas/data-spec.schema.json`: NEW, same posture
- `packages/cli/bin/smoke-test.cjs`: Section 20 added
- Optional: `packages/cli/references/backend-excellence/README.md` 1-line sync to match spec §7 ref subset for api (plan-verifier authorization — README is not in reference docs freeze scope)

## Scope out (hard)

- Phase 46 event/ops surfaces — remain stubs
- Phase 47 review surfaces — remain stubs
- Phase 43 detector wiring into Phase 45 workflows or agent (Phase 47 wire point)
- Phase 44 BACKEND-CONTEXT.md schema modification (Phase 44 lock)
- `discuss-phase.md` edit (FRONTEND / BACKEND blocks, tag lines, surrounding prose)
- Phase 42 `backend-excellence/reference/*.md` substantive edits (Phase 43 Escalate #5 still active)
- M2 frontend surfaces substantive edits (adjacency-risk siblings hash-locked + wrappers path-distance + `--test` protected)
- Vendored Impeccable source (R5 hard)
- install.cjs / Phase 37 R3 marker tag lines / Phase 37 backend router files
- PIL 999.1 backlog
- **`backend-context-loader.mjs`** — Phase 47 scope (A6 YAGNI)
- **Phase 40 ui-spec.schema.json BS1 version retrofit** — plan debt registered, NOT Phase 45 scope
- Validator (ajv) activation — deferred comment only
- 2-agent split (spec §7 "sunco-backend-researcher" singular)
- API-SPEC endpoint-level SLO fields (OPS-SPEC + BACKEND-CONTEXT territory)

## Key decisions (Focused+ Gate 45 outcomes)

### A1. Workflow populate (stub → behavioral 6-step, 2 files) — GREEN

Mirror Phase 40 `ui-phase-web.md` 6-step structure for both files:

```
Step 1: Require BACKEND-CONTEXT.md    — hard-stop exit 1 if absent,
                                        guide user to /sunco:discuss N --domain backend
Step 2: Read phase CONTEXT + BACKEND-CONTEXT — inline bash (no loader module)
Step 3: Spawn sunco-backend-researcher --surface <api|data> + ref subset
Step 4: Write {API|DATA}-SPEC.md       — prose sections + SPEC-BLOCK (R2)
Step 5: Validate SPEC-BLOCK            — structural check v1 (ajv deferred)
Step 6: Present for review + commit
```

Shared scaffold across both files; diverge at: `--surface` arg, schema path, ref subset, output filename, SPEC-BLOCK YAML shape.

Smoke assertion strategy (Codex note): **Step 1-6 markers + output path regex**, not line count alone. Line count > 200 is a secondary guard (Phase 40 baseline 282).

### A2. sunco-backend-researcher agent (1 agent, 2 surfaces) — GREEN

**1 agent**, `--surface api|data` dispatcher pattern. Spec §7 uses singular "sunco-backend-researcher" — spec-verbatim.

3-stage protocol (Phase 40 symmetry):
- Stage 1 — Ref-load (~8k): Overview + DO/DON'T per required ref
- Stage 2 — Outline (~4k): 6-bullet outline adapted to surface
- Stage 3 — Write (~15k): produce SPEC.md

Total ~27k, 3k buffer, ≤30k hard ceiling.

Hard guards in agent spec:
- MUST NOT invoke Phase 43 detector (`detect-backend-smells.mjs`) — Phase 47 wire point
- MUST NOT wire into `/sunco:backend-review` (Phase 47 scope)
- Read-only on Phase 42 reference docs
- MUST NOT write BACKEND-CONTEXT.md (read-only consumer)

### A3. Reference loading set per surface — GREEN-CONDITIONAL (condition 1 absorbed)

**Reconciliation of spec §7 vs Phase 42 README (spec authoritative):**

| Surface | REQUIRED (spec §7, Stage 1 mandatory) | OPTIONAL (README secondary, Stage 1 if ≤8k budget permits) |
|---------|---------------------------------------|------------------------------------------------------------|
| api | api-design.md, boundaries-and-architecture.md, reliability-and-failure-modes.md, security-and-permissions.md | performance-and-scale.md, observability-and-operations.md |
| data | data-modeling.md, migrations-and-compatibility.md | performance-and-scale.md, reliability-and-failure-modes.md |

Spec §7 is Phase 45's authority. README's Primary/Secondary table (Phase 42 descriptive guide) did not include `reliability-and-failure-modes` as api Primary — that omission predates Phase 45 researcher behavior. Phase 45 treats spec's required set as the minimum; README's secondary set is the optional expansion if Stage 1 token projection leaves room under the 8k cap.

Phase 42 README 1-line sync permitted within Phase 45 commit (plan-verifier authorization; README is NOT in reference docs freeze scope per Phase 43 Escalate #5 — only `reference/*.md` substantive text is frozen).

### A4. SPEC.md output format (prose + SPEC-BLOCK per R2) — GREEN

**API-SPEC.md** section layout:
- `<!-- spec_version: 1 -->` top-of-file marker (§12 BS1)
- `# API-SPEC — Phase [N] [phase-name]`
- `## Surface Intent` / `## Endpoints` / `## Error Envelope` / `## Versioning Strategy` / `## Auth & Idempotency Model` / `## Rate Limiting` / `## Anti-pattern Watchlist`
- SPEC-BLOCK YAML with: `version: 1`, `endpoints[]`, `error_envelope`, `versioning_strategy`, `auth_requirements`, `rate_limiting`, `anti_pattern_watchlist` (≥3)
- No endpoint-level SLO (OPS-SPEC territory per Codex condition)

**DATA-SPEC.md** section layout:
- `<!-- spec_version: 1 -->`
- `# DATA-SPEC — Phase [N] [phase-name]`
- `## Data Model Intent` / `## Entities` / `## Relationships` / `## Indexing Strategy` / `## Migration Strategy` / `## Retention & Lifecycle` / `## Anti-pattern Watchlist`
- SPEC-BLOCK YAML with: `version: 1`, `entities[]`, `migration_strategy`, `retention_policy`, `anti_pattern_watchlist` (≥3)

Both files require ≥3 anti-patterns (Phase 40 `minItems:3` precedent).

### A5. JSON schemas (lenient-additive, `version: 1` required) — GREEN-CONDITIONAL (condition 3 absorbed)

Mirror `ui-spec.schema.json` posture (draft-07, `additionalProperties: true`), **WITH `version: 1` required** per BS1 (judges convergent):

**api-spec.schema.json required (6):** `version` (const:1), `endpoints` (array, minItems:1), `error_envelope` (object), `versioning_strategy` (enum), `auth_requirements` (object), `anti_pattern_watchlist` (array, minItems:3).

**data-spec.schema.json required (5):** `version` (const:1), `entities` (array, minItems:1), `migration_strategy` (enum), `anti_pattern_watchlist` (array, minItems:3), `retention_policy` (object, nullable — required-shape but value may be null when retention is "indefinite").

`rate_limiting` optional on api-spec. `relationships` captured per-entity in data-spec, not a top-level field.

**Plan debt registered:** Phase 40 `ui-spec.schema.json` lacks `version` field — BS1 compliance gap predates Phase 45. Backfill is out of Phase 45 scope (judge-convergent); track for post-M3 cleanup.

### A6. BACKEND-CONTEXT.md consumer contract — GREEN-CONDITIONAL (condition 4 absorbed)

**Reader:** inline bash `grep`/`sed` per-section extraction. No loader module in Phase 45 — Phase 47 scope.

**Section names (must match Phase 44 schema exactly — drift = spec violation):**
- `## Domain`
- `## Traffic profile`
- `## Data sensitivity`
- `## SLO`
- `## Deployment model`
- `## Tech stack / runtime (auto-detected)` (optional, may be absent per Phase 44 policy)

Agent receives sections as prose for prompt injection; no structured parsing (Phase 47 loader's job).

**Smoke strong assertion** (Codex condition): Section 20 verifies both workflows + agent reference the same BACKEND-CONTEXT.md path + the same section-name set. Drift in any of these three files is caught immediately.

### A7. Smoke Section 20 + frozen invariant preservation — GREEN-CONDITIONAL (compromise absorbed)

**M2 hash scope compromise:**

Plan-verifier preferred 5-file universal M2 hash; Codex opposed M2 hash expansion beyond targeted cases. **Impl compromise = adjacency-risk targeting** (3 files — sibling directories to new Phase 45 authorship):

- `packages/cli/agents/sunco-ui-researcher-web.md` SHA-256 = `e3328dcb855a3454398acd08472f4d9f27d1e9cddb1613ccf02442adf762f64a`
- `packages/cli/schemas/ui-spec.schema.json` SHA-256 = `b691a28d7e9e5ad7f0fbaf045c25faaa61dbdcfd85aacf51638ec21fa3b95321`
- `packages/cli/workflows/ui-phase-web.md` SHA-256 = `d77b30e96783a38d3915383563c8e5304f8ebe12bd2cb4447c5398a205f4a205`

Path-distance M2 surfaces (`context-injector.mjs`, `detector-adapter.mjs`) stay on grep/presence + `--test` runs (10/10 and 22/22). Phase 45 does not author into `packages/cli/references/impeccable/wrapper/`, bounding accidental-mutation risk.

Rationale recorded here so post-commit re-review can revisit if either judge objects.

**Section 20 checks (~22):**

1. `backend-phase-api.md` populated (>200 lines, 6-step headers, writes `API-SPEC.md`)
2. `backend-phase-data.md` populated (>200 lines, 6-step headers, writes `DATA-SPEC.md`)
3. Both Step 1 hard-stops on BACKEND-CONTEXT.md absent
4. Both reference Phase 44 BACKEND-CONTEXT.md canonical path
5. Both reference Phase 44 5 required + 1 optional section names
6. `sunco-backend-researcher.md` exists with Stage 1/2/3 markers
7. Agent declares `--surface api|data` routing
8. Agent forbids Phase 43 detector invocation (SDI-like guard string)
9. Agent forbids Phase 47 review wire
10. Agent documents 30k token ceiling + 8k/4k/15k per-stage budget
11. Agent documents spec-required ref subset per surface
12. `api-spec.schema.json` exists, draft-07, additionalProperties:true
13. api-spec required = 6 fields listed
14. api-spec version const:1, anti_pattern_watchlist minItems:3
15. `data-spec.schema.json` exists, same posture
16. data-spec required = 5 fields listed
17. data-spec version const:1, anti_pattern_watchlist minItems:3
18. Both workflows reference correct Stage 1 required ref subset (grep spec filenames)
19. FRONTEND marker SHA-256 `0b723b2b...06ee` (R3, Phase 44 propagates)
20. Router files SHA-256 byte-identical (Phase 44 lock propagates)
21. **M2 adjacency-risk hash lock (3 files — compromise)**
22. Phase 43 detector source diff=0 + Phase 42 reference/*.md diff=0 + vendored source diff=0 (git diff --stat)
23. Phase 44 CONTEXT + Phase 45 CONTEXT populated
24. Phase 46 stub sanity: `backend-phase-event.md` + `backend-phase-ops.md` still ≤200 lines (inherited from Section 19 threshold — 1-line sanity in Section 20)

Target: 294 (Sections 1-19) + ~22 (Section 20) = ~316 passing.

## Escalate triggers (halt + re-relay if any fires)

1. Phase 46 stub (`backend-phase-event.md` or `backend-phase-ops.md`) activated
2. Phase 47 stub (any `backend-review-*.md`) activated
3. Phase 43 detector wired into Phase 45 workflow or agent
4. Phase 44 BACKEND-CONTEXT.md schema modification (Phase 44 lock)
5. `discuss-phase.md` edit (FRONTEND / BACKEND block, tag lines, surrounding prose)
6. Phase 42 `backend-excellence/reference/*.md` substantive edit
7. M2 adjacency-risk hash mismatch or M2 wrapper `--test` count regression
8. Vendored Impeccable source mutation (R5 hard)
9. install.cjs / Phase 37 dispatcher / Phase 37 R3 marker tag lines edited
10. PIL 999.1 backlog pull-in
11. `backend-context-loader.mjs` authored inside Phase 45
12. `ajv` validator actually activated (Phase 48+ plumbing)
13. Phase 40 `ui-spec.schema.json` BS1 version retrofit inside Phase 45
14. API-SPEC gets endpoint-SLO fields (OPS-SPEC/BACKEND-CONTEXT territory)
15. 2-agent split (spec-verbatim singular)

## Rollback anchor

Pre-Phase-45 HEAD: `de4c2b1` (Phase 44/M3.3 pushed 2026-04-19). `rollback/pre-v1.3-decision` tag remains.

## Judge relay summary (Focused+ Gate 45, 2026-04-19)

Two independent judges (Codex backend-review + plan-verifier) both returned GREEN-CONDITIONAL. 6 conditions convergent, 1 divergence on A7 hash scope resolved impl-side via adjacency-risk compromise.

**Conditions absorbed (7):**

1. **A3 ref-set reconciliation**: spec-verbatim required + README secondary optional. Phase 42 README 1-line sync allowed (plan-verifier explicit).
2. **A2 1-agent spec-verbatim**: `sunco-backend-researcher` singular, `--surface` dispatcher.
3. **A5 version field**: `version: 1` required in NEW schemas. Phase 40 retrofit = plan debt.
4. **A6 loader deferral**: inline bash; loader is Phase 47. Smoke asserts workflow+agent consistency.
5. **A7 hash scope (compromise)**: 3-file adjacency-risk targeting.
6. **A1/A7 minor**: Step 1-6 markers + output path assertions (not line-count alone).
7. **A4 detail**: No endpoint-SLO in API-SPEC.

**Plan debt registered (memory):** Phase 40 `ui-spec.schema.json` missing BS1 `version` field — backfill pending in post-M3 cleanup.

Focused+ Gate 45 → GREEN (after conditions absorbed). Execution authorized.
