---
name: sunco:lint
description: Check architecture boundaries — dependency direction, layer violations
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO architecture linter to detect boundary violations — imports going in the wrong direction across layers (e.g., domain importing from infra), circular dependencies, and convention breaches. 100% deterministic: zero LLM cost. "The linter teaches while blocking."
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js lint`
   - Optional: add `--fix` to auto-fix deterministic violations
   - Optional: add `--json` to output violations as structured JSON for agent consumption
   - Optional: add `--files <glob>` to lint a specific subset of files
2. Display the output clearly:
   - Total files linted, error count, warning count
   - For each violation: file path, line/column, which layer rule was violated, and the fix instruction
   - If zero violations: show "All architecture boundaries respected"
3. If errors are found:
   - Group violations by rule type for readability
   - Highlight the most critical errors first
   - Suggest: "Run `/sunco:lint --fix` to auto-fix deterministic violations"
4. If `sunco init` has not been run, the command will report that and stop — suggest running `/sunco:init` first.
5. After a clean lint, suggest: "Run `/sunco:health` for the full codebase health score."
</process>
