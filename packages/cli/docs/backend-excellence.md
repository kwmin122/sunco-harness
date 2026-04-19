# Backend Excellence (v1.4 M3)

SUNCO v1.4 adds a backend-domain track that mirrors the frontend side: deterministic reference documents teach conventions, a pattern-based detector catches common smells without LLM cost, and 4 surface-specific phase + review workflows produce structured SPEC-BLOCK YAML outputs.

This doc covers: 8 reference docs, 7 detector rules, BACKEND-CONTEXT teach flow, 4 backend-phase surfaces, 4 backend-review surfaces, and the audit_version:1 state discipline.

---

## 8 reference documents (Phase 42)

Clean-room authored, ≥1500 words each, ≥5 anti-patterns + code examples per doc. Located at `packages/cli/references/backend-excellence/`:

| Reference | Scope |
|---|---|
| `api-design.md` | REST/RPC endpoint shape, versioning, idempotency, pagination |
| `data-modeling.md` | Entity relationships, migrations, indexes, denormalization trade-offs |
| `boundaries-and-architecture.md` | Service decomposition, sync vs async boundaries, dependency direction |
| `reliability-and-failure-modes.md` | Timeouts, retries, circuit breakers, graceful degradation |
| `security-and-permissions.md` | AuthN/AuthZ models, injection defense, secret management |
| `performance-and-scale.md` | Caching layers, batching, connection pooling, query planning |
| `observability-and-operations.md` | Logs, metrics, traces, SLOs, runbooks |
| `migrations-and-compatibility.md` | Backward-compat windows, feature flags, data backfills |

These are teach-oriented, not code. Agents reference them via the `source` field in heuristic findings (e.g., `source: api-design.md`).

---

## 7 detector rules (Phase 43 — deterministic, high-confidence)

`packages/cli/references/backend-excellence/src/detect-backend-smells.mjs` emits JSON findings with `kind: deterministic` — zero LLM cost. 17 self-tests cover positive + negative fixtures per rule.

| Rule ID | Severity | Surface | Pattern |
|---|---|---|---|
| `raw-sql-interpolation` | HIGH | api/data | Template string inside SQL query with unescaped variable |
| `missing-timeout` | HIGH | api/ops | HTTP/DB/RPC call without explicit timeout |
| `swallowed-catch` | HIGH | api/data/ops | `catch {}` or `catch (e) {}` with no rethrow, log, or branch |
| `any-typed-body` | MEDIUM | api | Request body typed as `any` / `unknown` without validation |
| `missing-validation-public-route` | HIGH | api | Public route handler without input validation (zod, yup, joi absent) |
| `non-reversible-migration` | HIGH | data | Migration file adds NOT NULL / DROP / RENAME without down/rollback path |
| `logged-secret` | HIGH | ops | `console.log` or logger call receiving a value named `*_key`, `*_token`, `*_secret`, `password` |

Rules are **locked** — Phase 43 spec §13 forbids adding, removing, or renaming rules without a full re-audit cycle. Extensions happen at the heuristic layer (Phase 47 reviewer agent), not the deterministic layer.

Invoke directly:

```bash
node packages/cli/references/backend-excellence/src/detect-backend-smells.mjs --json src/
```

Or let `/sunco:backend-review` orchestrate it.

---

## BACKEND-CONTEXT.md (Phase 44 teach flow)

Before `/sunco:backend-phase`, populate the phase's backend context:

```
/sunco:discuss ${N} --domain backend
```

The teach flow asks 5 questions and writes `.planning/domains/backend/BACKEND-CONTEXT.md`:

1. **Surface classification** — api / data / event / ops? multiple?
2. **Dependency direction** — what does this phase own? what does it consume?
3. **Failure budget** — SLO, error rate ceiling, availability target
4. **State management** — stateful? transaction boundaries? event/queue/cron interactions?
5. **Security posture** — public/internal? auth model? PII/secret classification?

BACKEND-CONTEXT.md is **frozen** after creation for the phase's lifetime (C8 lock). Downstream phase-* and review-* workflows READ only — they never modify BACKEND-CONTEXT. This preserves the teach contract as source of truth across multiple regenerations of SPEC.md artifacts.

**Trigger discipline:** The teach flow is **explicit-only**. It fires when CONTEXT frontmatter declares `domains: [backend]` (or `domains: [frontend, backend]`), or when `/sunco:discuss` is invoked with `--domain backend`. Phases without a backend domain see zero behavior change.

---

## 4 backend-phase surfaces (Phase 45-46 — authoring)

`/sunco:backend-phase ${N} --surface {api|data|event|ops}` is the dispatcher. `--surface` is **required** (no default) — explicit surface selection prevents ambiguity and forces the phase author to classify the change.

Each surface produces a structured SPEC-BLOCK YAML at `.planning/domains/backend/${SURFACE}-SPEC.md`:

| Surface | Command | Output | SPEC-BLOCK keys |
|---|---|---|---|
| `api` | `/sunco:backend-phase N --surface api` | `API-SPEC.md` | endpoints[] (method/path/request/response/errors), error_envelope, versioning_strategy, auth_requirements, anti_pattern_watchlist |
| `data` | `/sunco:backend-phase N --surface data` | `DATA-SPEC.md` | entities[], relations[], indexes[], migration_strategy, consistency_model, anti_pattern_watchlist |
| `event` | `/sunco:backend-phase N --surface event` | `EVENT-SPEC.md` | events[], dlq_strategy, idempotency_strategy, replay_semantics, anti_pattern_watchlist |
| `ops` | `/sunco:backend-phase N --surface ops` | `OPS-SPEC.md` | deployment_topology, slo_targets, runbook, alerting, rollback_strategy, anti_pattern_watchlist |

