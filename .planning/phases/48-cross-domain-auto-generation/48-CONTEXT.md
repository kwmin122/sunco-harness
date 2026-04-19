# Phase 48 — cross-domain auto generation

- **Spec alias**: v1.4/M4.1
- **Milestone**: M4 Cross-Domain Integration
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` (§8 Phase 4.1)
- **Requirement**: IF-14 (see `.planning/REQUIREMENTS.md` § v1.4)
- **Status**: **Populated** (2026-04-19) — Full Gate 48 GREEN-CONDITIONAL / GREEN convergent, 8 conditions absorbed, implementation committed in Phase 48/M4.1 main.

---

## Gate 48 — Full Gate 3 (two-judge convergent relay)

First M4 phase + first deterministic-no-LLM phase → memory-pre-registered Full Gate 3 (NOT Focused+). Two judges: plan-verifier outgoing-Claude + Codex cross-domain.

### Relay v1 verdict

| Judge | Verdict | Notes |
|---|---|---|
| plan-verifier (outgoing Claude) | GREEN (8/8 axes) | G5 boundary-conditional (lifecycle tokens completely excluded); G8 recommendation: explicit BACKEND-CONTEXT lock. |
| Codex (cross-domain) | GREEN-CONDITIONAL | 3 critical fixes + 5 axis conditions + 1 new YELLOW axis (invocation surface). Convergent-direction on all 8 axes; conditions absorbable without v2 relay (Phase 47 `19ed2a4` precedent). |

### Conditions absorbed (8 total → implementation)

| ID | Source | Axis | Absorption |
|---|---|---|---|
| **C1** | Codex#1 | commit shape | `GATE-48-REQUEST-v1.md` is relay-only scratch; deleted **before** atomic commit. Commit contains NEW + MOD files only — the scratch never enters git history (tracked as untracked-then-removed). No `DEL GATE-48-REQUEST-v1.md` in commit changeset. |
| **C2** | Codex#2 | G2 parser | No new npm dependency. `yaml` dynamically required at runtime matching Phase 45 `backend-phase-api.md:242` precedent; install hint on absence. `ajv` explicitly deferred past Phase 48 (Phase 45 already wrote "deferred to Phase 48+" — Codex says NOT to pull it in here; structural `required`-field check only). Extractor `--test` uses JSON fixtures + `JSON.parse` — runs with zero deps. |
| **C3** | Codex#3 | G1 schema | `generated_from.sha` = SHA-256 of source file bytes (content hash via `node:crypto`), NOT git commit SHA. `generated_from.spec` = full repository-relative path (e.g., `.planning/domains/frontend/UI-SPEC.md`), not basename. Schema pattern: `^[0-9a-f]{64}$`. |
| **C4** | Codex#4 | G4 source-spec | `required_specs` CONTEXT.md declaration → generator **hard-stop** on missing (not read-only as v1 drafted). Default UI+API hard-stop applies only when `required_specs` is absent. Declared list **replaces** default requirement set; unlisted optional specs remain silent-skip. Phase 49 verify-gate is the finding-enforcement layer (missing-spec finding under audit_version:2). |
| **C5** | Plan-verifier G5 | generation boundary | Explicit escalate trigger documented inline: "lifecycle token (`resolved` / `dismissed` / `audit_version: 2`) in generated CROSS-DOMAIN-BLOCK output = RED, halt + re-relay." BACKEND-AUDIT.md is read-only in Phase 48 (count-only projection, no mutation). |
| **C6** | Codex#6 | G7 smoke | Section 23 negative greps target active output only: `cross-domain.schema.json` enum/property definitions + `cross-domain-sync.md` generation template blocks + `extract-spec-block.mjs` source. Gate-document / escalate-trigger / guard prose is **permitted** to name lifecycle tokens for documentation purposes (Phase 47 Section 22p/22q precedent — same scoping). |
| **C7** | Codex#7 | invocation surface (new YELLOW) | **No new slash command in Phase 48.** `cross-domain-sync.md` carries a top-of-file banner: "Internal workflow. No slash command in Phase 48. Invoked by Phase 49 `/sunco:verify` cross-domain gate layer or `/sunco:backend-review` composition." `verify.md` wiring lands in Phase 49/M4.2. |
| **C8** | Plan-verifier G8 | frozen invariants | Phase 44 `.planning/domains/backend/BACKEND-CONTEXT.md` added explicitly to frozen list. `cross-domain-sync.md` neither reads nor writes BACKEND-CONTEXT (explicit inline "MUST NOT read or write" declaration). Smoke Section 23 asserts this via scoped grep. |

---

## 8-axis disposition

| Axis | v1 proposal | Final disposition |
|---|---|---|
| **G1 schema** | 5 required + version const:1 + method enum + minItems:0 per projection array | GREEN — `cross-domain.schema.json` draft-07, 6 required (version + generated_from + endpoints_consumed + endpoints_defined + error_mappings + type_contracts), `additionalProperties: true`, `version: const 1`, method enum = api-spec's 7 methods, `generated_from[].sha` SHA-256 hex pattern (C3), minItems:0 per projection array. |
| **G2 parser module form** | `extract-spec-block.mjs` + `--test` ≥15 | GREEN — module at `packages/cli/references/cross-domain/src/extract-spec-block.mjs`; pure-stdlib (no new npm dep; C2); 22 self-tests pass (0 failed); dynamic `import('yaml')` at runtime matches Phase 45 convention. |
| **G3 output + markers** | `.planning/domains/contracts/CROSS-DOMAIN.md` + START/END pair + `<!-- cross_domain_version: 1 -->` | GREEN — output path fixed by spec §8 line 665 (authoritative); START/END paired markers align with UI/API SPEC-BLOCK precedent; BS1 parity marker matches API-SPEC `<!-- spec_version: 1 -->`. |
| **G4 source-spec requirements** | UI+API required; DATA/EVENT/OPS optional; `required_specs` override | GREEN — C4 absorbed: `required_specs` declared in CONTEXT.md **replaces** the default hard-required set and generator **hard-stops** on missing listed specs. Phase 49 verify-gate is the finding layer. |
| **G5 Phase 47 A5 rollup** | Summary-only open-count-by-severity table; no lifecycle | GREEN — `<!-- SUNCO:OPEN-FINDINGS-SUMMARY-START/END -->` fenced region emits 4-surface × 3-severity count table; BACKEND-AUDIT.md read-only; C5 escalate trigger inline. Phase 47 A5 deferred debt is now **CLOSED** via summary-only scope; lifecycle-aware aggregation remains Phase 49 scope. |
| **G6 no-LLM invariant** | Hard: no subagent, no AI SDK, no HTTP, no cross-domain agent | GREEN — module has no AI SDK imports (smoke-asserted); workflow documents no-LLM/no-subagent invariant; no `sunco-cross-domain-*` agent created; no HTTP surface. |
| **G7 smoke Section 23** | ~25-30 checks; content-marker grep; no `git diff --stat HEAD~1` | GREEN — Section 23 emits 28 checks (23a-23ab); content-marker grep only; C6 absorbed → negative grep scope limited to active output. |
| **G8 frozen invariants** | All Phase 35-47 outputs read-only; finding.schema unchanged | GREEN — C8 absorbed: Phase 44 BACKEND-CONTEXT.md added to frozen list; finding.schema state enum `["open"]` + `audit_version: 1` untouched; no agent creation; all M2/M3 SPEC producers read-only consumers. |
| **+1 invocation surface** (new YELLOW from Codex) | — | RESOLVED (C7) — internal workflow only, no slash command in Phase 48, Phase 49 verify wiring planned. |

---

## Plan-debt carry-forward

| ID | Status after Phase 48 |
|---|---|
| Phase 47 A5 deferred aggregate rollup | **CLOSED** — summary-only open-count rollup opened in Phase 48 per G5 convergent decision. Phase 49 expands to lifecycle-aware aggregation when `audit_version: 2` bumps. |
| BS2 runtime token logging | Carry — deferred M4+ (Phase 47 A9). Phase 48 is no-LLM scope; re-evaluate at Phase 49 LLM verify-gate. |
| Smoke Section 20l CI strict-mode restore | Carry — pending next CI config touch. Phase 48 touches no CI files. |
| BS1 ui-spec.schema.json backfill | CLOSED `bb8f110` (carry off; trigger active — no re-edit). |
| Phase 42 README api-row sync | CLOSED `638c16e` (carry off). |

---

## SDI-2 status

Counter = 2 at Phase 48 entry. Phase 48 ships a single atomic commit — no pre-planned 2-commit scope-separation. Any post-commit external-signal reactive additive fix increments to 3 → hard PIL 999.1 promote per plan-verifier Gate 46 rule. Phase 48 counter carry: **2** (unchanged at commit time).

---

## Out-of-scope for Phase 48 (hard)

- Phase 49 finding lifecycle enforcement (any `resolved`/`dismissed` active enum value, state transition logic, verify-gate cross-domain layer 4 checks, dismissal rationale validation, `--allow-low-open` flag).
- `finding.schema.json` state enum expansion or `audit_version: 2` bump.
- LLM invocation / subagent spawn / AI SDK import anywhere in Phase 48 artifacts.
- `sunco-cross-domain-*` agent creation (Phase 49 may introduce when finding-lifecycle layer wires).
- BACKEND-AUDIT.md / UI-REVIEW.md / IMPECCABLE-AUDIT.md write (read-only consumers; summary-only BACKEND-AUDIT count projection permitted per G5).
- UI-SPEC.md / API-SPEC.md / DATA-SPEC.md / EVENT-SPEC.md / OPS-SPEC.md modification (read-only sources-of-truth).
- Phase 44 BACKEND-CONTEXT.md read or write (C8 explicit lock).
- Phase 40 `ui-spec.schema.json` re-edit (BS1 backfill CLOSED `bb8f110`; trigger active).
- Phase 37 R3 marker tag lines / dispatcher SHA / install.cjs modification.
- M2 adjacency 3-file hash break (`ui-spec.schema = 46c67a60...` post-backfill baseline; researcher-web + ui-phase-web original SHAs).
- Phase 42 reference/*.md substantive edit (Escalate #5 carry); Phase 43 detector §13 7-rule lock; vendored Impeccable R5.
- `git commit --amend` (always NEW commit).
- `git diff --stat HEAD~1` or any history-dependent CI assertion (Gate 46 escalate #19 + Gate 47 C3 carry).
- New slash command / public surface (C7 — Phase 49 wires).
- New npm dependency (C2 — `yaml` dynamic-require matches Phase 45 precedent, no static import).
- `ajv` wire-up in Phase 48 (C2 — Phase 45 line 271 already declared "deferred to Phase 48+"; Codex said NOT in Phase 48).

---

## Files delivered (Phase 48 commit)

| File | Status | Purpose |
|---|---|---|
| `packages/cli/schemas/cross-domain.schema.json` | NEW | G1 schema — 6 required fields, draft-07, BS1 version const:1, SHA-256 pattern for `generated_from.sha`. |
| `packages/cli/workflows/cross-domain-sync.md` | NEW | Internal workflow (C7, no slash command) — 7-step deterministic pipeline; G4 source-spec policy with required_specs override; G5 summary-only rollup; G6 hard invariants; C5 escalate trigger. |
| `packages/cli/references/cross-domain/src/extract-spec-block.mjs` | NEW | Pure-stdlib module — SPEC-BLOCK extractor (marker + fence detection), SHA-256 source-byte hashing (C3), cross-domain projection, markdown rendering with hand-authored prologue preservation, summary-only BACKEND-AUDIT rollup helper, 22-check `--test` self-run. |
| `packages/cli/bin/smoke-test.cjs` | MOD | Section 23 added (28 checks: G1-G8 axes + 2 new YELLOW axis coverage + boundary assertions). |
| `.planning/phases/48-cross-domain-auto-generation/48-CONTEXT.md` | MOD | Populated from scaffold with Gate 48 outcomes + 8-condition absorption table + frozen list. |

---

## Next phase entry (Phase 49/M4.2)

Phase 49 introduces:
- `audit_version: 2` bump on `finding.schema.json` — state enum expands to `["open", "resolved", "dismissed-with-rationale"]`.
- Verify-gate cross-domain layer in `workflows/verify.md` with 4 findings (missing-endpoint HIGH, type-drift HIGH, error-state-mismatch MEDIUM, orphan-endpoint LOW).
- Finding-lifecycle transition logic + proceed-gate policy (HIGH hard-block, MEDIUM block-with-rationale-dismiss, LOW configurable).
- Phase YAML `required_specs` field **enforcement** (Phase 48 generates against declaration; Phase 49 enforces at verify).
- `sunco-cross-domain-checker` agent (if needed) — first permitted cross-domain agent.
- New public slash command surface (verify wiring).

Phase 49 is a **Focused+ gate** candidate (lifecycle introduces new risk surface but shares Phase 48's deterministic extraction baseline).

---

*Phase 48/M4.1 populated 2026-04-19 from Gate 48 outcomes. Convergent two-judge ratification; 8 conditions absorbed per Phase 47 `19ed2a4` precedent. `GATE-48-REQUEST-v1.md` relay scratch was deleted pre-commit per C1 absorption — the commit changeset contains only NEW and MOD files.*
