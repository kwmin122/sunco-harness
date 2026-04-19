# Backend Review Workflow — API Surface

Produce API-surface findings for a phase that has an API-SPEC.md authored by Phase 45 (`/sunco:backend-phase --surface api`). Runs the Phase 43 deterministic detector subset (4 rules: raw-sql-interpolation, any-typed-body, missing-validation-public-route, logged-secret), spawns the `sunco-backend-reviewer` agent with `--surface api` for heuristic + requires-human-confirmation findings, merges both into a single findings list, and writes them into the `## API findings` section of `.planning/domains/backend/BACKEND-AUDIT.md` (section-level replace per invocation). Used by `/sunco:backend-review --surface api` (Phase 47/M3.6+).

---

## Overview

Five steps (new behavioral pattern — 5-step, not 6-step; no commit step because BACKEND-AUDIT.md is a runtime consumer artifact not committed inside the workflow):

1. **Require API-SPEC.md** — hard-stop if the Phase 45 surface contract hasn't been authored
2. **Run Phase 43 detector subset** — 4 rules filtered by rule name, `state: open` injected
3. **Spawn sunco-backend-reviewer --surface api** — 2-stage review (context-load → review-emit), 30k ceiling
4. **Normalize findings** — merge deterministic (Step 2) + heuristic/requires-human-confirmation (Step 3) into a single list
5. **Write BACKEND-AUDIT.md** — section-level replace of `## API findings`; preserve other surface sections byte-for-byte; create file with 4-section skeleton if absent

> This workflow is the **API review branch** dispatched by `backend-review.md` (Phase 37 router). Surface selection (`--surface api|data|event|ops`) is handled upstream. Phase 47 activates all 4 review branches; Phase 48 adds CROSS-DOMAIN.md generation consuming this audit output.

---

## Step 1: Require API-SPEC.md

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |

Locate phase directory and check for the Phase 45 surface contract:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
API_SPEC="${PHASE_DIR}/API-SPEC.md"

if [ ! -f "$API_SPEC" ]; then
  echo "✗ No API-SPEC.md found at $API_SPEC"
  echo ""
  echo "Run /sunco:backend-phase ${PHASE_ARG} --surface api first to author:"
  echo "  - Endpoints inventory + method/path"
  echo "  - Error envelope + versioning + auth + idempotency"
  echo "  - Anti-pattern watchlist (≥3 Phase 42 reference citations)"
  echo ""
  echo "Review cannot audit a contract that doesn't exist."
  exit 1
fi

# Structural sanity: spec_version marker present (BS1)
if ! grep -q '<!-- spec_version: 1 -->' "$API_SPEC"; then
  echo "✗ API-SPEC.md missing <!-- spec_version: 1 --> top-of-file marker"
  echo "  Re-run /sunco:backend-phase ${PHASE_ARG} --surface api to regenerate."
  exit 1
fi
```

**Hard stop rule (Phase 45 lock):** This workflow MUST NOT author an API-SPEC.md inline. The canonical author path is `/sunco:backend-phase --surface api` (Phase 45 behavioral workflow). This workflow is a read-only consumer of the surface contract.

---

## Step 2: Run Phase 43 Detector (API Rule Subset)

Invoke the clean-room backend detector against the project root, filter the JSON output to the API rule subset (4 rules per spec §7 Phase 3.6), and inject `state: open` on every finding.

```bash
DETECTOR="packages/cli/references/backend-excellence/src/detect-backend-smells.mjs"
TARGET="${TARGET:-.}"   # default: project root; detector's internal SKIP_DIRS handles exclusions

# Run detector. Exit codes: 0 (clean) / 2 (findings present) / 1 (error).
# Both 0 and 2 are normal; only 1 is a hard-stop.
DETECTOR_OUT=$(node "$DETECTOR" --json "$TARGET")
DETECTOR_EXIT=$?

if [ "$DETECTOR_EXIT" -eq 1 ]; then
  echo "✗ Backend detector errored. Cannot proceed."
  echo "$DETECTOR_OUT" | head -20
  exit 1
fi

