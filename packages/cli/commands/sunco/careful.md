---
name: sunco:careful
description: Safety guardrails for destructive commands. Warns before rm -rf, DROP TABLE, force-push, git reset --hard, kubectl delete, and similar destructive operations.
argument-hint: ""
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<context>
No arguments. Activating this command enables destructive command detection for the session.
</context>

<objective>
Enable safety mode. Every bash command will be checked for destructive patterns before execution. Detected destructive commands trigger a warning with option to proceed or cancel.

**After this command:** Work normally — guardrails are active in the background.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/careful.md end-to-end.
</process>

<success_criteria>
- Safety mode activated and confirmed
- Destructive patterns monitored: rm -rf, DROP TABLE, TRUNCATE, force-push, reset --hard, checkout ., kubectl delete, docker system prune
- Safe exceptions allowed: rm -rf node_modules, dist, .next, __pycache__, .cache, build, .turbo, coverage
- User warned before any destructive command
- User can override each warning
</success_criteria>
