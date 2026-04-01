---
name: sunco:guard
description: Real-time lint-on-change with rule promotion. Use --draft-claude-rules to generate conditional .claude/rules/ files from recurring violations.
argument-hint: "[--watch] [--draft-claude-rules] [--blast-radius]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Flags:**
- `--watch` — Enable watch mode (default behavior). Guard re-lints on every file save.
- `--draft-claude-rules` — Analyze codebase patterns and generate conditional `.claude/rules/*.md` files with frontmatter globs. Each rule activates only when the agent touches matching files.
- `--blast-radius` — Enable blast radius monitoring. Flag when a single change touches more than 10 files.
</context>

<objective>
Run the SUNCO guard skill to watch the filesystem for changes and surface violations immediately. Repeated violations can be promoted to permanent rules.

With `--draft-claude-rules`: scan the codebase for patterns that agents commonly get wrong, and generate `.claude/rules/` files with conditional frontmatter so they only load when relevant files are touched. This is the proactive side of guard — teaching agents before they make mistakes, not catching mistakes after.

The generated rules follow the template format in `$HOME/.claude/sunco/templates/claude-rules/`.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/guard-watch.md end-to-end.
</process>

<success_criteria>
**Watch mode:**
- Guard watching directories confirmed
- File changes trigger automatic lint
- Violations surfaced immediately with fix suggestions
- Recurring violations suggest rule promotion

**--draft-claude-rules mode:**
- Codebase scanned for pattern categories (skill, API, test, architecture, config)
- Rules generated ONLY for patterns the codebase actually uses
- Each rule file has correct frontmatter `patterns:` matching relevant file globs
- Rules written to `.claude/rules/` (or previewed if `--dry-run`)
- No duplicate rules generated for patterns already covered
- User presented with generated rules for review before writing
</success_criteria>
