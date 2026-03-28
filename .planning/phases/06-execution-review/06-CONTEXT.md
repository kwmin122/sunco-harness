# Phase 6: Execution + Review - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected (all gray areas, recommended defaults)

<domain>
## Phase Boundary

2 agent-powered workflow skills: `sunco execute` (wave-based parallel execution with Git worktree isolation) and `sunco review` (multi-provider cross-review with unified report). These are the "do and check" skills — execute runs plans, review validates the output.

2 requirements: WF-13, WF-14

</domain>

<decisions>
## Implementation Decisions

### sunco execute — Wave-Based Parallel Execution (WF-14)
- **D-01:** Multi-wave execution orchestrator: (1) Read PLAN.md files from phase directory, (2) Analyze dependencies and group into waves, (3) For each wave, spawn parallel executor agents in Git worktrees, (4) Collect results, verify commits, (5) Report completion.
- **D-02:** Git worktree isolation: each executor agent gets its own worktree via `simple-git`. Agents commit with --no-verify to avoid hook contention. Post-wave hook validation runs once after all agents complete.
- **D-03:** Atomic commits per task. Each task in a plan produces one commit. If a task fails, the worktree is discarded (rollback-safe).
- **D-04:** Agent dispatch uses role: 'execution' with write permissions scoped to plan's files_modified list. Each agent receives the PLAN.md and executes tasks sequentially within the plan.
- **D-05:** SUMMARY.md created per plan after execution. STATE.md and ROADMAP.md updated with progress.
- **D-06:** Checkpoint handling: plans with `autonomous: false` pause for user input. In auto mode, checkpoints are auto-approved.
- **D-07:** Wave safety: Wave N+1 only starts after all Wave N agents complete successfully. If any agent fails, user chooses: retry, skip, or abort.

### sunco review — Cross-Provider Code Review (WF-13)
- **D-08:** Multi-provider review dispatch: `sunco review` sends the diff to multiple AI providers independently. Each provider reviews in isolation, producing a structured review.
- **D-09:** Provider flags: `--codex` (OpenAI Codex), `--gemini` (Google Gemini), `--claude` (Anthropic Claude). Default: use available providers. At least 1 provider required.
- **D-10:** Each review agent uses role: 'verification' (read-only + test permissions). Agents receive the git diff and produce structured findings.
- **D-11:** Reviews synthesized into a unified REVIEWS.md: common findings highlighted, disagreements flagged, severity-weighted priority list.
- **D-12:** Review dimensions: SQL safety, trust boundary violations, conditional side effects, architectural patterns, test coverage, security, performance.
- **D-13:** `sunco review --phase N` reviews all plans in a phase. `sunco review` (no flag) reviews staged/unstaged changes.

### Shared Infrastructure
- **D-14:** Both skills live in `packages/skills-workflow/src/` as execute.skill.ts and review.skill.ts.
- **D-15:** Reuse simple-git (already installed from Phase 3) for worktree creation/removal.
- **D-16:** Agent prompts in `packages/skills-workflow/src/prompts/` (execute.ts, review.ts, review-synthesize.ts).
- **D-17:** Execute skill reads PLAN.md XML format — must parse `<tasks>`, `<task>`, `<action>`, `<verify>`, `<acceptance_criteria>` XML blocks.

### Claude's Discretion
- Git worktree naming convention and cleanup strategy
- Executor agent prompt structure for task execution
- Review synthesis algorithm (how to merge multiple reviews)
- Diff size limits for review agents
- Error recovery strategy for partial worktree failures

</decisions>

<canonical_refs>
## Canonical References

### Phase 1 Agent Router
- `packages/core/src/agent/router.ts` -- AgentRouter.run()
- `packages/core/src/agent/types.ts` -- AgentRequest, AgentResult, AgentRole
- `packages/core/src/agent/permission.ts` -- PermissionHarness

### Phase 3 Git Integration
- `packages/skills-workflow/src/shared/git-state.ts` -- captureGitState()

### Phase 5 Planning
- `packages/skills-workflow/src/shared/phase-reader.ts` -- readPhaseDir(), findPlanFiles()
- `packages/skills-workflow/src/prompts/plan-create.ts` -- PLAN.md format reference

### simple-git
- Already installed in packages/skills-workflow/package.json

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentRouter.run()` with role-based permissions
- `simple-git` for worktree operations (already a dependency)
- `phase-reader.ts` for finding plan files in phase directories
- `writePlanningArtifact()` for writing REVIEWS.md
- `Promise.allSettled()` for parallel agent dispatch
- `captureGitState()` from Phase 3 for branch/status tracking

### Established Patterns
- Parallel agent dispatch: Phase 4's scan (7 agents), Phase 5's research (3-5 agents)
- Plan-checker validation loop: Phase 5's plan skill demonstrates generate-verify cycle
- Prompt templates in prompts/ directory

### Integration Points
- Skills in `packages/skills-workflow/src/` as `*.skill.ts`
- Prompts in `packages/skills-workflow/src/prompts/`
- Plans read from `.planning/phases/{padded}-{slug}/`

</code_context>

<specifics>
## Specific Ideas

- Execute is the most complex skill — it orchestrates multiple agents with worktree isolation, which is the key differentiator
- Review should work both for PR review (diff-based) and phase review (plan-based)
- Worktree isolation means agents can't interfere with each other — true parallel safety
- The execute→review chain mirrors the plan→verify chain from Phase 5

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 06-execution-review*
*Context gathered: 2026-03-28 via auto mode*
