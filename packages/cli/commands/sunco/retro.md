---
name: sunco:retro
description: Weekly engineering retrospective. Analyzes commit history, work patterns, code quality metrics with persistent history and trend tracking. Team-aware with per-person breakdown.
argument-hint: "[<window>] [compare] [--team]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Arguments:**
- `<window>` — Time window. Default: 7d. Examples: 24h, 14d, 30d.
- `compare` — Compare current window vs prior same-length window.
- `--team` — Include per-contributor breakdown.

**Examples:**
- `/sunco:retro` — Last 7 days
- `/sunco:retro 14d` — Last 14 days
- `/sunco:retro compare` — This week vs last week
- `/sunco:retro 30d --team` — 30-day team retro
</context>

<objective>
Generate a comprehensive engineering retrospective with commit analysis, session detection, hotspot analysis, and actionable insights. Saves history for trend tracking across retros.

**After this command:** Review insights and plan next week's focus.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/retro.md end-to-end.
</process>

<success_criteria>
- Metrics table: commits, LOC, test ratio, active days, sessions
- Commit time distribution histogram
- Work session detection (deep/medium/micro)
- Commit type breakdown (feat/fix/refactor/test/chore)
- Hotspot analysis (top changed files)
- Streak tracking (consecutive shipping days)
- Trend comparison if prior retro exists
- History saved to `.sun/retros/`
- Tweetable summary line
</success_criteria>
