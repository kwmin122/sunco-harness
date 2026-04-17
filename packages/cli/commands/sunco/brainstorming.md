---
name: sunco:brainstorming
description: Run the vendored Superpowers brainstorming flow before SUNCO project planning.
argument-hint: "[idea or @design-doc] [--visual]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
  - Task
  - AskUserQuestion
---

<flags>
- `--visual` — Boot the vendored Superpowers visual companion (local HTTP server serving mockups, wireframes, diagrams) alongside the brainstorming agent. The server URL is passed to the agent so it knows it can publish visual content when a question warrants it. Use when the idea involves layout, UI, or spatial reasoning.
</flags>

<context>
This command is the SUNCO wrapper for Superpowers' `brainstorming` skill.

The Superpowers skill content is vendored verbatim at:
`$HOME/.claude/sunco/references/superpowers/brainstorming/SKILL.md`

For non-Claude runtimes, installer path replacement maps `.claude/` to the active runtime directory.
</context>

<objective>
Run Superpowers brainstorming exactly as the design/spec layer, then hand the approved spec to `/sunco:new` so SUNCO can generate `.planning/` artifacts.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/brainstorming.md end-to-end.
</process>

<success_criteria>
- Superpowers brainstorming source was read from the vendored reference.
- No implementation or scaffolding happened during brainstorming.
- A design/spec was approved by the user.
- The next step is `/sunco:new --from-preflight [spec]`, not implementation.
</success_criteria>
