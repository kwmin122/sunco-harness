# Backend Review Workflow — Event Surface

Produce Event-surface findings for a phase that has an EVENT-SPEC.md authored by Phase 46 (`/sunco:backend-phase --surface event`). **Skips the Phase 43 deterministic detector entirely — spec §7 Phase 3.6 declares "no deterministic rules v1 — pure review"** — and spawns the `sunco-backend-reviewer` agent with `--surface event` for heuristic + requires-human-confirmation findings only. Writes them into the `## Event findings` section of `.planning/domains/backend/BACKEND-AUDIT.md` (section-level replace per invocation). Used by `/sunco:backend-review --surface event` (Phase 47/M3.6+).

---

## Overview

Five steps (event-specific — Step 2 is an explicit SKIP marker, not a detector invocation):

1. **Require EVENT-SPEC.md** — hard-stop if the Phase 46 surface contract hasn't been authored
2. **Detector step SKIPPED** — spec §7 Phase 3.6: "event: (no deterministic rules v1 — pure review)". Deterministic findings list is the empty array.
3. **Spawn sunco-backend-reviewer --surface event** — 2-stage review (context-load → review-emit), 30k ceiling
4. **Normalize findings** — agent findings only (deterministic list is empty by spec)
5. **Write BACKEND-AUDIT.md** — section-level replace of `## Event findings`; preserve other surface sections

> This workflow is the **Event review branch** dispatched by `backend-review.md` (Phase 37 router). Phase 47 activates all 4 review branches.

---

## Step 1: Require EVENT-SPEC.md

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |

Locate phase directory and check for the Phase 46 surface contract:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
EVENT_SPEC="${PHASE_DIR}/EVENT-SPEC.md"

if [ ! -f "$EVENT_SPEC" ]; then
  echo "✗ No EVENT-SPEC.md found at $EVENT_SPEC"
  echo ""
  echo "Run /sunco:backend-phase ${PHASE_ARG} --surface event first to author:"
  echo "  - Events inventory (name + producer + consumers)"
  echo "  - Ordering & delivery semantics (enum per event family)"
  echo "  - Idempotency keys + Dead-letter strategy"
  echo "  - Anti-pattern watchlist (≥3 Phase 42 reference citations)"
  echo ""
  echo "Review cannot audit a contract that doesn't exist."
  exit 1
fi

# Structural sanity: spec_version marker present (BS1)
if ! grep -q '<!-- spec_version: 1 -->' "$EVENT_SPEC"; then
  echo "✗ EVENT-SPEC.md missing <!-- spec_version: 1 --> top-of-file marker"
  echo "  Re-run /sunco:backend-phase ${PHASE_ARG} --surface event to regenerate."
  exit 1
fi
```

**Hard stop rule (Phase 46 lock):** This workflow MUST NOT author an EVENT-SPEC.md inline. The canonical author path is `/sunco:backend-phase --surface event`. Read-only consumer.

---

## Step 2: Detector SKIPPED (Pure Review)

**Spec §7 Phase 3.6 verbatim:** "event: (no deterministic rules v1 — pure review)". The Phase 43 detector is **NOT invoked** for the event surface in v1. None of the 7 detector rules (raw-sql-interpolation, missing-timeout, swallowed-catch, any-typed-body, missing-validation-public-route, non-reversible-migration, logged-secret) target eventing patterns — event surface concerns (ordering, delivery, idempotency, DLQ) are fundamentally heuristic and require human-confirmation context that a deterministic AST walk cannot provide.

The deterministic findings list for this surface is the empty array, handed to the reviewer agent unchanged. Future event-surface detector rules (if any) would require a Phase 43 §13 revisit + Gate re-justification; that is out of Phase 47 scope.

```bash
# Explicit SKIP marker — no detector invocation. The merged findings list
# for this surface consists entirely of sunco-backend-reviewer agent output.
EVENT_FINDINGS="[]"

