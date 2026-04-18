# Backend Phase Workflow — DATA Surface

Generate a data-model design contract (DATA-SPEC.md) for a phase that includes backend data-model work. Loads 2 clean-room Phase 42 backend-excellence references per spec §7 Phase 3.4 (data-modeling, migrations-and-compatibility), spawns the `sunco-backend-researcher` agent with `--surface data` for 3-stage research, then writes DATA-SPEC.md with a deterministic `<!-- SUNCO:SPEC-BLOCK -->` fenced YAML block that validates against `packages/cli/schemas/data-spec.schema.json`. Used by `/sunco:backend-phase --surface data` (Phase 45/M3.4+).

---

## Overview

Six steps (mirrors Phase 40 ui-phase-web + backend-phase-api structure):

1. **Require BACKEND-CONTEXT.md** — hard-stop if backend context hasn't been gathered
2. **Read phase context + backend context** — CONTEXT.md + BACKEND-CONTEXT.md (inline bash, no loader module in v1)
3. **Spawn sunco-backend-researcher --surface data** — 3-stage research (ref-load → outline → write), 2 Phase 42 refs, 30k token ceiling
4. **Write DATA-SPEC.md** — prose sections + `<!-- SUNCO:SPEC-BLOCK -->` YAML (R2)
5. **Validate SPEC-BLOCK** — schema structural check + ≥3 anti-patterns + `version: 1` (BS1)
6. **Present for review + commit**

> This workflow is the **DATA surface branch** dispatched by `backend-phase.md` (Phase 37 router). Surface selection (`--surface api|data|event|ops`) is handled upstream. Phase 46 activates the event/ops branches; Phase 47 wires `backend-review-*` for SPEC consumption.

---

## Step 1: Require BACKEND-CONTEXT.md

The DATA surface cannot proceed without gathered backend context. Data-model decisions depend critically on `Data sensitivity` (PII / payment / health) and `SLO` (retention under availability requirements) from Phase 44's teach. BACKEND-CONTEXT.md captures 5 required sections plus an optional auto-detected `Tech stack / runtime` section.

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |

Check for the canonical backend context:

```bash
CONTEXT_FILE=".planning/domains/backend/BACKEND-CONTEXT.md"
if [ ! -f "$CONTEXT_FILE" ]; then
  echo "✗ No backend context found at $CONTEXT_FILE"
  echo ""
  echo "Run /sunco:discuss ${PHASE_ARG} --domain backend first to gather:"
  echo "  - Domain (e-commerce / SaaS / content / internal / other)"
  echo "  - Traffic profile (QPS avg, peak, geographic distribution)"
  echo "  - Data sensitivity (PII / payment / health / tier classification)"
  echo "  - SLO (p95/p99 latency, availability 9s)"
  echo "  - Deployment model (serverless / k8s / bare-VM / bare-metal / edge)"
  echo ""
  echo "Data model contracts cannot be inferred from code — data sensitivity,"
  echo "retention, and migration posture come from stated intent."
  exit 1
fi
```

**Hard stop rule (Phase 44 lock):** This workflow MUST NOT invoke the backend teach mode. The canonical capture path is `/sunco:discuss --domain backend` which writes `.planning/domains/backend/BACKEND-CONTEXT.md`. This workflow is a read-only consumer.

---

## Step 2: Read Phase Context + Backend Context

