---
name: sunco:query
description: Instant JSON state snapshot — phase, progress, next action (no LLM)
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO query skill to produce an instant, structured JSON snapshot of the entire project state — no LLM, no analysis, pure data retrieval. Useful for agents that need to read current state programmatically, for CI pipelines, or for debugging state inconsistencies.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js query`
2. Display the raw JSON output. The snapshot includes:
   - `phase`: current phase id, name, stage
   - `progress`: percentage complete, tasks done/total
   - `lastSkillRun`: skill id, timestamp, success/failure
   - `nextAction`: recommended next skill from the 50+ rule recommender
   - `health`: last health score and timestamp
   - `lint`: last lint result (errorCount, warningCount)
   - `init`: detected preset, ecosystems, layers
   - `session`: active since, context token estimate
3. After displaying the snapshot:
   - If `nextAction` is present, suggest running that command
   - If `lint.errorCount > 0`, note that lint violations need to be resolved
   - If the snapshot is empty or minimal, suggest running `/sunco:init` first to populate state
</process>
