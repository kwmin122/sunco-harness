# Cross-Domain Sync Workflow — CROSS-DOMAIN.md Auto-Generation

> **Internal workflow.** No slash command in Phase 48. Invoked by Phase 49 `/sunco:verify` cross-domain gate layer or by `/sunco:backend-review` composition; may also be run manually via `node packages/cli/references/cross-domain/src/extract-spec-block.mjs` with future flags. Phase 48 ships this workflow as an internal library only — public surface lands with Phase 49/M4.2.

Generate `.planning/domains/contracts/CROSS-DOMAIN.md` from `UI-SPEC.md` + `API-SPEC.md` SPEC-BLOCK projection. Deterministic, no-LLM, no-subagent per spec §8 Phase 4.1. Used internally by `/sunco:verify` (Phase 49) and `/sunco:backend-review` (Phase 47) to keep the UI ↔ API contract in lockstep across regenerations.

---

## Hard invariants

This workflow is **pure projection** of declared SPEC.md artifacts. It MUST NOT:

- Spawn any subagent (no `Task(..., subagent_type=...)` anywhere).
- Import an AI SDK (`ai`, `anthropic`, `openai`, `@anthropic-ai/sdk`) or make an HTTP call.
- Modify UI-SPEC.md, API-SPEC.md, DATA-SPEC.md, EVENT-SPEC.md, OPS-SPEC.md, BACKEND-AUDIT.md, BACKEND-CONTEXT.md, UI-REVIEW.md, or IMPECCABLE-AUDIT.md.
- Emit finding-lifecycle tokens (`resolved`, `dismissed`, `audit_version: 2`) in CROSS-DOMAIN.md's generated output — finding lifecycle is Phase 49/M4.2 scope. Presence of any such token in the generated output is a spec violation; halt + re-relay.
- Introduce a new npm dependency. `yaml` is dynamically required at runtime matching Phase 45 `backend-phase-api.md` precedent (install hint on absence); the extractor's `--test` path does not depend on `yaml`.

The spec/agent surface in `packages/cli/agents/` MUST NOT include a `sunco-cross-domain-*` agent for Phase 48. Phase 49 may introduce one when the finding-lifecycle layer is wired.

MUST NOT read or write `.planning/domains/backend/BACKEND-CONTEXT.md` — Phase 44 schema lock; this workflow consumes UI-SPEC + API-SPEC + (optional) DATA/EVENT/OPS-SPEC only. BACKEND-CONTEXT is source-of-truth for Phase 44/45/47 backend domain discussion and is out of scope for cross-domain generation.

---

## Overview

Seven steps, all deterministic:

1. **Resolve required source specs** — apply G4 default (UI + API hard-required) or `required_specs` declaration in the phase's `${PHASE}-CONTEXT.md` as an override (listed specs are hard-stop; unlisted optional specs silent-skip).
2. **Extract SPEC-BLOCK YAML** from each required/optional source via `extract-spec-block.mjs` — returns `{ data, text, sha, sourcePath, kind }` per source.
3. **Project cross-domain fields** via `generateCrossDomain({ ui, api })` — endpoints_consumed, endpoints_defined, error_mappings, type_contracts.
4. **Read BACKEND-AUDIT.md summary-only** (G5) — count open findings per surface × severity via `countOpenFindingsFromAudit`; never mutate the audit file.
5. **Render CROSS-DOMAIN.md** via `renderMarkdown` — preserves hand-authored prologue byte-for-byte; replaces the `SUNCO:CROSS-DOMAIN-BLOCK` + `SUNCO:OPEN-FINDINGS-SUMMARY` regions only.
6. **Structural schema check** — verify the emitted YAML block round-trips through the required-field set in `packages/cli/schemas/cross-domain.schema.json`. Full `ajv` wire-up deferred beyond Phase 48 (matching Phase 45 backend-phase-api.md:271 stance — `ajv` is explicitly not pulled into Phase 48 scope per Gate 48 C2).
7. **Write output** — atomic write to `.planning/domains/contracts/CROSS-DOMAIN.md`. No git commit inside this workflow — the file is a runtime consumer artifact (same classification as BACKEND-AUDIT.md at Phase 47).

---

## Step 1: Resolve required source specs

Source-spec policy per Gate 48 G4 (two-judge convergent):

| Spec path | Default requirement | Override | Missing → |
|---|---|---|---|
| `.planning/domains/frontend/UI-SPEC.md` | **required** | `required_specs` in `${PHASE}-CONTEXT.md` may declare a different set | hard-stop exit 1 |
| `.planning/domains/backend/API-SPEC.md` | **required** | same override | hard-stop exit 1 |
| `.planning/domains/backend/DATA-SPEC.md` | optional | same override | silent skip |
| `.planning/domains/backend/EVENT-SPEC.md` | optional | same override | silent skip |
| `.planning/domains/backend/OPS-SPEC.md` | optional | same override | silent skip |

