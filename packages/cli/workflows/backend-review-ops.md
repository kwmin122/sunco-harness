# Backend Review Workflow — Ops Surface

Produce Ops-surface findings for a phase that has an OPS-SPEC.md authored by Phase 46 (`/sunco:backend-phase --surface ops`). Runs the Phase 43 deterministic detector subset (3 rules: missing-timeout, swallowed-catch, logged-secret), spawns the `sunco-backend-reviewer` agent with `--surface ops` for heuristic + requires-human-confirmation findings (including the SLO projection-drift check against BACKEND-CONTEXT `## SLO`, source of truth), merges both into a single findings list, and writes them into the `## Ops findings` section of `.planning/domains/backend/BACKEND-AUDIT.md` (section-level replace per invocation). Used by `/sunco:backend-review --surface ops` (Phase 47/M3.6+).

---

## Overview

Five steps:

1. **Require OPS-SPEC.md** — hard-stop if the Phase 46 surface contract hasn't been authored
2. **Run Phase 43 detector subset** — 3 rules (missing-timeout, swallowed-catch, logged-secret) filtered by rule name, `state: open` injected
3. **Spawn sunco-backend-reviewer --surface ops** — 2-stage review including SLO dual-source drift check (BACKEND-CONTEXT source of truth, OPS-SPEC `slo` is structural projection; drift surfaces as heuristic finding — neither file is overwritten)
4. **Normalize findings** — merge deterministic (Step 2) + heuristic/requires-human-confirmation (Step 3)
5. **Write BACKEND-AUDIT.md** — section-level replace of `## Ops findings`; preserve other surface sections

> This workflow is the **Ops review branch** dispatched by `backend-review.md` (Phase 37 router). Phase 47 activates all 4 review branches.

---

## Step 1: Require OPS-SPEC.md

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |

Locate phase directory and check for the Phase 46 surface contract:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
OPS_SPEC="${PHASE_DIR}/OPS-SPEC.md"

if [ ! -f "$OPS_SPEC" ]; then
  echo "✗ No OPS-SPEC.md found at $OPS_SPEC"
  echo ""
  echo "Run /sunco:backend-phase ${PHASE_ARG} --surface ops first to author:"
  echo "  - Deployment topology + rollout strategy"
  echo "  - Observability (logs + metrics + traces + alerts)"
  echo "  - Runbook pointers + SLO projection + error budget policy"
  echo "  - Anti-pattern watchlist (≥3 Phase 42 reference citations)"
  echo ""
  echo "Review cannot audit a contract that doesn't exist."
  exit 1
fi

# Structural sanity: spec_version marker present (BS1)
if ! grep -q '<!-- spec_version: 1 -->' "$OPS_SPEC"; then
  echo "✗ OPS-SPEC.md missing <!-- spec_version: 1 --> top-of-file marker"
  echo "  Re-run /sunco:backend-phase ${PHASE_ARG} --surface ops to regenerate."
  exit 1
fi

# Also require BACKEND-CONTEXT.md — ops review does an SLO projection-drift check
# against BACKEND-CONTEXT (source of truth). Without it, the check is unreliable.
BACKEND_CTX=".planning/domains/backend/BACKEND-CONTEXT.md"
if [ ! -f "$BACKEND_CTX" ]; then
  echo "✗ BACKEND-CONTEXT.md not found at $BACKEND_CTX"
  echo ""
  echo "Ops review requires BACKEND-CONTEXT as SLO source of truth."
  echo "Run /sunco:discuss ${PHASE_ARG} --domain backend first."
  exit 1
fi
```

**Hard stop rule (Phase 46 lock):** This workflow MUST NOT author an OPS-SPEC.md inline. The canonical author path is `/sunco:backend-phase --surface ops`. Read-only consumer.

**SLO dual-source rule:** BACKEND-CONTEXT `## SLO` is source of truth. OPS-SPEC `slo` is a structural projection. This workflow surfaces drift between them as a heuristic finding; it does NOT overwrite either file. See Step 3 agent prompt for the projection check.

