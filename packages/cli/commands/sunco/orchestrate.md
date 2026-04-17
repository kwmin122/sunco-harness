---
name: sunco:orchestrate
description: Dynamic multi-agent router — signal-driven role selection (explorer/librarian/oracle/developer/frontend/docs/verifier). Orchestrator never writes code itself.
argument-hint: "\"<task description>\" [--plan] [--stop-on-fail]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
  - Task
  - AskUserQuestion
---

<context>
`/sunco:orchestrate` is SUNCO's signal-driven orchestration front-door. Inspired by OmO's Sisyphus (AGPL-3.0, principles only — NOT vendored) and gstack's role-based sprint discipline. The router itself is deterministic (regex/keyword signals, zero LLM cost); only the delegated roles call LLMs.

**Contract:**
- The orchestrator never writes code itself. Writing roles are always delegated.
- There is no fixed pipeline. Step list is derived from the detected signals in your task.
- Read-only roles (explorer, librarian, oracle, verifier) run before write roles (developer, frontend, docs, debugger).
- A Context Pack threads across steps so later roles do not re-ask what earlier roles answered.

**Roles:**

| Role | When it fires | Delegates to |
|---|---|---|
| explorer | Unknown location, no exact file in request | `workflow.scan` |
| librarian | External API / SDK / docs lookup | `workflow.research` |
| oracle | Risky / cross-file / refactor / migration | `sunco-reviewer` subagent (read-only architecture review) |
| developer | Backend/logic write step | `workflow.quick` |
| frontend | UI/UX/styling/.tsx work | `workflow.quick` (UI context) |
| docs | Docs-only change | `workflow.doc` |
| verifier | Close the loop after a write step | `workflow.verify` |
| debugger | Test failure or bug investigation | `workflow.debug` |

**Flags:**
- `--plan` / `--dry-run` — Print the routed plan and exit. No execution.
- `--stop-on-fail` — Abort the chain at the first failed step. Default: continue with remaining read-only steps.
</context>

<objective>
Accept a natural-language task, detect routing signals, build an ordered plan, and execute each step with a Context Pack threaded between them. Return structured outcomes so the user can see which role did what and why.
</objective>

<process>
Implementation lives in `@sunco/skills-workflow/orchestrate`. The runtime loads it directly via `/sunco:orchestrate "<task>"`.

**Routing recipes (from shared/orchestration-router.ts):**

- exact-file + low risk → developer only
- unknown location → explorer → developer → verifier
- external API → librarian → developer → verifier
- risky refactor → oracle → developer → oracle → verifier
- UI-only → frontend → verifier
- docs-only → docs (short-circuit)
- test failure → debugger → verifier
- explicit verify request → verifier (only)
</process>

<success_criteria>
- Plan visible to the user (rationale + signals + ordered steps)
- Every step's delegate is a real SUNCO skill or a declared subagent name
- Context Pack carries original request + prior outputs across steps
- No step violates its read-only flag
- Default path works on a minimal install (no required config)
</success_criteria>
