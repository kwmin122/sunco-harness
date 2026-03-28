# Phase 4: Project Initialization - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected (all gray areas, recommended defaults)

<domain>
## Phase Boundary

2 agent-powered skills for project bootstrapping. `sunco new` guides greenfield project creation (idea → questions → research → requirements → roadmap). `sunco scan` analyzes existing codebases producing 7 structured documents. These are the first prompt skills (kind: 'prompt') in SUN — they use the AgentRouter to dispatch to Claude.

2 requirements: WF-01, WF-02

</domain>

<decisions>
## Implementation Decisions

### sunco new — Greenfield Project Bootstrap (WF-01)
- **D-01:** Multi-step orchestrated flow: (1) Accept idea as CLI arg or interactive prompt, (2) Ask 5-8 clarifying questions via ctx.ui.ask(), (3) Dispatch parallel research agents via ctx.agent.run() with role: 'research', (4) Synthesize research into requirements, (5) Generate roadmap from requirements. Each step shows progress via ctx.ui.progress().
- **D-02:** Research dispatches use AgentRouter with multiple parallel agent.run() calls. Research topics are derived from the user's idea and answers. Each research agent gets a focused prompt with scoped permissions (read-only).
- **D-03:** Output artifacts: PROJECT.md (vision, core value, constraints), REQUIREMENTS.md (categorized requirements), ROADMAP.md (phased plan with success criteria). All written to .planning/ directory.
- **D-04:** The question flow is adaptive — later questions informed by earlier answers. Use ctx.ui.ask() for interactive choices, plain text input for freeform answers.
- **D-05:** Research results are synthesized by a single planning agent call (role: 'planning') that reads all research outputs and generates the requirements + roadmap.
- **D-06:** `sunco new` is kind: 'prompt' — uses agent dispatch. Falls back gracefully if no agent provider is available (shows error message suggesting to install Claude CLI or set API key).

### sunco scan — Existing Codebase Analysis (WF-02)
- **D-07:** Produces 7 analysis documents in .sun/codebase/: STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTS.md, INTEGRATIONS.md, CONCERNS.md.
- **D-08:** Analysis uses parallel agent dispatch — 4-7 agents each focused on one document, running simultaneously via Promise.allSettled(). Each agent gets read-only permissions scoped to the project directory.
- **D-09:** Each agent receives a focused prompt with specific questions to answer about the codebase. Prompts reference the document template and expected sections.
- **D-10:** Deterministic pre-scan first: glob file tree, count lines, detect stack markers (reuse Phase 2 ecosystem-detector), sample key files. This pre-scan output is passed as context to all agents.
- **D-11:** `sunco scan` is kind: 'prompt' — uses agent dispatch. Falls back gracefully if no provider available.
- **D-12:** Scan results are written via ctx.fileStore.write('codebase', 'STACK.md', content) to .sun/codebase/.

### Shared Infrastructure
- **D-13:** Both skills live in `packages/skills-workflow/src/` as `new.skill.ts` and `scan.skill.ts`.
- **D-14:** Reuse Phase 2's ecosystem-detector for deterministic pre-scan in both skills.
- **D-15:** Agent prompts are defined as template strings in separate files (e.g., `prompts/research.ts`, `prompts/scan-stack.ts`) to keep skill files clean and prompts maintainable.
- **D-16:** Progress reporting via ctx.ui.progress() for each step (questioning, researching, synthesizing, writing).

### Claude's Discretion
- Exact question phrasing for sunco new interactive flow
- Research topic selection heuristics
- Agent prompt templates content
- Document section structure for scan outputs
- Error handling for partial agent failures (some agents succeed, others fail)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Agent Router (dependency)
- `packages/core/src/agent/router.ts` -- AgentRouter API (run, crossVerify)
- `packages/core/src/agent/types.ts` -- AgentRequest, AgentResult, AgentRole
- `packages/core/src/agent/permission.ts` -- PermissionHarness, role-based defaults
- `packages/core/src/agent/providers/claude-cli.ts` -- ClaudeCliProvider
- `packages/core/src/agent/providers/claude-sdk.ts` -- ClaudeSdkProvider

### Phase 1 Core (dependency)
- `packages/core/src/skill/types.ts` -- SkillDefinition, SkillContext
- `packages/core/src/skill/define.ts` -- defineSkill()
- `packages/core/src/state/file-store.ts` -- FileStoreApi for writing scan documents
- `packages/core/src/ui/adapters/SkillUi.ts` -- SkillUi (entry, ask, progress, result)

### Phase 2 Reusable (dependency)
- `packages/skills-harness/src/init/ecosystem-detector.ts` -- detectEcosystems() for pre-scan
- `packages/skills-harness/src/init/types.ts` -- EcosystemResult type

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentRouter.run()` — dispatches to available provider with role-based permissions
- `detectEcosystems()` from Phase 2 — deterministic stack detection for pre-scan
- `ctx.ui.ask()` — interactive question UI (InteractiveChoice component)
- `ctx.ui.progress()` — step progress display
- `ctx.fileStore.write()` — write documents to .sun/ subdirectories
- `Promise.allSettled()` — parallel agent dispatch with partial failure handling

### Established Patterns
- Prompt skills use `kind: 'prompt'` — agent access enabled via SkillContext
- Agent dispatch: `ctx.agent.run({ prompt, role, permissions })`
- Results normalized to AgentResult { success, outputText, artifacts, usage }

### Integration Points
- Skills in `packages/skills-workflow/src/` as `*.skill.ts`
- Agent prompts as template strings in `packages/skills-workflow/src/prompts/`
- Scan documents to `.sun/codebase/` via FileStoreApi

</code_context>

<specifics>
## Specific Ideas

- `sunco new` should feel like a "product manager in a box" — asks smart questions, does real research, produces actionable output
- `sunco scan` should produce documents useful for BOTH humans and agents — agents read these when making decisions
- Pre-scan (deterministic) provides grounding so agent analysis is concrete, not hallucinated
- Parallel research/scan agents maximize throughput while staying within permission boundaries

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-project-initialization*
*Context gathered: 2026-03-28 via auto mode*
