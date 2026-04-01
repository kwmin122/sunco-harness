# Impact Analysis Workflow

Computes the invalidation cascade when planning artifacts change. Called by other workflows (pivot, rethink, backtrack) or invoked directly via `/sunco:impact-analysis`. Deterministic — zero LLM calls. All reasoning done by `sunco-tools.cjs` comparing hashes and tracing cross-references.

---

## Core Principle

Planning artifacts form a dependency graph. When an upstream artifact changes, downstream artifacts may become invalid. Impact analysis traces this graph, classifies each affected artifact by severity, and presents options. The user always decides — SUNCO never auto-regenerates without consent.

Severity levels:
- **INVALID** — must be re-generated. Directly depends on changed content.
- **MAYBE INVALID** — check content. References something in the changed file but may still be correct.
- **WARN** — already executed. Code was written based on this artifact. Flagged for review only.

```
load_context → detect_changes → compute_cascade → present_results → route_action
```

---

## Step 1: load_context

```bash
STATE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state load)
if [[ "$STATE" == @file:* ]]; then STATE=$(cat "${STATE#@file:}"); fi
```

| Field | Type | Description |
|-------|------|-------------|
| `project_root` | string | Absolute path to project root |
| `planning_dir` | string | Path to `.planning/` directory |
| `state_exists` | bool | STATE.md present |
| `current_phase` | string | Currently active phase number |
| `artifact_hashes` | object | Last-known SHA256 hashes keyed by relative path |

**Errors:**
- `state_exists: false` → "No STATE.md found. Run `/sunco:init` to initialize the project harness."
- `artifact_hashes` empty → "No artifact hashes recorded. Run `/sunco:status` to establish baseline hashes."

**Short-circuit:** If invoked with `--changed <files>` (by a calling workflow), skip Step 2. Parse the comma-separated file list into `CHANGED_FILES` and jump to Step 3.

---

## Step 2: detect_changes

```bash
HASH_CHECK=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash check)
if [[ "$HASH_CHECK" == @file:* ]]; then HASH_CHECK=$(cat "${HASH_CHECK#@file:}"); fi
```

Returns `{ changed: bool, artifacts: [{ file, old_hash, new_hash, type }] }`.

**If `changed: false`:** Print "No planning artifact changes detected." and exit with success.

**If `changed: true`:** Build `CHANGED_FILES` from the `artifacts` array (file path + artifact type: project, requirements, roadmap, context, plan, summary).

---

## Step 3: compute_cascade

```bash
CHANGED_LIST=$(echo "$HASH_CHECK" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const arts = JSON.parse(d).artifacts || [];
  process.stdout.write(arts.map(a => a.file).join(','));
")

CASCADE=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" impact-analysis --changed "$CHANGED_LIST")
if [[ "$CASCADE" == @file:* ]]; then CASCADE=$(cat "${CASCADE#@file:}"); fi
```

When called with `--changed <files>` directly, substitute `$CHANGED_FILES` for `$CHANGED_LIST`.

Returns:
```json
{
  "trigger_files": [".planning/REQUIREMENTS.md"],
  "impact_count": 5,
  "impacts": [
    { "file": "...", "severity": "INVALID|MAYBE_INVALID|WARN", "reason": "...", "phase": "02", "artifact_type": "context" }
  ],
  "summary": { "invalid_count": 2, "maybe_invalid_count": 2, "warn_count": 1, "affected_phases": ["02","03"] }
}
```

**If `impact_count: 0`:** Print "Changes detected but no downstream impact. Safe to continue." Update hashes and exit:
```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash update
```

---

## Step 4: present_results

Group impacts by severity, then by phase.

```
========================================
  IMPACT ANALYSIS
  Trigger: REQUIREMENTS.md
  Affected: 5 artifacts across 2 phase(s)
========================================

INVALID — must re-generate:
  Phase 02 (auth):
    - 02-CONTEXT.md — Covers REQ-03 which was modified
    - 02A-PLAN.md   — Task 2 implements REQ-03 which was modified

MAYBE INVALID — review content:
  Global:
    - ROADMAP.md    — Phase 2 success criteria references REQ-03
  Phase 03 (api):
    - 03-CONTEXT.md — References REQ-03 in dependency section

WARN — already executed (code may need revision):
  Phase 02 (auth):
    - 02A-SUMMARY.md — Based on 02A-PLAN.md which is now INVALID
```

