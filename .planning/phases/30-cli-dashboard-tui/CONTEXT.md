# Phase 30: CLI Dashboard TUI - Context

**Gathered:** 2026-04-10
**Status:** Candidate — pending prioritization
**Upstream:** Phase 27 (OMO UX patterns)

<domain>
## Phase Boundary

This phase delivers a read-only terminal UI (TUI) built with Ink that consumes `.sun/active-work.json` and related state. It surfaces the active phase, background work, blocked status, and recent skill calls in near real time. The dashboard is display-only: no writes to project state, no interactive commands that mutate workflows—operators get situational awareness without a second control plane.

Out of scope for this phase: editing plans from the TUI, triggering skills from the dashboard, or replacing `sunco status` one-shot output entirely (the TUI is an additive, live view).
</domain>

<decisions>
## Open Questions (pre-discuss)

1. **Entry point** — Dedicated `sunco dashboard` (or equivalent) vs extending `sunco status --live`?
2. **Refresh model** — Polling interval for `.sun/active-work.json` (and whether to watch the file system where available)?
3. **Stack** — Ink vs alternatives such as blessed-contrib for layout/widgets and terminal compatibility?
4. **Compatibility** — Minimum terminal size, color assumptions, and CI/headless behavior (graceful degrade vs refuse to run)?
5. **Parity with Oh-My-OpenCode** — Which OMO dashboard behaviors are must-match vs inspiration-only for v1?
</decisions>

<canonical_refs>
## References

- `packages/core/src/state/active-work.ts`
- `packages/skills-workflow/src/status.skill.ts`
- Oh-My-OpenCode dashboard (reference implementation for live harness/status UX)
</canonical_refs>

<deferred>
## Deferred

- Writable panels (approvals, todo edits) from the TUI.
- Remote/multi-machine aggregation of active work.
- Web or GUI equivalents of the same dashboard.
</deferred>
