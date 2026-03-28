# Phase 3: Standalone TS Skills - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected (all gray areas, recommended defaults)

<domain>
## Phase Boundary

7 deterministic standalone skills for session management, idea capture, phase control, settings, and progress tracking. All instant, all zero LLM cost. Skills: `sunco status`, `sunco note`, `sunco todo`, `sunco seed`, `sunco phase`, `sunco settings` (enhanced), `sunco resume`/`sunco pause`/`sunco context`.

14 requirements: SES-01 through SES-05, IDX-01 through IDX-04, PHZ-01 through PHZ-03, SET-01, WF-08

</domain>

<decisions>
## Implementation Decisions

### Status Display (SES-01, WF-08)
- **D-01:** `sunco status` reads .planning/ROADMAP.md + .planning/STATE.md to show: current phase, plan progress, what's done, what's next. Pure file parsing — no database queries needed beyond StateApi.
- **D-02:** Visual progress uses Ink components: phase progress bar, plan checklist with checkmarks, "Next Best Action" recommendation at bottom.
- **D-03:** `sunco status` also serves as the entry point for `sunco progress` (WF-08) — same skill, aliased command.
- **D-04:** Output: terminal table with phase list, colored status indicators (complete/in-progress/not-started), current position highlight.

### Idea Capture (IDX-01 through IDX-04)
- **D-05:** `sunco note "text"` writes to .sun/notes/ as timestamped markdown files. `--tribal` flag writes to .sun/tribal/ instead (integrates with guard skill's tribal loader from Phase 2).
- **D-06:** `sunco todo add "task"` / `sunco todo list` / `sunco todo done <id>` — manages a todo list in .sun/ SQLite via StateApi. Simple CRUD. IDs are auto-incrementing integers.
- **D-07:** `sunco seed "idea" --trigger "when phase 5 starts"` — stores ideas in .sun/ SQLite with a trigger condition string. Seeds surface automatically when condition matches (checked by recommender rules).
- **D-08:** `sunco backlog` — lists items from .sun/ SQLite backlog table. `sunco backlog add "item"` / `sunco backlog promote <id>` moves to active roadmap.
- **D-09:** All 4 skills (note, todo, seed, backlog) are separate skill files but share the StateApi/FileStore backends.

### Phase Management (PHZ-01 through PHZ-03)
- **D-10:** `sunco phase add "Name"` — appends a new phase to ROADMAP.md with the next sequential number. Creates the phase directory.
- **D-11:** `sunco phase insert "Name" --after 3` — inserts as decimal phase (e.g., 3.1). Does NOT renumber existing phases.
- **D-12:** `sunco phase remove <number>` — removes a future (not started) phase from ROADMAP.md. Renumbers subsequent phases to close the gap. Refuses to remove in-progress or completed phases.
- **D-13:** All 3 operations parse and rewrite ROADMAP.md. Use regex-based parsing of the markdown structure (phase headers, checkboxes, progress table).

### Settings Interactive UI (SET-01)
- **D-14:** Enhanced `sunco settings` (replacing the Phase 1 basic version). Interactive Ink UI with: tree-view of config hierarchy, inline editing with validation, layer indicator (global/project/directory).
- **D-15:** `sunco settings --key agent.timeout` for direct query (existing behavior preserved). New: `sunco settings --set agent.timeout=60000` for direct mutation.
- **D-16:** Config changes write to the appropriate layer's TOML file. Project-level by default, `--global` for ~/.sun/config.toml.

### Session Management (SES-02 through SES-05)
- **D-17:** `sunco pause` — creates HANDOFF.json in .sun/ with: current phase, current plan, completed tasks, in-progress task, pending decisions, environment state (branch, uncommitted changes), timestamp.
- **D-18:** `sunco resume` — reads HANDOFF.json, displays summary of where we left off, validates environment (correct branch, no conflicts), and recommends the next action.
- **D-19:** `sunco next` — reads STATE.md + ROADMAP.md, determines the next logical skill to run based on current progress. Uses recommender engine (Phase 1 REC-*) for routing.
- **D-20:** `sunco context` — displays current decisions, blockers, and next actions. Reads from STATE.md + current phase's CONTEXT.md + any pending todos.
- **D-21:** HANDOFF.json format is a flat JSON structure, not nested. Easy to read for both humans and agents.

### Claude's Discretion
- Ink component layout details for settings tree-view
- HANDOFF.json exact field names and structure
- Note file naming convention (timestamp format)
- Todo/seed/backlog SQLite table schemas
- Phase number validation and edge cases

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Core Platform (dependency)
- `packages/core/src/skill/types.ts` -- SkillDefinition, SkillContext, SkillKind
- `packages/core/src/skill/define.ts` -- defineSkill() factory
- `packages/core/src/state/api.ts` -- StateEngine API
- `packages/core/src/state/file-store.ts` -- FileStore for .sun/ artifacts
- `packages/core/src/config/loader.ts` -- loadConfig() for TOML hierarchy
- `packages/core/src/config/types.ts` -- SunConfig type
- `packages/core/src/recommend/engine.ts` -- RecommenderEngine for sunco next
- `packages/core/src/recommend/rules.ts` -- Existing 30 recommendation rules
- `packages/core/src/ui/adapters/InkUiAdapter.ts` -- Ink rendering
- `packages/core/src/ui/patterns/` -- SkillEntry, InteractiveChoice, SkillProgress, SkillResult

### Phase 2 Integration
- `packages/skills-harness/src/settings.skill.ts` -- Current settings skill (to be enhanced)

### Project State
- `.planning/ROADMAP.md` -- Phase structure (parsed by status + phase skills)
- `.planning/STATE.md` -- Current progress state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StateApi` (SQLite) — todo/seed/backlog use get/set/list/delete
- `FileStoreApi` — note/tribal files via read/write/list
- `RecommenderEngine` — sunco next leverages existing 30 rules
- `InkUiAdapter` — all Ink rendering available for interactive UIs
- `InteractiveChoice` component — reusable for settings navigation
- Existing `settings.skill.ts` — base to enhance, not rewrite

### Established Patterns
- `defineSkill({ kind: 'deterministic' })` — all Phase 3 skills
- `ctx.state.get/set` for structured data, `ctx.fileStore.read/write` for human-readable files
- Skills in `packages/skills-harness/src/` as `*.skill.ts`

### Integration Points
- Skills auto-discovered by scanner via `*.skill.ts` glob
- CLI registers as Commander.js subcommands
- Recommender rules can be extended for new skill routing

</code_context>

<specifics>
## Specific Ideas

- `sunco status` should be the "home screen" — instant overview of where the project stands
- Note --tribal integrates directly with Phase 2's guard tribal loader
- Phase management must handle decimal insertion (3.1) without breaking existing phase directories
- Settings enhanced with Ink interactive tree-view, not just --key queries
- HANDOFF.json should be simple enough for a human to read and understand

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 03-standalone-ts-skills*
*Context gathered: 2026-03-28 via auto mode*
