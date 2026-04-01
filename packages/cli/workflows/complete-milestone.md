# Complete Milestone Workflow

Archive a completed milestone: audit all phases, archive planning artifacts, tag the git release, generate a milestone summary, and clean STATE.md for the next milestone. Used by `/sunco:milestone complete`.

---

## Overview

Completing a milestone is a deliberate ceremony. It is not just archiving files — it declares that every requirement promised for this milestone has been verified by the 5-layer Swiss cheese model, creates a permanent git tag, and resets the workspace for the next milestone without losing history.

The milestone complete workflow chains:

```
parse_args → pre_flight_check → run_audit → archive_phases
→ update_project_md → create_git_tag → write_milestone_summary
→ clean_state → route_next
```

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional (milestone name or version) | `MILESTONE_ID` | read from STATE.md |
| `--force` | `FORCE` | false |
| `--no-tag` | `NO_TAG` | false |
| `--no-commit` | `NO_COMMIT` | false |
| `--dry-run` | `DRY_RUN` | false |
| `--version <semver>` | `VERSION` | read from package.json or STATE.md |

If `MILESTONE_ID` is not provided, read `current_milestone.name` from `.sun/STATE.md`.

If `--dry-run`: execute all checks and generate the summary document but do NOT archive, tag, or modify STATE.md. Print `[DRY RUN]` prefix on all output lines.

---

## Step 2: Pre-flight Check

### Read project state

```bash
cat .planning/STATE.md 2>/dev/null || { echo "No SUNCO project found. Run /sunco:init first."; exit 1; }
cat .planning/ROADMAP.md 2>/dev/null
cat .planning/PROJECT.md 2>/dev/null
```

Extract from STATE.md:
- `project_name`
- `current_milestone.name`, `current_milestone.version`
- `current_milestone.phases` — list of phase numbers in this milestone
- `current_phase.number`, `current_phase.status`

### Resolve milestone metadata

```bash
MILESTONE_NAME="${MILESTONE_ID:-$(grep 'current_milestone:' .sun/STATE.md | head -1 | sed 's/.*: //')}"
VERSION="${VERSION:-$(node -p "require('./package.json').version" 2>/dev/null || grep 'version:' .sun/STATE.md | head -1 | sed 's/.*: //')}"
PADDED_PHASES=$(grep -A20 "phases:" .planning/STATE.md | grep "- " | sed 's/.*- //' | tr '\n' ' ')
```

### Check no uncommitted changes (unless --force)

```bash
git status --short 2>/dev/null
```

If there are uncommitted changes and `FORCE` is false: "You have uncommitted changes. Commit them first, or use --force to proceed anyway."

### Verify archive directory does not already exist

```bash
ARCHIVE_DIR=".planning/archive/milestone-${MILESTONE_NAME}"
if [[ -d "${ARCHIVE_DIR}" ]]; then
  echo "Milestone archive already exists: ${ARCHIVE_DIR}"
  echo "Use --force to overwrite."
  exit 1
fi
```

If `--force` and archive exists: overwrite.

---

## Step 3: Run Audit (unless --force)

If `--force` is set, skip audit and proceed directly to Step 4 with a visible warning:

```
WARNING: --force skips audit check. Milestone may contain unverified phases.
```

If `--force` is NOT set: invoke the audit workflow inline.

Read audit results by running the same checks as `audit-milestone.md`:

### Check each phase has VERIFICATION.md