Present three options:
```
What would you like to do?

  1) Run impact analysis and re-route (recommended)
     Re-generate INVALID, review MAYBE INVALID, flag WARN for manual check.

  2) Ignore and continue
     Mark changes as acknowledged. Update hashes. Proceed.

  3) Revert changes
     Restore artifacts to last-known-good state via rollback.
```

---

## Step 5: route_action

### Option 1: Re-route

Update trigger file hashes:
```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash update --files "$TRIGGER_FILES"
```

Build re-generation plan in dependency order (upstream before downstream):

| Artifact type | Command | Notes |
|---------------|---------|-------|
| `context` | `/sunco:discuss {phase}` | Re-discuss with updated upstream |
| `plan` | `/sunco:plan {phase}` | Re-plan with updated context |
| `roadmap` | Manual review | Present diff, user confirms or edits |

For MAYBE INVALID artifacts, present the relevant section alongside the triggering change and ask: `yes` (keep) / `no` (add to re-gen queue) / `show` (full diff).

For WARN artifacts, flag for manual review after re-planning completes. Suggest `/sunco:execute {phase} --gaps-only` to address code gaps.

Present the execution sequence:
```
Re-generation sequence:
  1. /sunco:discuss 02    — re-discuss (CONTEXT.md INVALID)
  2. /sunco:plan 02       — re-plan (depends on CONTEXT.md)
  3. Review ROADMAP.md    — confirm success criteria
  4. Review 03-CONTEXT.md — check REQ-03 reference
  5. /sunco:execute 02 --gaps-only — address WARN artifacts

Start with step 1? [yes/skip to N/abort]
```

### Option 2: Ignore and continue

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash update
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state append-log \
  --entry "impact-analysis: ignored changes to ${TRIGGER_FILES}. User acknowledged at $(date -u +%Y-%m-%dT%H:%M:%SZ)."
```

Print "Changes acknowledged. Hashes updated." Return control to calling workflow.

### Option 3: Revert changes

```bash
REVERT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point restore-files \
  --files "$CHANGED_LIST")
if [[ "$REVERT" == @file:* ]]; then REVERT=$(cat "${REVERT#@file:}"); fi
```

Returns `{ restored: [...], failed: [...], rollback_source: "..." }`.

If `failed` is non-empty: warn that manual restoration is needed for those files.
If all restored: print restored count, file list, and rollback source tag.

---

## Caller Integration

Calling workflows pass `--changed <files>` and check exit state:

| Exit state | Meaning | Caller action |
|------------|---------|---------------|
| `no_changes` | No artifacts changed | Continue normally |
| `no_impact` | Changed but no downstream impact | Continue normally |
| `rerouted` | User chose re-route | Caller exits — re-generation takes over |
| `ignored` | User chose ignore | Continue normally |
| `reverted` | User chose revert | Caller restarts with clean state |

```bash
IMPACT_RESULT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state get --key "impact_analysis.last_result")

case "$IMPACT_RESULT" in
  "rerouted") echo "Re-generation triggered. Exiting."; exit 0 ;;
  "reverted") echo "Artifacts reverted. Restarting."; exec "$0" "$@" ;;
  *) ;; # no_changes, no_impact, ignored — continue
esac
```

---

## Success Criteria

- Every changed planning artifact detected via hash comparison
- Cascade correctly traces dependency graph (PROJECT -> REQUIREMENTS -> CONTEXT -> PLAN -> SUMMARY)
- Each affected artifact classified with correct severity (INVALID / MAYBE INVALID / WARN)
- All three options presented; user chooses freely
- Option 1 produces re-generation sequence in dependency order
- Option 2 updates hashes and logs the decision
- Option 3 restores files via rollback system
- Calling workflows receive clear exit state for branching
- Zero LLM calls — entire workflow is deterministic
