# SUNCO Schemas

JSON Schema definitions for SUNCO's structured SPEC.md YAML blocks and cross-domain contracts. These schemas make SPEC-based verification deterministic (grep + `yaml.parse` + schema validation) rather than LLM-pattern-inference-based.

**Status**: Skeleton only (Phase 35/M1.1, 2026-04-18). Individual schema files are authored across later phases as their corresponding SPEC formats are defined.

## Planned schemas

| File | Populated in | Purpose |
|------|--------------|---------|
| `ui-spec.schema.json` | Phase 40/M2.3 | Validates SPEC-BLOCK YAML inside `UI-SPEC.md` (layout, components, states, interactions, a11y, responsive, motion, copy, anti-pattern-watchlist) |
| `api-spec.schema.json` | Phase 45/M3.4 | Validates SPEC-BLOCK YAML inside `API-SPEC.md` (endpoints, error_envelope, versioning, rate_limiting, auth_requirements) |
| `data-spec.schema.json` | Phase 45/M3.4 | Validates SPEC-BLOCK YAML inside `DATA-SPEC.md` (entities, indexes, constraints, relationships, migration_strategy, retention) |
| `event-spec.schema.json` | Phase 46/M3.5 | Validates SPEC-BLOCK YAML inside `EVENT-SPEC.md` (events, producer/consumers, schema, ordering, delivery_guarantee, DLQ, idempotency_keys) |
| `ops-spec.schema.json` | Phase 46/M3.5 | Validates SPEC-BLOCK YAML inside `OPS-SPEC.md` (deployment_topology, logs/metrics/traces/alerts, runbook, SLO+error_budget) |
| `cross-domain.schema.json` | Phase 48/M4.1 | Validates cross-domain contract extraction: endpoints_consumed, endpoints_defined, error_mappings, type_contracts |

## SPEC-BLOCK convention (locked in spec R2)

Every SPEC.md file that participates in deterministic extraction must contain at least one fenced YAML block marker:

```markdown
<!-- SUNCO:SPEC-BLOCK -->
```yaml
# structured content validated against the corresponding schema in this directory
```
```

Extractors consume **only** the content inside these fenced blocks. Prose outside the blocks is for human readers and does not participate in verification. This keeps cross-domain gate checks deterministic (grep + yaml.parse + schema validation) and eliminates the false-positive/negative risk of regex-or-LLM-based prose extraction.

## Schema versioning

Every schema includes a top-level `version: <integer>` field. v1.4 locks at `version: 1`.

Manual migration paths for schema changes are documented in `docs/migration-v0.X.md` (Phase 50/M5.1). An automated `/sunco:migrate-spec` CLI is a v2 candidate (out of scope for v1.4).

## References

- Source spec: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` § 11 Schemas (R2 SPEC-BLOCK rule, BS1 schema versioning)
- Requirement IDs: IF-06, IF-11, IF-12, IF-14 in `.planning/REQUIREMENTS.md` § v1.4
