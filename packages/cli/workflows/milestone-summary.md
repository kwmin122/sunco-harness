# Milestone Summary Workflow

Generate a comprehensive summary of a completed milestone by reading all phase artifacts. Extracts key decisions, metrics, architecture changes, and lessons learned, then writes MILESTONE-SUMMARY.md. Used by `/sunco:milestone summary` and automatically called by `/sunco:milestone complete`.

---

## Overview

Five steps:

1. **Initialize** — identify milestone boundaries and locate all phase directories
2. **Read phase artifacts** — SUMMARY.md, PLAN.md, VERIFICATION.md, REVIEWS.md, FORENSICS.md
3. **Extract insights** — decisions, metrics, architecture delta, lessons
4. **Write MILESTONE-SUMMARY.md** — structured report
5. **Update MILESTONES.md** — append new entry

---

## Step 1: Initialize

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `v<semver>` | `TARGET_VERSION` | current milestone from PROJECT.md |
| `--from <phase>` `--to <phase>` | Phase range | auto-detect from ROADMAP.md |

Load milestone context:

```bash
cat .planning/PROJECT.md    # current milestone name, version, goal
cat .planning/ROADMAP.md    # phase list for this milestone
cat .planning/MILESTONES.md # what shipped before
```

Identify which phases belong to this milestone:
- Parse ROADMAP.md for all phases in the current milestone's version
- If `--from`/`--to` provided, use those as the phase range

List phase directories:

```bash
ls -d .planning/phases/*/ 2>/dev/null | sort
```

---

## Step 2: Read Phase Artifacts

For each phase in the milestone's range, read:

```bash
for phase_dir in .planning/phases/[0-9][0-9]-*/; do
  cat "${phase_dir}"*-SUMMARY.md 2>/dev/null
  cat "${phase_dir}"*-PLAN.md 2>/dev/null
  cat "${phase_dir}"*-VERIFICATION.md 2>/dev/null
  cat "${phase_dir}"*-REVIEWS.md 2>/dev/null
  cat "${phase_dir}"*-FORENSICS.md 2>/dev/null
  cat "${phase_dir}"*-UAT.md 2>/dev/null
done
```

Also read:

```bash
cat .planning/REQUIREMENTS.md    # what was planned
cat .planning/research/SUMMARY.md 2>/dev/null  # what was researched
```

---

## Step 3: Extract Insights

**Metrics (count from artifacts):**

| Metric | Source |
|--------|--------|
| Total phases | ROADMAP.md count |
| Total plans | Count *-PLAN.md files |
| Requirements shipped | REQUIREMENTS.md checked items |
| Requirements deferred | REQUIREMENTS.md unchecked items |
| UAT tests passed | UAT.md summary sections |
| UAT issues found | UAT.md gap sections |
| Verification layers passed | VERIFICATION.md layer counts |
| Forensics investigations | FORENSICS.md file count |

**Key decisions (from SUMMARY.md and PLAN.md):**

Scan for decision-language: "decided", "chose", "rejected", "switched to", "replaced", "will use". Extract the decision and the rationale. Deduplicate if the same decision appears in multiple phases.

**Architecture changes (from SUMMARY.md):**

Scan for: "added", "created", "refactored", "removed", "renamed", "restructured". Map to component/module names. Build a before/after comparison.

**Lessons learned (from FORENSICS.md and REVIEWS.md):**

From FORENSICS.md: root cause categories (async-ordering, integration-gap, etc.) → generalize to lessons.
From REVIEWS.md: agreed issues that were found → what review revealed that execution missed.

**What shipped (from SUMMARY.md accomplishments):**

Pull the "Accomplishments" section from each SUMMARY.md. Group by theme (core features, infrastructure, testing, documentation). Keep only user-observable items.

---

## Step 4: Write MILESTONE-SUMMARY.md

Write `.planning/MILESTONE-SUMMARY.md`:

```markdown
# Milestone Summary — v[X.Y]: [Name]

Date: [ISO date]
Phases: [start] – [end]
Status: complete

## What Shipped

### Core Features
- [Feature 1] — [brief description from SUMMARY.md]
- [Feature 2]

### Infrastructure
- [Infrastructure change]

### Tests
- [Test coverage change]

## Metrics

| Metric | Value |
|--------|-------|
| Phases completed | N |
| Plans executed | N |
| Requirements shipped | N / M (X%) |
| UAT tests passed | N |
| UAT issues found | N |
| Forensics investigations | N |

## Key Decisions

### [Decision Title]
**Choice:** [what was decided]
**Rationale:** [why, from artifacts]
**Phase:** [when it was made]

### [Decision Title]
[same structure]

## Architecture Changes

| Component | Before | After |
|-----------|--------|-------|
| Skill Registry | Not implemented | Implemented with ID-based lookup and lazy loading |
| State Engine | Flat files | SQLite WAL + flat files dual-layer |

## Requirements Coverage

### Shipped
- [x] **COMP-01**: User can chain two skills in sequence
- [x] **STATE-01**: Workflow state persists to .sun/workflows/

### Deferred to Next Milestone
- [ ] **COMP-04**: Parallel execution — complexity exceeded v1.1 scope
- [ ] **STATE-03**: Cross-session shared state — no demand validated

## Lessons Learned

### What Worked
- [Lesson 1 — specific, from artifacts]
- [Lesson 2]

### What Didn't Work
- [Lesson 1 — root cause category + what it cost]
- [Lesson 2]

### For Next Milestone
- [Recommendation 1 — specific and actionable]
- [Recommendation 2]

## Phase Summary

| Phase | Name | Plans | Status | Verif. |
|-------|------|-------|--------|--------|
| 06 | Composition Core | 3 | complete | PASS |
| 07 | Workflow State | 2 | complete | PASS |
| 08 | Error Recovery | 3 | complete | PASS WITH WARNINGS |
| 09 | Integration Tests | 2 | complete | PASS |
```

---

## Step 5: Update MILESTONES.md

Append to `.planning/MILESTONES.md`:

```markdown
## v[X.Y] — [Name]

**Completed:** [ISO date]
**Goal:** [one sentence from PROJECT.md]
**Phases:** [start] – [end] ([N] phases, [M] plans)
**Requirements:** [N] / [total] shipped ([X]% coverage)

**Key features:**
- [Feature 1]
- [Feature 2]

**Deferred to next milestone:**
- [Item 1]

**Lessons:** [one-line summary]
```

Commit both files:

```bash
git add .planning/MILESTONE-SUMMARY.md .planning/MILESTONES.md
git commit -m "docs: milestone summary v[X.Y] — [N phases], [M requirements shipped]"
```

Display inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► MILESTONE SUMMARY COMPLETE  v1.1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4 phases  |  5/5 requirements shipped  |  0 blockers

Report: .planning/MILESTONE-SUMMARY.md

Next:
  /sunco:milestone new    start v1.2
  /sunco:release          tag v1.1 and update changelog
```

---

## Success Criteria

- [ ] All phase SUMMARY.md files read
- [ ] Metrics computed (phases, plans, requirements, UAT, verifications)
- [ ] Key decisions extracted with phase reference
- [ ] Architecture before/after delta produced
- [ ] Requirements coverage table (shipped vs. deferred)
- [ ] Lessons learned from forensics and reviews
- [ ] MILESTONE-SUMMARY.md written
- [ ] MILESTONES.md updated with new entry
- [ ] Both files committed
