---
name: sunco:export
description: Generate self-contained HTML project report
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO export skill to generate a self-contained HTML report of the current project state — including phase progress, health score, lint status, dependency graph, and session history. The HTML file is fully portable (no external dependencies) and can be shared or archived.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js export --html`
   - Optional: add `--output <path>` to specify the output file path (default: `./sunco-report.html`)
2. Display the output clearly:
   - The path where the HTML report was written
   - A summary of what sections are included in the report
   - File size of the generated report
3. After generation:
   - Confirm the file exists by reading its first few lines or checking file size
   - Suggest: "Open `sunco-report.html` in a browser to view the full interactive report"
   - If the project has never run `/sunco:init` or `/sunco:health`, note that the report will have limited data — suggest running those skills first for a richer report
</process>
