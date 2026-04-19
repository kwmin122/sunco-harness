# Backend Phase Workflow — OPS Surface

Generate an operations-surface design contract (OPS-SPEC.md) for a phase that includes backend deployment / observability / runbook work. Loads 2 clean-room Phase 42 backend-excellence references per Phase 42 README load-strategy table (observability-and-operations, reliability-and-failure-modes — spec §7 Phase 3.5 is silent on ref list, README is the local authority), spawns the `sunco-backend-researcher` agent with `--surface ops` for 3-stage research, then writes OPS-SPEC.md with a deterministic `<!-- SUNCO:SPEC-BLOCK -->` fenced YAML block that validates against `packages/cli/schemas/ops-spec.schema.json`. Used by `/sunco:backend-phase --surface ops` (Phase 46/M3.5+).

---

## Overview

Six steps (mirrors Phase 40 ui-phase-web + Phase 45 backend-phase-api/data structure):

1. **Require BACKEND-CONTEXT.md** — hard-stop if backend context hasn't been gathered
2. **Read phase context + backend context** — CONTEXT.md + BACKEND-CONTEXT.md (inline bash, no loader module in v1)
3. **Spawn sunco-backend-researcher --surface ops** — 3-stage research (ref-load → outline → write), 2 Phase 42 refs, 30k token ceiling
4. **Write OPS-SPEC.md** — prose sections + `<!-- SUNCO:SPEC-BLOCK -->` YAML (R2)
5. **Validate SPEC-BLOCK** — schema structural check + ≥3 anti-patterns + `version: 1` (BS1) + observability sub-structure
6. **Present for review + commit**

> This workflow is the **OPS surface branch** dispatched by `backend-phase.md` (Phase 37 router). Surface selection (`--surface api|data|event|ops`) is handled upstream. Phase 45 activated api+data; Phase 46 activates event+ops; Phase 47 wires `backend-review-*` for SPEC consumption.

---

## Step 1: Require BACKEND-CONTEXT.md

The OPS surface cannot proceed without gathered backend context. Operational decisions depend critically on `SLO` (projected into structured `{availability, latency_p95_ms}` form), `Deployment model` (serverless / k8s / bare-VM / edge determines rollout shape), and `Traffic profile` (alert thresholds scale with peak QPS) from Phase 44's teach. BACKEND-CONTEXT.md captures 5 required sections plus an optional auto-detected `Tech stack / runtime` section.

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
  echo "Operations contracts cannot be inferred from code — SLO projection,"
  echo "alert thresholds, and runbook actions come from stated intent."
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

Read backend context via inline bash (no loader module in v1 — Phase 47 scope when structured reading is needed for review-agent wire-up):

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

These 5 required sections + 1 optional are passed to the researcher as prose blocks. No structured parsing at this layer — the researcher reads them as plain-text prompt context. `SLO` + `Deployment model` are the highest-leverage sections for ops-contract decisions. The researcher projects BACKEND-CONTEXT SLO into the OPS-SPEC `slo` structured field (availability + latency_p95_ms) — projection, NOT verbatim duplicate. BACKEND-CONTEXT remains the source of truth for SLO intent.

---

## Step 3: Spawn sunco-backend-researcher

Spawn the backend researcher with `--surface ops` routing and the README-authoritative ref subset:

