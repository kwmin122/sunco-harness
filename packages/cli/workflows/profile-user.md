# Profile User Workflow

Analyze the developer's patterns across the project's planning artifacts and git history. Score 8 capability dimensions, identify strengths and growth edges, and write a structured USER-PROFILE.md. Used by `/sunco:profile`.

---

## Overview

The profile is built from evidence — not self-assessment. It reads artifacts the developer has already produced (CONTEXT.md decisions, PLAN.md structures, SUMMARY.md outcomes, VERIFICATION.md results, git commit messages) and infers skill signals from patterns.

Two modes:

| Mode | Trigger | Effect |
|------|---------|--------|
| Generate | `/sunco:profile` (no args) | Full analysis, write USER-PROFILE.md |
| Update | `/sunco:profile --update` | Re-run analysis, patch changed dimensions only |
| View | `/sunco:profile --view` | Read and display existing USER-PROFILE.md |

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--update` | `UPDATE_MODE` | false |
| `--view` | `VIEW_MODE` | false |
| `--dimension <name>` | `DIM_FILTER` | unset (all 8) |
| `--json` | `JSON_OUTPUT` | false |
| `--since <date>` | `SINCE_DATE` | project start |

If `--view` is set: read USER-PROFILE.md and display it. Skip analysis.

If `--dimension` is set: re-score only that dimension, patch USER-PROFILE.md.

---

## Step 2: Collect Evidence

### Source files

```bash
# All CONTEXT.md files (decisions, blockers, requirements)
CONTEXTS=$(ls .planning/phases/*/CONTEXT.md 2>/dev/null | sort)

# All PLAN.md files (task breakdown, acceptance criteria, wave assignments)
PLANS=$(ls .planning/phases/*/*-PLAN.md 2>/dev/null | sort)

# All SUMMARY.md files (execution outcomes, lint status)
SUMMARIES=$(ls .planning/phases/*/*-SUMMARY.md 2>/dev/null | sort)

# All VERIFICATION.md files (layer results, issues found)
VERIFICATIONS=$(ls .planning/phases/*/*-VERIFICATION.md 2>/dev/null | sort)

# Notes and seeds (idea quality, speculation)
NOTES=".planning/notes.md"
SEEDS=".planning/seeds.md"
TODOS=".planning/todos.md"

# Git log
git log --oneline --since="${SINCE_DATE}" 2>/dev/null
git log --format="%s" --since="${SINCE_DATE}" 2>/dev/null
```

### Git commit pattern analysis

```bash
# Commit message format distribution
git log --format="%s" | grep -cE "^(feat|fix|docs|refactor|test|chore|perf)\(.+\):"
git log --format="%s" | grep -cE "^(feat|fix|docs|refactor|test|chore|perf):"
git log --format="%s" | grep -cv "^(feat|fix|docs|refactor|test|chore|perf)"

# Average commit size (lines changed)
git log --shortstat --since="${SINCE_DATE}" | grep "changed" | \
  awk '{ sum += $4 + $6; count++ } END { print sum/count }'

# Commit frequency pattern (days with commits vs total days)
git log --format="%ad" --date=short --since="${SINCE_DATE}" | sort -u | wc -l

