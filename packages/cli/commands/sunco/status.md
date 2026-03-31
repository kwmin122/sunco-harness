---
name: sunco:status
description: Show current project status, phase, and progress
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO status skill to display a human-readable summary of the current project state: active phase, completion percentage, recent activity, pending blockers, and the recommended next action.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js status`
2. Display the output clearly:
   - Current phase name and number (e.g., "Phase 3: Execute — Implement skill registry")
   - Progress percentage for the current phase
   - Summary of completed tasks vs. remaining tasks
   - Any blockers or warnings (failed verifications, unresolved todos)
   - Last active timestamp
   - Recommended next action from the proactive recommender
3. Based on the status:
   - If a phase is in progress: Suggest the specific next command to advance it
   - If a phase just completed: Suggest `/sunco verify` or moving to the next phase
   - If there are blockers: Highlight them prominently and suggest resolution steps
   - If no active phase exists: Suggest `/sunco:init` or `/sunco new` to start
</process>