```bash
for PHASE_NUM in ${PADDED_PHASES}; do
  PADDED=$(printf "%02d" "$PHASE_NUM")
  PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-"*/ 2>/dev/null | head -1)

  if [[ -z "$PHASE_DIR" ]]; then
    echo "FAIL|${PHASE_NUM}|phase directory not found"
    continue
  fi

  VERIFY_FILE="${PHASE_DIR}${PADDED}-VERIFICATION.md"
  if [[ ! -f "$VERIFY_FILE" ]]; then
    echo "FAIL|${PHASE_NUM}|VERIFICATION.md missing"
    continue
  fi

  # Check all layers passed
  OVERALL=$(grep -i "overall:" "$VERIFY_FILE" | head -1 | grep -i "pass" && echo "PASS" || echo "FAIL")
  LAYER1=$(grep -i "| 1 |" "$VERIFY_FILE" | grep -i "pass\|warn" && echo "PASS" || echo "FAIL")
  LAYER2=$(grep -i "| 2 |" "$VERIFY_FILE" | grep -i "pass" && echo "PASS" || echo "FAIL")
  LAYER3=$(grep -i "| 3 |" "$VERIFY_FILE" | grep -i "pass\|partial" && echo "OK" || echo "FAIL")

  echo "${OVERALL}|${PHASE_NUM}|$(basename $PHASE_DIR)"
done
```

### Collect audit result

- If any phase has `FAIL`: set `AUDIT_PASSED=false`, collect all failing phases into `AUDIT_FAILURES[]`
- If all phases have `PASS` or `WARN`: set `AUDIT_PASSED=true`

If `AUDIT_PASSED=false`:

```
Milestone audit FAILED. The following phases have verification gaps:

  Phase 03 — feature-auth: VERIFICATION.md missing
  Phase 05 — api-layer: Layer 2 (Guardrails) FAILED

Fix these issues and re-run /sunco:milestone complete, or use --force to bypass.

Alternatively, run /sunco:audit-milestone for a detailed report.
```

Stop here if audit failed and `--force` is not set.

---

## Step 4: Archive Phases

Create the milestone archive directory:

```bash
ARCHIVE_DIR=".planning/archive/milestone-${MILESTONE_NAME}"
mkdir -p "${ARCHIVE_DIR}"
```

For each phase in the milestone, copy all artifacts:

```bash
for PHASE_NUM in ${PADDED_PHASES}; do
  PADDED=$(printf "%02d" "$PHASE_NUM")
  PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-"*/ 2>/dev/null | head -1)
  [[ -z "$PHASE_DIR" ]] && continue

  PHASE_SLUG=$(basename "${PHASE_DIR}")
  TARGET="${ARCHIVE_DIR}/phases/${PHASE_SLUG}"
  mkdir -p "${TARGET}"

  # Copy all planning artifacts
  cp "${PHASE_DIR}"CONTEXT.md "${TARGET}/" 2>/dev/null || true
  cp "${PHASE_DIR}"*-PLAN.md "${TARGET}/" 2>/dev/null || true
  cp "${PHASE_DIR}"*-SUMMARY.md "${TARGET}/" 2>/dev/null || true
  cp "${PHASE_DIR}"*-VERIFICATION.md "${TARGET}/" 2>/dev/null || true
  cp "${PHASE_DIR}"*-UAT.md "${TARGET}/" 2>/dev/null || true
  cp "${PHASE_DIR}"README.md "${TARGET}/" 2>/dev/null || true
done
```

Write the archive index:

```bash
cat > "${ARCHIVE_DIR}/ARCHIVE.md" << EOF
# Milestone Archive: ${MILESTONE_NAME}

**Version**: ${VERSION}
**Archived**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Phases**: ${PADDED_PHASES}
**Audit**: $([ "$AUDIT_PASSED" = "true" ] && echo "PASSED" || echo "FORCED (audit bypassed)")

## Phases Included

$(for PHASE_NUM in ${PADDED_PHASES}; do
  PADDED=$(printf "%02d" "$PHASE_NUM")
  DIR=$(ls -d ".planning/phases/${PADDED}-"*/ 2>/dev/null | head -1)
  NAME=$(basename "${DIR:-${PADDED}-unknown}")
  echo "- Phase ${PADDED}: ${NAME}"
done)

## Artifacts

$(find "${ARCHIVE_DIR}/phases/" -name "*.md" 2>/dev/null | sort | sed 's|'"${ARCHIVE_DIR}/"'||')
EOF
```

---

## Step 5: Update PROJECT.md

Move requirements from `Active` to `Validated` in PROJECT.md based on verified phases.