---

## Step 2: Run Phase 43 Detector (Ops Rule Subset)

Invoke the clean-room backend detector against the project root, filter the JSON output to the Ops rule subset (3 rules per spec §7 Phase 3.6), and inject `state: open` on every finding.

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

# Filter to Ops rule subset (spec §7 Phase 3.6 — 3 rules) and inject state: open.
OPS_FINDINGS=$(echo "$DETECTOR_OUT" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const OPS_RULES = new Set([
    "missing-timeout",
    "swallowed-catch",
    "logged-secret",
  ]);
  const filtered = (data.findings || [])
    .filter(f => OPS_RULES.has(f.rule))
    .map(f => ({ ...f, state: "open" }));
  process.stdout.write(JSON.stringify(filtered, null, 2));
')

echo "Deterministic findings (Ops subset, 3 rules): $(echo "$OPS_FINDINGS" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).length)') entries"
```

**Detector lock (Phase 43 §13):** the detector's 7-rule set is frozen. Rule subset enforcement lives here in the workflow's post-process filter. `logged-secret` is shared with the API surface (a single detector finding may legitimately appear in both surfaces' audit sections if it is both an API-surface and Ops-surface concern).

**Ops rule rationale:** `missing-timeout` (outbound HTTP calls without timeout/AbortSignal — availability risk at operational layer), `swallowed-catch` (silent error hiding — observability destruction), `logged-secret` (secret leakage in log statements — operational security).

---

## Step 3: Spawn sunco-backend-reviewer

Spawn the reviewer agent with `--surface ops` routing and the SLO projection-drift check:

```
Task(
  prompt="
Review OPS-SPEC.md for Phase XX — [Phase Name]. Surface: ops.

Phase context:
  [paste ${PHASE_DIR}/*-CONTEXT.md content]

Phase goal (from ROADMAP.md):
  [paste phase section]

Surface contract (Phase 46 authored):
  [paste ${PHASE_DIR}/OPS-SPEC.md content — prose sections + SPEC-BLOCK YAML]

Backend context (Phase 44 — canonical, SLO source of truth):
  ## Domain
    [section]
  ## Traffic profile
    [section — peak QPS informs alert thresholds]
  ## Data sensitivity
    [section]
  ## SLO
    [section — SOURCE OF TRUTH for SLO intent. Project into {availability, latency_p95_ms} form for comparison against OPS-SPEC slo.]
  ## Deployment model
    [section — rollout shape, oncall topology]
  ## Tech stack / runtime (auto-detected)
    [section — may be 'absent']

Deterministic detector findings (Ops rule subset, already filtered + state-injected):
  [paste OPS_FINDINGS JSON from Step 2 — possibly empty array]

Required reference subset (Phase 42 README load-strategy primary — 2 files):
  packages/cli/references/backend-excellence/reference/observability-and-operations.md
  packages/cli/references/backend-excellence/reference/reliability-and-failure-modes.md

Optional secondary refs (read only if Stage 1 budget permits ≤8k cap):
  packages/cli/references/backend-excellence/reference/security-and-permissions.md
  packages/cli/references/backend-excellence/reference/migrations-and-compatibility.md

Review protocol: 2-stage (context-load → review-emit).
Token ceiling: 30k total (8k Stage 1 + 15k Stage 2 + 7k buffer).

SLO dual-source check (ops-specific — mandatory):
  BACKEND-CONTEXT ## SLO is the source of truth for SLO intent. OPS-SPEC slo is
  a structural projection into {availability, latency_p95_ms} form. If the
  projection disagrees with BACKEND-CONTEXT prose (e.g., BACKEND-CONTEXT states
  99.95% availability but OPS-SPEC slo.availability is 99.9%), emit a heuristic
  finding:
    rule: slo-projection-drift
    severity: MEDIUM
    kind: heuristic
    file: '-'
    line: 0
    source: spec-projection
    fix_hint: "Reconcile BACKEND-CONTEXT SLO (source of truth) with OPS-SPEC slo projection; do not overwrite either."
    state: open
  Do NOT modify either file. Surface the discrepancy as a finding and let the
  human operator decide. BACKEND-CONTEXT remains source of truth.

Required output: one fenced YAML block with findings: array. Every finding has:
  kind ∈ {heuristic, requires-human-confirmation}   (NOT deterministic — detector owns that)
  severity ∈ {HIGH, MEDIUM, LOW}                    (NOT FAIL/WARN/PASS)
  state: open                                        (audit_version: 1)

Hard guards (agent spec — enforced):
  - MUST NOT write OPS-SPEC.md or BACKEND-CONTEXT.md (read-only consumer; SLO source of truth protected)
  - MUST NOT write BACKEND-AUDIT.md directly (orchestrator writes in Step 5)
  - MUST NOT emit kind: deterministic (Phase 43 detector exclusive)
  - MUST NOT emit state: resolved or state: dismissed (Phase 49 scope)
  - MUST NOT emit cross-domain findings (Phase 48 scope)
  - MUST NOT emit aggregate summary rollup
  - MUST NOT re-invoke Phase 43 detector
  - MUST NOT modify Phase 42 reference/*.md or detector source
  - MUST NOT overwrite BACKEND-CONTEXT SLO or OPS-SPEC slo when drift is detected — surface as heuristic finding only
  ",
  subagent_type="sunco-backend-reviewer",
  description="Backend Ops review for Phase XX"
)
```

The agent handles its own stage budgeting. On overrun it drops secondary refs first; REQUIRED refs cannot be dropped.

---

## Step 4: Normalize Findings

Merge the Step 2 detector findings (deterministic) with the Step 3 agent findings (heuristic + requires-human-confirmation) into a single list, validated against `finding.schema.json`:

```bash
AGENT_OUT="/tmp/sunco-review-ops-agent.yaml"
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
' "$OPS_FINDINGS" "$AGENT_OUT")
```

On validation failure: surface the error and ask the reviewer to revise (re-spawn Step 3). Do NOT proceed to Step 5 with an invalid findings list.

---

## Step 5: Write BACKEND-AUDIT.md (Section-Level Replace)

Write the merged findings into the `## Ops findings` section of `.planning/domains/backend/BACKEND-AUDIT.md`. **Section-level replace per invocation** — rewrite only the target surface section; preserve other surface sections byte-for-byte where possible. If the file is absent, create it with the 4-section skeleton and populate only the Ops section.

```bash
AUDIT=".planning/domains/backend/BACKEND-AUDIT.md"
mkdir -p "$(dirname "$AUDIT")"

SURFACE_LABEL="Ops"
SECTION_HEADER="## ${SURFACE_LABEL} findings"

SPEC_SHA=$(shasum -a 256 "$OPS_SPEC" | awk '{print $1}')
DETECTOR_VERSION="1.0.0"
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RENDERED_SECTION=$(cat <<EOF
${SECTION_HEADER}

<!-- surface_source: {"surface": "ops", "spec": "${OPS_SPEC}", "spec_sha": "${SPEC_SHA}", "detector_version": "${DETECTOR_VERSION}", "generated_at": "${GENERATED_AT}"} -->

_SLO dual-source discipline (Phase 46 carry): BACKEND-CONTEXT ## SLO is source of truth; OPS-SPEC slo is structural projection. Drift between them surfaces as a heuristic finding (rule: slo-projection-drift) — neither file is overwritten._

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

## Data findings

_Run \`/sunco:backend-review --surface data\` to populate._

## Event findings

_Run \`/sunco:backend-review --surface event\` to populate._

${RENDERED_SECTION}
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
 SUNCO ► BACKEND REVIEW (ops)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detector (Phase 43, 3-rule subset):
  missing-timeout · swallowed-catch · logged-secret
  → N deterministic findings

Reviewer agent (Phase 47, heuristic + requires-human-confirmation):
  SLO projection check: BACKEND-CONTEXT (source of truth) vs OPS-SPEC slo (projection)
  → M heuristic findings  |  K requires-human-confirmation findings

BACKEND-AUDIT.md ## Ops findings updated (section-level replace).
All findings state: open (audit_version: 1).
Neither BACKEND-CONTEXT nor OPS-SPEC is overwritten by this workflow.

Finding-lifecycle transitions (resolved / dismissed) ship in Phase 49/M4.2.
```

---

## Success Criteria

- [ ] `${PHASE_DIR}/OPS-SPEC.md` exists at Step 1 (hard-stop otherwise)
- [ ] `<!-- spec_version: 1 -->` marker present in OPS-SPEC.md
- [ ] `.planning/domains/backend/BACKEND-CONTEXT.md` exists at Step 1 (SLO source of truth — hard-stop otherwise)
- [ ] Phase 43 detector invoked with `--json` against project root; exit code ∈ {0, 2}
- [ ] Detector findings filtered to 3-rule Ops subset (missing-timeout, swallowed-catch, logged-secret)
- [ ] `state: open` injected on every detector finding (workflow post-process)
- [ ] `sunco-backend-reviewer` agent spawned with `--surface ops` + filtered detector findings + OPS-SPEC + BACKEND-CONTEXT
- [ ] 2 required Phase 42 refs loaded in Stage 1 (observability-and-operations, reliability-and-failure-modes)
- [ ] 2-stage review executed; token budget stayed under 30k
- [ ] SLO projection-drift check performed by agent (BACKEND-CONTEXT ## SLO prose vs OPS-SPEC `slo` structured)
- [ ] Agent output validated: no `kind: deterministic`, no `state: resolved|dismissed`, no FAIL/WARN severities
- [ ] Merged findings list validated against `finding.schema.json`
- [ ] `.planning/domains/backend/BACKEND-AUDIT.md` created (if absent) with 4-section skeleton, OR `## Ops findings` section replaced (if present) with other 3 surface sections preserved byte-for-byte
- [ ] `<!-- audit_version: 1 -->` marker present (when file created)
- [ ] `<!-- surface_source: {...} -->` metadata comment on rewritten Ops section
- [ ] Phase 42 reference docs unchanged
- [ ] Phase 43 detector source unchanged (CLI-only invocation)
- [ ] OPS-SPEC.md unchanged (read-only consumer)
- [ ] BACKEND-CONTEXT.md unchanged (Phase 44 lock + SLO source of truth)
- [ ] Vendored Impeccable source unchanged (R5)
- [ ] If SLO projection drift was detected: surfaced as heuristic finding (rule: slo-projection-drift), NOT written into either file

---

## Out-of-scope guardrails

Phase 47 / this workflow MUST NOT:

- Author OPS-SPEC.md inline (Phase 46 authorship territory)
- Modify `packages/cli/references/backend-excellence/reference/**`
- Modify `packages/cli/references/backend-excellence/src/detect-backend-smells.mjs` (§13 7-rule lock)
- Add `--rules` or any filter flag to the detector CLI
- Modify `BACKEND-CONTEXT.md` or its schema (Phase 44 lock + SLO source of truth)
- Overwrite BACKEND-CONTEXT `## SLO` or OPS-SPEC `slo` when drift is detected — surface as heuristic finding only
- Modify `discuss-phase.md` FRONTEND/BACKEND blocks
- Modify Phase 45/46 backend-phase-*.md / schemas / sunco-backend-researcher.md (Phase 45/46 locks)
- Activate finding lifecycle transitions (`resolved` / `dismissed`) — Phase 49/M4.2 scope
- Emit cross-surface aggregate or cross-domain findings — Phase 48/M4.1 scope
- Produce or consume CROSS-DOMAIN.md (Phase 48 scope)
- Touch `~/.claude/sunco` runtime files
- Produce `.impeccable.md`
- Backfill Phase 40 `ui-spec.schema.json` BS1 version field
- Activate `backend-review-{api,data,event}.md` logic (sibling surfaces)

*Phase 37/M1.3 introduced the stub; Phase 47/M3.6 replaces it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.6.*