```
Task(
  prompt="
Produce OPS-SPEC.md for Phase XX — [Phase Name]. Surface: ops.

Phase context:
  [paste ${PHASE_DIR}/*-CONTEXT.md content]

Phase goal (from ROADMAP.md):
  [paste phase section]

Backend context (Phase 44 — canonical):
  ## Domain
    [section]
  ## Traffic profile
    [section — peak QPS informs alert thresholds]
  ## Data sensitivity
    [section]
  ## SLO
    [section — HIGHEST leverage for ops; project into {availability, latency_p95_ms}]
  ## Deployment model
    [section — rollout shape, oncall topology]
  ## Tech stack / runtime (auto-detected)
    [section — may be 'absent' if Phase 44 teach run yielded no repo match]

Required reference subset (Phase 42 README load-strategy — 2 files):
  packages/cli/references/backend-excellence/reference/observability-and-operations.md
  packages/cli/references/backend-excellence/reference/reliability-and-failure-modes.md

Optional secondary refs (README — read only if Stage 1 budget permits ≤8k cap):
  packages/cli/references/backend-excellence/reference/security-and-permissions.md
  packages/cli/references/backend-excellence/reference/migrations-and-compatibility.md

Note: spec §7 Phase 3.5 is silent on ref list (unlike Phase 45 api/data which were
spec-verbatim). Phase 42 README load-strategy table is the local authority chosen at
Focused+ Gate 46. README is a living document; future phases may revise the ops row
only after Gate re-justification.

Research protocol: 3-stage (ref-load → outline → write).
Token ceiling: 30k total (8k / 4k / 15k per stage + 3k buffer).

Required output: .planning/phases/[N]-*/OPS-SPEC.md containing:
  - <!-- spec_version: 1 --> top-of-file marker
  - Prose sections: Deployment Topology, Observability, Runbook,
    SLO & Error Budget, Anti-pattern Watchlist
  - <!-- SUNCO:SPEC-BLOCK-START --> fenced ```yaml ... ``` block validating
    against packages/cli/schemas/ops-spec.schema.json
  - SPEC-BLOCK required fields: version (const:1), deployment_topology,
    observability (object with logs + metrics + traces sub-objects; optional
    alerts[] with name + threshold per alert), slo (object with availability
    + latency_p95_ms; structural projection of BACKEND-CONTEXT SLO, NOT
    verbatim duplicate), anti_pattern_watchlist (minItems:3, each citing a
    Phase 42 reference file in source:). runbook optional; error_budget_policy
    optional.

Hard guards:
  - MUST NOT invoke Phase 43 detector (detect-backend-smells.mjs).
    Phase 46 is contract authoring only; detector wires in Phase 47.
  - MUST NOT wire into /sunco:backend-review (Phase 47 scope).
  - MUST NOT modify BACKEND-CONTEXT.md (read-only consumer).
  - MUST NOT modify Phase 42 reference/*.md (frozen per Phase 43
    Escalate #5).
  - OPS-SPEC slo field MUST be structural projection of BACKEND-CONTEXT
    SLO, NOT verbatim prose duplicate. Structured form only:
    {availability: '<n-nines>', latency_p95_ms: <int>}. Cite BACKEND-CONTEXT
    as authority in a 1-sentence pre-block note if projection is lossy.
  ",
  subagent_type="sunco-backend-researcher",
  description="Backend OPS research for Phase XX"
)
```