Locate phase directory:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
```

Read phase CONTEXT:

```bash
cat "${PHASE_DIR}"/*-CONTEXT.md
cat .planning/ROADMAP.md | grep -A 20 "Phase ${PADDED}"
cat .planning/REQUIREMENTS.md 2>/dev/null
```

Read backend context via inline bash (no loader module in v1 — Phase 47 scope):

```bash
BACKEND_CTX_FILE=".planning/domains/backend/BACKEND-CONTEXT.md"

# Extract each section by header. Must match Phase 44 schema section names
# exactly — drift = spec violation.
sed -n '/^## Domain$/,/^## /p' "$BACKEND_CTX_FILE" | sed '$d'
sed -n '/^## Traffic profile$/,/^## /p' "$BACKEND_CTX_FILE" | sed '$d'
sed -n '/^## Data sensitivity$/,/^## /p' "$BACKEND_CTX_FILE" | sed '$d'
sed -n '/^## SLO$/,/^## /p' "$BACKEND_CTX_FILE" | sed '$d'
sed -n '/^## Deployment model$/,/^## /p' "$BACKEND_CTX_FILE" | sed '$d'

# Optional (Phase 44 auto-detected; may be absent if repo yielded no match):
sed -n '/^## Tech stack \/ runtime (auto-detected)$/,$p' "$BACKEND_CTX_FILE"
```

These 5 required sections + 1 optional are passed to the researcher as prose blocks. No structured parsing at this layer — the researcher reads them as plain-text prompt context. `Data sensitivity` is the highest-leverage section for data-model decisions; the researcher prioritizes it when choosing migration strategy + retention posture.

---

## Step 3: Spawn sunco-backend-researcher

Spawn the backend researcher with `--surface data` routing and the spec-required ref subset:

```
Task(
  prompt="
Produce DATA-SPEC.md for Phase XX — [Phase Name]. Surface: data.

Phase context:
  [paste ${PHASE_DIR}/*-CONTEXT.md content]

Phase goal (from ROADMAP.md):
  [paste phase section]

Backend context (Phase 44 — canonical):
  ## Domain
    [section]
  ## Traffic profile
    [section]
  ## Data sensitivity
    [section — HIGHEST leverage for data model]
  ## SLO
    [section]
  ## Deployment model
    [section]
  ## Tech stack / runtime (auto-detected)
    [section — may be 'absent' if Phase 44 teach run yielded no repo match]

Required reference subset (spec §7 Phase 3.4 verbatim — 2 files):
  packages/cli/references/backend-excellence/reference/data-modeling.md
  packages/cli/references/backend-excellence/reference/migrations-and-compatibility.md

Optional secondary refs (README load-strategy — read only if Stage 1 budget permits ≤8k cap):
  packages/cli/references/backend-excellence/reference/performance-and-scale.md
  packages/cli/references/backend-excellence/reference/reliability-and-failure-modes.md

Research protocol: 3-stage (ref-load → outline → write).
Token ceiling: 30k total (8k / 4k / 15k per stage + 3k buffer).

Required output: .planning/phases/[N]-*/DATA-SPEC.md containing:
  - <!-- spec_version: 1 --> top-of-file marker
  - Prose sections: Data Model Intent, Entities, Relationships,
    Indexing Strategy, Migration Strategy, Retention & Lifecycle,
    Anti-pattern Watchlist
  - <!-- SUNCO:SPEC-BLOCK-START --> fenced ```yaml ... ``` block
    validating against packages/cli/schemas/data-spec.schema.json
  - SPEC-BLOCK required fields: version (const:1), entities[] (each with
    name + fields[]), migration_strategy, anti_pattern_watchlist
    (minItems:3, each citing a Phase 42 reference in source:).
    retention_policy optional (nullable when indefinite).

