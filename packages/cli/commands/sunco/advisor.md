---
name: sunco:advisor
description: Ambient advisor debug surface — classify a task, inspect the last decision, reconfigure advisor model/thinking tier.
argument-hint: "[\"<task>\"] [--reconfigure | --last | --json | --verbose | --model <id> | --thinking <tier>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<context>
The real product experience is the ambient hooks (Phase 2 UserPromptSubmit injection + Phase 3 PostToolUse queue). This command is the **debug surface**: it does not write code, never runs skills, and never auto-deploys.

Four flows:

**1. Classify a task (default flow).**
```
/sunco:advisor "refactor the auth middleware for multi-tenant support"
```
Runs the deterministic risk classifier + advisor policy and prints the decision (Risk/Suggestion/Skip). Use `--verbose` to see reasonCodes, gates, and the raw XML block that would be injected. Use `--json` for programmatic callers (Codex CLI, external tools).

**2. Reconfigure.**
```
/sunco:advisor --reconfigure
```
Runs the first-run picker, detects providers (Anthropic SDK, Claude CLI, Codex CLI, OPENAI_API_KEY, GOOGLE_API_KEY), shows default options plus any detected advanced options, and rewrites `~/.sun/config.toml` `[advisor]` block.

**3. Show last decision.**
```
/sunco:advisor --last
```
Tails `~/.sun/advisor.log` (JSONL, one decision per line).

**4. One-shot override.**
```
/sunco:advisor --model claude-sonnet-4-6 --thinking max "<task>"
```
Uses a different model/thinking tier for just this call without touching `config.toml`.

**Never:**
- writes code
- runs `/sunco:*` skills (autoExecuteSkills is permanently false)
- pushes / deploys
</context>

<objective>
Expose the deterministic advisor engine (Phase 1) as a slash command available in all four runtimes (Claude Code / Codex / Cursor / Antigravity). This is the path non-Claude runtimes must use, since the ambient hooks are Claude-only.
</objective>

<success_criteria>
- `~/.sun/config.toml` contains a well-formed `[advisor]` block with `auto_execute_skills = false` after `--reconfigure`.
- `--json` emits a parseable object with `decision`, `config`, `picker`.
- `--verbose` shows gates and XML injection without hiding anything.
- Every non-`--reconfigure` invocation completes in a single tool call — no side effects beyond logging.
</success_criteria>