```bash
PROJECT_FILE=".planning/PROJECT.md"
```

For each phase in the milestone with a passing VERIFICATION.md:

1. Read `REQUIREMENTS.md` — find which requirements are mapped to these phases
2. In `PROJECT.md`, find the `## Active Requirements` section
3. Move lines whose phase reference matches a completed milestone phase to `## Validated Requirements`

```bash
# Promote requirements that were covered in milestone phases
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" project promote-milestone "${MILESTONE_NAME}" 2>/dev/null || {
  # Manual fallback: mark requirements section
  echo "" >> "$PROJECT_FILE"
  echo "## Milestone: ${MILESTONE_NAME} (v${VERSION}) — Validated" >> "$PROJECT_FILE"
  echo "Completed: $(date -u +%Y-%m-%d)" >> "$PROJECT_FILE"
}
```

Write a milestone completion marker to PROJECT.md:

```markdown
---

## Milestone: {MILESTONE_NAME} — v{VERSION}

**Status**: Completed
**Date**: {ISO date}
**Phases**: {list}
**Requirements validated**: {count of requirements moved to Validated}
```

---

## Step 6: Create Git Tag

Unless `--no-tag`:

```bash
TAG="v${VERSION}"
TAG_MESSAGE="Milestone: ${MILESTONE_NAME} v${VERSION}

Completed phases: ${PADDED_PHASES}
Verified: $([ "$AUDIT_PASSED" = "true" ] && echo "all layers passed" || echo "forced (audit bypassed)")
Date: $(date -u +%Y-%m-%d)

$(grep -A5 "## Summary" .planning/MILESTONE-SUMMARY-${MILESTONE_NAME}.md 2>/dev/null | tail -5)"
```

```bash
git tag -a "${TAG}" -m "${TAG_MESSAGE}"
```

If the tag already exists and `--force`:

```bash
git tag -d "${TAG}" 2>/dev/null
git tag -a "${TAG}" -m "${TAG_MESSAGE}"
```

If the tag already exists and NOT `--force`: "Tag ${TAG} already exists. Use --force to retag."

---

## Step 7: Generate MILESTONE-SUMMARY.md

Write `.planning/MILESTONE-SUMMARY-{MILESTONE_NAME}.md`:

```markdown
# Milestone Summary: {MILESTONE_NAME}

**Version**: v{VERSION}
**Status**: Complete
**Completed**: {ISO date}
**Duration**: {days from first phase commit to last commit}

---

## Summary

{3-5 sentences describing what was built this milestone. Generated from phase goals in ROADMAP.md and CONTEXT.md files.}

---

## Phases Completed

| Phase | Name | Plans | Verification | Duration |
|-------|------|-------|-------------|----------|
| 01 | {name} | {N}/{N} | PASS | {N days} |
| 02 | {name} | {N}/{N} | PASS | {N days} |
| ... | | | | |

**Total plans executed**: {sum}
**Total plans planned**: {sum}
**Execution rate**: {pct}%

---

## Requirements Covered

| Req ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| REQ-01 | {desc} | 02 | Validated |
| ... | | | |

**Coverage**: {covered}/{total} requirements ({pct}%)

---

## Key Decisions

{Aggregate decisions from all CONTEXT.md files across milestone phases. Deduplicate.}

- **{Decision 1}**: {rationale}
- **{Decision 2}**: {rationale}
- **{Decision 3}**: {rationale}

---

## Verification Results

| Phase | L1 Review | L2 Guardrails | L3 BDD | L4 Permission | L5 Adversarial | L6 Cross-Model |
|-------|-----------|---------------|--------|---------------|----------------|----------------|
| 01 | PASS | PASS | PASS | PASS | PASS | SKIPPED |
| 02 | PASS | PASS | PARTIAL | PASS | WARN | SKIPPED |

**Overall**: {PASS / FORCED}

---

## Git Activity

**Tag**: v{VERSION}
**Commits this milestone**: {count}
**Files changed**: {count}
**Lines added**: +{count}
**Lines removed**: -{count}

---

## Archive Location

`.planning/archive/milestone-{MILESTONE_NAME}/`

---

## Next Milestone

{If next milestone defined in ROADMAP.md:}
Next: {next milestone name} — {description}
Start with: `/sunco:new-milestone`

{If no next milestone:}
All planned milestones complete. Run `/sunco:stats` for a final project summary.
```

