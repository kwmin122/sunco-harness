---
name: sunco:headless
description: Run any skill in headless mode — JSON output, exit codes for CI/CD
allowed-tools:
  - Bash
  - Read
---

<objective>
Run any SUNCO skill in headless mode, which suppresses interactive UI, outputs structured JSON, and returns machine-readable exit codes. Use this in CI/CD pipelines, scripts, or any context where human-readable terminal output is not appropriate.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js headless <command> [args]`
   - Example: `node $HOME/.claude/sunco/bin/cli.js headless lint --json`
   - Example: `node $HOME/.claude/sunco/bin/cli.js headless health`
   - Example: `node $HOME/.claude/sunco/bin/cli.js headless validate`
2. Display the raw JSON output exactly as returned by the skill:
   - `success`: boolean
   - `summary`: one-line result description
   - `data`: skill-specific structured result data
   - `exitCode`: 0 for success, 1 for failure, 2 for warnings-only
3. Note the exit code convention:
   - `0` — skill succeeded, no issues
   - `1` — skill failed or found blocking errors
   - `2` — skill succeeded with warnings (non-blocking)
4. If no command is provided, list all skills available in headless mode with their expected JSON output shape.
5. Suggest: "Use `headless lint` in your CI pipeline to block merges on architecture violations."
</process>
