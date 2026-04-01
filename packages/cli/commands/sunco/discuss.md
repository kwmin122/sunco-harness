---
name: sunco:discuss
description: Extract decisions and clarify gray areas for a phase before planning. Reads ROADMAP.md, asks focused questions (max 5-7), writes CONTEXT.md. Use --auto to skip questions and pick recommended defaults.
argument-hint: "<phase> [--auto] [--batch] [--mode discuss|assumptions]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number (e.g., `1`, `2`). Required.

**Flags:**
- `--auto` — Skip all interactive questions. Pick the recommended option for every gray area. Auto-advance to `/sunco:plan [N]` after writing CONTEXT.md.
- `--batch` — Ask all questions together in a single grouped prompt.
- `--mode assumptions` — Read codebase first, surface what the agent would assume and do. No questions asked.
- `--mode discuss` — (default) Interactive discussion mode. Ask focused questions one at a time.
</context>

<objective>
Extract implementation decisions that downstream planning agents need. Analyze the phase, surface gray areas that could go multiple ways, ask focused questions, and write a CONTEXT.md that makes planning deterministic.

Creates `.planning/phases/[N]-[name]/[N]-CONTEXT.md` with decisions, constraints, assumptions, and out-of-scope items.

After completion: run `/sunco:plan [N]` to create execution plans using this context.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/discuss-phase.md end-to-end.
</process>

<success_criteria>
- `.planning/phases/[N]-[name]/[N]-CONTEXT.md` written with all gray areas resolved
- Decisions table populated with choice, reason, and impact for each gray area
- Constraints, out-of-scope items, and assumptions sections complete
- STATE.md updated: phase status set to `context_ready`, next_step set to `/sunco:plan [N]`
- Changes committed: `docs(phase-[N]): capture discussion context and decisions`
- User informed of next step: `/sunco:plan [N]`
</success_criteria>
