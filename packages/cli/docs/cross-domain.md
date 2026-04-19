# Cross-Domain Integration (v1.4 M4)

Phase 48 + Phase 49 land the v1.4 **Cross-Domain Integration** milestone: deterministic generation of a UI ↔ API contract (CROSS-DOMAIN.md) plus a verify-gate layer that emits 4 check-type findings into CROSS-DOMAIN-FINDINGS.md, consumed by `/sunco:proceed-gate` with a HIGH/MEDIUM/LOW severity × state policy.

This doc covers: when the layer fires, what it produces, the 3-region findings file, lifecycle overrides, `/sunco:proceed-gate` policy matrix, the `--allow-low-open` flag, the charter-level decision to keep M4 deterministic-only, and the future heuristic extension slot.

---

## Two files, two roles, one integration layer

Phase 48 and Phase 49 each own a distinct file in `.planning/domains/contracts/`:

| File | Owner | Purpose | Lifecycle |
|---|---|---|---|
| `CROSS-DOMAIN.md` | Phase 48/M4.1 generator | Projects UI-SPEC + API-SPEC SPEC-BLOCK fields into a contract table (endpoints_consumed / endpoints_defined / error_mappings / type_contracts). Deterministic, no LLM. | Regenerated on-demand; no lifecycle tokens in this file. |
| `CROSS-DOMAIN-FINDINGS.md` | Phase 49/M4.2 verify-gate | Emits 4 check-type findings (missing-endpoint / type-drift / error-state-mismatch / orphan-endpoint) with state lifecycle (open / resolved / dismissed-with-rationale). | 3-region structure: auto-gen findings + human-edit overrides + prose. |

Both files are **generated artifacts** — you don't hand-author the auto-gen regions. You do hand-edit two things: (a) the hand-authored prologue above the generated blocks, (b) the `overrides[]` YAML in CROSS-DOMAIN-FINDINGS.md's lifecycle region.

---

## When the cross-domain layer fires

The verify-gate cross-domain layer is **additive, not replacement** — Layers 1-7 of the 7-layer Swiss cheese verification run unchanged for every phase. The cross-domain layer fires only when the phase is actually cross-domain:

```
Cross-domain layer triggers when:
  phase's ${N}-CONTEXT.md declares:
    domains: [frontend, backend]    # both present
  OR
    required_specs:
      - .planning/domains/frontend/UI-SPEC.md
      - .planning/domains/backend/API-SPEC.md
```

Single-domain phases (`domains: [backend]` only, or `domains: [frontend]` only) **skip** the layer — zero behavior change vs pre-v1.4 verify. Phases with no `domains:` declaration also skip.

This is the `shouldTriggerCrossDomainLayer()` predicate in `packages/cli/references/cross-domain/src/extract-spec-block.mjs`. It's the explicit spec §8 line 731 non-regression guarantee.

---

## Phase 48 generation: CROSS-DOMAIN.md

`workflows/cross-domain-sync.md` is an **internal workflow** (no slash command in Phase 48 per C7). It's invoked by:

- Phase 49 `/sunco:verify` cross-domain gate layer (freshness check + regeneration)
- `/sunco:backend-review` composition (future wiring)

Invocation writes `.planning/domains/contracts/CROSS-DOMAIN.md` with a YAML-fenced block containing 6 required fields per `schemas/cross-domain.schema.json`:

- `version: 1` — schema marker (BS1 parity)
- `generated_from: [...]` — per-source {spec: full-path, sha: SHA-256 of file bytes}
- `endpoints_consumed: [...]` — from UI-SPEC's `endpoints_consumed`
- `endpoints_defined: [...]` — from API-SPEC's `endpoints`
- `error_mappings: [...]` — cross-projection of API error codes × UI `error_states_handled`
- `type_contracts: [...]` — field-path × ui_type × api_type × match (boolean)

Plus a top-of-file marker `<!-- cross_domain_version: 1 -->` and a summary-only BACKEND-AUDIT rollup (4 surfaces × 3 severities, Phase 47 aggregate closure).

**Deterministic generation:** no LLM, no subagent, no HTTP out. Pure set-algebra + YAML serialization + SHA-256 on file bytes. Idempotent: same input files → same output. The `generated_from[].sha` is a **content hash, not a git commit SHA** — same content across commits produces the same CROSS-DOMAIN.md.

---

## Phase 49 verify-gate: 4 check types