Populate each section by:
- Phase table: read each phase directory for plan/summary counts and VERIFICATION.md results
- Requirements: read REQUIREMENTS.md, cross-reference with phase CONTEXT.md files
- Key decisions: aggregate `## Decisions` sections from all CONTEXT.md files across phases, remove duplicates
- Verification table: read VERIFICATION.md summary tables from each phase
- Git activity: run `git log` and `git diff --shortstat` scoped to milestone date range
- Duration: `git log --format="%ai"` — first commit in earliest phase to last commit in latest phase

---

## Step 8: Clean STATE.md for Next Milestone

Reset STATE.md to prepare for the next milestone:

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set \
  "current_milestone.status" "complete" \
  "current_milestone.completed_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "current_milestone.version" "${VERSION}" \
  "current_milestone.archive_path" "${ARCHIVE_DIR}"
```

Clear active phase tracking:

```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state set \
  "current_phase.number" "" \
  "current_phase.name" "" \
  "current_phase.status" "none"
```

Update STATE.md narrative:

```markdown
## Current Position

**Milestone**: {MILESTONE_NAME} — COMPLETE (v{VERSION})
**Status**: Milestone archived. Ready for next milestone.
**Last Updated**: {ISO timestamp}

Run `/sunco:new-milestone` to begin the next milestone.
```

---

## Step 9: Commit

Unless `--no-commit`:

Stage all modified and new files:

```bash
git add .planning/MILESTONE-SUMMARY-${MILESTONE_NAME}.md
git add .planning/PROJECT.md
git add ".planning/archive/milestone-${MILESTONE_NAME}/"
git add .planning/STATE.md
git add .sun/STATE.md 2>/dev/null || true
```

Commit:

```bash
git commit -m "milestone: ${MILESTONE_NAME} v${VERSION} complete

$(grep -A3 "## Summary" .planning/MILESTONE-SUMMARY-${MILESTONE_NAME}.md | tail -3 | head -1)

Phases: ${PADDED_PHASES}
Verification: $([ "$AUDIT_PASSED" = "true" ] && echo "all layers passed" || echo "forced")
Archive: ${ARCHIVE_DIR}"
```

---

## Step 10: Display Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MILESTONE COMPLETE: {MILESTONE_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Version  : v{VERSION}
  Phases   : {count} completed
  Plans    : {executed}/{total} ({pct}%)
  Coverage : {req_covered}/{req_total} requirements
  Tag      : v{VERSION}
  Archive  : .planning/archive/milestone-{MILESTONE_NAME}/
  Summary  : .planning/MILESTONE-SUMMARY-{MILESTONE_NAME}.md

  {If audit forced:}
  ⚠  Audit bypassed with --force. Review gaps before shipping.

  {If dry run:}
  [DRY RUN] No files were modified, no tag was created.

```

---

## Route

If `--dry-run`: "Dry run complete. Re-run without --dry-run to apply changes."

If next milestone exists in ROADMAP.md: "Start the next milestone with `/sunco:new-milestone`."

If no next milestone: "All milestones complete. Run `/sunco:stats` for a full project summary."

