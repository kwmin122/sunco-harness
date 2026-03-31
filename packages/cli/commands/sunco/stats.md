---
name: sunco:stats
description: Display detailed project statistics — phases, plans, requirements coverage, git activity, time per phase, and LLM cost if tracked.
argument-hint: "[options]"
allowed-tools:
  - Read
  - Bash
---

<context>
**Arguments:**
- None. Outputs the full statistics report.

**Flags:**
- `--json` — Output raw statistics as JSON instead of formatted tables. Useful for scripting.
</context>

<objective>
Compute and display a structured statistics report for the current SUNCO project. Aggregates data from planning artifacts, git history, and STATE.md to give a full quantitative picture of project progress, velocity, and cost.

**After this command:** Use the data to assess project health or share progress with stakeholders.
</objective>

<process>
## Step 1: Read project artifacts

Read:
1. `.planning/STATE.md` — current phase, created date, LLM cost entries (if any)
2. `.planning/ROADMAP.md` — all phases with goals and milestone structure
3. `.planning/REQUIREMENTS.md` — full requirements list
4. `.planning/phases/*/` — all phase directories, enumerate plan files and summaries

## Step 2: Compute phase statistics

For each phase in ROADMAP.md:
- Determine status: planned / discussing / planned / executing / done / blocked
- Count PLAN.md files (total plans for that phase)
- Count SUMMARY.md files (completed plans)
- Derive: phases total, phases completed, phases in-progress, phases planned

## Step 3: Compute plan statistics

Walk all `.planning/phases/*/[N]-[M]-PLAN.md` files:
- Count total plans
- Count plans with a corresponding SUMMARY.md (completed)
- Derive: success rate = completed / total

## Step 4: Compute requirements coverage

Read REQUIREMENTS.md. Count all requirements (lines starting with `-` or numbered list items).

Scan all PLAN.md and SUMMARY.md files for requirement references.
Derive: total requirements, covered by at least one plan, coverage %.

## Step 5: Compute git statistics

```bash
# Total commits on this branch since project start
git log --oneline | wc -l

# Commits in current milestone (since last milestone tag or initial commit)
git log --oneline main..HEAD 2>/dev/null | wc -l

# Files changed across all commits
git diff --stat HEAD~$(git log --oneline | wc -l | tr -d ' ') HEAD 2>/dev/null | tail -1

# Lines added and removed (overall)
git log --shortstat | grep -E "insertion|deletion" | awk '{ins+=$4; del+=$6} END {print ins, del}'
```

## Step 6: Compute time statistics

From STATE.md: read project created date and last updated date.
From git log: get first commit date and most recent commit date.

For each completed phase: attempt to find phase start/end times from git log timestamps (using phase branch commits or SUMMARY.md timestamps).

Derive:
- Total project duration: days from first commit to today
- Average days per phase: total duration / completed phases (if > 0)

## Step 7: Compute LLM cost statistics

Scan STATE.md and all SUMMARY.md files for LLM cost entries (look for patterns like `cost:`, `tokens:`, `$` amounts, or a `## LLM Cost` section).

If any cost data found: aggregate by phase and total.
If no cost data found: show "Not tracked. Add cost entries to STATE.md to enable cost tracking."

## Step 8: Display statistics report

```
╔══════════════════════════════════════════════════════════════╗
║                     SUNCO PROJECT STATS                      ║
╚══════════════════════════════════════════════════════════════╝

Project: [name]
Branch:  [branch]
As of:   [today's date]

PHASES
------
Total phases:        [N]
  Completed:         [N]  ([%])
  In-progress:       [N]
  Planned:           [N]
  Blocked:           [N]

PLANS
-----
Total plans:         [N]
  Completed:         [N]
  In-progress:       [N]
  Success rate:      [%]

REQUIREMENTS
------------
Total requirements:  [N]
  Covered:           [N]
  Coverage:          [%]
  Uncovered:         [N]

GIT ACTIVITY
------------
Total commits:       [N]
Milestone commits:   [N]
Files changed:       [N]
Lines added:         +[N]
Lines removed:       -[N]

TIME
----
Project started:     [date]
Total duration:      [N] days
Avg days/phase:      [N] days
Fastest phase:       Phase [N] — [X] days
Slowest phase:       Phase [N] — [X] days

LLM COST
--------
[phase-by-phase cost table if data available]
[or "Not tracked" message]

Total estimated cost: $[X.XX]  (if tracked)
```

If `--json` flag provided: output the same data as a single JSON object instead of the formatted tables.

## Step 9: Callout

After the table, highlight any notable findings:
- If requirements coverage < 80%: "Coverage below 80% — consider adding plans to cover uncovered requirements."
- If any phases blocked: "X phase(s) are blocked — run `/sunco:verify [N]` to investigate."
- If success rate < 70%: "Plan success rate is below 70% — review plan quality with `/sunco:review [N]`."
- If no cost data: "Track LLM costs in STATE.md to enable cost reporting."
</process>