# Revert frequency
git log --format="%s" | grep -ci "revert\|undo\|rollback"
```

---

## Step 3: Score 8 Dimensions

Score each dimension 1–10. Use a 3-level evidence scale:

- **Strong evidence (3+ data points)**: score accurately reflects pattern
- **Weak evidence (1-2 data points)**: add `(low confidence)` to score
- **No evidence**: score = 0, annotate as `(no data)`

### Dimension 1: Planning Depth

*How thoroughly does the developer scope work before executing?*

Evidence sources:
- CONTEXT.md length and decision count per phase
- PLAN.md acceptance criteria count per plan
- Whether assumptions were documented before execution
- Whether `/sunco:discuss` was run before `/sunco:plan`

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | Every plan has 3+ acceptance criteria; CONTEXT.md decisions exceed 5 per phase |
| 7-8 | Plans have criteria; context has decisions; occasional gaps |
| 5-6 | Plans exist but acceptance criteria are thin or missing |
| 3-4 | Sparse planning; decisions made during execution, not before |
| 1-2 | No CONTEXT.md files; plans have no acceptance criteria |

### Dimension 2: Execution Precision

*How faithfully does execution match the plan?*

Evidence sources:
- SUMMARY.md `status` field distribution (completed vs partial vs failed)
- Mismatch between plan scope and summary "what was actually built" sections
- Wave overruns (plans exceeding their wave assignment)
- Lint pass rate across SUMMARY.md `lint_status` fields

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | >90% completed summaries; lint pass rate >90%; no scope drift |
| 7-8 | >80% completed; occasional partial; lint mostly passing |
| 5-6 | Mixed completed/partial; lint failures present |
| 3-4 | Frequent partial status; scope drift visible in summaries |
| 1-2 | Mostly failed/partial summaries; execution diverges from plans |

### Dimension 3: Verification Rigor

*Does the developer verify before shipping?*

Evidence sources:
- Presence of VERIFICATION.md for each executed phase
- Layer pass rates within VERIFICATION.md files
- How many times `/sunco:ship` was run with `--skip-verify`
- Whether adversarial and cross-model layers were run or skipped

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | All phases have VERIFICATION.md; all 6 layers run; PASS results |
| 7-8 | Most phases verified; occasional skips with justification |
| 5-6 | Some phases verified; some shipped without verification |
| 3-4 | Verification present but adversarial/cross-model consistently skipped |
| 1-2 | No VERIFICATION.md files or ship always uses --skip-verify |

### Dimension 4: Decision Quality

*How well are architectural and implementation decisions reasoned?*

Evidence sources:
- Decision entries in CONTEXT.md: presence of rationale vs just the decision
- Presence of alternatives-considered sections
- Whether blockers were identified early vs discovered during execution
- Whether previous phase decisions were referenced in later phases

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | Every decision has rationale + alternatives; blockers identified proactively |
| 7-8 | Most decisions are reasoned; occasional decision without rationale |
| 5-6 | Decisions recorded but rationale often missing |
| 3-4 | Thin decisions; blockers mostly discovered during execution |
| 1-2 | Decisions are one-liners with no reasoning; or no decisions recorded |

### Dimension 5: Commit Hygiene

*Is the git history clean, atomic, and navigable?*

Evidence sources:
- Commit message format (conventional commits pattern match)
- Commit frequency and size distribution
- Revert/undo commit frequency (indicator of WIP commits)
- Whether .planning/ commits are separated from code commits

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | Conventional commits throughout; atomic commits; no reverts |
| 7-8 | Mostly conventional; occasional large or vague commits |
| 5-6 | Mixed: some conventional, some WIP-style commits |
| 3-4 | Frequent vague messages; large mixed commits; reverts present |
| 1-2 | No format; bulk commits; history tells no story |

### Dimension 6: Scope Management

*Does the developer stay within defined phase boundaries?*

Evidence sources:
- SUMMARY.md "what was actually built" vs PLAN.md scope
- Whether CONTEXT.md blockers were resolved within their phase or carried over
- Frequency of mid-phase plan additions (plan files added after phase execution started)
- Whether requirements coverage improved each phase or stalled

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | Execution matches plans; blockers resolved; requirements advance each phase |
| 7-8 | Mostly in scope; occasional small overruns |
| 5-6 | Some scope creep visible; blockers carry over phases |
| 3-4 | Regular scope changes mid-phase; requirements stall |
| 1-2 | No phase boundary discipline; scope changes constantly |

### Dimension 7: Knowledge Capture

*Does the developer preserve context for the future?*

Evidence sources:
- Notes frequency and depth (`.planning/notes.md` entry count, average length)
- Seeds planted (`.planning/seeds.md` entry count)
- HANDOFF.md quality when pause was used (specific vs vague next steps)
- Whether CONTEXT.md references prior phase decisions

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | Regular notes; seeds with meaningful triggers; detailed handoffs |
| 7-8 | Notes exist; handoffs are written; seeds occasionally planted |
| 5-6 | Some notes; handoffs are thin; few seeds |
| 3-4 | Sparse notes; no handoffs; no seeds |
| 1-2 | No notes, seeds, or handoffs found |

### Dimension 8: Velocity Consistency

*Is work output steady or erratic?*

Evidence sources:
- Commit frequency variance (standard deviation of commits-per-day)
- Phase duration variance (some phases take 1 day, others 3 weeks?)
- Plan completion rate per session
- Whether periods of inactivity (3+ day gaps) correlate with blocked phases

Scoring rubric:

| Score | Signal |
|-------|--------|
| 9-10 | Consistent daily commits; phases complete in similar timeframes |
| 7-8 | Mostly consistent; occasional gaps tied to blockers |
| 5-6 | Variable velocity; some sprints, some long pauses |
| 3-4 | Erratic: bursts followed by extended inactivity |
| 1-2 | No discernible pattern; project looks stalled |

---

## Step 4: Synthesize Profile

### Identify top strengths

Take the 3 highest-scoring dimensions. For each, write a one-sentence evidence-backed statement.

Example: "**Planning Depth (9/10)**: CONTEXT.md files average 7 decisions each with rationale, and every PLAN.md has 3+ acceptance criteria."

### Identify growth edges

Take the 2-3 lowest-scoring dimensions. For each, write a specific, non-judgmental observation and a concrete improvement suggestion.

Example: "**Commit Hygiene (5/10)**: About 40% of commits don't follow conventional commit format. Try running `npx commitlint` or add a commit-msg hook."

### Compute composite score

`composite = mean(all 8 dimension scores)`

Round to 1 decimal.

### Determine profile archetype

| Composite | Archetype |
|-----------|-----------|
| 8.5–10.0 | Precision Builder |
| 7.0–8.4 | Structured Executor |
| 5.5–6.9 | Capable Practitioner |
| 4.0–5.4 | Developing Discipline |
| 0.0–3.9 | Establishing Foundations |

---

## Step 5: Write USER-PROFILE.md

```bash
PROFILE_FILE="CLAUDE.md"
# Inject into ## Developer Profile section, or create USER-PROFILE.md if no CLAUDE.md
OUTPUT_FILE=".planning/USER-PROFILE.md"
```

### File structure

```markdown
# Developer Profile