The agent handles its own token budgeting per stage. On overrun it drops secondary refs first; REQUIRED refs cannot be dropped. (Ops surface has only 2 required refs so the pressure is lower than API surface's 4.)

---

## Step 4: Write OPS-SPEC.md

The researcher writes `${PHASE_DIR}/OPS-SPEC.md` directly. The orchestrator does not rewrite the body; it only performs validation in Step 5.

Expected structure (produced by the agent — see `agents/sunco-backend-researcher.md`):

```markdown
<!-- spec_version: 1 -->

# OPS-SPEC — Phase XX [phase-name]

## Deployment Topology
[prose — single-region vs multi-region vs edge; rollout strategy
 (blue-green / canary / rolling); oncall topology]

## Observability
[prose overview — logs structure + level policy, metrics required
 dimensions + SLI list, traces propagation + sampling, alerts pointer.
 Structured form in SPEC-BLOCK.]

## Runbook
[prose overview — alert → action pointers; references external
 runbook location when applicable. Structured list in SPEC-BLOCK.]

## SLO & Error Budget
[SLO is structural projection of BACKEND-CONTEXT SLO section (authority).
 Stated here in {availability n-nines, p95 latency ms} structured form + error
 budget policy (burn rate, freeze threshold). Does NOT duplicate BACKEND-CONTEXT
 prose verbatim — projection only.]

## Anti-pattern Watchlist
[3-7 anti-patterns, each with Phase 42 reference citation + 1-sentence why]

<!-- SUNCO:SPEC-BLOCK-START -->
```yaml
version: 1
deployment_topology:
  shape: multi-region-active-active
  regions: [us-east-1, eu-west-1]
  rollout: blue-green
observability:
  logs:
    structured: true
    level_policy: error+warn default; info on explicit enable
    retention: 30d
  metrics:
    required_dimensions: [service, env, region, route]
    sli_list: [availability, latency_p95, error_rate]
  traces:
    propagation: w3c-tracecontext
    sampling: 10%-head-1%-tail
  alerts:
    - name: HighErrorRate
      threshold: "error_rate > 1% for 5m"
    - name: LatencyP95Breach
      threshold: "latency_p95_ms > 200 for 10m"
runbook:
  - alert: HighErrorRate
    action: "Check recent deploy, diff config, rollback if error spike coincides with release"
  - alert: LatencyP95Breach
    action: "Check DB slow query log + downstream dependency health"
slo:
  availability: "99.9%"
  latency_p95_ms: 200
error_budget_policy: "10m/month burn triggers freeze on non-critical releases"
anti_pattern_watchlist:
  - pattern: missing-timeout
    source: reliability-and-failure-modes.md
    why: All outbound calls must have explicit timeout or AbortSignal; otherwise a slow dependency cascades into thread/connection exhaustion.
  - pattern: ...
  - pattern: ...
```
<!-- SUNCO:SPEC-BLOCK-END -->
```

---

## Step 5: Validate SPEC-BLOCK

Extract the YAML body between the marker comments and validate against the schema:

```bash
OPS_SPEC="${PHASE_DIR}/OPS-SPEC.md"
SCHEMA="packages/cli/schemas/ops-spec.schema.json"

# Extract YAML body
awk '/<!-- SUNCO:SPEC-BLOCK-START -->/,/<!-- SUNCO:SPEC-BLOCK-END -->/' "$OPS_SPEC" \
  | awk '/^```yaml$/,/^```$/' \
  | sed '1d;$d' \
  > /tmp/ops-spec-block.yaml

# Structural check (Phase 40/45 precedent: full ajv validator wired Phase 48+).
# For Phase 46, enforce required-field + minItems + const version + observability sub-structure.
node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  const schema = JSON.parse(fs.readFileSync('$SCHEMA', 'utf8'));
  const body = yaml.parse(fs.readFileSync('/tmp/ops-spec-block.yaml', 'utf8'));

  if (body.version !== 1) {
    console.error('FAIL version must be 1, got', body.version);
    process.exit(1);
  }
  for (const k of schema.required) {
    if (!(k in body)) { console.error('FAIL missing field:', k); process.exit(1); }
  }
  if (typeof body.observability !== 'object' || body.observability === null) {
    console.error('FAIL observability must be object');
    process.exit(1);
  }
  for (const sub of ['logs', 'metrics', 'traces']) {
    if (!(sub in body.observability)) {
      console.error('FAIL observability.' + sub + ' required');
      process.exit(1);
    }
  }
  if (typeof body.slo !== 'object' || body.slo === null) {
    console.error('FAIL slo must be object');
    process.exit(1);
  }
  if (!('availability' in body.slo) || !('latency_p95_ms' in body.slo)) {
    console.error('FAIL slo requires availability + latency_p95_ms');
    process.exit(1);
  }
  if (!Array.isArray(body.anti_pattern_watchlist) || body.anti_pattern_watchlist.length < 3) {
    console.error('FAIL anti_pattern_watchlist needs >= 3 entries, got',
      (body.anti_pattern_watchlist || []).length);
    process.exit(1);
  }
  console.log('✓ SPEC-BLOCK valid: version=1, all required fields, observability has logs/metrics/traces, slo has availability+latency_p95_ms,',
    body.anti_pattern_watchlist.length, 'anti-patterns');
"
```

On failure: surface the error and ask the researcher to revise (re-run Stage 3 only). Do NOT proceed to Step 6 with an invalid SPEC-BLOCK.

Full `ajv` validator wire-up is deferred to Phase 48+ — structural check is sufficient for Phase 46 done-when.

---

## Step 6: Present for Review + Commit

Display summary inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► BACKEND SPEC (ops)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deployment: <topology-shape>  |  M anti-patterns watched  |  version: 1
SLO projection: availability <n-nines>, latency_p95_ms <int> (sourced from BACKEND-CONTEXT)

Phase 42 references consulted (README authority, spec §7 silent):
  observability-and-operations · reliability-and-failure-modes
  (+ secondary: security-and-permissions, migrations-and-compatibility
   — if loaded under budget)

Token usage: ~XXk / 30k ceiling

SPEC-BLOCK: ✓ 5/5 required fields, observability{logs+metrics+traces}, slo{availability+latency_p95_ms}, ≥3 anti-patterns, version=1 (BS1)

Looks good? (yes / adjust [describe change])
```

On "yes":

```bash
git add "${PHASE_DIR}/OPS-SPEC.md"
git commit -m "docs: OPS spec for phase ${PADDED} — K anti-patterns"
```

On "adjust": re-run Step 3 Stage 3 (Write) only with the adjustment hint. Re-run Stage 2 only if the adjustment invalidates the outline.

---

## Success Criteria

- [ ] `.planning/domains/backend/BACKEND-CONTEXT.md` exists at Step 1 (hard-stop otherwise)
- [ ] Backend context read via inline bash; all 5 required sections extracted (Tech stack / runtime optional)
- [ ] `sunco-backend-researcher` agent spawned with `--surface ops` + full phase + backend context
- [ ] 2 required Phase 42 refs loaded in Stage 1 (observability-and-operations, reliability-and-failure-modes)
- [ ] 3-stage research executed; token budget stayed under 30k
- [ ] OPS-SPEC.md written to `${PHASE_DIR}/OPS-SPEC.md`
- [ ] `<!-- spec_version: 1 -->` top-of-file marker present (§12 BS1)
- [ ] SPEC-BLOCK contains all 5 required fields (version + deployment_topology + observability + slo + anti_pattern_watchlist)
- [ ] `observability` contains `logs` + `metrics` + `traces` sub-objects
- [ ] `slo` contains `availability` + `latency_p95_ms` (structural projection, NOT verbatim duplicate of BACKEND-CONTEXT prose)
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

Phase 46 / this workflow MUST NOT:
- Invoke the Phase 43 backend detector (`detect-backend-smells.mjs`) — Phase 47/M3.6 scope
- Wire into `/sunco:backend-review` or any `backend-review-*` workflow (Phase 47 scope)
- Modify `packages/cli/references/backend-excellence/reference/**` (Phase 43 Escalate #5 still active)
- Modify `BACKEND-CONTEXT.md` or its schema (Phase 44 lock)
- Modify `discuss-phase.md` (FRONTEND or BACKEND block)
- Modify `backend-phase-event.md` logic (sibling surface — shared scaffold but authored in parallel)
- Modify Phase 45 `backend-phase-api.md` / `backend-phase-data.md` / `api-spec.schema.json` / `data-spec.schema.json` (Phase 45 locked)
- Activate any `backend-review-*.md` stubs (Phase 47)
- Touch `~/.claude/sunco` runtime files
- Produce or consume `.impeccable.md` (SDI-1 continuation)
- Verbatim-duplicate BACKEND-CONTEXT SLO prose into `slo` field (structural projection only)
- Backfill Phase 40 `ui-spec.schema.json` BS1 version field (registered plan debt)

*Phase 37/M1.3 introduced the stub; Phase 46/M3.5 replaces it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.5.*
