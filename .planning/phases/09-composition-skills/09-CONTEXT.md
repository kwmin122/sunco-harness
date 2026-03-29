# Phase 9: Composition Skills - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected

<domain>
## Phase Boundary

4 power-user orchestration skills: `sunco auto` (full autonomous execution), `sunco quick` (lightweight with optional discuss/research), `sunco fast` (immediate execution, skip planning), `sunco do` (natural language → skill routing).

4 requirements: WF-15, WF-16, WF-17, WF-18

</domain>

<decisions>
## Implementation Decisions

### sunco auto — Full Autonomous Execution (WF-15)
- **D-01:** Orchestrates the discuss→plan→execute→verify chain for all remaining phases. Stops only at blockers or gray areas requiring human judgment.
- **D-02:** Uses ctx.run() to chain: discuss → plan → execute → verify → ship (if verify passes). Loops through phases sequentially.
- **D-03:** kind: 'prompt' — needs agent access for discuss/plan/verify steps.
- **D-04:** `--from <phase>` flag to start from a specific phase. Default: current phase from STATE.md.

### sunco quick — Lightweight Task (WF-16)
- **D-05:** Quick task execution with optional planning steps: `--discuss` adds context gathering, `--research` adds domain research, `--full` adds both.
- **D-06:** Without flags: goes straight to execute (agent writes code directly from the task description).
- **D-07:** kind: 'prompt' — dispatches agent for task execution.
- **D-08:** Task description from CLI positional args or interactive askText().

### sunco fast — Immediate Execution (WF-17)
- **D-09:** Skip planning entirely. Agent receives the task and executes immediately.
- **D-10:** Thinnest wrapper — essentially `ctx.agent.run({ role: 'execution', prompt: task })` with atomic commit.
- **D-11:** kind: 'prompt' — minimal agent dispatch.

### sunco do — Natural Language Router (WF-18)
- **D-12:** Accepts natural language input, uses agent to identify the best skill chain, then executes it.
- **D-13:** Agent receives: user input + available skills list (from registry). Returns: skill ID(s) to invoke.
- **D-14:** Executes identified skills via ctx.run(). Falls back to quick execution if no skill matches.
- **D-15:** kind: 'prompt' — needs agent for NL understanding.

### Shared
- **D-16:** All skills in `packages/skills-workflow/src/` as auto.skill.ts, quick.skill.ts, fast.skill.ts, do.skill.ts.
- **D-17:** These are thin orchestration wrappers — they compose existing skills, not implement new logic.

### Claude's Discretion
- Auto skill's phase loop error recovery strategy
- Quick skill's default planning depth
- Do skill's NL→skill matching prompt design
- Fast skill's commit message generation

</decisions>

<canonical_refs>
## Canonical References

### Core
- `packages/core/src/skill/types.ts` — SkillContext with run() for inter-skill calls
- `packages/core/src/skill/registry.ts` — SkillRegistry.getAll() for skill listing
- `packages/core/src/recommend/engine.ts` — RecommenderEngine for next-skill routing

### Workflow Skills (composed by Phase 9)
- `packages/skills-workflow/src/discuss.skill.ts` — ctx.run target
- `packages/skills-workflow/src/plan.skill.ts` — ctx.run target
- `packages/skills-workflow/src/execute.skill.ts` — ctx.run target
- `packages/skills-workflow/src/verify.skill.ts` — ctx.run target
- `packages/skills-workflow/src/ship.skill.ts` — ctx.run target

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable
- `ctx.run(skillId)` — inter-skill calls with circular invocation protection
- `ctx.ui.askText()` — freeform input for task descriptions
- `ctx.agent.run()` — direct agent dispatch for fast/quick
- SkillRegistry — list all available skills for do skill's matching

### Patterns
- Phase 3's `next.skill.ts` demonstrates recommender-based routing
- Phase 5's `discuss.skill.ts` demonstrates multi-step agent orchestration
- All composition skills are thin wrappers over existing skills

</code_context>

<specifics>
## Specific Ideas

- auto is "set it and forget it" — the full autonomous pipeline
- quick is "I have a small task" — optional planning depth
- fast is "just do it now" — zero overhead
- do is "I'll describe what I want" — natural language interface

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 09-composition-skills*
*Context gathered: 2026-03-28 via auto mode*
