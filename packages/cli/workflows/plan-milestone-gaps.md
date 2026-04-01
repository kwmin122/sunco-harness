# Plan Milestone Gaps Workflow

Read a gap report (from `/sunco:audit-uat` or `/sunco:forensics`), identify uncovered or failed requirements, generate new phases to close them, insert those phases into ROADMAP.md, and commit. Used by `/sunco:plan-milestone-gaps`.

---

## Overview

Six steps:

1. **Initialize** — locate gap sources (UAT.md, FORENSICS.md, audit reports)
2. **Read gap data** — extract every unfulfilled requirement or failed test
3. **Group gaps** — cluster related gaps that can be fixed together
4. **Generate fix phases** — one phase per gap cluster, with scope and success criteria
5. **Insert into ROADMAP.md** — after the current phase, before next milestone
6. **Commit and present** — show what was added and what to run next

---

## Step 1: Initialize

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--from-uat <phase>` | `UAT_PHASE` | auto-detect |
| `--from-forensics <phase>` | `FORENSICS_PHASE` | auto-detect |
| `--from-audit` | `USE_AUDIT` | false |
| `--insert-after <phase>` | `INSERT_AFTER` | current phase |

Locate gap source files:

```bash
# UAT gaps
find .planning/phases -name "*-UAT.md" | xargs grep -l "severity:" 2>/dev/null

# Forensics reports
find .planning/phases -name "FORENSICS.md" 2>/dev/null

# Audit report (from /sunco:audit-uat)
cat .planning/AUDIT-REPORT.md 2>/dev/null
```

Read current ROADMAP.md to understand existing phase numbering and insertion point:

```bash
cat .planning/ROADMAP.md
```

Identify the last phase number currently in the roadmap. New phases will be inserted after `INSERT_AFTER` (default: current executing phase).

---

## Step 2: Read Gap Data

Read all located gap files and extract individual gaps.

**From UAT.md Gaps section:**

```markdown
## Gaps

### Gap 1 — Reply to Comment
severity: major
description: Clicking reply opens the wrong modal (shows edit instead of reply)
test_number: 3
```

Extract: `test_name`, `severity`, `description`, `test_number`.

**From FORENSICS.md:**

```markdown
### Root Cause 1 — logic-error
Location: src/skill-registry.ts:42
Explanation: resolve() returns undefined because...
Fix complexity: simple
```

Extract: `root_cause_category`, `location`, `explanation`, `fix_complexity`.

**From AUDIT-REPORT.md:**

Extract uncovered requirements (requirements that map to no executed SUMMARY.md) and failed verification layers.

Build a master gap list with deduplication (same gap appearing in UAT and FORENSICS → merge into one entry).

---

## Step 3: Group Gaps

Cluster gaps that logically belong in the same fix phase:

**Grouping criteria:**
- Same root cause category (all `logic-error` in the same module)
- Same domain area (all gaps in `skill-registry` component)
- Same fix complexity (group `trivial` items together, `complex` items alone)
- Dependency order (gap B cannot be fixed without gap A → sequence them)

**Output:** N clusters, each with:
- `cluster_name` — short label ("Fix SkillRegistry Lookup", "Fix Config Merge")
- `gaps` — list of gap items
- `estimated_complexity` — trivial | simple | moderate | complex
- `blocker_count` — number of blocker-severity gaps

Sort clusters: blockers first, then by complexity (simple before complex).

---

## Step 4: Generate Fix Phases

For each gap cluster, generate a phase spec:

**Phase spec structure:**

```
Phase [N+1]: Fix [Cluster Name]

Goal: [One sentence describing what this phase repairs]

Scope:
  - [Gap 1]: [brief description of the fix]
  - [Gap 2]: [brief description of the fix]
  - [Gap 3]: [brief description of the fix]

Out of scope:
  - [Related thing that is NOT being changed]

Success criteria (done_when):
  1. [Observable user behavior that proves gap 1 is fixed]
  2. [Observable user behavior that proves gap 2 is fixed]
  3. All previously failed tests in UAT phase XX now pass

Estimated complexity: [trivial | simple | moderate | complex]
Blocked by: [Phase N if dependency exists, else none]
```

**Phase numbering:**
- Parse current last phase in ROADMAP.md (e.g., Phase 9)
- Assign new phases starting at Phase 10, 11, 12...
- If `--insert-after N` was given, insert at N+1 and renumber any subsequent phases

---

## Step 5: Insert into ROADMAP.md

Read the full ROADMAP.md. Locate the insertion point.

Insert new phase entries:

```markdown
## Phase 10: Fix SkillRegistry Lookup
**Goal:** Resolve async-ordering issue causing resolve() to return undefined

**Scope:**
- Fix skill-loader.ts:31 — await load() before register loop
- Add integration test asserting resolve() returns skills after init()

**Out of scope:** Refactoring registry internals unrelated to the bug

**Success criteria:**
1. `sunco help` displays all registered skills without undefined entries
2. Calling `sunco run <skill-id>` with a valid ID executes the skill
3. Unit test `skill-registry.resolve.test.ts` passes

**Gap source:** UAT Phase 04 Gap 1 + FORENSICS Phase 04 Root Cause 1
**Complexity:** simple
```

Update STATE.md to reflect new roadmap length:

```markdown
## Current Position

Roadmap: N → N+2 phases (2 gap-fix phases inserted)
```

Commit:

```bash
git add .planning/ROADMAP.md .planning/STATE.md
git commit -m "docs: insert [N] gap-fix phases into roadmap (from phase XX audit)"
```

---

## Step 6: Present and Route

Display what was added:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► GAP PHASES CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2 gaps → 2 new phases inserted after Phase 9

  Phase 10  Fix SkillRegistry Lookup    simple     (1 blocker)
  Phase 11  Fix Config Merge Order      trivial    (1 minor)

Roadmap is now 11 phases.

Next:
  /sunco:discuss 10   gather context for gap-fix phase
  /sunco:plan 10      plan the fix directly
  /sunco:status       see updated roadmap
```

---

## Success Criteria

- [ ] All gap sources located (UAT, FORENSICS, AUDIT)
- [ ] Individual gaps extracted with severity and description
- [ ] Gaps grouped into logical clusters
- [ ] Blocker-severity gaps prioritized first
- [ ] Fix phases generated with scope, success criteria, and complexity
- [ ] Phases inserted at the correct position in ROADMAP.md
- [ ] Phase numbers do not collide with existing phases
- [ ] STATE.md updated with new phase count
- [ ] ROADMAP.md + STATE.md committed
- [ ] User knows the next command to run
