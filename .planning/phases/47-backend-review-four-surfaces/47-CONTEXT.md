# Phase 47 — backend review four surfaces

- **Spec alias**: v1.4/M3.6
- **Milestone**: M3 Backend Excellence (closing phase)
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.6 (line 605-626)
- **Requirement**: IF-13 (`.planning/REQUIREMENTS.md`:289)
- **Precedent**: Phase 45/M3.4 api+data workflow `9a52c53`+`e424a23`, Phase 46/M3.5 event+ops workflow `638c16e`+`3370bd7`
- **Status**: **Populated 2026-04-19.** Focused+ Gate 47 passed GREEN-CONDITIONAL; two-judge convergent (plan-verifier outgoing Claude + Codex backend-review). 4 Codex conditions absorbed (C1 gate-artifact untracked, C2 section-level replace wording, C3 smoke broad-freeze completion, C4 negative-grep scope limiting); plan-verifier 3 trigger coverage recommendations confirmed already present (trigger #2, #23, #24 in Gate v1).

## Goal

Activate the 4 backend-review surface workflows. Mirror Phase 45/46's behavioral pattern adapted for review (5-step instead of 6-step; no commit step because `BACKEND-AUDIT.md` is a runtime consumer artifact). Introduce `sunco-backend-reviewer` agent (singular per spec §7) with 2-stage research (context-load → review-emit, 30k budget). Introduce `finding.schema.json` with `audit_version: 1` and `state` enum single-value `["open"]` — Phase 49/M4.2 expands to `audit_version: 2` with `resolved`/`dismissed` states. Wire the Phase 43 detector's surface-filtered rule subsets into Steps 2 of api/data/ops workflows; event surface skips detector entirely per spec §7 "no deterministic rules v1". Phase 43 detector source unchanged (§13 7-rule lock); rule subset enforcement is workflow post-process, not detector CLI flag.

## Scope in

- `packages/cli/workflows/backend-review-api.md`: stub 28 → behavioral 5-step (~380 lines)
- `packages/cli/workflows/backend-review-data.md`: stub 28 → behavioral 5-step (~310 lines)
- `packages/cli/workflows/backend-review-event.md`: stub 28 → behavioral 5-step (~300 lines; Step 2 SKIP)
- `packages/cli/workflows/backend-review-ops.md`: stub 28 → behavioral 5-step (~430 lines; SLO projection-drift check)
- `packages/cli/agents/sunco-backend-reviewer.md`: NEW, 2-stage (context-load → review-emit), 30k budget, 4-surface routing, hard guards against deterministic kind / resolved-dismissed states / cross-domain findings / aggregate rollup
- `packages/cli/schemas/finding.schema.json`: NEW, draft-07, lenient-additive, `state` enum `["open"]` single-value (Phase 49 `audit_version: 2` expansion path documented in schema description)
- `packages/cli/bin/smoke-test.cjs`: Section 22 added (~30 checks, Phase 47 contract); Section 19 `SURFACE_STUB_FILES` retired (review surfaces no longer stubs); Section 12 review-stub-references-Phase-47 retired (surfaces populated)
- `.planning/phases/47-backend-review-four-surfaces/47-CONTEXT.md`: populated (this file)

## Scope out (hard)

- Phase 48 cross-domain (`CROSS-DOMAIN.md` generation, cross-surface aggregate rollup, UI↔API endpoint orphan/missing findings)
- Phase 49 finding lifecycle transitions (`resolved` / `dismissed` active enum values, transition semantics, verify-gate integration for state management)
- Phase 44 `BACKEND-CONTEXT.md` schema or auto-detect behavior modification
- `discuss-phase.md` FRONTEND/BACKEND marker block SHA-256 (`0b723b2b...06ee`) change
- Phase 42 `backend-excellence/reference/*.md` substantive edits (Phase 43 Escalate #5 still active)
- Phase 43 `detect-backend-smells.mjs` internal rule set (§13 7-rule lock) or CLI flag additions (`--rules` forbidden)
- Phase 45 `backend-phase-api.md` / `backend-phase-data.md` / `api-spec.schema.json` / `data-spec.schema.json` substantive edits
- Phase 46 `backend-phase-event.md` / `backend-phase-ops.md` / `event-spec.schema.json` / `ops-spec.schema.json` / `sunco-backend-researcher.md` substantive edits
- M2 adjacency-risk 3-file hash (Phase 45 lock, Phase 46 Codex condition 2 carry)
- M2 wrapper (injector/adapter/ui-phase-web/researcher-web/ui-spec.schema) substantive edits or `--test` count regression
- Vendored Impeccable source (R5 hard)
- `install.cjs` / Phase 37 dispatcher / Phase 37 R3 marker tag lines
- Phase 37 backend router SHA-256 (`backend-phase.md` + `backend-review.md`)
- PIL 999.1 backlog
- Commit amend (always NEW commit; Phase 44/45/46 precedent)
- Phase 40 `ui-spec.schema.json` BS1 version retrofit inside Phase 47 (registered plan debt — separate commit scheduled **after Phase 47 push, before Phase 48 entry**, per plan-verifier timing flag)
- `git diff --stat HEAD~1` or history-dependent CI assertion re-introduction (Gate 46 Codex condition 1 carry, escalate trigger)
- 2-agent split for reviewer (spec §7 singular — `sunco-backend-reviewer`)
- Backend detector adapter file authoring (YAGNI — backend detector is clean-room + output schema aligned with `finding.schema.json`; Phase 41 adapter was vendored-Impeccable R5 wrapper, different purpose)
- `ajv` validator activation (Phase 48+ plumbing, Phase 46 escalate #11 carry)
- Reviewer agent emitting `kind: deterministic` (Step 2 detector exclusive territory)
- Reviewer agent writing `<SURFACE>-SPEC.md` / `BACKEND-CONTEXT.md` / `BACKEND-AUDIT.md` directly (orchestrator owns writes)
- `BACKEND-AUDIT.md` committed inside Phase 47 (runtime consumer artifact; generated at user's first `/sunco:backend-review` invocation)
- `GATE-47-REQUEST-v1.md` staged/committed (relay-only scratch, Codex C1)

## Key decisions (Focused+ Gate 47 outcomes)

### A1. 4 workflow populate (stub 28 → behavioral 5-step) — GREEN

5-step pattern (not 6 — BACKEND-AUDIT.md is runtime consumer, no commit step inside workflow):

```
Step 1: Require <SURFACE>-SPEC.md           hard-stop exit 1 if absent,
                                             guide: "Run /sunco:backend-phase N --surface <s> first"
                                             + <!-- spec_version: 1 --> marker check
Step 2: Run Phase 43 detector subset        event: SKIPPED (spec §7 "no deterministic rules v1")
                                             api=4 rules, data=1 rule, ops=3 rules
                                             post-process filter by rule name (NOT detector --rules flag)
                                             state:open injection
Step 3: Spawn sunco-backend-reviewer        --surface + filtered detector findings + SPEC + BACKEND-CONTEXT
                                             2-stage (context-load → review-emit), 30k ceiling
Step 4: Normalize findings                   validate kind ∈ {heuristic, requires-human-confirmation} agent-side
                                             validate state == "open" both sides
                                             validate severity ∈ {HIGH, MEDIUM, LOW}
                                             merge deterministic + agent output
Step 5: Write BACKEND-AUDIT.md               section-level replace per invocation
                                             create 4-section skeleton if absent
                                             preserve other 3 surface sections byte-for-byte
                                             no commit (runtime artifact)
```

Per-surface divergence (Step 1 filename + Step 2 rule subset + Step 5 section label):

| Surface | Step 1 require | Step 2 rule subset | Step 5 section label |
|---------|----------------|---------------------|----------------------|
| api | `${PHASE_DIR}/API-SPEC.md` | raw-sql-interpolation, any-typed-body, missing-validation-public-route, logged-secret (4) | `## API findings` |
| data | `${PHASE_DIR}/DATA-SPEC.md` | non-reversible-migration (1) | `## Data findings` |
| event | `${PHASE_DIR}/EVENT-SPEC.md` | — (detector SKIPPED) | `## Event findings` |
| ops | `${PHASE_DIR}/OPS-SPEC.md` (+ BACKEND-CONTEXT for SLO dual-source) | missing-timeout, swallowed-catch, logged-secret (3) | `## Ops findings` |

Smoke marker-based assertion (Phase 45/46 precedent): Step 1-5 headers + SPEC path + rule-name grep (api=4, data=1, event=0 explicit SKIP marker, ops=3).

### A2. Phase 43 detector wire (post-process filter, detector frozen) — GREEN

- CLI: `node packages/cli/references/backend-excellence/src/detect-backend-smells.mjs --json ${TARGET:-.}`
- Exit codes: 0 (clean) / 2 (findings) / 1 (error — hard-stop)
- **Rule subset enforcement: workflow post-process** (Node inline JSON filter). Detector `--rules` flag **NOT added** (§13 7-rule lock + Phase 43 CONTEXT lock).
- **Event surface: Step 2 SKIP** (spec §7 verbatim "no deterministic rules v1 — pure review"). Empty `[]` handed to agent.
- Detector output schema (`{rule, severity, kind: "deterministic", file, line, column, match, fix_hint}`) already aligned with `finding.schema.json`. Workflow post-process **injects `state: "open"`** on each — no other mutation.
- **No backend detector adapter file** — Phase 41 `detector-adapter.mjs` wraps vendored Impeccable (R5 reason); backend detector is clean-room authorship with aligned output schema. YAGNI.

### A3. Surface-specific SPEC.md hard-stop (Step 1) — GREEN

- Each review workflow Step 1 hard-stops on `${PHASE_DIR}/{API|DATA|EVENT|OPS}-SPEC.md` absent
- Exit 1 with guide: `"Run /sunco:backend-phase ${PHASE_ARG} --surface <s> first"`
- `<!-- spec_version: 1 -->` top-marker grep (structural sanity, Phase 45/46 BS1 propagation)
- SPEC-BLOCK re-validation **NOT done** (Phase 45/46 Step 5 already validated; avoid double-check)
- OPS workflow adds secondary hard-stop on `BACKEND-CONTEXT.md` absent (SLO source of truth; dual-source check requires both files present)

### A4. `sunco-backend-reviewer` agent — GREEN

- **Singular** per spec §7 (1-agent-4-surfaces; researcher precedent mirror)
- **2-stage** (not 3-stage like researcher): Stage 1 context-load (~8k) + Stage 2 review-emit (~15k) + 7k buffer = 30k ceiling. Researcher's Stage 2 outline is unnecessary for review (output is findings list YAML, not document authorship).
- Ref subset: Phase 42 README load-strategy `backend-review-<surface>` row (already has review-surface column from Phase 42 authorship)
- **Hard guards**:
  - MUST NOT write `<SURFACE>-SPEC.md` / `BACKEND-CONTEXT.md` / `BACKEND-AUDIT.md`
  - MUST NOT emit `kind: deterministic` (Phase 43 detector exclusive)
  - MUST NOT emit `state: resolved` or `state: dismissed` (Phase 49/M4.2 scope; audit_version: 1 enum is `["open"]` only)
  - MUST NOT emit cross-domain findings (Phase 48/M4.1 CROSS-DOMAIN.md scope)
  - MUST NOT emit aggregate summary rollup (Phase 48 scope)
  - MUST NOT re-invoke Phase 43 detector (orchestrator Step 2 exclusive)
  - MUST NOT modify vendored Impeccable source (R5)
- Output contract: exactly one fenced YAML block with `findings:` array. No prose.
- Finding count ceiling: 15 + optional `review-saturation` marker

### A5. `BACKEND-AUDIT.md` output contract — GREEN-CONDITIONAL (Codex C2 absorbed)

- Location: `.planning/domains/backend/BACKEND-AUDIT.md` (same dir as Phase 44 BACKEND-CONTEXT.md)
- Top-of-file marker: `<!-- audit_version: 1 -->` (BS1-style mirror)
- 4 fixed section order: `## API findings` / `## Data findings` / `## Event findings` / `## Ops findings` (NOT alphabetical — surface dependency order)
- **Write strategy: section-level replace per invocation** (Codex C2 wording):
  - If `BACKEND-AUDIT.md` exists, rewrite only the target surface section and preserve the other surface sections byte-for-byte where possible
  - If absent, create the file with all four section headers and populate the target section only
  - Other 3 sections carry skeleton placeholder `_Run /sunco:backend-review --surface <s> to populate._`
- Per-section metadata: `<!-- surface_source: {"surface", "spec", "spec_sha", "detector_version", "generated_at"} -->` (Phase 49 staleness detection basis)
- Per finding: YAML block conforming to `finding.schema.json` (`rule/severity/kind/file/line/column?/match?/fix_hint?/source?/state`)
- Aggregate summary (cross-surface tallies "HIGH: N") **NOT emitted** — Phase 48 cross-domain scope
- **Not committed inside Phase 47** — runtime consumer artifact, generated at user's first `/sunco:backend-review` invocation

### A6. Finding labels: severity × state boundary — GREEN-CONDITIONAL (Codex C4 absorbed)

- **3 kinds** (spec §7 verbatim):
  - `deterministic` — Phase 43 detector output only (Step 2 exclusive producer; agent forbidden)
  - `heuristic` — LLM review + partial static evidence
  - `requires-human-confirmation` — LLM only, no static evidence
- **3 severities**: HIGH / MEDIUM / LOW (R6 vocabulary). FAIL/WARN/PASS forbidden.
- **state enum**: `["open"]` single-value at `audit_version: 1` (Option a — strict)
  - Phase 49/M4.2 path: `audit_version: 2` bump + enum expansion to `["open", "resolved", "dismissed"]` + transition semantics in verify gate
  - Option b (loose `default: "open"` with no enum) rejected — silent drift risk
- **Codex C4 — Negative-grep scope limit** (smoke assertion):
  - Smoke check name: `"no resolved/dismissed active state enum"` (not bare grep)
  - **Allowed contexts** (won't trigger): workflow/agent hard-guard prose ("MUST NOT emit resolved/dismissed"), escalate trigger descriptions, comments documenting Phase 49 scope
  - **Forbidden contexts** (will trigger): `state:` YAML field value used as active enum, JSON schema `enum:` array including `resolved` or `dismissed`, BACKEND-AUDIT.md finding output template with those state values
  - Implementation: grep patterns `state:\s*(resolved|dismissed)` (YAML value) AND `"enum":\s*\[[^\]]*"(resolved|dismissed)"` (schema enum). Guards that mention the words in prose-context are not matched.

### A7. SLO dual-source boundary re-affirmation — GREEN

- Phase 46 carry: BACKEND-CONTEXT `## SLO` = source of truth, OPS-SPEC `slo` = structural projection
- Phase 47 ops-review adds **active drift check** via reviewer agent:
  - Agent prompt (backend-review-ops.md Step 3) mandates the check
  - If discrepancy: emit `kind: heuristic`, `rule: slo-projection-drift`, `severity: MEDIUM`, `source: spec-projection`
  - Agent hard guard: MUST NOT overwrite either file
- Smoke Section 22 check: `backend-review-ops.md` grep for `BACKEND-CONTEXT.md` path + `OPS-SPEC` + "projection" + "source of truth" (all 4 strings present)

### A8. Smoke Section 22 + retirement patterns — GREEN-CONDITIONAL (Codex C3 absorbed)

**Section 22 checks (~30, Phase 47 contract)**:

1-4. 4 workflows populated (>200 lines)
5-8. Each has Step 1-5 headers
9-12. Each Step 1 references correct SPEC.md filename + `Run /sunco:backend-phase` guide
13. `backend-review-api.md` has all 4 api rule names
14. `backend-review-data.md` has `non-reversible-migration`
15. `backend-review-event.md` has detector SKIP marker + "pure review" or "no deterministic rules v1"
16. `backend-review-ops.md` has 3 ops rule names
17. All 4 workflows spawn `sunco-backend-reviewer` (agent reference grep)
18. All 4 workflows write `.planning/domains/backend/BACKEND-AUDIT.md` (path grep)
19-20. `sunco-backend-reviewer.md` exists + 4-surface routing table (api/data/event/ops rows)
21. Agent hard-guard strings present (MUST NOT emit deterministic / write SPEC / write BACKEND-CONTEXT / write BACKEND-AUDIT / emit cross-domain / re-invoke detector)
22. Agent 30k budget + 2-stage markers (Stage 1 / Stage 2)
23. `kind` 3-enum references present (deterministic/heuristic/requires-human-confirmation)
24. `severity` R6 (HIGH/MEDIUM/LOW) present; no bare FAIL/WARN/PASS grep matches (negative check — permits prose R6-vs-FAIL comparisons via scope limit)
25. **No resolved/dismissed as active state enum** (Codex C4 scoped): `state:\s*(resolved|dismissed)` YAML pattern + schema `enum` including those values
26. `finding.schema.json` exists + `state` enum = `["open"]` single-value + `kind` enum = 3-value + `severity` enum = 3-value
27. BACKEND-AUDIT.md path + `<!-- audit_version: 1 -->` marker template + 4 surface section headers referenced in workflow templates
28. ops workflow SLO dual-source language (BACKEND-CONTEXT + OPS-SPEC + "projection" + "source of truth" all grep)
29. FRONTEND marker SHA-256 `0b723b2b...06ee` (R3, propagates)
30. Router files SHA-256 byte-identical (Phase 37 backend-phase.md + backend-review.md, propagates)
31. Phase 43 detector source content-marker unchanged (grep for 7 rule names + RULES_ENABLED array + `DETECTOR_VERSION = '1.0.0'`; NO file hash)
32. Phase 42 reference docs content-marker unchanged (grep for 8 known anti-pattern names across ref/* files; NO file hash)
33. Phase 45/46 producer files content-marker unchanged (6-step markers + SPEC path in workflows; required-field grep in schemas — Phase 46 21j/21i/21h pattern mirror; NO file hash)
34. Vendored Impeccable pristine (existing Section 13/14 coverage; no new assertion here)
35. Phase 47 CONTEXT populated

**Codex C3 — broad-freeze wording completion**:
- Hash-lock scope unchanged: 3-file M2 adjacency + FRONTEND marker + Phase 37 routers only
- Phase 45/46 backend files verified via **content-marker grep**, not hash
- Phase 43/42 frozen surfaces verified via content-marker grep, not hash
- Vendored Impeccable pristine via existing Section 13/14 coverage (no new assertion)
- "모든 backend files hash lock" phrasing retired

**Retirement**:
- Section 19 `SURFACE_STUB_FILES`: 4 review surfaces → 0 (all populated). Variable removed (not kept with empty list — clean retirement, no more stub surfaces in Phase 42-47 cycle).
- Section 19 sub-check `remaining ${N} stubs ≤ 200 lines` → removed
- Section 12 `backend-review-<surface> stub references Phase 47` → retired (surfaces populated; substantive-content assertions move to Section 22)

**Target smoke count**: 377 (Phase 46) − 6 (Section 19 SURFACE_STUB_FILES 4+2=6 related checks) − 4 (Section 12 review-stub-references-Phase-47) + ~35 (Section 22) ≈ **~402**.

### A9. Frozen invariants + BS2 evaluation — GREEN

**Frozen (unchanged by Phase 47)**:
- Phase 42 reference/*.md + vendored Impeccable source (R5)
- Phase 43 detect-backend-smells.mjs 7-rule set + internal impl (§13)
- Phase 44 BACKEND-CONTEXT.md schema + discuss-phase.md FRONTEND/BACKEND markers (SHA `0b723b2b...06ee`)
- Phase 45 api/data workflows + schemas
- Phase 46 event/ops workflows + schemas + sunco-backend-researcher agent
- M2 wrapper — 실질 편집 금지
- Phase 37 backend router (backend-phase.md + backend-review.md) SHA-256
- install.cjs / Phase 37 R3 marker tag lines
- PIL 999.1 backlog

**BS2 (runtime token logging) — formally deferred to M4+**:
- BS2 was Phase 43 registered plan debt for detector perf capture. Phase 47 is first LLM agent invocation surface (reviewer agent spawn) — natural re-evaluation point.
- Deferred rationale: (i) Phase 47 core delivery (4 workflows + agent + schema + smoke + retirement) already broad; BS2 additional scope = creep. (ii) Token accounting belongs at agent-framework level (Vercel AI SDK instrumentation), not workflow layer. (iii) M4 cross-domain naturally pairs with audit aggregate observability.
- **Phase 47 close condition NOT gated on BS2** — explicit defer decision (Codex absorbed).

**Plan debt tracker post-Phase-47**:
1. BS2 runtime token logging — **deferred to M4+** (this CONTEXT A9 decision)
2. Phase 40 `ui-spec.schema.json` BS1 version field — **target: after Phase 47 push, before Phase 48 Gate entry** (plan-verifier timing flag). Separate dedicated commit. Not Phase 47 scope (trigger #17 inline backfill forbidden).
3. Phase 42 README api-row sync — CLOSED 2026-04-19 (`638c16e`)
4. Smoke Section 20l CI strict-mode restore — still open; touch when next CI config change lands

## Escalate triggers (halt + re-relay if any fires)

1. Phase 49 lifecycle state transition (`resolved` / `dismissed`) logic landed inside Phase 47
2. Phase 48 cross-domain scope (CROSS-DOMAIN.md / cross-surface aggregate / cross-domain findings) landed inside Phase 47
3. BACKEND-AUDIT.md surface-aggregate summary (cross-surface tallies) emitted
4. Phase 43 detector source edit (internal rule add/change, `--rules` flag add, output schema change)
5. Phase 45/46 `backend-phase-*.md` / `{api,data,event,ops}-spec.schema.json` / `sunco-backend-researcher.md` substantive edit
6. Phase 44 BACKEND-CONTEXT.md schema or auto-detect behavior change
7. `discuss-phase.md` FRONTEND/BACKEND marker block SHA-256 `0b723b2b...06ee` broken
8. Phase 42 `backend-excellence/reference/*.md` substantive edit (Phase 43 Escalate #5 carry)
9. Phase 42 README review-surface row substantive edit without Gate re-justification
10. M2 adjacency-risk 3-file hash broken (Phase 45 lock, Phase 46 carry)
11. M2 wrapper substantive edit or `--test` count regression
12. Vendored Impeccable source mutation (R5 hard)
13. install.cjs / Phase 37 dispatcher / R3 marker tag lines edit
14. Phase 37 backend router SHA-256 change (backend-phase.md / backend-review.md)
15. PIL 999.1 backlog pull-in
16. Commit amend attempt (always NEW commit)
17. Phase 40 ui-spec.schema.json BS1 version retrofit inside Phase 47 atomic commit (separate post-Phase-47 commit only)
18. `git diff --stat HEAD~1` or history-dependent CI assertion re-introduction (Gate 46 #19 carry)
19. 2-agent split for reviewer (spec §7 singular violation)
20. Backend detector adapter file authoring (YAGNI)
21. ajv validator activation inside Phase 47 (Phase 48+ plumbing)
22. Reviewer agent emits `kind: deterministic` (Step 2 detector exclusive)
23. Reviewer agent writes `<SURFACE>-SPEC.md` / `BACKEND-CONTEXT.md` / `BACKEND-AUDIT.md` directly
24. `state` enum schema leaves `["open"]` single-value at audit_version: 1 (Phase 49 boundary leak)
25. **SDI-2 3rd occurrence** (PIL 999.1 hard promote trigger — counter=2 entering Phase 47)
26. BS2 closed inside Phase 47 (A9 deferral reversed)
27. `GATE-47-REQUEST-v1.md` staged/committed (Codex C1 — relay-only scratch, untracked throughout phase)
28. `BACKEND-AUDIT.md` committed inside Phase 47 (runtime consumer artifact; generated at user runtime)

## Rollback anchor

Pre-Phase-47 HEAD: `3370bd7` (Phase 46/M3.5 main). Rollback via `git revert` (new commit), not force-push.

Pre-Phase-46 HEAD: `638c16e` (Phase 45 docs api-row sync). Phase 46 rollback boundary.

`rollback/pre-v1.3-decision` tag remains.

## SDI-2 counter (external signal → additive fix pattern)

Counter at Phase 47 entry: **2** (Phase 44 `67a23f1`+`de4c2b1` pre-push post-judge, Phase 45 `9a52c53`+`e424a23` post-push post-CI-fail). Phase 46 `638c16e`+`3370bd7` was NOT SDI-2 (clean pre-delivery scope separation; Codex Gate 46 condition 3 convergent with plan-verifier).

**3rd occurrence = hard PIL 999.1 promote** (plan-verifier Gate 46 explicit absorb; Gate 47 trigger #25).

## Judge relay summary (Focused+ Gate 47, 2026-04-19)

Two independent judges returned GREEN-CONDITIONAL with 4 Codex absorb conditions + plan-verifier 3 confirmed-present trigger recommendations.

**Codex 4 conditions absorbed**:

1. **C1 — `GATE-47-REQUEST-v1.md` gate-artifact status**: relay-only scratch, untracked throughout Phase 47. 47-CONTEXT.md absorbs decisions. Not committed inside Phase 47 (escalate trigger #27 added).
2. **C2 — A5 write strategy wording**: "overwrite-per-invocation" → "**section-level replace per invocation**". Wording shift: rewrite only target surface section, preserve other 3 surface sections byte-for-byte where possible; 4-section skeleton when file absent. Workflow Step 5 + agent spec + CONTEXT A5 all aligned on new wording.
3. **C3 — A8 smoke broad-freeze completion**: "모든 backend files hash lock" phrasing retired. Hash-lock scope limited to 3-file M2 adjacency + FRONTEND marker + Phase 37 routers. Phase 42/43/45/46 frozen surfaces verified via **content-marker grep**, not file hash. Vendored Impeccable covered by existing Section 13/14.
4. **C4 — A6 resolved/dismissed negative grep scope**: limited to active-context patterns (`state:` YAML value + schema `enum:` array), NOT bare word grep. Guard prose context (e.g., "MUST NOT emit resolved/dismissed") allowed. Smoke assertion name: "no resolved/dismissed **active state enum**".

**Plan-verifier 3 trigger recommendations — already present in v1**:
- (i) Reviewer agent BACKEND-CONTEXT.md write guard → trigger #23 (covers SPEC + CONTEXT + AUDIT writes)
- (ii) Finding state ≠ open → trigger #24
- (iii) CROSS-DOMAIN.md generation → trigger #2

**3 pre-approval decisions** (user confirmed):
- BACKEND-AUDIT.md write = **section-level replace per invocation** (C2 refined wording, semantic identical to v1 intent)
- state enum = `["open"]` single-value strict (Phase 49 audit_version: 2 bump expansion path)
- BS2 = formally defer to M4+ (NOT Phase 47 close condition)

Focused+ Gate 47 → GREEN (post-conditions absorbed). Execution authorized (user approval relayed 2026-04-19, including pre-push approval for atomic commit).

## Post-Phase-47 schedule

1. Phase 47 atomic commit (this scope)
2. Phase 47 push (user pre-approved)
3. **Phase 40 `ui-spec.schema.json` BS1 version backfill** — separate dedicated commit closing M3 plan debt before M4 entry (plan-verifier timing flag)
4. Push Phase 40 backfill
5. Phase 48 Gate entry (M4 cross-domain begin)

---

*Phase 47/M3.6 Focused+ Gate 47 GREEN convergent (plan-verifier + Codex backend-review, 2026-04-19). Populated by implementer (구현 Claude, Opus 4.7 1M-context). Spec source: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.6.*
