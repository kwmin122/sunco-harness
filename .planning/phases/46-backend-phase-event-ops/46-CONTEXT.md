# Phase 46 — backend phase event + ops

- **Spec alias**: v1.4/M3.5
- **Milestone**: M3 Backend Excellence
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.5 (line 569-604)
- **Requirement**: IF-12 (see `.planning/REQUIREMENTS.md`:288)
- **Precedent**: Phase 45/M3.4 backend-phase-api+data @ commits `9a52c53` + `e424a23`
- **Status**: **Populated 2026-04-19.** Focused+ Gate 46 passed GREEN-CONDITIONAL; two-judge convergent (plan-verifier + Codex backend-review). 5 conditions absorbed (Codex A7 history-diff removal, A7 M2 hash scope note, A3 README docs separation, plan-verifier #15 living-document clarification, SDI-2 3-occurrence PIL trigger explicitness).

## Goal

Activate the two EVENT/OPS backend workflow surfaces. Mirror Phase 45's 6-step behavioral pattern for `/sunco:backend-phase --surface event|ops`. Extend the existing `sunco-backend-researcher` agent (Phase 45: 2 surfaces → Phase 46: 4 surfaces) per spec §7 singular naming. Agent reads BACKEND-CONTEXT.md (Phase 44 schema), loads Phase 42 README-authoritative reference subset per surface (spec §7 Phase 3.5 is silent on ref list), writes EVENT-SPEC.md / OPS-SPEC.md with `<!-- SUNCO:SPEC-BLOCK -->` YAML validating against new per-surface JSON schemas.

## Scope in

- `packages/cli/workflows/backend-phase-event.md`: stub 28 → behavioral 6-step (~310 lines)
- `packages/cli/workflows/backend-phase-ops.md`: stub 28 → behavioral 6-step (~330 lines)
- `packages/cli/agents/sunco-backend-researcher.md`: extend routing table 2 rows → 4 rows (api/data/event/ops); add Stage 1 surface rules + Stage 2 outline templates + Stage 3 sections for event/ops; add SPEC-BLOCK required fields for event/ops; spec-source authority note (spec-verbatim for api/data vs README-authoritative for event/ops) (singular per spec §7 — NOT a 2-agent split)
- `packages/cli/schemas/event-spec.schema.json`: NEW, draft-07, lenient-additive, `version: 1` required (BS1), per-event `ordering`/`delivery_guarantee` enums
- `packages/cli/schemas/ops-spec.schema.json`: NEW, draft-07, lenient-additive, `version: 1` required (BS1), `observability` sub-structure required (logs/metrics/traces), `slo` structural projection of BACKEND-CONTEXT SLO
- `packages/cli/bin/smoke-test.cjs`: Section 21 added (~23 checks); Section 20 #24 retirement (event/ops stubs no longer ≤200 lines); Section 19 SURFACE_STUB_FILES 6→4 (review surfaces only)
- `packages/cli/references/backend-excellence/README.md`: **NOT in this commit** — Phase 45 api-row sync landed as separate docs-only commit (Codex Gate 46 condition 3)

## Scope out (hard)

- Phase 47 review surfaces (backend-review-{api,data,event,ops}) — remain stubs
- Phase 43 detector wiring into Phase 46 workflows or agent (Phase 47 wire point)
- Phase 44 BACKEND-CONTEXT.md schema modification (Phase 44 lock)
- `discuss-phase.md` edit (FRONTEND / BACKEND blocks, tag lines, surrounding prose)
- Phase 42 `backend-excellence/reference/*.md` substantive edits (Phase 43 Escalate #5 still active)
- Phase 45 `backend-phase-api.md` / `backend-phase-data.md` / `api-spec.schema.json` / `data-spec.schema.json` substantive edits (Phase 45 locked)
- M2 frontend surfaces substantive edits (adjacency-risk 3-file hash locked from Phase 45 + wrappers path-distance + `--test` protected)
- Vendored Impeccable source (R5 hard)
- install.cjs / Phase 37 R3 marker tag lines / Phase 37 backend router files
- PIL 999.1 backlog
- **`backend-context-loader.mjs`** — Phase 47 scope (A6 YAGNI carry)
- **Phase 40 ui-spec.schema.json BS1 version retrofit** — registered plan debt, NOT Phase 46 scope (Phase 48 前 별도 commit)
- Validator (ajv) activation — deferred comment only (Phase 48+ plumbing)
- 2-agent split (spec §7 "sunco-backend-researcher" singular)
- OPS-SPEC `slo` verbatim-duplicating BACKEND-CONTEXT prose (structural projection only)
- EVENT-SPEC including HTTP request/response schemas (API-SPEC territory)
- Smoke Section 20l CI strict-mode restore (separate devops commit when CI workflow file is touched)

## Key decisions (Focused+ Gate 46 outcomes)

### A1. Workflow populate (stub → behavioral 6-step, 2 files) — GREEN

Mirror Phase 45 `backend-phase-api.md` / `backend-phase-data.md` 6-step structure for both files:

```
Step 1: Require BACKEND-CONTEXT.md    — hard-stop exit 1 if absent,
                                        guide user to /sunco:discuss N --domain backend
Step 2: Read phase CONTEXT + BACKEND-CONTEXT — inline bash (no loader module)
Step 3: Spawn sunco-backend-researcher --surface <event|ops> + ref subset
Step 4: Write {EVENT|OPS}-SPEC.md     — prose sections + SPEC-BLOCK (R2)
Step 5: Validate SPEC-BLOCK           — structural check v1 (ajv deferred) + per-surface sub-structure
Step 6: Present for review + commit
```

Smoke assertion (Phase 45 precedent): Step 1-6 markers + output path regex (EVENT-SPEC.md / OPS-SPEC.md), not line-count alone.

### A2. sunco-backend-researcher extension (1 agent, 2 → 4 surfaces) — GREEN

**1 agent**, `--surface api|data|event|ops` dispatcher pattern. Spec §7 uses singular "sunco-backend-researcher" — spec-verbatim; Phase 45 precedent continues.

3-stage protocol budget re-evaluated: event/ops use 2 primary refs each (same as Phase 45 data surface, fewer than api's 4). Stage 1 ~8k / Stage 2 ~4k / Stage 3 ~15k + 3k buffer = 30k ceiling **unchanged** — adding surfaces doesn't increase per-invocation load (still 1 surface per spawn).

Surface-specific Stage 1 rule added for `event` (no deterministic Phase 43 rules map — pure anti-pattern listing per spec §7 Phase 3.6 "no deterministic rules v1"); `ops` captures `missing-timeout` / `swallowed-catch` / `logged-secret` Detection labels (Phase 43 detector's ops-surface subset).

Hard guards in agent spec extended:
- MUST NOT invoke Phase 43 detector (detect-backend-smells.mjs) — Phase 47 wire point
- MUST NOT wire into /sunco:backend-review (Phase 47 scope)
- Read-only on Phase 42 reference docs
- MUST NOT write BACKEND-CONTEXT.md (read-only consumer)
- OPS-SPEC `slo` is structural projection of BACKEND-CONTEXT SLO, NOT verbatim duplicate (prevents dual source-of-truth)
- EVENT-SPEC MUST NOT include HTTP request/response schemas (API-SPEC territory)
- DATA-SPEC MUST NOT include cross-service event schemas (EVENT-SPEC territory — now active)

### A3. Reference loading set per surface — GREEN-CONDITIONAL (Codex condition 3 absorbed)

**Spec §7 Phase 3.5 is silent on ref list** (unlike Phase 45 where §7 Phase 3.4 was verbatim). Phase 42 README load-strategy table is the local authority chosen at Focused+ Gate 46.

| Surface | REQUIRED (Phase 42 README Primary, Stage 1 mandatory) | OPTIONAL (README Secondary, Stage 1 if ≤8k budget permits) |
|---------|-------------------------------------------------------|------------------------------------------------------------|
| event | reliability-and-failure-modes.md, boundaries-and-architecture.md | performance-and-scale.md, observability-and-operations.md |
| ops | observability-and-operations.md, reliability-and-failure-modes.md | security-and-permissions.md, migrations-and-compatibility.md |

**Living-document note (plan-verifier #15 absorbed):** README is the baseline authority AT PHASE 46 AUTHORSHIP. Future phases may revise event/ops rows only after Gate re-justification — README is not frozen. The event/ops row at HEAD=638c16e post-Phase-46 is the baseline; substantive modification = escalate trigger.

**Phase 42 README api row sync (docs debt)** landed as separate docs-only commit `638c16e` BEFORE Phase 46 main commit (Codex condition 3: clean separation between Phase 45 debt closure and Phase 46 delivery). Scope was 1 line (Primary list for api-row gained `reliability-and-failure-modes`); reference/*.md untouched (Phase 43 Escalate #5 preserved).

### A4. SPEC.md output format (prose + SPEC-BLOCK per R2) — GREEN

**EVENT-SPEC.md** section layout:
- `<!-- spec_version: 1 -->` top-of-file marker (§12 BS1)
- `# EVENT-SPEC — Phase [N] [phase-name]`
- `## Event Intent` / `## Events Inventory` / `## Ordering & Delivery Semantics` / `## Idempotency & Keys` / `## Dead-Letter Strategy` / `## Anti-pattern Watchlist`
- SPEC-BLOCK YAML with: `version: 1`, `events[]` (each {name, producer, consumers, schema?, ordering enum, delivery_guarantee enum, retention?}), `dead_letter_strategy`, `idempotency_keys`, `anti_pattern_watchlist` (≥3)

**OPS-SPEC.md** section layout:
- `<!-- spec_version: 1 -->`
- `# OPS-SPEC — Phase [N] [phase-name]`
- `## Deployment Topology` / `## Observability` / `## Runbook` / `## SLO & Error Budget` / `## Anti-pattern Watchlist`
- SPEC-BLOCK YAML with: `version: 1`, `deployment_topology`, `observability {logs, metrics, traces, alerts?}`, `runbook?`, `slo {availability, latency_p95_ms}`, `error_budget_policy?`, `anti_pattern_watchlist` (≥3)

Both files require ≥3 anti-patterns (Phase 40/45 `minItems:3` precedent). OPS-SPEC `slo` is **structural projection** of BACKEND-CONTEXT SLO — dual-source-of-truth prevention.

### A5. JSON schemas (lenient-additive, `version: 1` required) — GREEN

Mirror `api-spec.schema.json` / `data-spec.schema.json` posture (draft-07, `additionalProperties: true`), **WITH `version: 1` required** per BS1:

**event-spec.schema.json required (5):** `version` (const:1), `events` (array, minItems:1; each event requires name+producer+consumers+ordering enum+delivery_guarantee enum), `dead_letter_strategy`, `idempotency_keys`, `anti_pattern_watchlist` (array, minItems:3).

**ops-spec.schema.json required (5):** `version` (const:1), `deployment_topology`, `observability` (object; requires `logs`+`metrics`+`traces` sub-objects; optional `alerts[]` with name+threshold), `slo` (object; requires `availability`+`latency_p95_ms`), `anti_pattern_watchlist` (array, minItems:3). `runbook[]` optional; `error_budget_policy` optional.

**Plan debt carry-over:** Phase 40 `ui-spec.schema.json` lacks `version` field — BS1 compliance gap predates Phase 45. Backfill is out of Phase 46 scope (Phase 48 前 dedicated cleanup); track for post-M3 cleanup.

### A6. BACKEND-CONTEXT.md consumer contract — GREEN

**Reader:** inline bash `grep`/`sed` per-section extraction. No loader module in Phase 46 — Phase 47 scope (A6 YAGNI carry from Phase 45).

**Section names (must match Phase 44 schema exactly — drift = spec violation):**
- `## Domain`
- `## Traffic profile`
- `## Data sensitivity`
- `## SLO`
- `## Deployment model`
- `## Tech stack / runtime (auto-detected)` (optional, may be absent per Phase 44 policy)

Agent receives sections as prose for prompt injection; no structured parsing. `SLO` + `Deployment model` are highest-leverage for ops surface; `Domain` + `Deployment model` for event surface.

**OPS-SPEC slo field**: structural projection of BACKEND-CONTEXT SLO section into `{availability: '<n-nines>', latency_p95_ms: <int>}` form. BACKEND-CONTEXT remains source of truth for SLO intent; OPS-SPEC is downstream structured mirror. Phase 47 review-agent backward-reading will not face dual-source conflict because projection ≠ duplicate.

**Smoke strong assertion** (Phase 45 precedent): Section 21 verifies 4 workflows + 1 agent reference the same BACKEND-CONTEXT.md path + same section-name set. Drift in any of these 5 files is caught immediately.

### A7. Smoke Section 21 + frozen invariant preservation — GREEN-CONDITIONAL (Codex conditions 1+2 absorbed)

**Codex condition 1 (critical) — history-dependent diff removed:** Phase 45 hotfix `e424a23` showed `git diff --stat HEAD~1` is unsafe under shallow-clone CI. Phase 46 Section 21 uses **current-tree content assertions only** (file existence + content marker grep + SHA-256 on hash-locked files). No `HEAD~1` dependency. Phase 45's Section 20l `git diff --stat` with `cat-file -e` probe + WARN degrade remains; Section 21 does not introduce any new history-dependent check.

**Codex condition 2 — M2 adjacency-risk scope note:** Phase 45 3-file hash-lock continues unchanged (content-tree SHA-256 is shallow-clone-safe). Phase 46 does NOT expand hash scope to Phase 45 backend files — physical adjacency is low, and the risk is covered by Section 21 content-marker grep on Phase 45 files (workflow Step 1-6 markers + schema required-field lists + agent 4-surface routing table presence). Phase 47 or M4 entry may re-evaluate hash scope.

**Section 21 checks (~23):**

1. `backend-phase-event.md` populated (>200 lines, 6-step headers, writes `EVENT-SPEC.md`)
2. `backend-phase-ops.md` populated (>200 lines, 6-step headers, writes `OPS-SPEC.md`)
3. Both Step 1 hard-stops on BACKEND-CONTEXT.md absent
4. Both reference Phase 44 BACKEND-CONTEXT.md canonical path
5. Both reference Phase 44 5 required + 1 optional section names
6. `sunco-backend-researcher.md` expanded with 4-surface routing table (api/data/event/ops rows)
7. Agent event-surface ref subset grep (reliability + boundaries primary)
8. Agent ops-surface ref subset grep (observability + reliability primary)
9. Agent still forbids Phase 43 detector invocation (guard string)
10. Agent still forbids Phase 47 review wire (guard string)
11. Agent documents 30k token ceiling + 8k/4k/15k per-stage budget (unchanged)
12. `event-spec.schema.json` exists, draft-07, additionalProperties:true
13. event-spec required=5 fields listed
14. event-spec version const:1, anti_pattern_watchlist minItems:3
15. event-spec events[].ordering enum + delivery_guarantee enum present
16. `ops-spec.schema.json` exists, same posture
17. ops-spec required=5 fields listed
18. ops-spec version const:1, anti_pattern_watchlist minItems:3
19. ops-spec observability sub-structure required (logs/metrics/traces)
20. ops-spec slo required with availability + latency_p95_ms
21. FRONTEND marker SHA-256 `0b723b2b...06ee` (R3, Phase 44 propagates)
22. Router files SHA-256 byte-identical (Phase 44 lock propagates)
23. **M2 adjacency-risk hash lock (3 files from Phase 45 — unchanged scope)**
24. Phase 43 detector source + Phase 42 reference/*.md + vendored source — current-tree file hash unchanged (NO `git diff HEAD~1`)
25. Phase 45 backend files (api-spec.schema.json, data-spec.schema.json, backend-phase-api.md, backend-phase-data.md) — content-marker grep assertions (required fields in schemas, 6-step markers in workflows) — NO history diff
26. Phase 46 CONTEXT populated
27. Phase 47 stub sanity: 4 `backend-review-*.md` still ≤200 lines

**Retirement**: Section 19 SURFACE_STUB_FILES 6→4 (remove event/ops; review 4 remain); Section 20 #24 "Phase 46 stub ≤200" removed (event/ops now populated).

**Target smoke**: 335 (Phase 45) − 2 (Section 19 stub-exit event/ops) − 1 (Section 20 #24) + ~27 (Section 21) ≈ 359.

## Escalate triggers (halt + re-relay if any fires)

1. Phase 47 stub (any `backend-review-*.md`) activated
2. Phase 43 detector wired into Phase 46 workflow or agent
3. Phase 44 BACKEND-CONTEXT.md schema modification (Phase 44 lock)
4. `discuss-phase.md` edit (FRONTEND / BACKEND block, tag lines, surrounding prose)
5. Phase 42 `backend-excellence/reference/*.md` substantive edit (README edits permitted per docs-debt precedent but no reference/*.md)
6. M2 adjacency-risk hash mismatch (Phase 45 3-file lock) or M2 wrapper `--test` count regression
7. Vendored Impeccable source mutation (R5 hard)
8. install.cjs / Phase 37 dispatcher / Phase 37 R3 marker tag lines edited
9. PIL 999.1 backlog pull-in
10. `backend-context-loader.mjs` authored inside Phase 46
11. `ajv` validator actually activated (Phase 48+ plumbing)
12. Phase 40 `ui-spec.schema.json` BS1 version retrofit inside Phase 46
13. OPS-SPEC `slo` field verbatim-duplicates BACKEND-CONTEXT SLO prose (structural projection only)
14. EVENT-SPEC gets HTTP request/response schemas (API-SPEC territory)
15. 2-agent split (spec-verbatim singular)
16. README event/ops row substantive edit without Gate re-justification (living-document note per plan-verifier #15; api row sync was a separate bounded docs-debt closure commit)
17. Phase 45 backend files (api-spec.schema / data-spec.schema / backend-phase-api / backend-phase-data) substantive edit
18. Commit amend attempt (precedent: always NEW commit)
19. Any `git diff --stat HEAD~1` style history-dependent CI assertion re-introduced without `cat-file -e` probe + WARN degrade (Codex Gate 46 A7 condition 1)

## Rollback anchor

Pre-Phase-46 HEAD: `638c16e` (docs(backend-excellence): sync api reference load strategy, pushed pending). `rollback/pre-v1.3-decision` tag remains.

Pre-docs-sync HEAD: `e424a23` (Phase 45 CI-shallow-clone hotfix, pushed 2026-04-19).

## SDI-2 — additive fix pattern (3-occurrence → PIL promote)

SDI-2 registered 2026-04-19 after 2 occurrences (Phase 44 `67a23f1` + `de4c2b1` pre-push post-judge; Phase 45 `9a52c53` + `e424a23` post-push post-CI-fail). **Plan-verifier condition absorbed at Gate 46**: 3rd occurrence MUST trigger PIL 999.1 promote — explicit rule, not discretionary.

Trigger: phase commit passes local gates but external signal (judge post-review / CI output / shallow-clone / install mismatch / cross-model) surfaces a bounded issue before the next risky phase begins.

Resolution: narrow additive fix commit on top of initial delivery. Never amend. Never squash. Scope bounded.

Phase 46 separate docs-commit pattern (Phase 45 debt closure → `638c16e` → Phase 46 main) is **NOT an SDI-2 occurrence** — it is a clean scope separation preceding the phase commit, not a post-commit additive fix. SDI-2 counter remains at 2.

## Judge relay summary (Focused+ Gate 46, 2026-04-19)

Two independent judges (Codex backend-review + plan-verifier) both returned GREEN-CONDITIONAL with 5 absorb-able conditions.

**Conditions absorbed (5):**

1. **Codex A7 critical — history-diff removal**: `git diff --stat HEAD~1` forbidden in Section 21. Current-tree content assertion + SHA-256 + content marker grep only. Phase 45 `e424a23` hotfix precedent encoded as escalate trigger #19.
2. **Codex A7 — M2 hash scope note**: Phase 45 3-file hash unchanged; no expansion into Phase 45 backend files. Physical adjacency low; content-marker grep covers substantive drift.
3. **Codex A3 — docs separation**: Phase 42 README api-row sync landed as separate commit `638c16e` before Phase 46 main. Clean debt-closure / phase-delivery separation.
4. **Plan-verifier #15 — README living-document clarification**: README is baseline authority AT PHASE 46 AUTHORSHIP. Future event/ops row modification requires Gate re-justification (escalate trigger #16). Not frozen, but not freely mutable either.
5. **Plan-verifier SDI-2 — 3-occurrence PIL promote explicit**: 3rd SDI-2 occurrence is a hard PIL 999.1 registration trigger (not discretionary). Encoded in CONTEXT SDI-2 section above.

Focused+ Gate 46 → GREEN (after conditions absorbed). Execution authorized.
