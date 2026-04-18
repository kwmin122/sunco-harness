# UI Phase Workflow — Web Surface

Generate a web-surface UI design contract (UI-SPEC.md) for a phase that includes web frontend work. Loads 7 vendored Impeccable references via wrapper (typography, color-and-contrast, spatial-design, motion-design, interaction-design, responsive-design, ux-writing), spawns a sunco-ui-researcher-web agent for 3-stage research, then writes UI-SPEC.md with a deterministic `<!-- SUNCO:SPEC-BLOCK -->` fenced YAML block that validates against `packages/cli/schemas/ui-spec.schema.json`. Used by `/sunco:ui-phase --surface web` (Phase 40/M2.3+).

---

## Overview

Six steps:

1. **Require DESIGN-CONTEXT.md** — hard-stop if frontend design context hasn't been gathered
2. **Read phase context + inject design context** — CONTEXT.md + DESIGN-CONTEXT.md via wrapper
3. **Spawn ui-researcher-web** — 3-stage research (ref-load → outline → write), 7 Impeccable refs, 30k token ceiling
4. **Write UI-SPEC.md** — prose sections + `<!-- SUNCO:SPEC-BLOCK -->` YAML (R2)
5. **Validate SPEC-BLOCK** — schema check + ≥ 3 anti-patterns in watchlist
6. **Present for review + commit**

> This workflow is the **web surface branch** dispatched by `ui-phase.md` (router). Surface selection (`--surface cli|web|native`) is handled upstream; this branch executes the web path only.

---

## Step 1: Require DESIGN-CONTEXT.md

The web surface cannot proceed without gathered design context. Unlike the CLI surface (which can infer from SUNCO defaults), web design is meaningless without audience, use-cases, and brand personality.

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |

Check for the canonical frontend design context:

```bash
CONTEXT_FILE=".planning/domains/frontend/DESIGN-CONTEXT.md"
if [ ! -f "$CONTEXT_FILE" ]; then
  echo "✗ No frontend design context found at $CONTEXT_FILE"
  echo ""
  echo "Run /sunco:discuss ${PHASE_ARG} --domain frontend first to gather:"
  echo "  - Target audience"
  echo "  - Primary use cases"
  echo "  - Brand personality / tone"
  echo ""
  echo "Web UI contracts cannot be inferred from code — only from stated intent."
  exit 1
fi
```

**Hard stop rule (SDI-1):** This workflow MUST NOT invoke Impeccable's `teach` mode to gather missing context. Impeccable teach writes `.impeccable.md` to the project root, which violates SDI-1 (SUNCO never writes `.impeccable.md`). The canonical capture path is `/sunco:discuss --domain frontend` which writes `.planning/domains/frontend/DESIGN-CONTEXT.md`.

---

## Step 2: Read Phase Context + Inject Design Context

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

Load design context via the wrapper (not direct file read — wrapper enforces the contract with Impeccable):

```bash
node packages/cli/references/impeccable/wrapper/context-injector.mjs --load "$PWD"
```

Or from the orchestrator, import directly:

```javascript
import { loadDesignContext } from './packages/cli/references/impeccable/wrapper/context-injector.mjs';
const ctx = loadDesignContext(process.cwd());
// ctx = { source, version, sections: { audience, useCases, brand }, raw_markdown }
```

If `ctx === null` or `ctx.sections === null`, fall back to Step 1 hard-stop (shouldn't happen given Step 1's existence check, but the guard stays in case of mid-flight file removal).

---

## Step 3: Spawn sunco-ui-researcher-web

Spawn the web-specific researcher agent with 3-stage research protocol:

```
Task(
  prompt="
Produce UI-SPEC.md for Phase XX — [Phase Name].

Phase context:
  [paste ${PHASE_DIR}/*-CONTEXT.md content]

Phase goal (from ROADMAP.md):
  [paste phase section]

Injected design context:
  audience: [ctx.sections.audience]
  useCases: [ctx.sections.useCases]
  brand: [ctx.sections.brand]

Raw design context markdown (for citation):
  [ctx.raw_markdown]

Research protocol: 3-stage (ref-load → outline → write).
Reference path: packages/cli/references/impeccable/source/skills/impeccable/reference/
Token ceiling: 30k total.

Required output: .planning/phases/[N]-*/UI-SPEC.md containing:
  - prose sections (audience, aesthetic, layout, components, states, interactions,
    responsive, a11y, motion, copy, anti-pattern watchlist)
  - <!-- SUNCO:SPEC-BLOCK-START --> fenced ```yaml ... ``` block with all 12 fields
  - Anti-pattern watchlist with >= 3 entries, each citing an Impeccable reference

SDI-1 constraint: Do NOT write .impeccable.md. Do NOT invoke Impeccable teach or extract.
Read Impeccable references only (7 files under source/skills/impeccable/reference/).
  ",
  subagent_type="sunco-ui-researcher-web",
  description="Web UI research for Phase XX"
)
```

The agent handles its own token budgeting per stage (Stage 1: ~8k, Stage 2: ~4k, Stage 3: ~15k, total ≈ 27k with 3k buffer).

---