If audit was forced: "Review skipped verification gaps with `/sunco:audit-milestone --json`."

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` first." |
| STATE.md missing `current_milestone` | Prompt user to provide milestone name as argument |
| Phase directory not found | WARN: "Phase {N} directory missing — was it deleted?" Continue with remaining phases. |
| VERIFICATION.md missing (without --force) | FAIL: prompt to run `/sunco:verify {N}` |
| Git tag already exists (without --force) | FAIL: "Tag v{VERSION} already exists. Use --force to retag." |
| Git commit fails | Report error. All files already written. Retry with `git add . && git commit`. |
| package.json not found | Prompt user for version via `--version` argument |
| Archive directory already exists | FAIL unless --force |

---

## Requirement Status Migration

When completing a milestone, requirements migrate through status levels:

| Status | Meaning | Trigger |
|--------|---------|---------|
| `Active` | In scope for current milestone | Set at milestone start |
| `Validated` | Verified by Swiss cheese model | VERIFICATION.md layer 3 (BDD) passed |
| `Shipped` | Included in a tagged release | Milestone complete with git tag |
| `Deferred` | Moved out of scope | Explicitly removed from milestone phases |

Migration logic during `complete-milestone`:

1. Read all REQUIREMENTS.md entries mapped to milestone phases
2. For each requirement, check the highest verification status achieved:
   - If phase verified (all layers) → promote to `Validated`
   - If phase shipped (tag created) → promote to `Shipped`
   - If phase used `--force` bypass → keep as `Active` with warning marker
3. Update REQUIREMENTS.md status column in-place (do not reorder rows)
4. Append migration summary to PROJECT.md:

```markdown
### Requirements migration: {MILESTONE_NAME} → {VERSION}

| Req ID | Previous status | New status | Phase |
|--------|----------------|------------|-------|
| REQ-01 | Active | Shipped | 03 |
| REQ-04 | Active | Validated | 05 |
| REQ-07 | Active | Active (audit forced) | 04 |
```

---

## Next Milestone Routing

After completing a milestone, determine the routing:

### If next milestone is defined in ROADMAP.md

```bash
NEXT_MILESTONE=$(grep -A3 "milestone:" .planning/ROADMAP.md | grep "next:" | head -1 | sed 's/.*next: //')
```

If found, display:
```
Next milestone: {next_milestone_name}
  Description: {from ROADMAP}

Start with: /sunco:new-milestone {next_milestone_name}
```

### If no next milestone is defined

Display:
```
All milestones complete.

Options:
  /sunco:stats        — full project summary with all metrics
  /sunco:release      — prepare a versioned release
  /sunco:new          — start a new project
```

### If in roadmap but not yet defined

If ROADMAP.md mentions a next milestone in the `## Future Milestones` section but it has no phase plan:

```
Future milestone found: {name}
  Status: Not yet planned

Run /sunco:new-milestone {name} to define phases and requirements.
```

---

## Full Audit Before Archive

The audit phase (Step 3) checks beyond just VERIFICATION.md existence. Full audit includes:

### Per-phase checks

1. **VERIFICATION.md exists** — hard requirement (unless `--force`)
2. **All verification layers passed** — Layers 1-4 required; Layer 5 (adversarial) WARN-level
3. **All plans summarized** — PLAN count equals SUMMARY count
4. **Lint gate clean** — No outstanding lint errors in phase directory (cross-reference with git log)
5. **UAT items resolved** — Any `*-UAT.md` files with `status: human_needed` are flagged

### Milestone-level checks

1. **Requirements coverage** — All v1 requirements have at least one covering phase
2. **No phases with `blocked` status** — Blocked phases are hard failures
3. **No orphaned plans** — All `*-PLAN.md` files have corresponding `*-SUMMARY.md`

### Audit output format

```
Audit results for milestone: {MILESTONE_NAME}

  Phase 01 — [name]    ✓ PASS    (4/4 plans, all layers verified)
  Phase 02 — [name]    ✓ PASS    (3/3 plans, all layers verified)
  Phase 03 — [name]    ✗ FAIL    (VERIFICATION.md missing)
  Phase 04 — [name]    ⚠ WARN    (Layer 5 adversarial: skipped)

Requirements:
  v1: 12/15 covered — 3 requirements not covered by any phase
  Uncovered: REQ-04, REQ-09, REQ-12

Overall: FAIL — 1 phase missing verification, 3 requirements uncovered
```

If `AUDIT_PASSED=false` and `--force` not set: stop with instructions.

---

## Milestone Summary Generation Detail

The MILESTONE-SUMMARY.md generation in Step 7 is the most complex part of `complete-milestone`. It synthesizes information from across all phase artifacts.