echo "Event surface: deterministic detector SKIPPED (spec §7 Phase 3.6 — pure review)"
echo "Deterministic findings: 0 entries (by spec)"
```

**Detector lock (Phase 43 §13):** no `--rules` flag on the detector CLI, no rule-set modification. The event surface's detector-less posture is a spec decision, not a workflow hack.

---

## Step 3: Spawn sunco-backend-reviewer

Spawn the reviewer agent with `--surface event` routing and an empty deterministic findings list:

```
Task(
  prompt="
Review EVENT-SPEC.md for Phase XX — [Phase Name]. Surface: event.

Phase context:
  [paste ${PHASE_DIR}/*-CONTEXT.md content]

Phase goal (from ROADMAP.md):
  [paste phase section]

Surface contract (Phase 46 authored):
  [paste ${PHASE_DIR}/EVENT-SPEC.md content — prose sections + SPEC-BLOCK YAML]

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
    [section — may be 'absent']

Deterministic detector findings: []
  (Empty by spec §7 Phase 3.6 — event surface has no deterministic rules in v1.
   Your output comprises 100% of the Event findings section. Use heuristic +
   requires-human-confirmation kinds only.)

Required reference subset (Phase 42 README load-strategy primary — 2 files):
  packages/cli/references/backend-excellence/reference/reliability-and-failure-modes.md
  packages/cli/references/backend-excellence/reference/boundaries-and-architecture.md

Optional secondary refs (read only if Stage 1 budget permits ≤8k cap):
  packages/cli/references/backend-excellence/reference/performance-and-scale.md
  packages/cli/references/backend-excellence/reference/observability-and-operations.md

Review protocol: 2-stage (context-load → review-emit).
Token ceiling: 30k total (8k Stage 1 + 15k Stage 2 + 7k buffer).

Required output: one fenced YAML block with findings: array. Every finding has:
  kind ∈ {heuristic, requires-human-confirmation}   (deterministic is forbidden — spec silent for event)
  severity ∈ {HIGH, MEDIUM, LOW}                    (NOT FAIL/WARN/PASS)
  state: open                                        (audit_version: 1)

Event-specific review focus:
  - Ordering ↔ delivery_guarantee pairing sanity (strict ordering + at-most-once
    is rare; flag as heuristic if found)
  - DLQ strategy presence for every event family (multi-region Deployment model
    without DLQ = HIGH heuristic)
  - Idempotency key provenance (TTL, retry window, key source — MED heuristic
    if absent)
  - Producer ↔ consumer coherence (every event has at least one consumer
    declared; orphan producers = LOW)

Hard guards (agent spec — enforced):
  - MUST NOT write EVENT-SPEC.md or BACKEND-CONTEXT.md (read-only consumer)
  - MUST NOT write BACKEND-AUDIT.md directly (orchestrator writes in Step 5)
  - MUST NOT emit kind: deterministic (event surface has no deterministic rules v1)
  - MUST NOT emit state: resolved or state: dismissed (Phase 49 scope)
  - MUST NOT emit cross-domain findings (Phase 48 scope)
  - MUST NOT emit aggregate summary rollup
  - MUST NOT invoke Phase 43 detector (spec §7 — event is detector-less v1)
  - MUST NOT modify Phase 42 reference/*.md or detector source
  ",
  subagent_type="sunco-backend-reviewer",
  description="Backend Event review for Phase XX"
)
```

The agent handles its own stage budgeting. On overrun it drops secondary refs first; REQUIRED refs cannot be dropped.

---

## Step 4: Normalize Findings

Event surface has an empty deterministic findings list. Validate the agent's output against `finding.schema.json`; no detector merge needed:

```bash
AGENT_OUT="/tmp/sunco-review-event-agent.yaml"
# ... (orchestrator captures agent stdout to $AGENT_OUT)

MERGED=$(node -e '
  const yaml = require("yaml");
  const fs = require("fs");
  const agentBody = yaml.parse(fs.readFileSync(process.argv[1], "utf8"));
  const agentFindings = (agentBody && agentBody.findings) || [];

  for (const f of agentFindings) {
    if (f.kind === "deterministic") {
      console.error("FAIL agent emitted kind: deterministic (event surface has no deterministic rules v1). Reject.");
      process.exit(1);
    }
    if (f.state !== "open") {
      console.error("FAIL agent emitted state != open. Got:", f.state);
      process.exit(1);
    }
    if (!["HIGH", "MEDIUM", "LOW"].includes(f.severity)) {
      console.error("FAIL agent emitted invalid severity. Got:", f.severity);
      process.exit(1);
    }
  }

  process.stdout.write(JSON.stringify(agentFindings, null, 2));
' "$AGENT_OUT")
```

On validation failure: surface the error and ask the reviewer to revise (re-spawn Step 3). Do NOT proceed to Step 5 with an invalid findings list.

---

## Step 5: Write BACKEND-AUDIT.md (Section-Level Replace)

Write the agent's findings into the `## Event findings` section of `.planning/domains/backend/BACKEND-AUDIT.md`. **Section-level replace per invocation** — rewrite only the target surface section; preserve other surface sections byte-for-byte where possible. If the file is absent, create it with the 4-section skeleton and populate only the Event section.

```bash
AUDIT=".planning/domains/backend/BACKEND-AUDIT.md"
mkdir -p "$(dirname "$AUDIT")"

SURFACE_LABEL="Event"
SECTION_HEADER="## ${SURFACE_LABEL} findings"

SPEC_SHA=$(shasum -a 256 "$EVENT_SPEC" | awk '{print $1}')
DETECTOR_VERSION="skipped (spec §7 Phase 3.6: no deterministic rules v1)"
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RENDERED_SECTION=$(cat <<EOF
${SECTION_HEADER}

<!-- surface_source: {"surface": "event", "spec": "${EVENT_SPEC}", "spec_sha": "${SPEC_SHA}", "detector_version": "${DETECTOR_VERSION}", "generated_at": "${GENERATED_AT}"} -->

_Event surface has no deterministic detector rules in v1 (spec §7 Phase 3.6 — pure review). All findings below are heuristic or require human confirmation._

\`\`\`yaml
findings:
$(echo "$MERGED" | node -e '
  const list = JSON.parse(require("fs").readFileSync(0, "utf8"));
  for (const f of list) {
    process.stdout.write(`  - rule: ${f.rule}\n`);
    process.stdout.write(`    severity: ${f.severity}\n`);
    process.stdout.write(`    kind: ${f.kind}\n`);
    process.stdout.write(`    file: ${JSON.stringify(f.file)}\n`);
    process.stdout.write(`    line: ${f.line || 0}\n`);
    if (f.column != null) process.stdout.write(`    column: ${f.column}\n`);
    if (f.match) process.stdout.write(`    match: ${JSON.stringify(f.match)}\n`);
    if (f.fix_hint) process.stdout.write(`    fix_hint: ${JSON.stringify(f.fix_hint)}\n`);
    process.stdout.write(`    source: ${JSON.stringify(f.source || "spec-projection")}\n`);
    process.stdout.write(`    state: ${f.state}\n`);
  }
  if (list.length === 0) process.stdout.write("  []  # no findings this run\n");
')
\`\`\`
EOF
)

if [ ! -f "$AUDIT" ]; then
  cat > "$AUDIT" <<EOF
<!-- audit_version: 1 -->

# BACKEND-AUDIT — Phase ${PADDED}

_This audit is generated by \`/sunco:backend-review --surface <s>\`. Each surface section is replaced on its own invocation; other sections are preserved byte-for-byte. Finding lifecycle (\`resolved\` / \`dismissed\`) is Phase 49/M4.2 scope; at audit_version: 1 the only valid \`state\` value is \`open\`._

## API findings

_Run \`/sunco:backend-review --surface api\` to populate._

## Data findings

_Run \`/sunco:backend-review --surface data\` to populate._

${RENDERED_SECTION}

## Ops findings

_Run \`/sunco:backend-review --surface ops\` to populate._
EOF
else
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const header = process.argv[2];
    const newBody = process.argv[3];
    const content = fs.readFileSync(path, "utf8");
    const lines = content.split("\n");
    const headerIdx = lines.findIndex(l => l.trim() === header);
    if (headerIdx < 0) {
      fs.writeFileSync(path, content.trimEnd() + "\n\n" + newBody + "\n");
      return;
    }
    let nextIdx = lines.length;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith("## ") && !lines[i].startsWith("## " + header.slice(3))) {
        nextIdx = i;
        break;
      }
    }
    const before = lines.slice(0, headerIdx).join("\n");
    const after = lines.slice(nextIdx).join("\n");
    const merged = (before ? before + "\n" : "") + newBody + (after ? "\n" + after : "\n");
    fs.writeFileSync(path, merged);
  ' "$AUDIT" "$SECTION_HEADER" "$RENDERED_SECTION"
fi

echo "✓ BACKEND-AUDIT.md ${SECTION_HEADER} written ($(echo "$MERGED" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).length)') findings)"
```

**Write strategy:** section-level replace per invocation. If `BACKEND-AUDIT.md` exists, rewrite only the target surface section and preserve the other surface sections byte-for-byte where possible. If absent, create the file with all four section headers and populate the target section.

**No commit in this workflow.** BACKEND-AUDIT.md is a runtime consumer artifact.

---

## Display Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► BACKEND REVIEW (event)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detector: SKIPPED (spec §7 Phase 3.6 — no deterministic rules v1)

Reviewer agent (Phase 47, heuristic + requires-human-confirmation):
  → M heuristic findings  |  K requires-human-confirmation findings

BACKEND-AUDIT.md ## Event findings updated (section-level replace).
All findings state: open (audit_version: 1).

Finding-lifecycle transitions (resolved / dismissed) ship in Phase 49/M4.2.
```

---

## Success Criteria

- [ ] `${PHASE_DIR}/EVENT-SPEC.md` exists at Step 1 (hard-stop otherwise)
- [ ] `<!-- spec_version: 1 -->` marker present in EVENT-SPEC.md
- [ ] Phase 43 detector **NOT invoked** (spec §7 — event is detector-less v1)
- [ ] Empty deterministic findings list (`[]`) handed to reviewer agent
- [ ] `sunco-backend-reviewer` agent spawned with `--surface event` + empty detector list + EVENT-SPEC + BACKEND-CONTEXT
- [ ] 2 required Phase 42 refs loaded in Stage 1 (reliability-and-failure-modes, boundaries-and-architecture)
- [ ] 2-stage review executed; token budget stayed under 30k
- [ ] Agent output validated: no `kind: deterministic`, no `state: resolved|dismissed`, no FAIL/WARN severities
- [ ] Findings list validated against `finding.schema.json`
- [ ] `.planning/domains/backend/BACKEND-AUDIT.md` created (if absent) with 4-section skeleton, OR `## Event findings` section replaced (if present) with other 3 surface sections preserved byte-for-byte
- [ ] `<!-- audit_version: 1 -->` marker present (when file created)
- [ ] `<!-- surface_source: {...} -->` metadata comment with `detector_version: "skipped (spec §7 ...)"`
- [ ] Phase 42 reference docs unchanged
- [ ] Phase 43 detector source unchanged (NOT invoked)
- [ ] EVENT-SPEC.md unchanged (read-only consumer)
- [ ] BACKEND-CONTEXT.md unchanged (Phase 44 lock)
- [ ] Vendored Impeccable source unchanged (R5)

---

## Out-of-scope guardrails

Phase 47 / this workflow MUST NOT:

- Author EVENT-SPEC.md inline (Phase 46 authorship territory)
- Invoke the Phase 43 detector for the event surface (spec §7 — detector-less v1)
- Add event-surface rules to the Phase 43 detector (§13 7-rule lock; new rules require Gate re-justification)
- Modify `packages/cli/references/backend-excellence/reference/**`
- Modify `packages/cli/references/backend-excellence/src/detect-backend-smells.mjs`
- Modify `BACKEND-CONTEXT.md` or its schema (Phase 44 lock)
- Modify `discuss-phase.md` FRONTEND/BACKEND blocks
- Modify Phase 45/46 backend-phase-*.md / schemas / sunco-backend-researcher.md (Phase 45/46 locks)
- Activate finding lifecycle transitions (`resolved` / `dismissed`) — Phase 49/M4.2 scope
- Emit cross-surface aggregate or cross-domain findings — Phase 48/M4.1 scope
- Produce or consume CROSS-DOMAIN.md (Phase 48 scope)
- Touch `~/.claude/sunco` runtime files
- Produce `.impeccable.md`
- Backfill Phase 40 `ui-spec.schema.json` BS1 version field
- Activate `backend-review-{api,data,ops}.md` logic (sibling surfaces)

*Phase 37/M1.3 introduced the stub; Phase 47/M3.6 replaces it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.6.*
