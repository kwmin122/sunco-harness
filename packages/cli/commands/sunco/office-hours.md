---
name: sunco:office-hours
description: Pre-project brainstorming with forced questions. Startup mode (6 diagnostic questions) or Builder mode (generative design). Produces design docs, not code.
argument-hint: ""
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - Agent
  - WebSearch
  - AskUserQuestion
---

<context>
No arguments. Interactive session — mode selected during the process.
</context>

<objective>
Ensure the problem is deeply understood before solutions are proposed. Produce a structured design document — not code. Two modes: Startup (hard diagnostic questions) and Builder (enthusiastic design partner).

**Default chain for new projects:** After the office-hours design doc is approved, continue to `/sunco:brainstorming`; after brainstorming approval, continue to `/sunco:new --from-preflight <spec-path>`.

**Standalone use:** If the user explicitly asks only for office-hours, stop after the design doc and suggest review commands.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/office-hours.md end-to-end.
</process>

<success_criteria>
- Mode selected (Startup or Builder)
- All applicable questions asked ONE AT A TIME
- Premises challenged before proposing solutions
- 2-3 distinct implementation approaches generated
- Design doc written to `.sun/designs/`
- Design doc reviewed by adversarial subagent
- Concrete next action assigned (`/sunco:brainstorming` by default for project starts)
- No code written or scaffolded
</success_criteria>
