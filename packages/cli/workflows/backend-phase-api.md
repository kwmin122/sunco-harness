# Backend Phase Workflow — API Surface

Generate an API-surface design contract (API-SPEC.md) for a phase that includes backend API work. Loads 4 clean-room Phase 42 backend-excellence references per spec §7 Phase 3.4 (api-design, boundaries-and-architecture, reliability-and-failure-modes, security-and-permissions), spawns the `sunco-backend-researcher` agent with `--surface api` for 3-stage research, then writes API-SPEC.md with a deterministic `<!-- SUNCO:SPEC-BLOCK -->` fenced YAML block that validates against `packages/cli/schemas/api-spec.schema.json`. Used by `/sunco:backend-phase --surface api` (Phase 45/M3.4+).

---

## Overview

Six steps (mirrors Phase 40 ui-phase-web structure):

1. **Require BACKEND-CONTEXT.md** — hard-stop if backend context hasn't been gathered
2. **Read phase context + backend context** — CONTEXT.md + BACKEND-CONTEXT.md (inline bash, no loader module in v1)
3. **Spawn sunco-backend-researcher --surface api** — 3-stage research (ref-load → outline → write), 4 Phase 42 refs, 30k token ceiling
4. **Write API-SPEC.md** — prose sections + `<!-- SUNCO:SPEC-BLOCK -->` YAML (R2)
5. **Validate SPEC-BLOCK** — schema structural check + ≥3 anti-patterns + `version: 1` (BS1)
6. **Present for review + commit**

> This workflow is the **API surface branch** dispatched by `backend-phase.md` (Phase 37 router). Surface selection (`--surface api|data|event|ops`) is handled upstream. Phase 46 activates the event/ops branches; Phase 47 wires `backend-review-*` for SPEC consumption.

---

## Step 1: Require BACKEND-CONTEXT.md

The API surface cannot proceed without gathered backend context. Unlike the frontend DESIGN-CONTEXT.md (which has a 3-question teach at `/sunco:discuss --domain frontend`), BACKEND-CONTEXT.md captures 5 required sections (Phase 44 schema): `Domain`, `Traffic profile`, `Data sensitivity`, `SLO`, `Deployment model`, plus an optional auto-detected `Tech stack / runtime` section.

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
  echo "API contracts cannot be inferred from code — only from stated intent."
  exit 1
fi
```

**Hard stop rule (Phase 44 lock):** This workflow MUST NOT invoke the backend teach mode to gather missing context. The canonical capture path is `/sunco:discuss --domain backend` which writes `.planning/domains/backend/BACKEND-CONTEXT.md`. This workflow is a read-only consumer.

---

## Step 2: Read Phase Context + Backend Context

Locate phase directory:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
```

Read phase CONTEXT (decisions from `/sunco:discuss`):

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

These 5 required sections + 1 optional are passed to the researcher as prose blocks. No structured parsing at this layer — the researcher reads them as plain-text prompt context.

---

## Step 3: Spawn sunco-backend-researcher

Spawn the backend researcher with `--surface api` routing and the spec-required ref subset:

```
Task(
  prompt="
Produce API-SPEC.md for Phase XX — [Phase Name]. Surface: api.

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
    [section]
  ## SLO
    [section]
  ## Deployment model
    [section]
  ## Tech stack / runtime (auto-detected)
    [section — may be 'absent' if Phase 44 teach run yielded no repo match]

Required reference subset (spec §7 Phase 3.4 verbatim — 4 files):
  packages/cli/references/backend-excellence/reference/api-design.md
  packages/cli/references/backend-excellence/reference/boundaries-and-architecture.md
  packages/cli/references/backend-excellence/reference/reliability-and-failure-modes.md
  packages/cli/references/backend-excellence/reference/security-and-permissions.md

Optional secondary refs (README load-strategy — read only if Stage 1 budget permits ≤8k cap):
  packages/cli/references/backend-excellence/reference/performance-and-scale.md
  packages/cli/references/backend-excellence/reference/observability-and-operations.md

Research protocol: 3-stage (ref-load → outline → write).
Token ceiling: 30k total (8k / 4k / 15k per stage + 3k buffer).

Required output: .planning/phases/[N]-*/API-SPEC.md containing:
  - <!-- spec_version: 1 --> top-of-file marker
  - Prose sections: Surface Intent, Endpoints, Error Envelope,
    Versioning Strategy, Auth & Idempotency Model, Rate Limiting,
    Anti-pattern Watchlist
  - <!-- SUNCO:SPEC-BLOCK-START --> fenced ```yaml ... ``` block
    validating against packages/cli/schemas/api-spec.schema.json
  - SPEC-BLOCK required fields: version (const:1), endpoints[],
    error_envelope, versioning_strategy, auth_requirements,
    anti_pattern_watchlist (minItems:3, each citing a Phase 42
    reference file in source:)

Hard guards:
  - MUST NOT invoke Phase 43 detector (detect-backend-smells.mjs).
    Phase 45 is contract authoring only; detector wires in Phase 47.
  - MUST NOT wire into /sunco:backend-review (Phase 47 scope).
  - MUST NOT modify BACKEND-CONTEXT.md (read-only consumer).
  - MUST NOT modify Phase 42 reference/*.md (frozen per Phase 43
    Escalate #5).
  - MUST NOT include endpoint-level SLO fields — SLO lives in
    BACKEND-CONTEXT aggregate + Phase 46 OPS-SPEC.
  ",
  subagent_type="sunco-backend-researcher",
  description="Backend API research for Phase XX"
)
```

The agent handles its own token budgeting per stage. On overrun it drops secondary refs first; REQUIRED refs cannot be dropped.

---

## Step 4: Write API-SPEC.md

The researcher writes `${PHASE_DIR}/API-SPEC.md` directly. The orchestrator does not rewrite the body; it only performs validation in Step 5.

Expected structure (produced by the agent — see `agents/sunco-backend-researcher.md`):

```markdown
<!-- spec_version: 1 -->

# API-SPEC — Phase XX [phase-name]

## Surface Intent
[1 paragraph synthesizing BACKEND-CONTEXT + phase decisions]

## Endpoints
[prose overview — method + path per bullet; full schemas in SPEC-BLOCK]

## Error Envelope
[1 paragraph describing the shared error response shape]

## Versioning Strategy
[url-major / header / none + rationale in 1-2 sentences]

## Auth & Idempotency Model
[prose — bearer vs session vs API key; idempotency key strategy]

## Rate Limiting
[prose — policy or "none enforced at API layer"]

## Anti-pattern Watchlist
[3-7 anti-patterns, each with Phase 42 reference citation + 1-sentence why]

<!-- SUNCO:SPEC-BLOCK-START -->
```yaml
version: 1
endpoints:
  - method: GET
    path: /users/me
    request_schema: ...
    response_schema: ...
    errors: [{code: AUTH_EXPIRED, http: 401}]
    auth: required
    idempotency: idempotent
error_envelope: {code: string, message: string, details: object|null}
versioning_strategy: url-major
auth_requirements: {type: bearer, scopes: [...]}
rate_limiting: {policy: ...}        # optional
anti_pattern_watchlist:
  - pattern: raw-sql-interpolation
    source: security-and-permissions.md
    why: Direct interpolation risks SQL injection; use parameterized queries.
  - pattern: ...
  - pattern: ...
```
<!-- SUNCO:SPEC-BLOCK-END -->
```

---

## Step 5: Validate SPEC-BLOCK

Extract the YAML body between the marker comments and validate against the schema:

```bash
API_SPEC="${PHASE_DIR}/API-SPEC.md"
SCHEMA="packages/cli/schemas/api-spec.schema.json"

# Extract YAML body
awk '/<!-- SUNCO:SPEC-BLOCK-START -->/,/<!-- SUNCO:SPEC-BLOCK-END -->/' "$API_SPEC" \
  | awk '/^```yaml$/,/^```$/' \
  | sed '1d;$d' \
  > /tmp/api-spec-block.yaml

# Structural check (Phase 40 precedent: full ajv validator wired Phase 48+).
# For Phase 45, enforce required-field + minItems + const version.
node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  const schema = JSON.parse(fs.readFileSync('$SCHEMA', 'utf8'));
  const body = yaml.parse(fs.readFileSync('/tmp/api-spec-block.yaml', 'utf8'));

  if (body.version !== 1) {
    console.error('FAIL version must be 1, got', body.version);
    process.exit(1);
  }
  for (const k of schema.required) {
    if (!(k in body)) { console.error('FAIL missing field:', k); process.exit(1); }
  }
  if (!Array.isArray(body.endpoints) || body.endpoints.length < 1) {
    console.error('FAIL endpoints needs >= 1 entry');
    process.exit(1);
  }
  if (!Array.isArray(body.anti_pattern_watchlist) || body.anti_pattern_watchlist.length < 3) {
    console.error('FAIL anti_pattern_watchlist needs >= 3 entries, got',
      (body.anti_pattern_watchlist || []).length);
    process.exit(1);
  }
  console.log('✓ SPEC-BLOCK valid: version=1, all required fields,',
    body.endpoints.length, 'endpoints,',
    body.anti_pattern_watchlist.length, 'anti-patterns');
"
```

On failure: surface the error and ask the researcher to revise (re-run Stage 3 only). Do NOT proceed to Step 6 with an invalid SPEC-BLOCK.

Full `ajv` validator wire-up is deferred to Phase 48+ — the structural check above is sufficient for Phase 45 done-when (Phase 40 precedent).

---

## Step 6: Present for Review + Commit

Display summary inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► BACKEND SPEC (api)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

N endpoints  |  M anti-patterns watched  |  version: 1

Phase 42 references consulted:
  api-design · boundaries-and-architecture ·
  reliability-and-failure-modes · security-and-permissions
  (+ secondary: performance-and-scale, observability-and-operations
   — if loaded under budget)

Token usage: ~XXk / 30k ceiling

SPEC-BLOCK: ✓ 6/6 required fields, ≥3 anti-patterns, version=1 (BS1)

Looks good? (yes / adjust [describe change])
```

On "yes":

```bash
git add "${PHASE_DIR}/API-SPEC.md"
git commit -m "docs: API spec for phase ${PADDED} — N endpoints, K anti-patterns"
```

On "adjust": re-run Step 3 Stage 3 (Write) only with the adjustment hint. Re-run Stage 2 only if the adjustment invalidates the outline.

---

## Success Criteria

- [ ] `.planning/domains/backend/BACKEND-CONTEXT.md` exists at Step 1 (hard-stop otherwise)
- [ ] Backend context read via inline bash; all 5 required sections extracted (Tech stack / runtime optional)
- [ ] `sunco-backend-researcher` agent spawned with `--surface api` + full phase + backend context
- [ ] 4 required Phase 42 refs loaded in Stage 1 (api-design, boundaries, reliability, security)
- [ ] 3-stage research executed; token budget stayed under 30k
- [ ] API-SPEC.md written to `${PHASE_DIR}/API-SPEC.md`
- [ ] `<!-- spec_version: 1 -->` top-of-file marker present (§12 BS1)
- [ ] SPEC-BLOCK contains all 6 required fields (version + endpoints + error_envelope + versioning_strategy + auth_requirements + anti_pattern_watchlist)
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
- Modify `backend-phase-data.md` logic (sibling surface — shared scaffold but authored in parallel, not by this workflow)
- Activate `backend-phase-event.md` or `backend-phase-ops.md` stubs (Phase 46)
- Activate any `backend-review-*.md` stubs (Phase 47)
- Touch `~/.claude/sunco` runtime files
- Produce or consume `.impeccable.md` (SDI-1 continuation)
- Backfill Phase 40 `ui-spec.schema.json` BS1 version field (registered plan debt)

*Phase 37/M1.3 introduced the stub; Phase 45/M3.4 replaces it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.4.*