Hard guards:
  - MUST NOT invoke Phase 43 detector (detect-backend-smells.mjs).
    Phase 45 is contract authoring only; detector wires in Phase 47.
  - MUST NOT wire into /sunco:backend-review (Phase 47 scope).
  - MUST NOT modify BACKEND-CONTEXT.md (read-only consumer).
  - MUST NOT modify Phase 42 reference/*.md (frozen per Phase 43
    Escalate #5).
  - MUST NOT include cross-service event schemas — those live in
    EVENT-SPEC.md (Phase 46 scope).
  ",
  subagent_type="sunco-backend-researcher",
  description="Backend DATA research for Phase XX"
)
```

The agent handles its own token budgeting per stage. On overrun it drops secondary refs first; REQUIRED refs cannot be dropped. (Data surface has only 2 required refs so the pressure is lower than API surface's 4.)

---

## Step 4: Write DATA-SPEC.md

The researcher writes `${PHASE_DIR}/DATA-SPEC.md` directly. The orchestrator does not rewrite the body; it only performs validation in Step 5.

Expected structure (produced by the agent — see `agents/sunco-backend-researcher.md`):

```markdown
<!-- spec_version: 1 -->

# DATA-SPEC — Phase XX [phase-name]

## Data Model Intent
[1 paragraph — what this data represents, shaped by Domain + Data sensitivity]

## Entities
[prose overview — entity names + purpose per bullet; full field tables in SPEC-BLOCK]

## Relationships
[prose — belongsTo / hasMany / manyToMany graph, foreign key cardinality]

## Indexing Strategy
[prose — hot read paths, write-amplification tradeoffs, composite vs single-column]

## Migration Strategy
[expand-contract vs in-place + rationale, referencing SLO availability requirement]

## Retention & Lifecycle
[prose — retention duration per entity, archival path, tombstone vs hard-delete,
 shaped by Data sensitivity (PII/payment/health often have regulatory retention)]

## Anti-pattern Watchlist
[3-7 anti-patterns, each with Phase 42 reference citation + 1-sentence why]

<!-- SUNCO:SPEC-BLOCK-START -->
```yaml
version: 1
entities:
  - name: User
    fields:
      - {name: id, type: uuid, nullable: false, unique: true}
      - {name: email, type: text, nullable: false, unique: true}
      - {name: created_at, type: timestamptz, nullable: false}
    indexes:
      - {name: users_email_idx, columns: [email], unique: true}
    constraints:
      - {name: users_email_lower_unique, type: check, expr: email = lower(email)}
    relationships:
      - hasMany Order via user_id
migration_strategy: expand-contract
retention_policy: {unit: days, value: 2555, rationale: "GDPR 7-year financial-record retention"}
anti_pattern_watchlist:
  - pattern: non-reversible-migration
    source: migrations-and-compatibility.md
    why: Down path must exist or release note must mark migration as expand-contract.
  - pattern: ...
  - pattern: ...
```
<!-- SUNCO:SPEC-BLOCK-END -->
```

---

## Step 5: Validate SPEC-BLOCK

Extract the YAML body between the marker comments and validate against the schema:

```bash
DATA_SPEC="${PHASE_DIR}/DATA-SPEC.md"
SCHEMA="packages/cli/schemas/data-spec.schema.json"

# Extract YAML body
awk '/<!-- SUNCO:SPEC-BLOCK-START -->/,/<!-- SUNCO:SPEC-BLOCK-END -->/' "$DATA_SPEC" \
  | awk '/^```yaml$/,/^```$/' \
  | sed '1d;$d' \
  > /tmp/data-spec-block.yaml

# Structural check (Phase 40 precedent: full ajv validator wired Phase 48+).
# For Phase 45, enforce required-field + minItems + const version.
node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  const schema = JSON.parse(fs.readFileSync('$SCHEMA', 'utf8'));
  const body = yaml.parse(fs.readFileSync('/tmp/data-spec-block.yaml', 'utf8'));

  if (body.version !== 1) {
    console.error('FAIL version must be 1, got', body.version);
    process.exit(1);
  }
  for (const k of schema.required) {
    if (!(k in body)) { console.error('FAIL missing field:', k); process.exit(1); }
  }
  if (!Array.isArray(body.entities) || body.entities.length < 1) {
    console.error('FAIL entities needs >= 1 entry');
    process.exit(1);
  }
  for (const e of body.entities) {
    if (!e.name) { console.error('FAIL entity missing name'); process.exit(1); }
    if (!Array.isArray(e.fields) || e.fields.length < 1) {
      console.error('FAIL entity', e.name, 'needs >= 1 field');
      process.exit(1);
    }
  }
  if (!['expand-contract', 'in-place'].includes(body.migration_strategy)) {
    console.error('FAIL migration_strategy must be expand-contract|in-place, got',
      body.migration_strategy);
    process.exit(1);
  }
  if (!Array.isArray(body.anti_pattern_watchlist) || body.anti_pattern_watchlist.length < 3) {
    console.error('FAIL anti_pattern_watchlist needs >= 3 entries, got',
      (body.anti_pattern_watchlist || []).length);
    process.exit(1);
  }
  console.log('✓ SPEC-BLOCK valid: version=1, all required fields,',
    body.entities.length, 'entities,',
    body.anti_pattern_watchlist.length, 'anti-patterns');
"
```

On failure: surface the error and ask the researcher to revise (re-run Stage 3 only). Do NOT proceed to Step 6 with an invalid SPEC-BLOCK.

Full `ajv` validator wire-up is deferred to Phase 48+ — structural check is sufficient for Phase 45 done-when.

---

## Step 6: Present for Review + Commit

Display summary inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► BACKEND SPEC (data)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

N entities  |  M anti-patterns watched  |  version: 1

Phase 42 references consulted:
  data-modeling · migrations-and-compatibility
  (+ secondary: performance-and-scale, reliability-and-failure-modes
   — if loaded under budget)

Token usage: ~XXk / 30k ceiling

SPEC-BLOCK: ✓ 4/4 required fields, ≥3 anti-patterns, version=1 (BS1)
Migration strategy: <expand-contract|in-place>

Looks good? (yes / adjust [describe change])
```

On "yes":

```bash
git add "${PHASE_DIR}/DATA-SPEC.md"
git commit -m "docs: DATA spec for phase ${PADDED} — N entities, K anti-patterns"
```

On "adjust": re-run Step 3 Stage 3 (Write) only with the adjustment hint. Re-run Stage 2 only if the adjustment invalidates the outline.

---

## Success Criteria

- [ ] `.planning/domains/backend/BACKEND-CONTEXT.md` exists at Step 1 (hard-stop otherwise)
- [ ] Backend context read via inline bash; all 5 required sections extracted (Tech stack / runtime optional)
- [ ] `sunco-backend-researcher` agent spawned with `--surface data` + full phase + backend context
- [ ] 2 required Phase 42 refs loaded in Stage 1 (data-modeling, migrations-and-compatibility)
- [ ] 3-stage research executed; token budget stayed under 30k
- [ ] DATA-SPEC.md written to `${PHASE_DIR}/DATA-SPEC.md`
- [ ] `<!-- spec_version: 1 -->` top-of-file marker present (§12 BS1)
- [ ] SPEC-BLOCK contains all 4 required fields (version + entities + migration_strategy + anti_pattern_watchlist)
- [ ] Each entity has `name` + `fields[]` (minItems:1 per entity)
- [ ] `migration_strategy` is `expand-contract` or `in-place`
- [ ] `anti_pattern_watchlist` has ≥3 entries, each citing a Phase 42 reference
- [ ] `version: 1` in SPEC-BLOCK YAML (BS1)
- [ ] Schema structural validation passes (Step 5)
- [ ] Phase 42 reference docs unchanged (diff=0; Phase 43 Escalate #5)
- [ ] Phase 43 detector not invoked (Phase 47 wire point)
- [ ] BACKEND-CONTEXT.md not written by this workflow (read-only consumer; Phase 44 lock)
- [ ] Vendored Impeccable source unchanged (R5)
- [ ] User confirmed before commit

---

## Out-of-scope guardrails

Phase 45 / this workflow MUST NOT:
- Invoke the Phase 43 backend detector (`detect-backend-smells.mjs`) — Phase 47/M3.6 scope
- Wire into `/sunco:backend-review` or any `backend-review-*` workflow (Phase 47 scope)
- Modify `packages/cli/references/backend-excellence/reference/**` (Phase 43 Escalate #5 still active)
- Modify `BACKEND-CONTEXT.md` or its schema (Phase 44 lock)
- Modify `discuss-phase.md` (FRONTEND or BACKEND block)
- Modify `backend-phase-api.md` logic (sibling surface — shared scaffold but authored in parallel)
- Activate `backend-phase-event.md` or `backend-phase-ops.md` stubs (Phase 46)
- Activate any `backend-review-*.md` stubs (Phase 47)
- Touch `~/.claude/sunco` runtime files
- Produce or consume `.impeccable.md` (SDI-1 continuation)
- Include cross-service event schemas — those live in EVENT-SPEC.md (Phase 46)
- Backfill Phase 40 `ui-spec.schema.json` BS1 version field (registered plan debt)

*Phase 37/M1.3 introduced the stub; Phase 45/M3.4 replaces it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.4.*