# Filter to API rule subset (spec §7 Phase 3.6 verbatim — 4 rules) and inject state: open.
API_FINDINGS=$(echo "$DETECTOR_OUT" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const API_RULES = new Set([
    "raw-sql-interpolation",
    "any-typed-body",
    "missing-validation-public-route",
    "logged-secret",
  ]);
  const filtered = (data.findings || [])
    .filter(f => API_RULES.has(f.rule))
    .map(f => ({ ...f, state: "open" }));
  process.stdout.write(JSON.stringify(filtered, null, 2));
')

echo "Deterministic findings (API subset, 4 rules): $(echo "$API_FINDINGS" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).length)') entries"
```

**Detector lock (Phase 43 §13):** the detector's 7-rule set is frozen. Do NOT add `--rules` flags to the detector CLI. Rule subset enforcement lives here in the workflow's post-process filter. Detector output schema (`{rule, severity, kind: "deterministic", file, line, column, match, fix_hint}`) is already aligned with `packages/cli/schemas/finding.schema.json` — the only mutation is `state: "open"` injection.

**API rule rationale:** `raw-sql-interpolation` + `any-typed-body` + `missing-validation-public-route` + `logged-secret` are the Phase 43 rules whose code patterns surface at the API boundary (SQL-building in handlers, typed-body enforcement on public routes, validator call presence on public routes, and secret leakage in log statements that public handlers commonly touch).

---

## Step 3: Spawn sunco-backend-reviewer

Spawn the reviewer agent with `--surface api` routing, the filtered detector findings, and the surface contract + backend context:

```
Task(
  prompt="
Review API-SPEC.md for Phase XX — [Phase Name]. Surface: api.

Phase context:
  [paste ${PHASE_DIR}/*-CONTEXT.md content]

Phase goal (from ROADMAP.md):
  [paste phase section]

Surface contract (Phase 45 authored):
  [paste ${PHASE_DIR}/API-SPEC.md content — prose sections + SPEC-BLOCK YAML]

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
    [section — may be 'absent' if Phase 44 teach yielded no repo match]

Deterministic detector findings (API rule subset, already filtered + state-injected):
  [paste API_FINDINGS JSON from Step 2 — possibly empty array]

Required reference subset (Phase 42 README load-strategy primary — 4 files):
  packages/cli/references/backend-excellence/reference/api-design.md
  packages/cli/references/backend-excellence/reference/boundaries-and-architecture.md
  packages/cli/references/backend-excellence/reference/reliability-and-failure-modes.md
  packages/cli/references/backend-excellence/reference/security-and-permissions.md

Optional secondary refs (read only if Stage 1 budget permits ≤8k cap):
  packages/cli/references/backend-excellence/reference/performance-and-scale.md
  packages/cli/references/backend-excellence/reference/observability-and-operations.md

Review protocol: 2-stage (context-load → review-emit).
Token ceiling: 30k total (8k Stage 1 + 15k Stage 2 + 7k buffer).

Required output: one fenced YAML block with findings: array, per agent spec
(agents/sunco-backend-reviewer.md Output contract). Every finding has:
  kind ∈ {heuristic, requires-human-confirmation}   (NOT deterministic — detector owns that)
  severity ∈ {HIGH, MEDIUM, LOW}                    (NOT FAIL/WARN/PASS — R6)
  state: open                                        (audit_version: 1 enum single-value)

Hard guards (agent spec — enforced):
  - MUST NOT write API-SPEC.md or BACKEND-CONTEXT.md (read-only consumer)
  - MUST NOT write BACKEND-AUDIT.md directly (orchestrator writes in Step 5)
  - MUST NOT emit kind: deterministic (Phase 43 detector exclusive)
  - MUST NOT emit state: resolved or state: dismissed (Phase 49/M4.2 scope)
  - MUST NOT emit cross-domain findings (UI↔API — Phase 48/M4.1 scope)
  - MUST NOT emit aggregate summary rollup (cross-surface tally — Phase 48 scope)
  - MUST NOT re-invoke Phase 43 detector (orchestrator Step 2 exclusive)
  - MUST NOT modify Phase 42 reference/*.md or Phase 43 detector source
  ",
  subagent_type="sunco-backend-reviewer",
  description="Backend API review for Phase XX"
)
```

The agent handles its own stage budgeting. On overrun it drops secondary refs first; REQUIRED refs cannot be dropped.

---

## Step 4: Normalize Findings

Merge the Step 2 detector findings (deterministic) with the Step 3 agent findings (heuristic + requires-human-confirmation) into a single list, validated against `finding.schema.json`:

```bash
# Extract agent YAML block output (the task result)
AGENT_OUT="/tmp/sunco-review-api-agent.yaml"
# ... (orchestrator captures agent stdout to $AGENT_OUT)

MERGED=$(node -e '
  const yaml = require("yaml");
  const fs = require("fs");
  const detector = JSON.parse(process.argv[1]);         // Step 2 API_FINDINGS
  const agentBody = yaml.parse(fs.readFileSync(process.argv[2], "utf8"));
  const agentFindings = (agentBody && agentBody.findings) || [];

  // Guard: agent must not emit kind: deterministic
  for (const f of agentFindings) {
    if (f.kind === "deterministic") {
      console.error("FAIL agent emitted kind: deterministic (Phase 43 detector exclusive). Reject.");
      process.exit(1);
    }
    if (f.state !== "open") {
      console.error("FAIL agent emitted state != open (audit_version: 1 enum single-value). Got:", f.state);
      process.exit(1);
    }
    if (!["HIGH", "MEDIUM", "LOW"].includes(f.severity)) {
      console.error("FAIL agent emitted invalid severity. Got:", f.severity);
      process.exit(1);
    }
  }

  // Validate detector entries carry state: open (Step 2 injection)
  for (const f of detector) {
    if (f.state !== "open") {
      console.error("FAIL detector finding missing state: open — Step 2 injection failed.");
      process.exit(1);
    }
  }

  process.stdout.write(JSON.stringify([...detector, ...agentFindings], null, 2));
' "$API_FINDINGS" "$AGENT_OUT")
```

On validation failure: surface the error and ask the reviewer to revise (re-spawn Step 3 with the failure mode in the prompt). Do NOT proceed to Step 5 with an invalid findings list.

---

## Step 5: Write BACKEND-AUDIT.md (Section-Level Replace)

Write the merged findings into the `## API findings` section of `.planning/domains/backend/BACKEND-AUDIT.md`. **Section-level replace per invocation** — rewrite only the target surface section; preserve other surface sections byte-for-byte where possible. If the file is absent, create it with the 4-section skeleton and populate only the API section.

```bash
AUDIT=".planning/domains/backend/BACKEND-AUDIT.md"
mkdir -p "$(dirname "$AUDIT")"

# Section-level replace helper (per-surface invocation rewrites only its own section)
SURFACE_LABEL="API"
SECTION_HEADER="## ${SURFACE_LABEL} findings"

# Current SPEC SHA-256 for provenance (Phase 49 staleness-detection basis)
SPEC_SHA=$(shasum -a 256 "$API_SPEC" | awk '{print $1}')
DETECTOR_VERSION="1.0.0"
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Render section body (YAML findings block + metadata)
RENDERED_SECTION=$(cat <<EOF
${SECTION_HEADER}

<!-- surface_source: {"surface": "api", "spec": "${API_SPEC}", "spec_sha": "${SPEC_SHA}", "detector_version": "${DETECTOR_VERSION}", "generated_at": "${GENERATED_AT}"} -->

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

# If file absent: create 4-section skeleton and drop API section in.
# If file present: replace ONLY the `## API findings` section; preserve others.
if [ ! -f "$AUDIT" ]; then
  cat > "$AUDIT" <<EOF
<!-- audit_version: 1 -->

# BACKEND-AUDIT — Phase ${PADDED}

_This audit is generated by \`/sunco:backend-review --surface <s>\`. Each surface section is replaced on its own invocation; other sections are preserved byte-for-byte. Finding lifecycle (\`resolved\` / \`dismissed\`) is Phase 49/M4.2 scope; at audit_version: 1 the only valid \`state\` value is \`open\`._

${RENDERED_SECTION}

## Data findings

_Run \`/sunco:backend-review --surface data\` to populate._

## Event findings

_Run \`/sunco:backend-review --surface event\` to populate._

## Ops findings

_Run \`/sunco:backend-review --surface ops\` to populate._
EOF
else
  # Section-level replace using awk — rewrite only the target section, preserve others.
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const header = process.argv[2];
    const newBody = process.argv[3];
    const content = fs.readFileSync(path, "utf8");
    const lines = content.split("\n");
    const headerIdx = lines.findIndex(l => l.trim() === header);
    if (headerIdx < 0) {
      // Section missing — append
      fs.writeFileSync(path, content.trimEnd() + "\n\n" + newBody + "\n");
      return;
    }
    // Find next "## " header after headerIdx, or EOF
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

**No commit in this workflow.** `BACKEND-AUDIT.md` is a runtime consumer artifact (like `.sun/state.json` or the ui-review's `UI-REVIEW.md`). Phase 47 ships the workflow + agent + schema; the audit file itself is generated at user runtime and is not part of the Phase 47 commit.

---

## Display Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► BACKEND REVIEW (api)  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detector (Phase 43, 4-rule subset):
  raw-sql-interpolation · any-typed-body ·
  missing-validation-public-route · logged-secret
  → N deterministic findings

Reviewer agent (Phase 47, heuristic + requires-human-confirmation):
  → M heuristic findings  |  K requires-human-confirmation findings

BACKEND-AUDIT.md ## API findings updated (section-level replace).
All findings state: open (audit_version: 1).

Finding-lifecycle transitions (resolved / dismissed) ship in Phase 49/M4.2.
Cross-surface aggregate rollup ships in Phase 48/M4.1.
```

---

## Success Criteria

- [ ] `${PHASE_DIR}/API-SPEC.md` exists at Step 1 (hard-stop otherwise)
- [ ] `<!-- spec_version: 1 -->` marker present in API-SPEC.md
- [ ] Phase 43 detector invoked with `--json` against project root; exit code ∈ {0, 2}
- [ ] Detector findings filtered to 4-rule API subset (raw-sql-interpolation, any-typed-body, missing-validation-public-route, logged-secret)
- [ ] `state: open` injected on every detector finding (workflow post-process)
- [ ] `sunco-backend-reviewer` agent spawned with `--surface api` + filtered detector findings + API-SPEC + BACKEND-CONTEXT
- [ ] 4 required Phase 42 refs loaded in Stage 1 (api-design, boundaries, reliability, security)
- [ ] 2-stage review executed; token budget stayed under 30k
- [ ] Agent output validated: no `kind: deterministic`, no `state: resolved|dismissed`, no FAIL/WARN severities
- [ ] Merged findings list validated against `packages/cli/schemas/finding.schema.json`
- [ ] `.planning/domains/backend/BACKEND-AUDIT.md` created (if absent) with 4-section skeleton, OR `## API findings` section replaced (if present) with other 3 surface sections preserved byte-for-byte
- [ ] `<!-- audit_version: 1 -->` top-of-file marker present (when file is created)
- [ ] `<!-- surface_source: {...} -->` metadata comment on the rewritten API section with `spec_sha` + `detector_version` + `generated_at`
- [ ] Phase 42 reference docs unchanged (read-only consumer)
- [ ] Phase 43 detector source unchanged (CLI-only invocation)
- [ ] API-SPEC.md unchanged (read-only consumer)
- [ ] BACKEND-CONTEXT.md unchanged (Phase 44 lock)
- [ ] Other BACKEND-AUDIT.md surface sections (`## Data findings`, `## Event findings`, `## Ops findings`) byte-for-byte preserved if already populated
- [ ] Vendored Impeccable source unchanged (R5)

---

## Out-of-scope guardrails

Phase 47 / this workflow MUST NOT:

- Author API-SPEC.md inline (Phase 45 authorship territory)
- Invoke `/sunco:backend-phase --surface api` inline (separate user-driven command)
- Modify `packages/cli/references/backend-excellence/reference/**` (Phase 43 Escalate #5 + Phase 46 carry)
- Modify `packages/cli/references/backend-excellence/src/detect-backend-smells.mjs` (Phase 43 §13 7-rule lock)
- Add `--rules` or any filter flag to the detector CLI (rule subset enforcement lives here in workflow post-process)
- Modify `BACKEND-CONTEXT.md` or its schema (Phase 44 lock)
- Modify `discuss-phase.md` FRONTEND/BACKEND blocks (R3 marker SHA-256 lock)
- Modify Phase 45/46 `backend-phase-*.md` / `{api,data,event,ops}-spec.schema.json` / `sunco-backend-researcher.md` (Phase 45/46 locks)
- Activate finding lifecycle transitions (`resolved` / `dismissed`) — Phase 49/M4.2 scope
- Emit cross-surface aggregate summary or cross-domain findings — Phase 48/M4.1 scope
- Produce or consume CROSS-DOMAIN.md (Phase 48 scope)
- Touch `~/.claude/sunco` runtime files
- Produce `.impeccable.md` (SDI-1 continuation)
- Backfill Phase 40 `ui-spec.schema.json` BS1 version field (registered plan debt, Phase 48 前 별도 commit)
- Activate `backend-review-{data,event,ops}.md` logic (sibling surfaces — shared scaffold but populated in parallel, not by this workflow)

*Phase 37/M1.3 introduced the stub; Phase 47/M3.6 replaces it with this behavioral workflow. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.6. Focused+ Gate 47 judges: plan-verifier (outgoing Claude) GREEN, Codex backend-review GREEN-CONDITIONAL → 4 conditions absorbed (section-level replace wording, smoke broad-freeze completion, negative-grep scope, gate artifact untracked).*
