# BACKEND-AUDIT — dogfood /sunco:proceed-gate surface

<!-- audit_version: 1 -->

Phase 47 surface-section format. Dogfood scope per Phase 51/M5.2:
- `packages/cli/references/cross-domain/src/extract-spec-block.mjs` (primary)
- `packages/cli/references/impeccable/wrapper/detector-adapter.mjs` (adjacent)

Findings: **6 total** (4 deterministic from `scanTarget`, 2 heuristic from dogfood review pass).

Spec §9 L793 gate: ≥5 findings processed — ✓ (6 findings, all with explicit disposition below).

## API findings

```yaml
findings:
  - rule: raw-sql-interpolation
    severity: HIGH
    kind: deterministic
    file: packages/cli/references/cross-domain/src/extract-spec-block.mjs
    line: 559
    state: open
    source: backend-excellence
    match: "`API does not define ${key} consumed by ${ep.ui_ref || 'UI'}...`"
    fix_hint: False-positive — template literal is a human-readable fix_hint message, not a SQL query. Dogfood observation: detector's SQL-keyword heuristic needs a content-domain guard (e.g., only fire when string contains FROM/SELECT/INSERT/UPDATE/DELETE keywords near the interpolation). Detector improvement tracked; PIL 999 candidate.
  - rule: raw-sql-interpolation
    severity: HIGH
    kind: deterministic
    file: packages/cli/references/cross-domain/src/extract-spec-block.mjs
    line: 576
    state: open
    source: backend-excellence
    match: "`API defines ${key} but no UI consumer declares it; either r...`"
    fix_hint: False-positive — same class as line 559 (fix_hint message, not SQL). Paired observation confirms detector improvement need. PIL 999 candidate.
  - rule: swallowed-catch
    severity: HIGH
    kind: deterministic
    file: packages/cli/references/cross-domain/src/extract-spec-block.mjs
    line: 1213
    state: open
    source: backend-excellence
    match: catch {}
    fix_hint: True-positive — confirm catch block intent. If intentional (input tolerance), add comment documenting the rationale; if unintentional, replace with explicit error path. Dogfood scope: observation only (G9 hard-lock prevents code mutation in Phase 51).
  - rule: swallowed-catch
    severity: HIGH
    kind: deterministic
    file: packages/cli/references/impeccable/wrapper/detector-adapter.mjs
    line: 355
    state: open
    source: backend-excellence
    match: catch {}
    fix_hint: True-positive — similar to extract-spec-block.mjs:1213. Review for documented rationale or explicit error handling. Dogfood observation only (G9 hard-lock).
  - rule: dogfood-semantic-fidelity
    severity: MEDIUM
    kind: heuristic
    file: packages/cli/commands/sunco/proceed-gate.md
    line: 0
    state: open
    source: dogfood-review
    match: CLI-as-REST-API semantic mapping
    fix_hint: Applying backend-phase-api to a slash-command surface is semantically stretched — slash commands have no HTTP method, no status codes, no versioning strategy beyond CLI release. The API-SPEC.md produced for dogfood is a synthetic mapping; for v2 the ops-surface (operational runbook) may be a more honest target. Tracked as v2 scope per Gate 51 G5.
  - rule: bs2-runtime-token-enforcement
    severity: LOW
    kind: heuristic
    file: docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md
    line: 0
    state: open
    source: dogfood-review
    match: BS2 30k token ceiling — measurement-only closure in v1.4
    fix_hint: Phase 51 DOGFOOD-RUNTIME.md records token measurements when available but does not enforce the 30k per-spawn ceiling. v2 scope per Gate 51 G4. Tracked as PIL 999 carry; not release-blocking.
```

## Data findings

None (surface is CLI command + reference modules; no data-layer in dogfood scope).

## Event findings

None (CLI commands are not event-sourced; no event-layer in dogfood scope).

## Ops findings

None (dogfood scope bounded to API surface per Gate 51 G5).

## Disposition summary

| Finding | Disposition | Next step |
|---------|-------------|-----------|
| raw-sql-interpolation:559 | PIL 999 candidate — detector improvement | v1.5 |
| raw-sql-interpolation:576 | PIL 999 candidate — paired false-positive | v1.5 |
| swallowed-catch:1213 | Open — review for rationale comment | v1.5 |
| swallowed-catch:355 | Open — review for rationale comment | v1.5 |
| dogfood-semantic-fidelity | v2 scope (ops-surface replacement) | v2 |
| bs2-runtime-token-enforcement | PIL 999 carry (measurement-only sufficient for v1.4) | v2 |

All 6 findings processed with explicit disposition. None are release-blocking for v1.4 per Gate 51 G10 "active release-blocking debt 0" criterion — all route to v1.5 or v2 as tracked backlog.
