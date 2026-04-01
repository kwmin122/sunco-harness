# Reinforce Workflow

Add new requirements to the current milestone and insert new phases if needed. Reads current REQUIREMENTS.md and ROADMAP.md, determines whether new requirements fit into existing phases or demand new ones, updates both artifacts atomically, and runs impact analysis to flag any existing work affected by the additions. Used by `/sunco:reinforce`.

---

## Overview

Ten steps:

1. **Load context** — read planning artifacts and current state
2. **Create rollback point** — save state before any modifications
3. **Gather new requirements** — ask user what to add
4. **Analyze fit** — determine if new requirements fit existing phases or need new ones
5. **Update REQUIREMENTS.md** — assign REQ-IDs and append
6. **Update ROADMAP.md** — insert new phases or annotate existing ones
7. **Impact analysis** — check if existing plans/executions are affected
8. **Update STATE.md** — record the reinforcement event
9. **Commit** — atomic commit of all changes
10. **Summary** — report what changed and next steps

---

## Core Principle

Reinforce, don't rebuild. New requirements are additive — they extend the current milestone without invalidating already-shipped work. If a new requirement conflicts with a shipped decision, surface the conflict and let the user resolve it (via `/sunco:rethink` or `/sunco:backtrack`).

---

## Step 1: Load Context

Read all planning artifacts to understand the current state:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash check
```

If hash mismatch detected: warn the user before proceeding.

```
Detected uncommitted changes to planning artifacts.
Proceeding will snapshot the current (modified) state as the rollback point.
Continue? (yes / abort)
```

Read:

```bash
cat .planning/PROJECT.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/ROADMAP.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null
cat .planning/MILESTONES.md 2>/dev/null
```

Extract:
- **Current milestone** — version, name, goal
- **Existing requirements** — all REQ-IDs, categories, status (active/validated/out-of-scope)
- **Existing phases** — phase numbers, titles, statuses (draft/planned/executing/done)
- **Current position** — which phase is active, what has shipped
- **Highest REQ-ID per category** — for continuation numbering

If REQUIREMENTS.md is missing: stop with "No requirements found. Run `/sunco:milestone new` first."
If ROADMAP.md is missing: stop with "No roadmap found. Run `/sunco:milestone new` first."

---

## Step 2: Create Rollback Point

Before any modifications, snapshot the current state:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point create --label "before-reinforce"
```

Store the label for display in the summary. If rollback creation fails: warn but continue (the user can still manually revert via git).

---

## Step 3: Gather New Requirements