When the layer fires, Phase 49's verify-gate emits findings via `generateCrossDomainFindings()` into `.planning/domains/contracts/CROSS-DOMAIN-FINDINGS.md`:

| Rule | Severity | Detection | File ref |
|---|---|---|---|
| `missing-endpoint` | **HIGH** | UI consumes endpoint that API doesn't define (set difference: consumed \ defined) | UI-SPEC.md |
| `type-drift` | **HIGH** | UI-declared type ≠ API-declared type at the same field path (`type_contracts[].match === false`) | UI-SPEC.md |
| `error-state-mismatch` | **MEDIUM** | API error code has no explicit UI handler (`error_mappings[].ui_state === ''`) | UI-SPEC.md |
| `orphan-endpoint` | **LOW** | API defines endpoint no UI consumer declares (set difference: defined \ consumed) | API-SPEC.md |

All 4 use **raw method+path set-keys** — no path parameter normalization (`/users/:id` vs `/users/{id}` surface as `missing-endpoint` or `orphan-endpoint` by design). This preserves Phase 48 projection parity; templated-path alignment is an author-side concern.

Findings are deterministically ordered: rule asc → file asc → line asc → match asc. All carry `state: open`, `kind: deterministic`, `source: cross-domain`, `line: 0` (SPEC-level, not line-local).

---

## CROSS-DOMAIN-FINDINGS.md — 3-region structure

```
<!-- findings_version: 1 -->
# CROSS-DOMAIN-FINDINGS.md

<hand-authored prologue — preserved byte-for-byte across regenerations>

<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-START -->
```yaml
findings:
  - rule: missing-endpoint
    severity: HIGH
    kind: deterministic
    file: .planning/domains/frontend/UI-SPEC.md
    line: 0
    state: open
    source: cross-domain
    match: "GET /orders"
    fix_hint: "API does not define GET /orders consumed by OrderList; ..."
  - ...
```
<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-END -->

<!-- SUNCO:CROSS-DOMAIN-LIFECYCLE-START -->
```yaml
overrides:
  - id: type-drift:.planning/domains/frontend/UI-SPEC.md:0
    state: resolved
    resolved_commit: abc1234
  - id: error-state-mismatch:.planning/domains/frontend/UI-SPEC.md:0
    state: dismissed-with-rationale
    dismissed_rationale: "UNKNOWN_ERR falls through to the generic-error UI state by design; the fallback copy is user-tested and covers this path without a dedicated handler."
```
<!-- SUNCO:CROSS-DOMAIN-LIFECYCLE-END -->

<optional hand-authored prose below — preserved byte-for-byte>
```

**Region semantics:**

1. **Prologue** (above `FINDINGS-BLOCK-START`) — hand-authored; preserved byte-for-byte across regenerations. Default inserted only on first generation.
2. **Findings block** (inside `FINDINGS-BLOCK-START/END`) — auto-generated, **overwrite on every regeneration**, deterministic ordering. You do not edit this region.
3. **Lifecycle region** (inside `LIFECYCLE-START/END`) — human-edited `overrides[]` list; preserved byte-for-byte when the renderer is called with `overrides=undefined`. This is where you record resolved + dismissed-with-rationale transitions.
4. **Prose** (below `LIFECYCLE-END`) — hand-authored; preserved byte-for-byte.

**id-join key:** Lifecycle overrides join findings by `rule:file:line` composite ID — e.g., `missing-endpoint:.planning/domains/frontend/UI-SPEC.md:0`. The renderer computes effective state per finding as `override.state ?? finding.state`.

**Top marker:** `<!-- findings_version: 1 -->` — BS1 parity with Phase 48's `cross_domain_version: 1` and M3's `audit_version: 1`.

---

## Finding lifecycle (audit_version:2)

Phase 49 introduces **audit_version:2** at the schema layer (`finding.schema.json`) — the `state` enum expands:

| state | When emitted | Required fields | Semantics |
|---|---|---|---|
| `open` | Auto-gen findings + fresh finds | (none beyond core) | Blocking until resolved or dismissed |
| `resolved` | Human override in lifecycle region | `resolved_commit: ^[0-9a-f]{7,40}$` | A commit actually fixed the underlying issue |
| `dismissed-with-rationale` | Human override in lifecycle region | `dismissed_rationale: min 50 chars` | Accepted trade-off with written justification |

The schema uses **`oneOf` lifecycle branches** to enforce conditional-required fields:

- state=open → no extra requirement
- state=resolved → `resolved_commit` required
- state=dismissed-with-rationale AND severity ∈ {MEDIUM, LOW} → `dismissed_rationale` required (min 50 chars)

**HIGH dismissal is structurally rejected.** A finding with `state: dismissed-with-rationale` + `severity: HIGH` matches zero `oneOf` branches → oneOf validation fails → finding rejected. This implements spec §8 line 710's "HARD BLOCK, cannot be dismissed" at the schema layer, not just the gate layer. Defense-in-depth: the schema rejects the combination, and `/sunco:proceed-gate` additionally rejects HIGH+open at gate time.

**Phase 47 backward compat:** `sunco-backend-reviewer.md` has a hard-guard that forbids emitting resolved/dismissed at audit_version:1 (BACKEND-AUDIT.md writes). Phase 47 findings (state=open only) continue to validate against the first oneOf branch — no regression. The audit_version:2 lifecycle applies to **CROSS-DOMAIN-FINDINGS.md writes only**; BACKEND-AUDIT.md remains audit_version:1 append-only.

---

## `/sunco:proceed-gate` — severity × state policy

`/sunco:proceed-gate ${N}` runs AFTER `/sunco:verify` and BEFORE `/sunco:ship`, `/sunco:release`, or `/sunco:update`. When CROSS-DOMAIN-FINDINGS.md exists for the phase, the gate consumes it (Step 1.5 in `commands/sunco/proceed-gate.md`) and applies a severity × state policy in addition to VERIFICATION.md's existing "zero unresolved" policy.

### Policy matrix (Phase 49 A4 + spec §8 L709-713)

| Severity | State | Outcome | Override |
|---|---|---|---|
| **HIGH** | `open` | **HARD BLOCK** | None — cannot be dismissed (schema also rejects) |
| HIGH | `resolved` (with commit) | PASS | — |
| HIGH | `dismissed-with-rationale` | N/A | Schema rejects; unreachable at runtime |
| **MEDIUM** | `open` | **BLOCK** | Dismissible via lifecycle override: `state: dismissed-with-rationale` + `dismissed_rationale` ≥50 chars |
| MEDIUM | `resolved` / `dismissed-with-rationale` | PASS | — |
| **LOW** | `open` | **BLOCK** (default) | `/sunco:proceed-gate --allow-low-open` flag permits pass-through |
| LOW | `resolved` / `dismissed-with-rationale` | PASS | — |

### `--allow-low-open` flag semantics

```
/sunco:proceed-gate 05 --allow-low-open
```

Permits LOW+open findings to **pass-through** only. HIGH+open and MED+open still block regardless of the flag. Intended for phases where a known LOW-severity orphan-endpoint is deliberate (e.g., an API endpoint intentionally defined for future UI consumption, not a current miss). The flag acknowledges the authorial intent without requiring a formal `dismissed-with-rationale` entry.

Use sparingly. Prefer explicit `dismissed-with-rationale` overrides in CROSS-DOMAIN-FINDINGS.md's lifecycle region when possible — they leave a permanent audit trail.

### Non-cross-domain phases — zero regression

When `.planning/domains/contracts/CROSS-DOMAIN-FINDINGS.md` does **not exist** for the phase (single-domain phases, no-SPEC phases), `/sunco:proceed-gate` skips the cross-domain consumption logic entirely and retains its original VERIFICATION.md-only behavior. Existing ship verification behavior is preserved byte-for-byte for non-cross-domain phases (spec §8 line 731).

---

## Charter citation — deterministic-only over spec §8 L685 agent wording

**Spec §8 line 685 reads:** *"Spawn sunco-cross-domain-checker agent"* as Phase 4.2 Step 2.

**Phase 49 implementation:** no agent spawned. The 4 check types are set-algebra + boolean + string-empty operations on the CROSS-DOMAIN.md projection output — deterministic, no judgment required.

**Authority stack (descending priority):**

1. **`.claude/rules/architecture.md`** — "Deterministic First — 린터/테스트로 강제할 수 있는 건 LLM 사용 안 함."
2. **`packages/cli/references/product-contract.md`** — single source of truth on verify layers + runtime paths.
3. **Phase 48 precedent (`1a508ba`)** — `ajv` schema validator explicitly deferred past Phase 48 (spec §8 Phase 4.1 mentioned ajv but deterministic structural required-field check was adopted instead per C2). Phase 49 extends this: spec mention of an agent ≠ mandate to spawn when deterministic replacement exists.
4. Spec §8 L685 literal wording — overruled by (1)–(3) for this axis.