**Override semantics** (Gate 48 C4): when `${PHASE}-CONTEXT.md` declares a YAML-fenced `required_specs: [...]` list (e.g., in a SPEC-BLOCK-STYLE region or an explicit heading), the listed paths become the hard-stop set and the default (UI + API) no longer auto-applies. The generator runs with whatever specs the phase actually declares required. Unlisted optional specs remain silent-skip. An empty `required_specs: []` runs the generator with no hard-stops — suitable for introspection.

Phase 49 verify-gate is the **enforcement** layer: missing declared `required_specs` at verify time produces a `missing-endpoint` / `spec-not-produced` finding under audit_version:2. Phase 48 only hard-stops generation.

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
CONTEXT_MD="${PHASE_DIR}/${PADDED}-CONTEXT.md"

UI_SPEC=".planning/domains/frontend/UI-SPEC.md"
API_SPEC=".planning/domains/backend/API-SPEC.md"
DATA_SPEC=".planning/domains/backend/DATA-SPEC.md"
EVENT_SPEC=".planning/domains/backend/EVENT-SPEC.md"
OPS_SPEC=".planning/domains/backend/OPS-SPEC.md"
```

Read `required_specs` if declared in CONTEXT.md (tolerant grep for a YAML-ish list; absent → apply defaults):

```bash
REQUIRED_OVERRIDE=$(awk '/^required_specs:/,/^[^ -]/' "$CONTEXT_MD" 2>/dev/null | \
  grep -oE '\.planning/domains/[a-z]+/[A-Z-]+\.md' | sort -u)

if [ -z "$REQUIRED_OVERRIDE" ]; then
  REQUIRED_SET="$UI_SPEC $API_SPEC"
else
  REQUIRED_SET="$REQUIRED_OVERRIDE"
fi

for spec in $REQUIRED_SET; do
  if [ ! -f "$spec" ]; then
    echo "✗ required spec missing: $spec"
    echo "  Source-spec policy: see workflows/cross-domain-sync.md Step 1."
    exit 1
  fi
done
```

---

## Step 2-6: Project + render via the extractor module

All projection + rendering is delegated to `packages/cli/references/cross-domain/src/extract-spec-block.mjs` — a pure-stdlib module that handles marker extraction, SHA-256 of source bytes (Gate 48 C3: content hash, not git SHA; full path in `generated_from.spec`), cross-reference projection, summary-only BACKEND-AUDIT rollup, and markdown rendering that preserves hand-authored regions byte-for-byte.

Runtime invocation (inline node; matches Phase 45 `require('yaml')` precedent — dynamic require, install hint on absence, no new dep introduced in Phase 48):

```bash
OUT=".planning/domains/contracts/CROSS-DOMAIN.md"
mkdir -p .planning/domains/contracts

node --experimental-modules -e "
  import('./packages/cli/references/cross-domain/src/extract-spec-block.mjs').then(async (m) => {
    const fs = await import('node:fs');
    const {
      extractSpecBlock, generateCrossDomain, renderMarkdown, countOpenFindingsFromAudit,
    } = m;
    const ui  = await extractSpecBlock('$UI_SPEC',  'ui');
    const api = await extractSpecBlock('$API_SPEC', 'api');
    const gen = generateCrossDomain({ ui, api });

    let auditMd = '';
    try { auditMd = fs.readFileSync('.planning/domains/backend/BACKEND-AUDIT.md', 'utf8'); } catch {}
    const counts = countOpenFindingsFromAudit(auditMd);

    let prior = null;
    try { prior = fs.readFileSync('$OUT', 'utf8'); } catch {}

    const { content, changed } = renderMarkdown(
      { crossDomainBlock: gen.crossDomainBlock, findingsCounts: counts }, prior);

    // Escalate-trigger guard (Gate 48 C5): no lifecycle tokens may appear in the
    // generated block output. Phase 49 scope; Phase 48 generation must be lifecycle-free.
    const body = content.split('<!-- SUNCO:CROSS-DOMAIN-BLOCK-START -->')[1]
      ?.split('<!-- SUNCO:CROSS-DOMAIN-BLOCK-END -->')[0] ?? '';
    if (/\\b(resolved|dismissed|dismissed-with-rationale|audit_version\\s*:\\s*2)\\b/.test(body)) {
      console.error('FATAL: lifecycle token found in generated CROSS-DOMAIN-BLOCK — Phase 49 scope. Halt + re-relay.');
      process.exit(2);
    }

    fs.writeFileSync('$OUT', content);
    console.log((changed ? '✎ wrote ' : '= no change ') + '$OUT  (' +
      gen.crossDomainBlock.endpoints_consumed.length + ' consumed, ' +
      gen.crossDomainBlock.endpoints_defined.length + ' defined, ' +
      gen.crossDomainBlock.error_mappings.length + ' error_mappings, ' +
      gen.crossDomainBlock.type_contracts.length + ' type_contracts)');
  }).catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
