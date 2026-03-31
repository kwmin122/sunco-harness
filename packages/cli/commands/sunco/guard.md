---
name: sunco:guard
description: Real-time lint-on-change with rule promotion
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO guard skill to watch the filesystem for changes and automatically run architecture lint on every saved file. Violations are surfaced immediately so they are fixed at the point of introduction rather than discovered later. Repeated violations can be promoted to permanent rules.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js guard`
   - Optional: add `--watch` to explicitly enable watch mode (default behavior)
2. Display the output clearly:
   - Confirmation that guard is watching (show the directories being monitored)
   - For each file change detected: the file path and lint result (clean or violations)
   - For each violation found in watch mode: show the same structured output as `/sunco:lint`
3. When a violation is detected in watch mode:
   - Show the violation details immediately
   - Suggest: "Fix the violation and save — guard will re-lint automatically"
   - If the same violation appears multiple times across different files, suggest: "This pattern is recurring — consider promoting it to a permanent rule with `/sunco:settings`"
4. Guard runs as a long-lived process. Inform the user it will keep watching until interrupted (Ctrl+C).
</process>
