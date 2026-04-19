# Phase 49 — verify gate cross domain + finding lifecycle

- **Spec alias**: v1.4/M4.2
- **Milestone**: M4 Cross-Domain Integration
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` (§8 Phase 4.2)
- **Requirement**: IF-15 (see `.planning/REQUIREMENTS.md` § v1.4)
- **Status**: **Populated** (2026-04-19) — Full Gate 49 GREEN-CONDITIONAL / GREEN convergent, 8 conditions absorbed, implementation in progress.

---

## Gate 49 — Full Gate 4 (two-judge convergent relay)

Phase 49 joined the **mandatory-full-gate** list alongside Phase 36/38/48. Novel risk surface: breaking schema change (audit_version 1→2), conditional-required JSON Schema discipline (lifecycle fields), finding state machine, 4 deterministic cross-domain checks, cross-phase proceed-gate severity policy, `required_specs` enforcement role transition. Two judges: plan-verifier outgoing-Claude + Codex cross-domain.

### Relay v1 verdict

| Judge | Verdict | Notes |
|---|---|---|
| plan-verifier (outgoing Claude) | 8 GREEN + 1 GREEN-CONDITIONAL (G7) | G7 conditional on charter citation + extension slot + Phase 50 amendment path + smoke negative check (4 sub-conditions all absorbed). |
| Codex (cross-domain) | GREEN-CONDITIONAL × multi-axis (G1/G2/G4/G5/G6/G7/G8) | 5 merged conditions + 3 co-convergent with plan-verifier G7. No RED. |

Convergent verdict: **GO**. Absorbed per Phase 47 `19ed2a4` / Phase 48 `1a508ba` precedent (no v2 re-relay). Execution order fixed: memory update → install preflight (read-only) → 49-CONTEXT.md populate → implementation → verify-lite → atomic commit → push approval wait.

### Conditions absorbed (8 merged — Claude ∪ Codex)

| ID | Axis | Absorption |
|---|---|---|
| **A1** | G1/G2 | `finding.schema.json`: state enum = `["open", "resolved", "dismissed-with-rationale"]` (축약 금지 — full literal `dismissed-with-rationale`); `oneOf` with 3 lifecycle branches + 4th branch enforcing `if state = dismissed-with-rationale then severity != HIGH` (HIGH dismissal schema-level hard-block); `resolved_commit` pattern `^[0-9a-f]{7,40}$` (short+full SHA); `dismissed_rationale` `minLength: 50`; `audit_version` remains top-of-file marker only (NOT a schema property — BACKEND-AUDIT.md precedent + cross_domain_version:1 BS1 parity). |
| **A2** | G3 | Path normalization **forbidden**. Endpoints are keyed by raw `method + path` tuples (as declared in UI-SPEC.md + API-SPEC.md) — Phase 48 projection parity. Templated parameter normalization (`/users/:id` vs `/users/{id}`) is NOT performed; diverging styles across UI/API surface as `missing-endpoint` or `orphan-endpoint` findings by design. |
| **A3** | G4 | Cross-domain layer triggers when: `domains: [frontend, backend]` declared in `${PHASE}-CONTEXT.md` frontmatter/body **OR** `required_specs` explicitly lists both frontend UI-SPEC + backend API-SPEC paths. Single-domain phases (`domains: [backend]` only or `domains: [frontend]` only) **skip** cross-domain layer (no layer invocation, no findings emitted, no generation). Non-cross-domain phases retain existing verify-phase 7-layer behavior unchanged. |
| **A4** | G5 | **Option (X) Extension — NOT new workflow file.** Install preflight discovered `packages/cli/commands/sunco/proceed-gate.md` already exists as inline-pattern slash command (195 lines, 8-step inline `<process>`, no workflow delegate). Phase 49 extends this file in-place to add: CROSS-DOMAIN-FINDINGS.md consumption (in addition to existing VERIFICATION.md), HIGH/MED/LOW severity policy matrix, `--allow-low-open` flag, lifecycle-state-aware verdict. `workflows/proceed-gate.md` **NOT created**. `ship.md` Step 1 wording corrected to "existing ship verification behavior preserved for non-cross-domain phases" (NOT "proceed-gate behavior unchanged"). |
| **A5** | G6 | Lifecycle override region is **YAML block, NOT markdown table** (Codex rejection of v1 markdown-table proposal — parser edge cases around pipes, multi-line rationale, escaping). 3-region CROSS-DOMAIN-FINDINGS.md structure: (1) `<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-START/END -->` YAML block — auto-generated findings, overwrite-on-regeneration, deterministic ordering (rule asc, file asc, line asc); (2) `<!-- SUNCO:CROSS-DOMAIN-LIFECYCLE-START/END -->` YAML block — human-edited `overrides[]` list, preserve-on-regeneration, id-join key = `rule:file:line`; (3) hand-authored prose below `LIFECYCLE-END`, preserve byte-for-byte. Top marker `<!-- findings_version: 1 -->` (BS1 parity). |
| **A6** | G7 | Option (a) deterministic-only confirmed. `sunco-cross-domain-checker` agent **NOT created** in Phase 49. 4 sub-conditions all absorbed: (i) charter citation below; (ii) future heuristic extension slot documented below; (iii) Phase 50/M5.1 spec §8 L685 amendment registered as plan debt; (iv) smoke Section 24 includes negative grep "no `sunco-cross-domain-*` agent file in `packages/cli/agents/`". |
| **A7** | G8-D | YAML **direct dependency** added to `packages/cli/package.json` (move from transitive in `package-lock.json` to explicit direct dep). `package-lock.json` updated. Smoke Section 24 asserts dependency presence in `package.json`. Phase 48 carry debt (yaml packaging) **CLOSES on Phase 49 commit**. |
| **A8** | G9 | `/sunco:proceed-gate` command extension (not creation — A4 correction). `/sunco:cross-domain-check` **NOT created** — surface inflation blocked; cross-domain layer accessed via existing `/sunco:verify` entry. Frontmatter description updated to reflect cross-domain + severity policy + flag (user-discoverable capability). `install.cjs` **NOT modified** — gate command descriptions are frontmatter-based, not in install.cjs description table (fresh evidence: `artifact-gate`/`dogfood-gate`/`plan-gate`/`proceed-gate` all absent from install.cjs description map). |

---

## Premise correction trail (install preflight discovery)

**Gate 49 v1 A4 initial premise:** "NEW `workflows/proceed-gate.md` + NEW `/sunco:proceed-gate` slash command."

**Fresh evidence (install preflight, 2026-04-19):**
- `packages/cli/commands/sunco/proceed-gate.md` already exists (195 lines, registered as `/sunco:proceed-gate`).
- Pattern: **inline** (8-step `<process>` block directly in command file), NOT delegate-to-workflow (unlike `verify.md` → `workflows/verify-phase.md`).
- Existing functionality: VERIFICATION.md-based general gate (findings-first, root-fix evidence, mitigation/suppression acknowledgment). Cross-domain awareness absent. `--allow-low-open` flag absent. HIGH/MED/LOW policy absent.
- `install.cjs` description map does NOT enumerate gate commands (artifact-gate / dogfood-gate / plan-gate / proceed-gate absent).

**Correction rationale:** Evidence > authority. Gate 49 A4 *intent* was "proceed-gate with cross-domain awareness + severity policy + `--allow-low-open` flag." *Premise* "file creation needed" was factually wrong. Option (X) inline extension delivers A4 intent with 1-file change; Option (Y) delegate-refactor would be 2-file change purely for pattern consistency — violates Phase 48 C2/C7 minimal-surface-change precedent. Two judges convergent on Option (X).

**Commit shape adjusted:** 9 logical buckets (8 files + `package-lock.json` paired with `package.json`).

---

## Axis disposition (9 axes)

| Axis | v1 proposal | Final disposition |
|---|---|---|
| **G1 audit_version 1→2** | Top-of-file marker; state enum unconditional 3-value expansion | GREEN — A1 absorbed. No schema-level `audit_version` property; writer discipline (Phase 47 agent hard-guard preserves audit_version:1 emit; Phase 49 verify-gate is sole audit_version:2 writer, writes only CROSS-DOMAIN-FINDINGS.md). |
| **G2 lifecycle rules** | oneOf 3 branches; HIGH dismissal schema-block; regex/minLength | GREEN — A1 absorbed. oneOf + HIGH-dismissal-block 4th branch + `resolved_commit` `^[0-9a-f]{7,40}$` + `dismissed_rationale` `minLength: 50`. state enum literals preserved verbatim (no `dismissed` shorthand). |
| **G3 4 check types** | missing-endpoint HIGH, type-drift HIGH, error-state-mismatch MED, orphan-endpoint LOW; deterministic set-algebra | GREEN — A2 absorbed: raw method+path set-key, no normalization. `kind: deterministic` for all 4 checks. file_ref: `missing-endpoint`/`type-drift`/`error-state-mismatch` → UI-SPEC.md; `orphan-endpoint` → API-SPEC.md. line: 0 (SPEC-level, not line-local). |
| **G4 required_specs transition** | Phase 48 hard-stop → Phase 49 soft-emit finding; `domains` field support | GREEN — A3 absorbed. Layer trigger requires BOTH frontend+backend signal (via `domains` or explicit `required_specs` pair). Single-domain phases skip. `spec-not-produced` rule: HIGH + deterministic, emitted only when declared `required_specs` is missing at verify time. |
| **G5 proceed-gate integration** | NEW workflow file + /sunco:proceed-gate; HIGH/MED/LOW matrix; --allow-low-open flag | GREEN — A4 absorbed via premise correction. Option (X): extend existing `commands/sunco/proceed-gate.md` inline. HIGH+open → HARD BLOCK, MED+open → BLOCK dismissible with ≥50-char rationale, LOW+open → BLOCK default + `--allow-low-open` override, all resolved/dismissed-with-rationale → PASS. Fallback: CROSS-DOMAIN-FINDINGS.md absent → existing VERIFICATION.md-only behavior (non-regression). ship.md Step 1 wording fix. |
| **G6 CROSS-DOMAIN-FINDINGS.md contract** | 3-region structure; markdown-table lifecycle (v1) | GREEN — A5 absorbed via Codex override: **YAML block lifecycle** (not markdown table). findings auto-gen / lifecycle overrides YAML / prose preserve. id-join `rule:file:line`. Deterministic ordering. Top marker `<!-- findings_version: 1 -->`. |
| **G7 deterministic vs LLM** | Option (a) deterministic-only | GREEN — A6 absorbed. Charter citation + extension slot + Phase 50 amendment debt + smoke negative check all inline below. `sunco-cross-domain-checker.md` agent file NOT created. |
| **G8 smoke + frozen + YAML debt** | Section 24 ~30 checks; YAML direct dep | GREEN — A7 absorbed. yaml direct dep in package.json + package-lock + smoke dep-present assertion. Section 24 asserts A1-A8 full grep + negative A6-iv. YAML packaging debt CLOSES on Phase 49 commit. |
| **G9 public surface** | /sunco:proceed-gate only; no /sunco:cross-domain-check | GREEN — A8 absorbed via premise correction. proceed-gate command extension (not creation). frontmatter description update. `/sunco:cross-domain-check` NOT created. `install.cjs` NOT modified. |

---

## Charter citation (A6-i) — deterministic-first prevails over spec §8 L685

Spec §8 line 685 reads: *"Spawn sunco-cross-domain-checker agent"* as Phase 4.2 Step 2 of the verify-gate cross-domain layer. Phase 49 implements this step **without spawning any agent**, using deterministic set-algebra + boolean scan + string-empty scan on the Phase 48 CROSS-DOMAIN.md projection output.

**Authority stack (descending priority):**

1. **`.claude/rules/architecture.md`** — "Deterministic First — 린터/테스트로 강제할 수 있는 건 LLM 사용 안 함."
2. **`packages/cli/references/product-contract.md`** — single source of truth on verify layers + runtime paths.
3. **Phase 48 precedent (`1a508ba`)** — `ajv` schema validator explicitly deferred past Phase 48 (spec §8 Phase 4.1 mentioned ajv but deterministic structural required-field check was adopted instead per C2). Phase 49 extends this precedent: spec mention of an agent ≠ mandate to spawn when deterministic replacement exists.
4. Spec document §8 L685 — literal wording, overruled by (1)–(3) for this axis.

**Consequence for implementation:** `packages/cli/references/cross-domain/src/extract-spec-block.mjs` gains the 4 check-type logic (`generateCrossDomainFindings` export). `workflows/verify-phase.md` invokes it inline. No agent spawn, no AI SDK import, no HTTP out — smoke Section 24 asserts these negatives structurally.

---

## Future heuristic extension slot (A6-ii)

Phase 49 v1 = **deterministic-only**. Four checks (missing-endpoint / type-drift / orphan-endpoint / error-state-mismatch) are set-algebra + boolean + string-empty — no judgment required. All findings carry `kind: deterministic`.

**Heuristic checks NOT implemented in Phase 49:**
- Type aliasing (e.g., `UUID` type alias for `string`)
- Nullability reasoning (e.g., `string | null` vs `string`)
- Union type comparison (e.g., `"pending" | "active"` vs `string`)
- Semantic endpoint role mismatch (e.g., `GET /users` list vs `GET /user/{id}` detail — UI declares consume but path pattern differs)
- Error code semantic drift (e.g., API `AUTH_EXPIRED` vs UI `session-timeout` — string match fails but semantically aligned)

**Extension path (when heuristic need lands — M5 dogfood phase, v2, or later):**
1. Create `packages/cli/agents/sunco-cross-domain-checker.md` with `kind: heuristic` output contract.
2. Extend `verify-phase.md` cross-domain layer with `Step 3: Spawn sunco-cross-domain-checker agent` (post-deterministic findings).
3. Extend `finding.schema.json` NOT required — existing `kind` enum already supports `heuristic` + `requires-human-confirmation`.
4. Cross-domain rule slugs for heuristic checks: reviewer-authored (e.g., `type-alias-unresolved`, `nullability-mismatch`, `union-narrowing`).

Phase 49 v1 does not open any of these surfaces; slot documented for future upgrade.

---

## Plan debt tracker — Phase 49 entry state

| Debt | Source | Status at Phase 49 entry | Phase 49 disposition |
|---|---|---|---|
| yaml packaging (transitive-only in package-lock) | Phase 48 C2 + post-push Codex | Carry | **CLOSING** on Phase 49 commit (A7 direct dep added + smoke dep-present assertion) |
| BS2 runtime token logging | Phase 36 | Carry (no LLM use in M4) | Carry continues — Phase 49 is deterministic-only (G7 option a), no LLM invocation for cross-domain layer |
| Smoke Section 20l CI strict-mode restore | Phase 43 | Carry (CI config untouched) | Carry continues — Phase 49 does not modify CI config |
| **NEW: Spec §8 L685 agent wording amendment** | Phase 49 A6-iii | — | Register for Phase 50/M5.1 docs phase — update spec to note deterministic-only implementation + document heuristic extension slot. Charter drift trail established. |

---

## Phase 48 ↔ Phase 49 role transition (A3)

CROSS-DOMAIN.md generation is **shared** between Phase 48 (generator) and Phase 49 (verify-gate consumer/regenerator):

| Concern | Phase 48 (generator) | Phase 49 (verify-gate) |
|---|---|---|
| required_specs missing | Generator **hard-stop** (exit 1, no output) | **Soft-emit** finding `spec-not-produced` HIGH+open |
| CROSS-DOMAIN.md stale (source SPEC SHA drift) | N/A (each invocation regenerates) | Detect via `isCrossDomainStale(crossDomainPath, uiPath, apiPath)`, regenerate inline before checks |
| Lifecycle tokens in CROSS-DOMAIN-BLOCK | RED escalate trigger (C5) — halt + re-relay | N/A (lifecycle lives in CROSS-DOMAIN-**FINDINGS**.md, distinct file) |
| 4 check types emission | Not in scope (Phase 48 projects contracts only) | In scope — emit as findings to CROSS-DOMAIN-FINDINGS.md |
| BACKEND-AUDIT.md writes | Forbidden (count-only projection, C5) | Forbidden — Phase 49 writes CROSS-DOMAIN-FINDINGS.md only |
| `extract-spec-block.mjs` signatures | Owner — frozen after 1a508ba | Extension-only — new exports OK, existing signatures IMMUTABLE |

---

## Invariants / out-of-scope (hard lock)

**Phase 35-48 frozen surfaces:**
- M3 backend-phase/review workflows + agents + schemas (Phase 42-47 content-grep)
- M2 adjacency 3-file hash: `ui-spec.schema.json` = `46c67a60...` (post-BS1-backfill)
- Phase 44 BACKEND-CONTEXT.md schema (Phase 48 C8 lock — Phase 49 may NOT read or write)
- Phase 48 assets: `cross-domain.schema.json` IMMUTABLE; `cross-domain-sync.md` IMMUTABLE; `extract-spec-block.mjs` existing exports IMMUTABLE (extension-only)
- Phase 47 `sunco-backend-reviewer.md` state hard-guard (resolved/dismissed emission FORBIDDEN at audit_version:1) — preserved
- M2 + M3 SPEC producers (ui-phase-web, backend-phase-*) read-only consumers

**Schema mutations:** ONLY `finding.schema.json` may be modified (A1 lifecycle expansion). All other schemas (`ui-spec`, `api-spec`, `data-spec`, `event-spec`, `ops-spec`, `cross-domain`) IMMUTABLE.

**Hard out-of-scope (Phase 49):**
- Phase 50/M5.1 docs selection or migration guide pre-work
- Phase 51/M5.2 dogfood / fixture / CI integration pre-work
- `ajv` introduction (Phase 48 C2 carry)
- `sunco-cross-domain-checker.md` agent file creation (A6-ii future slot; NOT Phase 49)
- Phase 48 asset signature mutation (cross-domain.schema.json / cross-domain-sync.md / extract-spec-block.mjs existing exports)
- Phase 47 sunco-backend-reviewer.md hard-guard weakening
- Phase 44 BACKEND-CONTEXT.md modification
- `workflows/proceed-gate.md` NEW FILE creation (A4 Option X — inline extension only)
- `/sunco:cross-domain-check` slash command creation (A8)
- `install.cjs` modification (A8 — gate descriptions are frontmatter-based)
- `git commit --amend`
- `git diff --stat HEAD~1` or history-dependent CI assertion (Phase 46/47/48 carry)
- PIL 999.1 backlog pull-in

---

## Done-when criteria (spec §8 line 727-731 + Gate 49 convergent)

1. Fixture phase with intentional FE/BE mismatches produces exactly 4 expected findings (one per check type) with correct severity (`missing-endpoint` HIGH, `type-drift` HIGH, `error-state-mismatch` MED, `orphan-endpoint` LOW).
2. Proceed-gate blocks on HIGH+open (HARD BLOCK, no override).
3. Proceed-gate passes on all-findings-dismissed-with-rationale (MED lifecycle path; HIGH dismissal schema-blocked, not reachable at runtime).
4. `--allow-low-open` flag on `/sunco:proceed-gate` permits LOW+open pass-through (HIGH/MED still blocked).
5. Existing ship verification behavior preserved for non-cross-domain phases (single-domain or no-SPEC phases skip cross-domain layer; VERIFICATION.md-only flow unchanged).
6. Cross-domain layer triggered only when `domains: [frontend, backend]` OR both UI-SPEC.md + API-SPEC.md exist.
7. `CROSS-DOMAIN-FINDINGS.md` 3-region structure established (findings auto-gen / lifecycle overrides YAML / prose preserve) with id-join key `rule:file:line`.
8. `finding.schema.json` expanded with state lifecycle + oneOf + HIGH-dismissal-block — Phase 47 open-only emission continues to validate against first oneOf branch.
9. Smoke 492+N/492+N passes (Section 24 adds ~30 checks; Sections 1-23 unchanged); injector 10/10, adapter 22/22, detector 17/17 unchanged; extract-spec-block self-tests expand 22 → 22+N.
10. 49-CONTEXT.md (this file) populated.

---

## Requirements covered

- **IF-15** (see `.planning/REQUIREMENTS.md:294`): Verify gate cross-domain layer with 4 checks + finding-state lifecycle + severity × state policy — delivered by Phase 49 per Gate 49 convergent absorption.

---

*Phase 49/M4.2. Full Gate 49 convergent (plan-verifier outgoing Claude + Codex cross-domain). 8 conditions absorbed (A1-A8), no v2 re-relay — per Phase 47 `19ed2a4` + Phase 48 `1a508ba` precedent. Execution: memory updated → install preflight → CONTEXT populate → schema + module + proceed-gate extension + verify-phase + ship + yaml dep + smoke → verify-lite → atomic commit → push approval.*
