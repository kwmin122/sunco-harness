---
name: sunco:agents
description: Analyze agent instruction files (CLAUDE.md) — efficiency score
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO agents skill to audit agent instruction files (CLAUDE.md, .cursorrules, system prompts) for quality, completeness, and token efficiency. Produces an efficiency score and actionable recommendations to reduce agent errors and wasted context.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js agents`
2. Display the output clearly:
   - Files analyzed (CLAUDE.md, nested instruction files, etc.)
   - Efficiency score per file (0–100): token density, instruction clarity, redundancy
   - Issues found: vague instructions, contradictions, missing constraints, bloat
   - Recommended rewrites or additions for the highest-impact gaps
3. Based on the results:
   - If efficiency score < 70: Show the top 3 specific improvements with example rewrites
   - If contradictions are detected: Highlight them clearly — they cause agent confusion
   - If instruction files are missing entirely: Suggest running `/sunco:init` which generates a baseline CLAUDE.md scaffold
4. After analysis, suggest: "Update your CLAUDE.md based on these findings, then re-run `/sunco:agents` to verify improvement."
</process>
