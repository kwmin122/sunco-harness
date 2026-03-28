# Phase 5: Context + Planning - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected (all gray areas, recommended defaults)

<domain>
## Phase Boundary

4 agent-powered workflow skills that form the spec-driven planning chain: discuss → assume → research → plan. These are the "think before you code" skills. All use AgentRouter for dispatch. `sunco discuss` and `sunco assume` are interactive (questions + agent analysis), `sunco research` and `sunco plan` are agent-heavy (parallel dispatch + validation loops).

4 requirements: WF-09, WF-10, WF-11, WF-12

</domain>

<decisions>
## Implementation Decisions

### sunco discuss — Vision Extraction (WF-09)
- **D-01:** Interactive conversation flow: (1) Agent reads phase goal from ROADMAP.md, (2) Identifies gray areas via analysis agent, (3) Presents gray areas for user selection via ctx.ui.ask(), (4) Deep-dive each selected area with follow-up questions, (5) Writes CONTEXT.md with locked decisions + Claude's discretion areas.
- **D-02:** Holdout scenarios: During discussion, agent generates acceptance criteria that become holdout scenarios. These are written to .sun/scenarios/ as BDD-style Given/When/Then files. Coding agents cannot access .sun/scenarios/; only verification agents can.
- **D-03:** CONTEXT.md structure follows template: `<domain>`, `<decisions>`, `<canonical_refs>`, `<code_context>`, `<specifics>`, `<deferred>`. Each decision is numbered (D-01, D-02...) and marked as locked or discretionary.
- **D-04:** Uses kind: 'prompt' with role: 'planning' for agent analysis. Interactive UI via ctx.ui.ask() and ctx.ui.askText().

### sunco assume — Approach Preview (WF-10)
- **D-05:** Agent reads CONTEXT.md + ROADMAP.md + codebase, then presents what it would do before doing it. Output: structured assumptions list with confidence levels.
- **D-06:** User can correct assumptions — corrections are appended to CONTEXT.md as additional locked decisions.
- **D-07:** Uses kind: 'prompt' with role: 'planning'. Single agent call (not parallel).

### sunco research — Domain Research (WF-11)
- **D-08:** Parallel agent dispatch: 3-5 research agents each investigating a specific topic derived from CONTEXT.md decisions and phase scope.
- **D-09:** Research agents use role: 'research' (read-only permissions). Each produces a focused research document.
- **D-10:** Results synthesized into a single RESEARCH.md in the phase directory. Includes validation architecture section for Nyquist compliance.
- **D-11:** Research topics auto-derived from phase goal + CONTEXT.md, but can be overridden with `--topics "topic1,topic2"`.

### sunco plan — Execution Planning (WF-12)
- **D-12:** Agent reads CONTEXT.md + RESEARCH.md + REQUIREMENTS.md + ROADMAP.md, produces PLAN.md files with: frontmatter (wave, depends_on, files_modified, autonomous), XML tasks with read_first + acceptance_criteria + action, verification criteria, must_haves.
- **D-13:** Built-in plan-checker validation loop: after plan creation, a separate verification agent checks quality. If issues found, planner revises (max 3 iterations).
- **D-14:** BDD scenario-based completion criteria: each plan's must_haves include observable truths derived from acceptance criteria. These truths are what the verifier checks.
- **D-15:** Plans support wave-based parallel execution. Planner assigns wave numbers based on dependency analysis.
- **D-16:** Uses kind: 'prompt' with role: 'planning' for plan creation, separate agent for verification.

### Shared Infrastructure
- **D-17:** All 4 skills live in `packages/skills-workflow/src/` as discuss.skill.ts, assume.skill.ts, research.skill.ts, plan.skill.ts.
- **D-18:** Reuse Phase 4's prompt template pattern: agent prompts in `packages/skills-workflow/src/prompts/` (discuss-*.ts, assume.ts, research-*.ts, plan.ts, plan-checker.ts).
- **D-19:** All skills read/write to .planning/ phase directories using the planning-writer utility from Phase 4.
- **D-20:** Scenario files in .sun/scenarios/ use BDD format: `scenario-{id}.md` with Given/When/Then blocks.

### Claude's Discretion
- Gray area identification heuristics for discuss
- Assumption extraction prompts for assume
- Research topic derivation algorithm
- Plan-checker verification dimensions and scoring
- BDD scenario generation format details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Agent Router
- `packages/core/src/agent/router.ts` -- AgentRouter.run() API
- `packages/core/src/agent/types.ts` -- AgentRequest, AgentResult, AgentRole
- `packages/core/src/agent/permission.ts` -- PermissionHarness

### Phase 1 UI
- `packages/core/src/ui/adapters/SkillUi.ts` -- ask(), askText(), progress(), result()

### Phase 4 Shared Utilities
- `packages/skills-workflow/src/shared/planning-writer.ts` -- writePlanningArtifact()
- `packages/skills-workflow/src/shared/pre-scan.ts` -- buildPreScanContext()
- `packages/skills-workflow/src/prompts/` -- prompt template pattern

### State
- `packages/core/src/state/file-store.ts` -- FileStoreApi for .sun/scenarios/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentRouter.run()` with role-based permissions — all 4 skills use this
- `ctx.ui.ask()` + `ctx.ui.askText()` — discuss and assume use interactive UI
- `writePlanningArtifact()` — writes to .planning/ directories
- `ctx.fileStore.write('scenarios', ...)` — holdout scenario storage
- `Promise.allSettled()` — parallel research agent dispatch (same as scan/new)
- Prompt template pattern from Phase 4 (`prompts/*.ts`)

### Established Patterns
- Prompt skills: `defineSkill({ kind: 'prompt' })` with agent dispatch
- Multi-step orchestration: Phase 4's sunco new demonstrates the pattern
- Parallel dispatch: Phase 4's sunco scan demonstrates 7-agent parallel

### Integration Points
- Skills in `packages/skills-workflow/src/` as `*.skill.ts`
- Prompts in `packages/skills-workflow/src/prompts/`
- Output to `.planning/phases/{padded}-{slug}/` directories

</code_context>

<specifics>
## Specific Ideas

- discuss → assume → research → plan forms a chain. Each skill's output feeds the next.
- Holdout scenarios are the Swiss cheese model's first layer — generated during discuss, invisible to coding agents, loaded by verifiers
- Plan-checker loop ensures plans are actionable before execution begins
- BDD completion criteria bridge the gap between "tasks done" and "goal achieved"

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 05-context-planning*
*Context gathered: 2026-03-28 via auto mode*