## Step 4: Write UI-SPEC.md

The researcher writes `${PHASE_DIR}/UI-SPEC.md` directly. The orchestrator does not rewrite the body; it only performs validation in Step 5.

Expected structure (produced by the agent — see `agents/sunco-ui-researcher-web.md`):

```markdown
# UI-SPEC — Phase XX [phase-name]

## Audience & Intent
## Aesthetic Direction
## Layout
## Components
## States
## Interactions
## Responsive Behavior
## Accessibility
## Motion
## Copy
## Anti-pattern watchlist

<!-- SUNCO:SPEC-BLOCK-START -->
```yaml
layout: ...
components: [...]
states: [...]
interactions: [...]
a11y: ...
responsive: {...}
motion: ...
copy: ...
anti_pattern_watchlist:
  - pattern: ...
    source: ...
    why: ...
  - pattern: ...
    source: ...
  - pattern: ...
    source: ...
design_system_tokens_used: {...}
endpoints_consumed: [...]
error_states_handled: [...]
```
<!-- SUNCO:SPEC-BLOCK-END -->
```

---

## Step 5: Validate SPEC-BLOCK

Extract the YAML body between the marker comments and validate against the schema:

```bash
UI_SPEC="${PHASE_DIR}/UI-SPEC.md"
SCHEMA="packages/cli/schemas/ui-spec.schema.json"

# Extract YAML body
awk '/<!-- SUNCO:SPEC-BLOCK-START -->/,/<!-- SUNCO:SPEC-BLOCK-END -->/' "$UI_SPEC" \
  | awk '/^```yaml$/,/^```$/' \
  | sed '1d;$d' \
  > /tmp/ui-spec-block.yaml

# Validate (pseudo — actual validator wired in Phase 41+; for Phase 40, structural check only)
node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  const schema = JSON.parse(fs.readFileSync('$SCHEMA', 'utf8'));
  const body = yaml.parse(fs.readFileSync('/tmp/ui-spec-block.yaml', 'utf8'));

  // Required-field check (12 fields)
  for (const k of schema.required) {
    if (!(k in body)) { console.error('FAIL missing field:', k); process.exit(1); }
  }

  // anti_pattern_watchlist length >= 3
  if (!Array.isArray(body.anti_pattern_watchlist) || body.anti_pattern_watchlist.length < 3) {
    console.error('FAIL anti_pattern_watchlist needs >= 3 entries, got',
      (body.anti_pattern_watchlist || []).length);
    process.exit(1);
  }

  console.log('✓ SPEC-BLOCK valid: all 12 fields present,',
    body.anti_pattern_watchlist.length, 'anti-patterns');
"
```

On failure: surface the error and ask the researcher to revise. Do NOT proceed to Step 6 with an invalid SPEC-BLOCK.

---

## Step 6: Present for Review + Commit

Display summary inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► UI SPEC (web)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

N components  |  M states  |  K anti-patterns watched

Impeccable references consulted:
  typography · color-and-contrast · spatial-design · motion-design ·
  interaction-design · responsive-design · ux-writing

Token usage: ~XXk / 30k ceiling

SPEC-BLOCK: ✓ 12/12 fields, ≥3 anti-patterns

Looks good? (yes / adjust [describe change])
```

On "yes":

```bash
git add "${PHASE_DIR}/UI-SPEC.md"
git commit -m "docs: UI spec (web) for phase ${PADDED} — N components, K anti-patterns"
```

On "adjust": re-run Step 3 Stage 3 (Write) only with the adjustment hint. Do not re-run Stage 1 or 2 unless the adjustment invalidates the outline.

---

## Success Criteria

- [ ] `.planning/domains/frontend/DESIGN-CONTEXT.md` exists at Step 1 (hard-stop otherwise)
- [ ] Design context injected via `loadDesignContext()` wrapper (not direct `.impeccable.md` read)
- [ ] `sunco-ui-researcher-web` agent spawned with full phase + design context
- [ ] 3-stage research executed; token budget logged in commit body
- [ ] UI-SPEC.md written to `${PHASE_DIR}/UI-SPEC.md`
- [ ] SPEC-BLOCK contains all 12 required fields
- [ ] `anti_pattern_watchlist` has at least 3 entries, each citing an Impeccable reference
- [ ] Schema validation passes (Step 5)
- [ ] Vendored Impeccable source unchanged (pristine; R5 + Gate 2 G4)
- [ ] No `.impeccable.md` written anywhere (SDI-1)
- [ ] User confirmed before commit

---

## Out-of-scope guardrails

Phase 40 / this workflow MUST NOT:
- Invoke Impeccable `teach` or `extract` modes (write paths)
- Modify `packages/cli/references/impeccable/source/**` (R5 pristine)
- Run `detector-adapter.mjs` against the project source (Phase 41/M2.4 scope)
- Modify `ui-review.md` or other phases' workflows
- Touch `~/.claude/sunco` runtime files (Gate 2 G7)
- Produce or consume `.impeccable.md` (SDI-1)

*Phase 36/M1.2 introduced the stub; Phase 40/M2.3 replaced it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §6 Phase 2.3.*