Generated: {ISO timestamp}
Composite Score: {composite}/10 — {archetype}
Data sources: {N} phases, {N} plans, {N} summaries, {N} git commits analyzed

---

## Composite Score

  {composite}/10 — {archetype}

  {████████░░} {composite * 10}%

---

## Dimension Scores

| Dimension | Score | Confidence | Signal |
|-----------|-------|------------|--------|
| Planning Depth | {N}/10 | {high/low/none} | {1-line evidence} |
| Execution Precision | {N}/10 | {high/low/none} | {1-line evidence} |
| Verification Rigor | {N}/10 | {high/low/none} | {1-line evidence} |
| Decision Quality | {N}/10 | {high/low/none} | {1-line evidence} |
| Commit Hygiene | {N}/10 | {high/low/none} | {1-line evidence} |
| Scope Management | {N}/10 | {high/low/none} | {1-line evidence} |
| Knowledge Capture | {N}/10 | {high/low/none} | {1-line evidence} |
| Velocity Consistency | {N}/10 | {high/low/none} | {1-line evidence} |

---

## Strengths

1. **{dimension} ({score}/10)**
   {Evidence-backed strength statement — 2-3 sentences.}

2. **{dimension} ({score}/10)**
   {Evidence-backed strength statement.}

3. **{dimension} ({score}/10)**
   {Evidence-backed strength statement.}

---

## Growth Edges

1. **{dimension} ({score}/10)**
   {Observation.}
   Suggestion: {concrete actionable step}

2. **{dimension} ({score}/10)**
   {Observation.}
   Suggestion: {concrete actionable step}

---

## Patterns Observed

{3-5 patterns extracted from the evidence:}
- {Pattern}: {specific examples from artifacts}
- {Pattern}: {specific examples from artifacts}
- {Pattern}: {specific examples from artifacts}

---

## Recommended Focus

Based on current scores, the highest-leverage improvement is:

**{lowest-scoring dimension with high evidence}**

{2-3 sentences on why this dimension has the most impact on output quality,
and the single most actionable change to improve it.}

---

