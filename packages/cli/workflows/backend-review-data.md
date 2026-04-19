# Backend Review Workflow — Data Surface

Produce Data-surface findings for a phase that has a DATA-SPEC.md authored by Phase 45 (`/sunco:backend-phase --surface data`). Runs the Phase 43 deterministic detector subset (1 rule: non-reversible-migration), spawns the `sunco-backend-reviewer` agent with `--surface data` for heuristic + requires-human-confirmation findings, merges both into a single findings list, and writes them into the `## Data findings` section of `.planning/domains/backend/BACKEND-AUDIT.md` (section-level replace per invocation). Used by `/sunco:backend-review --surface data` (Phase 47/M3.6+).

---

## Overview

Five steps (new behavioral pattern — 5-step, not 6-step; BACKEND-AUDIT.md is a runtime consumer artifact):

1. **Require DATA-SPEC.md** — hard-stop if the Phase 45 surface contract hasn't been authored
2. **Run Phase 43 detector subset** — 1 rule (non-reversible-migration) filtered by rule name, `state: open` injected
3. **Spawn sunco-backend-reviewer --surface data** — 2-stage review (context-load → review-emit), 30k ceiling
4. **Normalize findings** — merge deterministic (Step 2) + heuristic/requires-human-confirmation (Step 3)
5. **Write BACKEND-AUDIT.md** — section-level replace of `## Data findings`; preserve other surface sections

> This workflow is the **Data review branch** dispatched by `backend-review.md` (Phase 37 router). Phase 47 activates all 4 review branches.

---

## Step 1: Require DATA-SPEC.md

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |

Locate phase directory and check for the Phase 45 surface contract:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
DATA_SPEC="${PHASE_DIR}/DATA-SPEC.md"

if [ ! -f "$DATA_SPEC" ]; then
  echo "✗ No DATA-SPEC.md found at $DATA_SPEC"
  echo ""
  echo "Run /sunco:backend-phase ${PHASE_ARG} --surface data first to author:"
  echo "  - Entities + primary keys + field schema"
  echo "  - Migration strategy (expand-contract vs in-place)"
  echo "  - Retention policy + indexing strategy"
  echo "  - Anti-pattern watchlist (≥3 Phase 42 reference citations)"
  echo ""
  echo "Review cannot audit a contract that doesn't exist."
  exit 1
fi

# Structural sanity: spec_version marker present (BS1)
if ! grep -q '<!-- spec_version: 1 -->' "$DATA_SPEC"; then
  echo "✗ DATA-SPEC.md missing <!-- spec_version: 1 --> top-of-file marker"
  echo "  Re-run /sunco:backend-phase ${PHASE_ARG} --surface data to regenerate."
  exit 1
fi
```

**Hard stop rule (Phase 45 lock):** This workflow MUST NOT author a DATA-SPEC.md inline. The canonical author path is `/sunco:backend-phase --surface data`. Read-only consumer.

---

## Step 2: Run Phase 43 Detector (Data Rule Subset)

Invoke the clean-room backend detector against the project root, filter the JSON output to the Data rule subset (1 rule per spec §7 Phase 3.6), and inject `state: open` on every finding.

```bash
DETECTOR="packages/cli/references/backend-excellence/src/detect-backend-smells.mjs"
TARGET="${TARGET:-.}"

DETECTOR_OUT=$(node "$DETECTOR" --json "$TARGET")
DETECTOR_EXIT=$?

if [ "$DETECTOR_EXIT" -eq 1 ]; then
  echo "✗ Backend detector errored. Cannot proceed."
  echo "$DETECTOR_OUT" | head -20
  exit 1
fi