Display current milestone context:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► REINFORCE — Add to Current Milestone
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current milestone: {VERSION} — {MILESTONE_NAME}
Active requirements: {COUNT} ({VALIDATED_COUNT} validated, {ACTIVE_COUNT} active)
Phases: {PHASE_COUNT} ({DONE_COUNT} done, {REMAINING_COUNT} remaining)
Current phase: {CURRENT_PHASE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask the user (AskUserQuestion): "What new requirements or features do you want to add to this milestone?"

Wait for response.

Probe with targeted follow-ups:
- "Which existing requirements are these closest to?" (helps determine category)
- "Do any of these block or depend on already-planned phases?"
- "Should any current Out of Scope items be brought back in?"

If user mentions an Out of Scope item: confirm explicitly — "Bringing {ITEM} back into scope. This was originally excluded because: {REASON}. Proceed? (yes / keep out of scope)"

---

## Step 4: Analyze Fit

For each new requirement, determine placement:

### Classification

Classify each new requirement into one of three buckets:

| Bucket | Criteria | Action |
|--------|----------|--------|
| **Fits existing phase** | Requirement is a natural extension of an existing phase's objective | Add to that phase's scope |
| **Needs new phase** | Requirement introduces a new domain or concern not covered by any existing phase | Insert a new phase |
| **Cross-cutting** | Requirement touches multiple existing phases (e.g., "add logging everywhere") | Attach to the earliest relevant phase, note cross-cutting nature |

### Fit Analysis

For each new requirement, compare against every existing phase:

```
Requirement: "User can export workflow results as PDF"

Phase 6 — Composition Core:     NO FIT (different domain)
Phase 7 — Workflow State:        PARTIAL FIT (state includes results, but export is a new concern)
Phase 8 — Error Recovery:        NO FIT
Phase 9 — Integration Tests:     NO FIT

Verdict: NEEDS NEW PHASE (export is a distinct feature area)
```

### Present Fit Analysis

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► FIT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

New requirements → placement:

  1. "Cache skill outputs"
     → FITS Phase 7 (Workflow State) — state persistence covers caching

  2. "Export results as PDF"
     → NEW PHASE needed — export is a distinct feature area

  3. "Retry failed skills automatically"
     → FITS Phase 8 (Error Recovery) — retry is error recovery

New phases needed: 1
  Phase 9.1: Result Export (after Phase 9, before milestone end)

Approve this placement? (yes / adjust)
```

If "adjust": ask what to change. Re-analyze. Loop until confirmed.

---

## Step 5: Update REQUIREMENTS.md

### Assign REQ-IDs

For requirements fitting existing categories: continue numbering from the highest existing ID.

```
Existing: COMP-01, COMP-02, COMP-03, STATE-01, STATE-02
New "Cache skill outputs" → STATE category → STATE-03
New "Retry failed skills" → COMP category → COMP-04
```

For requirements needing a new category: derive category code from the domain.

```
New "Export results as PDF" → new EXPORT category → EXPORT-01
```

### Requirement Quality Gate

Every new requirement must be:
- **Specific and testable**: "User can export workflow results as a single PDF file"
- **User-centric**: "User can X" not "System does Y"
- **Atomic**: one capability per requirement
- **Independent**: minimal dependencies on other new requirements

If a user-provided requirement is vague, rewrite it and confirm: "I've refined '{original}' to '{refined}'. Sound right?"

### Write Updates

Read REQUIREMENTS.md. Append new requirements to the appropriate category sections under `## Active Requirements`.

If a new category is needed, add it as a new `### {Category}` heading.

Update the `## Future Requirements` section if any items were promoted from Out of Scope.

Update the `## Traceability` section: map each new requirement to its target phase.

Write the updated file. Verify:

```bash
grep "EXPORT-01" .planning/REQUIREMENTS.md
```

---

## Step 6: Update ROADMAP.md

### If new phases are needed

For each new phase identified in Step 4:

Determine placement:
- If the new phase should come after all existing phases: use `add-phase` logic (append)
- If the new phase should be inserted between existing phases: use decimal numbering

```bash
# Example: insert new phase after Phase 9
AFTER_PHASE=9
```

Calculate decimal phase number (same logic as `insert-phase.md`):

```bash
EXISTING_DECIMALS=$(grep -oE "Phase ${AFTER_PHASE}\.[0-9]+" .planning/ROADMAP.md \
  | grep -oE "\.[0-9]+" | grep -oE "[0-9]+" | sort -n)

if [[ -z "$EXISTING_DECIMALS" ]]; then
  DECIMAL=1
else
  LAST_DECIMAL=$(echo "$EXISTING_DECIMALS" | tail -1)
  DECIMAL=$((LAST_DECIMAL + 1))
fi
PHASE_NUMBER="${AFTER_PHASE}.${DECIMAL}"
```

Create phase directory and CONTEXT.md stub:

```bash
PARENT_PADDED=$(printf "%02d" "$AFTER_PHASE")
DIR_NAME="${PARENT_PADDED}.${DECIMAL}-${PHASE_SLUG}"
PHASE_DIR=".planning/phases/${DIR_NAME}"
mkdir -p "${PHASE_DIR}"
```

Write CONTEXT.md stub following `insert-phase.md` format with:
- Phase number, title, slug, milestone
- `inserted_by: reinforce` in frontmatter
- Requirements mapped to this phase
- Acceptance criteria derived from requirements

Insert the phase entry into ROADMAP.md at the correct position.

### If requirements fit existing phases

For each existing phase that gains new requirements: update its entry in ROADMAP.md to reference the new REQ-IDs in the success criteria or description.

### Verify

```bash
grep "Phase ${PHASE_NUMBER}:" .planning/ROADMAP.md
```

If verification fails: abort with "ROADMAP.md update failed. Check file manually. Rollback available: `sunco-tools.cjs rollback-point restore --label before-reinforce`"

---

## Step 7: Impact Analysis

Run impact analysis to check if existing work is affected by the additions:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" impact-analysis --changed .planning/REQUIREMENTS.md
```

Parse the JSON result:

```json
{
  "invalidated": [...],
  "maybe_invalidated": [...],
  "warnings": [...]
}
```

### Handle Results

**If `invalidated` is non-empty:**

```
Impact detected — {N} artifacts may need revision:

  INVALID:
    - Phase 7 PLAN.md — references STATE-01 which now has new sibling STATE-03
      (plan may need to account for caching alongside persistence)

  MAYBE INVALID:
    - Phase 8 CONTEXT.md — error recovery scope may need to include retry (COMP-04)

  Action:
    1) Re-plan affected phases (recommended)
    2) Acknowledge and proceed (changes are additive, existing plans are still valid)
    3) Rollback reinforcement