## Methodology

This profile was generated by analyzing:
- {N} CONTEXT.md files (decisions and blockers)
- {N} PLAN.md files (task breakdowns and acceptance criteria)
- {N} SUMMARY.md files (execution outcomes and lint status)
- {N} VERIFICATION.md files (layer results)
- {N} git commits (messages, sizes, frequency)
- notes.md: {N} entries
- seeds.md: {N} entries

Scores reflect observable patterns in planning artifacts, not self-assessment.
Low-confidence scores (marked with asterisk) have fewer than 3 data points.
```

---

## Step 6: Update CLAUDE.md Developer Profile Section

If the project has a `CLAUDE.md` file with a `## Developer Profile` section:

```bash
# Find the section and replace its content
PROFILE_SUMMARY="Composite: ${composite}/10 — ${archetype}. Strengths: ${top1}, ${top2}. Growth edge: ${bottom1}. Full profile: .planning/USER-PROFILE.md"
```

Replace the placeholder text in CLAUDE.md:

```
> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
```

With:

```
> Generated: {ISO timestamp}. Composite: {composite}/10 — {archetype}.
> Strengths: {top_dim_1} ({score}), {top_dim_2} ({score}).
> Growth edge: {bottom_dim} ({score}).
> Full profile: `.planning/USER-PROFILE.md` — run `/sunco:profile --update` to refresh.
> This section is managed by `sunco:profile` — do not edit manually.
```

---

## Step 7: Report

```
Developer profile generated.

  Output: .planning/USER-PROFILE.md
  Score:  {composite}/10 — {archetype}

  Strengths:
    {top1_dim}: {score}/10
    {top2_dim}: {score}/10
    {top3_dim}: {score}/10

  Growth edge:
    {bottom_dim}: {score}/10 — {suggestion}

  {If CLAUDE.md was updated:}
  CLAUDE.md developer profile section updated.

Refresh after completing more phases:
  /sunco:profile --update
```

---

## View Mode (--view)

If `--view`:

Read `.planning/USER-PROFILE.md` and render it as-is.

If file does not exist:

```
No profile found. Generate one:
  /sunco:profile
```

---

## JSON Output (--json)

```json
{
  "generated": "{ISO}",
  "composite": 7.4,
  "archetype": "Structured Executor",
  "dimensions": {
    "planning_depth": { "score": 9, "confidence": "high", "signal": "..." },
    "execution_precision": { "score": 8, "confidence": "high", "signal": "..." },
    "verification_rigor": { "score": 6, "confidence": "high", "signal": "..." },
    "decision_quality": { "score": 7, "confidence": "high", "signal": "..." },
    "commit_hygiene": { "score": 5, "confidence": "high", "signal": "..." },
    "scope_management": { "score": 8, "confidence": "high", "signal": "..." },
    "knowledge_capture": { "score": 7, "confidence": "low", "signal": "..." },
    "velocity_consistency": { "score": 8, "confidence": "high", "signal": "..." }
  },
  "strengths": ["planning_depth", "scope_management", "execution_precision"],
  "growth_edges": ["commit_hygiene", "verification_rigor"],
  "data_sources": {
    "phases": 4,
    "plans": 18,
    "summaries": 14,
    "verifications": 2,
    "commits": 67
  }
}
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No `.planning/` directory | "No SUNCO project found. Run `/sunco:init` first." |
| Fewer than 2 phases | "Not enough data for a reliable profile. Complete at least 2 phases first." |
| No git history | Skip git-based dimensions (commit hygiene, velocity). Score as `(no data)`. |
| No SUMMARY.md files | Skip execution precision and lint rate. |
| USER-PROFILE.md not writable | Print profile to stdout only. |
| CLAUDE.md found but no `## Developer Profile` section | Write USER-PROFILE.md only. Do not modify CLAUDE.md. |

---

## Route

After generating: "Profile saved to `.planning/USER-PROFILE.md`. Run `/sunco:profile --view` to read it anytime."

If composite < 6: "Consider running `/sunco:health` to identify the structural issues driving lower scores."

If commit hygiene is the growth edge: "Add a conventional commit hook: `/sunco:quick 'add commitlint to dev workflow'`."