Each SPEC.md has `<!-- spec_version: 1 -->` top-of-file (BS1 parity) and a `SUNCO:SPEC-BLOCK-START/END`-fenced YAML body. The schema files at `packages/cli/schemas/${surface}-spec.schema.json` enforce required fields + additionalProperties:true (lenient-additive across versions).

Authoring uses the `sunco-backend-researcher` agent (3-stage, 30k token ceiling, BS2 enforcement). Output is structured, machine-consumable by:

- Downstream `/sunco:backend-review --surface ${same}`
- Phase 48 cross-domain-sync (API-SPEC only, combined with UI-SPEC)
- Phase 49 verify-gate cross-domain layer (when domains include both)

---

## 4 backend-review surfaces (Phase 47 — audit)

`/sunco:backend-review ${N} --surface {api|data|event|ops}` runs:

1. **Step 1** — read SPEC.md + BACKEND-CONTEXT.md for the phase
2. **Step 2** — run `detect-backend-smells.mjs` with the surface's rule subset (API: 4 rules, Data: 1 rule, Event: 0 rules [pure review], Ops: 3 rules), inject `state: open` on each finding
3. **Step 3** — spawn `sunco-backend-reviewer` agent with deterministic findings as prompt context + 3-way classification
4. **Step 4** — write section-level replace into `.planning/domains/backend/BACKEND-AUDIT.md` (preserves other 3 sections byte-for-byte)

BACKEND-AUDIT.md has:

- `<!-- audit_version: 1 -->` top-of-file marker
- 4 sections: `## API findings`, `## Data findings`, `## Event findings`, `## Ops findings`
- Per-section `<!-- surface_source: ${path} -->` metadata
- Each finding follows `finding.schema.json` — rule, severity (HIGH/MEDIUM/LOW), kind (deterministic/heuristic/requires-human-confirmation), file, line, state (**open only at audit_version:1**), fix_hint

---

## audit_version:1 state discipline

At audit_version:1 (Phase 47 output), the **only valid `state` value is `open`**. The `sunco-backend-reviewer` agent has a hard-guard that forbids emitting `state: resolved` or `state: dismissed-with-rationale` at audit_version:1 — those lifecycle states are introduced in Phase 49/M4.2 and apply to **CROSS-DOMAIN-FINDINGS.md** writes, not BACKEND-AUDIT.md.

BACKEND-AUDIT.md remains **append-only at audit_version:1**. Re-running `/sunco:backend-review --surface X` replaces section X with fresh findings (all `state: open`); other sections are preserved byte-for-byte (section-level replace discipline, not full overwrite).

**Why keep BACKEND-AUDIT at audit_version:1?** Phase 47 writer discipline is stable, proven, and downstream-consumed by Phase 48's summary-only rollup (CROSS-DOMAIN.md's `OPEN-FINDINGS-SUMMARY` region). Mixing audit_version:2 lifecycle into BACKEND-AUDIT would break the Phase 47 agent's hard-guard and the Phase 48 rollup counter. Phase 49 writes lifecycle findings to a **separate file** (CROSS-DOMAIN-FINDINGS.md at findings_version:1), preserving audit_version:1 invariants.

See `cross-domain.md` for audit_version:2 + findings_version:1 details.

---

## How backend findings flow into proceed-gate

```
/sunco:backend-review N --surface X
   │
   ├─▶ detect-backend-smells --json (deterministic, Phase 43)
   ├─▶ sunco-backend-reviewer agent (heuristic + human-confirm, Phase 47)
   │
   └─▶ BACKEND-AUDIT.md section X (state: open only, audit_version:1)
         │
         └─▶ /sunco:verify N (Layer 1 multi-agent review reads BACKEND-AUDIT)
               │
               └─▶ VERIFICATION.md includes backend findings summary
                     │
                     └─▶ /sunco:proceed-gate N (blocks on unresolved findings)
```

Backend findings at v1.4 flow through `VERIFICATION.md` → `/sunco:proceed-gate`. The gate's cross-domain severity × state policy (HIGH hard-block / MED dismissible / LOW `--allow-low-open`) applies to **CROSS-DOMAIN-FINDINGS.md** findings (Phase 49), not backend findings. Backend findings remain governed by VERIFICATION.md's existing "zero unresolved" policy (see `/sunco:proceed-gate` command docs for the severity policy that applies when cross-domain layer is active).

---

## `/sunco:backend-phase --assume` (planning preview)

Before actual generation, preview what the backend-researcher agent would assume:

```
/sunco:backend-phase ${N} --surface api --assume
```

Outputs a list of decisions the agent would make with current BACKEND-CONTEXT input. Use it to refine BACKEND-CONTEXT.md before committing to a SPEC.md generation. This is advisory only — no SPEC.md is written.

---

## Related docs

- **`impeccable-integration.md`** — M2 frontend-side companion
- **`cross-domain.md`** — M4 UI ↔ API contract layer (where backend API-SPEC meets frontend UI-SPEC)
- **`migration-v1.4.md`** — adoption path

---

*v1.4 M3 Backend Excellence — Phase 42 (references) + Phase 43 (detector) + Phase 44 (teach) + Phase 45-46 (4 phase surfaces) + Phase 47 (4 review surfaces).*
