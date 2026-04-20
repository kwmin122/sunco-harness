# .planning/router/

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## Purpose

Houses the SUNCO Workflow Router design, durable route decision logs, archived decisions, and current pause-state pointer. Defined fully in `DESIGN-v1.md`.

## Directory layout

- `DESIGN-v1.md` — release-grade design document for v1.5 SUNCO Workflow Router (captured 2026-04-20 post-v1.4 shipping; `popcoru@0.12.0` / tag `v0.12.0` / commit `94041a2`).
- `decisions/` — durable tier route decision logs (promoted per `DESIGN-v1.md` §4.2). *(not yet created; Phase 52b deliverable)*
- `archive/` — route decisions older than 180 days. *(not yet created; Phase 52b deliverable)*
- `paused-state.json` — current pause pointer (overwritten on pause/resume per §2.3 PAUSE contract). *(not yet created; Phase 52a/52b deliverable)*

## Status

v1.5 design captured and reviewed (4 convergent absorption rounds with plan-verifier and Codex). **Not yet registered** in `.planning/ROADMAP.md`; v1.5 kickoff deferred until user explicit `/sunco:new-milestone v1.5` invocation. This directory holds the design document only.

## Relationship to `.planning/compound/`

Compound engine is a Phase 54 deliverable (post-router). Its namespace (`.planning/compound/`) will be created when Phase 54 executes. Router and compound design are combined in this single `DESIGN-v1.md` for readability; separation into distinct docs may occur during Phase 52a.