"
```

The extractor validates required fields + `version: 1` for each SPEC-BLOCK (Gate 48 G1 BS1 discipline) and throws with precise diagnostics on marker/fence/schema faults. `yaml` is imported only when the SPEC-BLOCK is not JSON-compatible; projects that author SPEC-BLOCKs as JSON-compatible YAML subset require no additional dep.

DATA-SPEC / EVENT-SPEC / OPS-SPEC are not consumed by the projection at Phase 48 — they are future extension points. When `required_specs` declares them, Step 1's hard-stop catches their absence but the projection itself still runs on UI + API only (the current projection surface). Phase 49 expands this.

---

## Step 6: Structural schema check

After write, re-parse the generated block and confirm required-field coverage. The check mirrors the Phase 45 backend-phase-api.md line 241-266 inline structural validator; `ajv` is explicitly deferred past Phase 48:

```bash
SCHEMA="packages/cli/schemas/cross-domain.schema.json"
node -e "
  const fs = require('node:fs');
  const out = fs.readFileSync('$OUT', 'utf8');
  const body = out.split('<!-- SUNCO:CROSS-DOMAIN-BLOCK-START -->')[1]
    .split('<!-- SUNCO:CROSS-DOMAIN-BLOCK-END -->')[0]
    .replace(/^[\\s\\S]*?\\n\`\`\`yaml\\n/, '')
    .replace(/\\n\`\`\`\\s*$/, '');
  const schema = JSON.parse(fs.readFileSync('$SCHEMA', 'utf8'));
  // Minimal structural re-parse — uses the extractor's own serializer output,
  // which is JSON-compatible by construction.
  const lines = body.split('\\n');
  const required = schema.required;
  for (const k of required) {
    if (!lines.some((l) => l.startsWith(k + ':'))) {
      console.error('FAIL required top-level key missing:', k);
      process.exit(1);
    }
  }
  console.log('✓ cross-domain block has all', required.length, 'required top-level keys');
"
```

---

## Step 7: Done

No git commit inside this workflow. `CROSS-DOMAIN.md` is a runtime consumer artifact generated per phase / per invocation, like `BACKEND-AUDIT.md` (Phase 47) and `UI-REVIEW.md` (Phase 41). Phase 48 ships the schema + workflow + extractor + smoke Section 23; the generated `.md` is not part of Phase 48's commit.

Emit a terse completion banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► CROSS-DOMAIN  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UI-SPEC sha256:  <hash16>…
API-SPEC sha256: <hash16>…

N consumed  |  M defined  |  K error_mappings  |  T type_contracts
BACKEND-AUDIT rollup: <summary or "no audit present">

Output: .planning/domains/contracts/CROSS-DOMAIN.md

Next (Phase 49): /sunco:verify will run the cross-domain-checker layer
                 to emit missing-endpoint / type-drift / error-state-mismatch
                 / orphan-endpoint findings. Phase 48 generates the contract;
                 Phase 49 enforces it.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Completion checklist (for Phase 49 verify wiring)

- [ ] `UI-SPEC.md` + `API-SPEC.md` exist (or `required_specs` override satisfied)
- [ ] `.planning/domains/contracts/CROSS-DOMAIN.md` exists with the latest generated block
- [ ] `<!-- cross_domain_version: 1 -->` top-of-file marker present (BS1 parity with `spec_version: 1` in API-SPEC)
- [ ] `<!-- SUNCO:CROSS-DOMAIN-BLOCK-START -->` / `<!-- SUNCO:CROSS-DOMAIN-BLOCK-END -->` paired markers fence the generated YAML
- [ ] `<!-- SUNCO:OPEN-FINDINGS-SUMMARY-START -->` / `<!-- SUNCO:OPEN-FINDINGS-SUMMARY-END -->` fence the summary-only BACKEND-AUDIT rollup
- [ ] Hand-authored prologue above `SUNCO:CROSS-DOMAIN-BLOCK-START` preserved byte-for-byte across regenerations
- [ ] Generated block contains all 6 schema required fields (version, generated_from, endpoints_consumed, endpoints_defined, error_mappings, type_contracts)
- [ ] `version: 1` in generated block (BS1)
- [ ] `generated_from[].sha` is a SHA-256 of source file bytes (content hash), not a git commit SHA (C3)
- [ ] `generated_from[].spec` is the full repository-relative path, not a basename (C3)
- [ ] No lifecycle tokens (`resolved` / `dismissed` / `audit_version: 2`) in generated block (C5 escalate trigger)

---

*Phase 48/M4.1 internal workflow. Spec: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §8 Phase 4.1. Requirement: IF-14. Two-judge Gate 48 convergent (plan-verifier outgoing Claude GREEN, Codex cross-domain GREEN-CONDITIONAL → 8 conditions absorbed; see 48-CONTEXT.md absorption table). No slash command ships in Phase 48; public wiring lands in Phase 49 verify gate.*
