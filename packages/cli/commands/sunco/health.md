---
name: sunco:health
description: Codebase health score with trend tracking
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO health skill to compute a composite codebase health score across multiple dimensions: architecture compliance, test coverage, code complexity, documentation completeness, and dependency hygiene. Tracks score over time so degradation is visible.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js health`
   - Optional: add `--trend` to show score history across previous runs
2. Display the output clearly:
   - Overall health score (0–100) with a grade (A/B/C/D/F)
   - Per-dimension breakdown: architecture, tests, complexity, docs, dependencies
   - Any critical issues that are dragging the score down
   - If `--trend` was used, show the score history table
3. Based on the score:
   - Score ≥ 80: Suggest keeping the score high by running `/sunco:lint` before each commit
   - Score 60–79: Highlight the top 2–3 dimensions to improve, suggest specific next commands
   - Score < 60: Show the highest-impact issues and suggest starting with `/sunco:lint --fix`
4. If the score has dropped compared to the last run, flag the regression clearly.
</process>