### Duration calculation

```bash
FIRST_COMMIT=$(git log --format="%ai" --reverse -- ".planning/phases/$(printf '%02d' ${FIRST_PHASE})-*/" 2>/dev/null | head -1)
LAST_COMMIT=$(git log --format="%ai" -1 -- ".planning/phases/$(printf '%02d' ${LAST_PHASE})-*/" 2>/dev/null)
DURATION_DAYS=$(( ($(date -d "$LAST_COMMIT" +%s) - $(date -d "$FIRST_COMMIT" +%s)) / 86400 ))
```

### Key decisions aggregation

Scan all CONTEXT.md files in milestone phases for `## Decisions` or `## Key Decisions` sections:

```bash
for PHASE in $PADDED_PHASES; do
  CONTEXT=$(ls ".planning/phases/${PHASE}-"*"/CONTEXT.md" 2>/dev/null | head -1)
  [ -f "$CONTEXT" ] && sed -n '/## .*[Dd]ecision/,/^##/p' "$CONTEXT" | grep "^- \|^\*\*" | head -5
done | sort -u
```

Deduplicate decisions that appear across multiple phases (exact match + fuzzy).

### Git stats for milestone

```bash
git diff --shortstat "${FIRST_TAG:-HEAD~100}" HEAD 2>/dev/null
git log --oneline "${FIRST_TAG:-HEAD~100}..HEAD" 2>/dev/null | wc -l
```

---

## Config Reference

| Key | Default | Effect |
|-----|---------|--------|
| `milestone.require_all_verified` | `true` | All phases must have passing VERIFICATION.md |
| `milestone.require_coverage_pct` | `80` | Minimum requirement coverage % to complete |
| `milestone.auto_tag` | `true` | Automatically create git tag |
| `milestone.tag_prefix` | `v` | Prefix for version tags (e.g., `v1.2.0`) |
| `git.commit_docs` | `true` | Commit archive and summary on completion |
| `git.main_branch` | `main` | Branch for milestone merge (strategy: milestone) |

---

## Idempotency

`/sunco:milestone complete` is designed to be safely re-runnable:

- If the archive already exists and `--force` is not set: error with clear message
- If the tag already exists and `--force` is not set: error with clear message
- If MILESTONE-SUMMARY.md already exists: overwrite (idempotent for summary generation)
- If STATE.md already shows milestone complete: skip STATE.md update

The typical re-run scenario: initial run generated the summary but failed at the git tag step. Re-running with `--force` overwrites the tag and re-commits cleanly.

---

## Post-Completion Checklist

After `complete-milestone` succeeds, recommended follow-up:

1. **Push the tag**: `git push origin v{VERSION}` (sunco does not push automatically)
2. **Review the summary**: `.planning/MILESTONE-SUMMARY-{name}.md` — verify the auto-generated content is accurate
3. **Start next milestone**: `/sunco:new-milestone` or update ROADMAP.md with next milestone phases
4. **Archive cleanup** (optional): The `.planning/phases/` directory still contains phase files. These are left in place for reference. Only the `.planning/archive/` copy is the "official" archive.

---

## Workflow Summary

The complete-milestone workflow is a ceremony, not just a script. It marks the deliberate end of a development iteration: all requirements verified, all decisions documented, all artifacts archived, a permanent git tag created.

The steps are ordered so that each failure leaves the workspace in a consistent, recoverable state:
- Audit fails → nothing written, no tag
- Archive fails → STATE.md not updated yet
- Tag fails → files written, re-run with `--force` to fix tag
- Commit fails → files written, all state updated, just the git commit missing

---

## Flag Reference

| Flag | Effect |
|------|--------|
| `--force` | Skip audit check, overwrite existing archive, overwrite existing tag |
| `--no-tag` | Skip git tag creation |
| `--no-commit` | Skip git commit (files are still written) |
| `--dry-run` | Run all checks and generate summary doc, but do not modify git or STATE.md |
| `--version <v>` | Override version string for tag and summary |