# Filter to Data rule subset (spec §7 Phase 3.6 — 1 rule) and inject state: open.
DATA_FINDINGS=$(echo "$DETECTOR_OUT" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const DATA_RULES = new Set([
    "non-reversible-migration",
  ]);
  const filtered = (data.findings || [])
    .filter(f => DATA_RULES.has(f.rule))
    .map(f => ({ ...f, state: "open" }));
  process.stdout.write(JSON.stringify(filtered, null, 2));
')

echo "Deterministic findings (Data subset, 1 rule): $(echo "$DATA_FINDINGS" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).length)') entries"
```

**Detector lock (Phase 43 §13):** the detector's 7-rule set is frozen. Rule subset enforcement lives here in the workflow's post-process filter. Detector output schema is already aligned with `finding.schema.json`; only `state: "open"` injection is added.

**Data rule rationale:** `non-reversible-migration` is the Phase 43 rule whose code pattern surfaces at the data/schema boundary (DROP COLUMN / DROP TABLE without a rollback counterpart, irreversible `ALTER` within a migration file). The other 6 detector rules target API/Ops surfaces, not data definition.

---

## Step 3: Spawn sunco-backend-reviewer

Spawn the reviewer agent with `--surface data` routing:

```
Task(
  prompt="
Review DATA-SPEC.md for Phase XX — [Phase Name]. Surface: data.

Phase context:
  [paste ${PHASE_DIR}/*-CONTEXT.md content]

Phase goal (from ROADMAP.md):
  [paste phase section]

Surface contract (Phase 45 authored):
  [paste ${PHASE_DIR}/DATA-SPEC.md content — prose sections + SPEC-BLOCK YAML]

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

Deterministic detector findings (Data rule subset, already filtered + state-injected):
  [paste DATA_FINDINGS JSON from Step 2 — possibly empty array]

Required reference subset (Phase 42 README load-strategy primary — 2 files):
  packages/cli/references/backend-excellence/reference/data-modeling.md
  packages/cli/references/backend-excellence/reference/migrations-and-compatibility.md

Optional secondary refs (read only if Stage 1 budget permits ≤8k cap):
  packages/cli/references/backend-excellence/reference/performance-and-scale.md
  packages/cli/references/backend-excellence/reference/reliability-and-failure-modes.md

Review protocol: 2-stage (context-load → review-emit).
Token ceiling: 30k total (8k Stage 1 + 15k Stage 2 + 7k buffer).

Required output: one fenced YAML block with findings: array, per agent spec
(agents/sunco-backend-reviewer.md Output contract). Every finding has:
  kind ∈ {heuristic, requires-human-confirmation}   (NOT deterministic)
  severity ∈ {HIGH, MEDIUM, LOW}                    (NOT FAIL/WARN/PASS)
  state: open                                        (audit_version: 1)

Hard guards (agent spec — enforced):
  - MUST NOT write DATA-SPEC.md or BACKEND-CONTEXT.md (read-only consumer)
  - MUST NOT write BACKEND-AUDIT.md directly (orchestrator writes in Step 5)
  - MUST NOT emit kind: deterministic
  - MUST NOT emit state: resolved or state: dismissed (Phase 49 scope)
  - MUST NOT emit cross-domain findings (Phase 48 scope)
  - MUST NOT emit aggregate summary rollup
  - MUST NOT re-invoke Phase 43 detector
  - MUST NOT modify Phase 42 reference/*.md or detector source
  ",
  subagent_type="sunco-backend-reviewer",
  description="Backend Data review for Phase XX"
)
```

The agent handles its own stage budgeting. On overrun it drops secondary refs first; REQUIRED refs cannot be dropped.

---

## Step 4: Normalize Findings

Merge the Step 2 detector findings (deterministic) with the Step 3 agent findings (heuristic + requires-human-confirmation) into a single list, validated against `finding.schema.json`:

```bash
AGENT_OUT="/tmp/sunco-review-data-agent.yaml"
# ... (orchestrator captures agent stdout to $AGENT_OUT)

MERGED=$(node -e '
  const yaml = require("yaml");
  const fs = require("fs");
  const detector = JSON.parse(process.argv[1]);
  const agentBody = yaml.parse(fs.readFileSync(process.argv[2], "utf8"));
  const agentFindings = (agentBody && agentBody.findings) || [];

  for (const f of agentFindings) {
    if (f.kind === "deterministic") {
      console.error("FAIL agent emitted kind: deterministic (Phase 43 detector exclusive). Reject.");
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

  for (const f of detector) {
    if (f.state !== "open") {
      console.error("FAIL detector finding missing state: open — Step 2 injection failed.");
      process.exit(1);
    }
  }

  process.stdout.write(JSON.stringify([...detector, ...agentFindings], null, 2));
' "$DATA_FINDINGS" "$AGENT_OUT")
```

On validation failure: surface the error and ask the reviewer to revise (re-spawn Step 3). Do NOT proceed to Step 5 with an invalid findings list.

---

## Step 5: Write BACKEND-AUDIT.md (Section-Level Replace)

Write the merged findings into the `## Data findings` section of `.planning/domains/backend/BACKEND-AUDIT.md`. **Section-level replace per invocation** — rewrite only the target surface section; preserve other surface sections byte-for-byte where possible. If the file is absent, create it with the 4-section skeleton and populate only the Data section.

```bash
AUDIT=".planning/domains/backend/BACKEND-AUDIT.md"
mkdir -p "$(dirname "$AUDIT")"

SURFACE_LABEL="Data"
SECTION_HEADER="## ${SURFACE_LABEL} findings"

SPEC_SHA=$(shasum -a 256 "$DATA_SPEC" | awk '{print $1}')
DETECTOR_VERSION="1.0.0"
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RENDERED_SECTION=$(cat <<EOF
${SECTION_HEADER}

<!-- surface_source: {"surface": "data", "spec": "${DATA_SPEC}", "spec_sha": "${SPEC_SHA}", "detector_version": "${DETECTOR_VERSION}", "generated_at": "${GENERATED_AT}"} -->

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
    process.stdout.write(`    source: ${JSON.stringify(f.source || "detector")}\n`);
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

${RENDERED_SECTION}

## Event findings

_Run \`/sunco:backend-review --surface event\` to populate._

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
 SUNCO ► BACKEND REVIEW (data)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detector (Phase 43, 1-rule subset):
  non-reversible-migration
  → N deterministic findings

Reviewer agent (Phase 47, heuristic + requires-human-confirmation):
  → M heuristic findings  |  K requires-human-confirmation findings

BACKEND-AUDIT.md ## Data findings updated (section-level replace).
All findings state: open (audit_version: 1).

Finding-lifecycle transitions (resolved / dismissed) ship in Phase 49/M4.2.
```

---

## Success Criteria

- [ ] `${PHASE_DIR}/DATA-SPEC.md` exists at Step 1 (hard-stop otherwise)
- [ ] `<!-- spec_version: 1 -->` marker present in DATA-SPEC.md
- [ ] Phase 43 detector invoked; exit code ∈ {0, 2}
- [ ] Detector findings filtered to 1-rule Data subset (non-reversible-migration)
- [ ] `state: open` injected on every detector finding
- [ ] `sunco-backend-reviewer` agent spawned with `--surface data` + filtered detector findings + DATA-SPEC + BACKEND-CONTEXT
- [ ] 2 required Phase 42 refs loaded in Stage 1 (data-modeling, migrations-and-compatibility)
- [ ] 2-stage review executed; token budget stayed under 30k
- [ ] Agent output validated: no `kind: deterministic`, no `state: resolved|dismissed`, no FAIL/WARN severities
- [ ] Merged findings list validated against `finding.schema.json`
- [ ] `.planning/domains/backend/BACKEND-AUDIT.md` created (if absent) with 4-section skeleton, OR `## Data findings` section replaced (if present) with other 3 surface sections preserved byte-for-byte
- [ ] `<!-- audit_version: 1 -->` marker present (when file created)
- [ ] `<!-- surface_source: {...} -->` metadata comment on rewritten Data section
- [ ] Phase 42 reference docs unchanged
- [ ] Phase 43 detector source unchanged (CLI-only invocation)
- [ ] DATA-SPEC.md unchanged (read-only consumer)
- [ ] BACKEND-CONTEXT.md unchanged (Phase 44 lock)
- [ ] Vendored Impeccable source unchanged (R5)

---

## Out-of-scope guardrails

Phase 47 / this workflow MUST NOT:

- Author DATA-SPEC.md inline (Phase 45 authorship territory)
- Modify `packages/cli/references/backend-excellence/reference/**`
- Modify `packages/cli/references/backend-excellence/src/detect-backend-smells.mjs` (§13 7-rule lock)
- Add `--rules` or any filter flag to the detector CLI
- Modify `BACKEND-CONTEXT.md` or its schema (Phase 44 lock)
- Modify `discuss-phase.md` FRONTEND/BACKEND blocks
- Modify Phase 45/46 backend-phase-*.md / schemas / sunco-backend-researcher.md (Phase 45/46 locks)
- Activate finding lifecycle transitions (`resolved` / `dismissed`) — Phase 49/M4.2 scope
- Emit cross-surface aggregate or cross-domain findings — Phase 48/M4.1 scope
- Produce or consume CROSS-DOMAIN.md (Phase 48 scope)
- Touch `~/.claude/sunco` runtime files
- Produce `.impeccable.md`
- Backfill Phase 40 `ui-spec.schema.json` BS1 version field
- Activate `backend-review-{api,event,ops}.md` logic (sibling surfaces)

*Phase 37/M1.3 introduced the stub; Phase 47/M3.6 replaces it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.6.*
