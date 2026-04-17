---
name: sunco:backend-review
description: Retroactive audit of backend implementation across API/data/event/ops surfaces. Dispatcher — --surface flag REQUIRED (no default).
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
- `--surface {api|data|event|ops}` — **REQUIRED**. No default (unlike `/sunco:ui-review`). Specifies the backend surface to audit: API contracts, data schemas, event contracts, or ops runbooks. Introduced in Phase 37/M1.3. Explicit-only — no auto-detection.
</context>

<objective>
Dispatch to the backend-surface review workflow via the `backend-review.md` router. Phase 37/M1.3 introduces the dispatcher skeleton; all four surface-specific review workflows are populated in Phase 47/M3.6 (parallel to M3.4/M3.5 phase contracts). Until populated, each stub emits a "pending" message and exits cleanly without writing artifacts.

**Creates:** delegated to surface-specific workflow once populated (Phase 47/M3.6).

**After this command:** once stubs are populated, runs the selected backend surface review for the given phase. During Phase 37/M1.3, the command completes with a stub message.
</objective>

<process>
Follow instructions in `workflows/backend-review.md` (router). The router validates `--surface` (required, enum: api|data|event|ops, lowercase-normalize, last-wins on duplicate, both `--surface <v>` and `--surface=<v>` forms) and dispatches to the appropriate stub file.
</process>
