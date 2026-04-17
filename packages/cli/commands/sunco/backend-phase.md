---
name: sunco:backend-phase
description: Generate backend design contract for API/data/event/ops surfaces. Dispatcher — --surface flag REQUIRED (no default).
argument-hint: "<phase> --surface {api|data|event|ops}"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.

**Flags:**
- `--surface {api|data|event|ops}` — **REQUIRED**. No default (unlike `/sunco:ui-phase` which defaults to `cli`). Specifies the backend surface: API contracts, data schemas, event contracts, or ops runbooks. Introduced in Phase 37/M1.3. Explicit-only — no auto-detection.
</context>

<objective>
Dispatch to the backend-surface workflow via the `backend-phase.md` router. Phase 37/M1.3 introduces the dispatcher skeleton; surface-specific workflows for api/data are populated in Phase 45/M3.4 and for event/ops in Phase 46/M3.5. Until populated, each stub emits a "pending" message and exits cleanly without writing artifacts.

**Creates:** delegated to surface-specific workflow once populated (Phase 45-46).

**After this command:** once stubs are populated, runs the selected backend surface workflow for the given phase. During Phase 37/M1.3, the command completes with a stub message.
</objective>

<process>
Follow instructions in `workflows/backend-phase.md` (router). The router validates `--surface` (required, enum: api|data|event|ops, lowercase-normalize, last-wins on duplicate, both `--surface <v>` and `--surface=<v>` forms) and dispatches to the appropriate stub file.
</process>
