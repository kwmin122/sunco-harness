# Retro — Weekly Engineering Retrospective

Comprehensive engineering retrospective analyzing commit history, work patterns, and code quality metrics. Team-aware: identifies the current user, then analyzes all contributors.

---

## Arguments

Parse `$ARGUMENTS`:
- No args → 7d window
- `<N>d` or `<N>h` → custom window (e.g., `14d`, `24h`)
- `compare` → compare current window vs prior same-length window
- `compare <N>d` → compare with explicit window
- `--team` → include per-contributor breakdown

**Argument validation:** If doesn't match expected format:
```
Usage: /sunco:retro [window | compare] [--team]
  /sunco:retro              — last 7 days (default)
  /sunco:retro 24h          — last 24 hours
  /sunco:retro 14d          — last 14 days
  /sunco:retro compare      — compare this period vs prior period
  /sunco:retro 30d --team   — 30-day team retro
```

---

## Step 1: Gather Raw Data

Detect the default branch:
```bash
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")
```

Identify the current user:
```bash
git config user.name
git config user.email
```

Compute midnight-aligned start date. For day units: explicit ISO datetime at midnight. For hour units: relative string.

Run these git commands in parallel:

```bash
# 1. All commits in window with stats
git log origin/$DEFAULT_BRANCH --since="<window>" --format="%H|%aN|%ae|%ai|%s" --shortstat

# 2. Per-commit LOC breakdown (test vs prod)
git log origin/$DEFAULT_BRANCH --since="<window>" --format="COMMIT:%H|%aN" --numstat

# 3. Commit timestamps for session detection
git log origin/$DEFAULT_BRANCH --since="<window>" --format="%at|%aN|%ai|%s" | sort -n

# 4. Hotspot analysis (most frequently changed files)
git log origin/$DEFAULT_BRANCH --since="<window>" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn

# 5. Per-author commit counts
git shortlog origin/$DEFAULT_BRANCH --since="<window>" -sn --no-merges

# 6. Test file count
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' 2>/dev/null | grep -v node_modules | wc -l

# 7. Test files changed in window
git log origin/$DEFAULT_BRANCH --since="<window>" --format="" --name-only | grep -E '\.(test|spec)\.' | sort -u | wc -l
```

---

## Step 2: Compute Metrics

| Metric | Value |
|--------|-------|
| Commits to default branch | N |
| Contributors | N |
| Total insertions | N |
| Total deletions | N |
| Net LOC added | N |
| Test LOC (insertions) | N |
| Test LOC ratio | N% |
| Active days | N |
| Detected sessions | N |
| Avg LOC/session-hour | N |

Per-author leaderboard:
```
Contributor         Commits   +/-          Top area
You (name)              32   +2400/-300   packages/cli/
alice                    12   +800/-150    packages/core/
```

Sort by commits descending. Current user first, labeled "You (name)".

---

## Step 3: Commit Time Distribution

Hourly histogram in local time:
```
Hour  Commits  ████████████████
 00:    4      ████
 07:    5      █████
 ...
```

Call out: peak hours, dead zones, bimodal patterns, late-night clusters.

---

## Step 4: Work Session Detection

Detect sessions using **45-minute gap** threshold between consecutive commits.

Classify:
- **Deep sessions** (50+ min)
- **Medium sessions** (20-50 min)
- **Micro sessions** (<20 min)

Calculate:
- Total active coding time
- Average session length
- LOC per hour of active time

---

## Step 5: Commit Type Breakdown

Categorize by conventional commit prefix (feat/fix/refactor/test/chore/docs):
```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
refactor:  2  ( 4%)  ██
```

Flag if fix ratio exceeds 50% — signals "ship fast, fix fast" pattern.

---

## Step 6: Hotspot Analysis

Top 10 most-changed files. Flag:
- Files changed 5+ times (churn hotspots)
- Test vs production files in hotspot list
- VERSION/CHANGELOG frequency (version discipline)

---

## Step 7: Focus Score

Calculate percentage of commits touching the single most-changed top-level directory. Higher = deeper focused work. Lower = scattered context-switching.

Report: "Focus score: 62% (packages/cli/)"

---

## Step 8: Streak Tracking

```bash
# Team streak
git log origin/$DEFAULT_BRANCH --format="%ad" --date=format:"%Y-%m-%d" | sort -u

# Personal streak
git log origin/$DEFAULT_BRANCH --author="<user_name>" --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

Count backward from today — consecutive days with commits.
- "Team shipping streak: N consecutive days"
- "Your shipping streak: N consecutive days"

---

## Step 9: Load History & Compare

```bash
ls -t .sun/retros/*.json 2>/dev/null
```

If prior retros exist: load most recent, calculate deltas:
```
                    Last        Now         Delta
Test ratio:         22%    →    41%         ↑19pp
Sessions:           10     →    14          ↑4
LOC/hour:           200    →    350         ↑75%
Fix ratio:          54%    →    30%         ↓24pp (improving)
```

If `compare` mode: load the retro from the prior window and compare explicitly.

If no prior retros: "First retro recorded — run again next week to see trends."

---

## Step 10: Save History

```bash
mkdir -p .sun/retros
```

Save JSON snapshot to `.sun/retros/{date}-{sequence}.json`:

```json
{
  "date": "2026-04-02",
  "window": "7d",
  "metrics": {
    "commits": 47,
    "contributors": 3,
    "insertions": 3200,
    "deletions": 800,
    "net_loc": 2400,
    "test_loc": 1300,
    "test_ratio": 0.41,
    "active_days": 6,
    "sessions": 14,
    "deep_sessions": 5,
    "avg_session_minutes": 42,
    "loc_per_session_hour": 350,
    "feat_pct": 0.40,
    "fix_pct": 0.30,
    "peak_hour": 22,
    "ai_assisted_commits": 32
  },
  "authors": {
    "Name": { "commits": 32, "insertions": 2400, "deletions": 300, "test_ratio": 0.41, "top_area": "packages/cli/" }
  },
  "streak_days": 47,
  "tweetable": "Week of Mar 26: 47 commits, 3.2k LOC, 41% tests, peak: 10pm"
}
```

---

## Step 11: Write Narrative

Structure output as:

1. **Tweetable summary** (first line)
2. **Metrics table**
3. **Leaderboard** (if --team or multiple contributors)
4. **Time distribution** (histogram)
5. **Sessions** (deep/medium/micro breakdown)
6. **Commit types** (feat/fix/refactor bar chart)
7. **Hotspots** (top 10 files)
8. **Focus score**
9. **Streak**
10. **Trends** (if prior retro exists)
11. **Insights** (2-3 actionable observations)

Insights should be specific and actionable:
- "Your fix ratio dropped from 54% to 30% — fewer firefights this week."
- "3 deep sessions this week vs 1 last week — you're finding flow state."
- "packages/cli/workflows/ is a churn hotspot (changed 12 times). Consider if these files are stabilizing."