```

Wait for user choice.

If "re-plan": note phases to re-plan in STATE.md. User should run `/sunco:plan {phase}` after this workflow completes.

If "rollback":
```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point restore --label "before-reinforce"
```
Stop workflow. Report: "Reinforcement rolled back. Planning artifacts restored."

**If `invalidated` is empty:** report "No existing work affected by the new requirements."

---

## Step 8: Update STATE.md

Update the `## Accumulated Context` section to record the reinforcement:

```markdown
### Reinforcement — {ISO_DATE}
- Added {N} requirements: {REQ_IDS}
- New phases: {PHASE_NUMBERS} (or "none")
- Categories affected: {CATEGORIES}
- Impact: {IMPACT_SUMMARY}
- Rollback: sunco/rollback/{timestamp}-before-reinforce
```

Update `Last activity` in Current Position:

```markdown
Last activity: {ISO_DATE} — Reinforced milestone with {N} new requirements
```

---

## Step 9: Commit

```bash
git add .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/STATE.md
```

If new phase directories were created:
```bash
git add .planning/phases/
```

Commit:

```bash
git commit -m "docs(reinforce): add {N} requirements to {MILESTONE_VERSION} — {BRIEF_SUMMARY}"
```

Example: `docs(reinforce): add 3 requirements to v1.1 — caching, export, retry`

Create post-reinforcement rollback point:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point create --label "after-reinforce"
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" artifact-hash compute
```

---

## Step 10: Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► REINFORCEMENT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone {VERSION}: {MILESTONE_NAME}

  Added requirements:
    {REQ-ID}: {title}                    → Phase {N}
    {REQ-ID}: {title}                    → Phase {N} (new)
    {REQ-ID}: {title}                    → Phase {N}

  New phases:
    Phase {N}: {title}

  Impact:
    {N} existing artifacts flagged for review
    {N} phases may need re-planning

  Rollback:
    Before: sunco/rollback/{timestamp}-before-reinforce
    After:  sunco/rollback/{timestamp}-after-reinforce

  Commit: {hash}

Before:  {OLD_REQ_COUNT} requirements, {OLD_PHASE_COUNT} phases
After:   {NEW_REQ_COUNT} requirements, {NEW_PHASE_COUNT} phases

Next steps:
  /sunco:plan {PHASE}       — plan newly inserted phases
  /sunco:rethink {PHASE}    — revise affected phases if impact detected
  /sunco:progress            — check updated milestone progress
```

---

## Error Handling

| Error | Response |
|-------|----------|
| REQUIREMENTS.md not found | "Run `/sunco:milestone new` first." |
| ROADMAP.md not found | "Run `/sunco:milestone new` first." |
| No new requirements provided | "Nothing to reinforce. Exiting." |
| Rollback point creation fails | Warn, continue (git history is still available) |
| ROADMAP.md write verification fails | Abort with rollback instructions |
| Impact analysis tool unavailable | Skip impact analysis, warn user to check manually |
| Git commit fails | Show error, skip commit, print manual instructions |
| All new requirements are duplicates of existing | "All proposed requirements already exist. Nothing to add." |