**Consequence:** `generateCrossDomainFindings` lives in `extract-spec-block.mjs` (pure stdlib + set-algebra). `workflows/verify-phase.md` invokes it inline. No agent file (`sunco-cross-domain-*`) exists in `packages/cli/agents/`. Smoke Section 24 asserts this negative.

This is the **Spec §8 L685 amendment** — Phase 49 A6-iii registered it as plan debt, now closed by this documentation.

---

## Future heuristic extension slot

Phase 49 v1 = deterministic-only. Four checks cover structural mismatch. **Not covered** (by design, at v1.4):

- Type aliasing (e.g., `UUID` alias for `string`)
- Nullability reasoning (`string | null` vs `string`)
- Union type comparison (`"pending" | "active"` vs `string`)
- Semantic endpoint role (e.g., list vs detail endpoint shape inference)
- Error code semantic drift (e.g., API `AUTH_EXPIRED` vs UI `session-timeout` — string-match fails but semantically aligned)

**Extension path (when heuristic checks are needed — M5 dogfood, v2, or later):**

1. Create `packages/cli/agents/sunco-cross-domain-checker.md` with `kind: heuristic` output contract.
2. Extend `workflows/verify-phase.md` Cross-Domain Gate with `Step C3.5: Spawn sunco-cross-domain-checker agent` (post-deterministic-findings).
3. `finding.schema.json` already supports `heuristic` and `requires-human-confirmation` kinds — no schema change needed.
4. Cross-domain rule slugs for heuristic findings: reviewer-agent-authored (`type-alias-unresolved`, `nullability-mismatch`, `union-narrowing`, `endpoint-role-mismatch`, `error-code-semantic-drift`).

The slot is documented so future contributors know the integration point. No agent is pre-created — surface inflation blocked until actual heuristic need arises.

---

## End-to-end flow (cross-domain phase)

```
1. Author phase with domains: [frontend, backend]
   /sunco:discuss 05 --domain frontend     # DESIGN-CONTEXT.md
   /sunco:discuss 05 --domain backend      # BACKEND-CONTEXT.md

2. Generate specs
   /sunco:ui-phase 05 --surface web        # UI-SPEC.md
   /sunco:backend-phase 05 --surface api   # API-SPEC.md

3. Review each surface
   /sunco:ui-review 05 --surface web       # IMPECCABLE-AUDIT.md + UI-REVIEW.md
   /sunco:backend-review 05 --surface api  # BACKEND-AUDIT.md section

4. Verify phase (cross-domain layer fires because domains includes both)
   /sunco:verify 05
     └─▶ Layers 1-7 run
     └─▶ Cross-Domain Gate:
           - shouldTriggerCrossDomainLayer → true
           - isCrossDomainStale → regenerate CROSS-DOMAIN.md if needed
           - generateCrossDomainFindings → 4 check types → CROSS-DOMAIN-FINDINGS.md
     └─▶ VERIFICATION.md (existing 7-layer output)

5. Review findings + record overrides
   Edit CROSS-DOMAIN-FINDINGS.md lifecycle region:
     overrides:
       - id: type-drift:.../UI-SPEC.md:0
         state: resolved
         resolved_commit: <sha>
       - id: error-state-mismatch:.../UI-SPEC.md:0
         state: dismissed-with-rationale
         dismissed_rationale: "<≥50 chars explaining the trade-off>"

6. Gate
   /sunco:proceed-gate 05
     └─▶ Reads VERIFICATION.md + CROSS-DOMAIN-FINDINGS.md
     └─▶ Applies severity × state policy
     └─▶ Outcome: PROCEED | CHANGES_REQUIRED | BLOCKED

7. Ship (if PROCEED)
   /sunco:ship 05
```

Non-cross-domain phases skip step 4's Cross-Domain Gate and step 5/6's CROSS-DOMAIN-FINDINGS flow entirely — zero regression.

---

## Related docs

- **`impeccable-integration.md`** — M2 frontend-side producer of UI-SPEC.md
- **`backend-excellence.md`** — M3 backend-side producer of API-SPEC.md + audit_version:1 discipline
- **`migration-v1.4.md`** — adoption path

---

*v1.4 M4 Cross-Domain Integration — Phase 48 (CROSS-DOMAIN.md generator) + Phase 49 (verify-gate cross-domain layer + finding lifecycle + proceed-gate severity policy). Spec §8 L685 amendment CLOSED in this doc.*
