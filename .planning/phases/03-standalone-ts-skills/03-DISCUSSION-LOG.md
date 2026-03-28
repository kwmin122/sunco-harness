# Phase 3: Standalone TS Skills - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 03-standalone-ts-skills
**Areas discussed:** Status display, Idea capture, Phase management, Settings UI, Session management
**Mode:** Auto (all areas selected, recommended defaults chosen)

---

## Status Display

| Option | Description | Selected |
|--------|-------------|----------|
| File-based parsing | Read ROADMAP.md + STATE.md directly | ✓ |
| Database-driven | Store progress in SQLite | |

**User's choice:** [auto] File-based parsing with Ink visual output
**Notes:** ROADMAP.md and STATE.md are the source of truth. No need to duplicate in SQLite.

## Idea Capture

| Option | Description | Selected |
|--------|-------------|----------|
| Separate skills, shared backend | note/todo/seed/backlog as individual skills using StateApi | ✓ |
| Single unified skill | One `sunco ideas` with subcommands | |

**User's choice:** [auto] Separate skills with shared StateApi/FileStore backend
**Notes:** Each skill has distinct UX. Separate skills align with SUN's skill-only architecture.

## Phase Management

| Option | Description | Selected |
|--------|-------------|----------|
| ROADMAP.md direct manipulation | Parse and rewrite markdown | ✓ |
| Structured data + render | Store in SQLite, render to markdown | |

**User's choice:** [auto] Direct ROADMAP.md manipulation via regex parsing
**Notes:** ROADMAP.md is human-editable and git-tracked. Direct manipulation preserves this.

## Settings UI

| Option | Description | Selected |
|--------|-------------|----------|
| Enhanced Ink interactive | Tree-view navigation with inline editing | ✓ |
| Plain text output | Keep current --key query style only | |

**User's choice:** [auto] Enhanced Ink interactive tree-view with preserved --key for scripting
**Notes:** Interactive mode for exploration, --key/--set for scripting.

## Session Management

| Option | Description | Selected |
|--------|-------------|----------|
| HANDOFF.json flat structure | Simple flat JSON in .sun/ | ✓ |
| Nested state snapshot | Deep clone of all state | |

**User's choice:** [auto] Flat HANDOFF.json with essential context only
**Notes:** Must be readable by humans. Simple structure.

## Claude's Discretion

- Ink component layouts, SQLite schemas, HANDOFF.json field names, note file naming

## Deferred Ideas

None
