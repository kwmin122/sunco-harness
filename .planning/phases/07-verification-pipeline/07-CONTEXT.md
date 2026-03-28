# Phase 7: Verification Pipeline - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected (all gray areas, recommended defaults)

<domain>
## Phase Boundary

3 skills implementing the 5-layer Swiss cheese verification model: `sunco verify` (5 layers + expert agents + intent reconstruction), `sunco validate` (deterministic test coverage audit), `sunco test-gen` (test generation with Digital Twin mock servers). Plus the 6-stage review pipeline architecture and tribal knowledge integration.

15 requirements: VRF-01 through VRF-11, REV-01 through REV-04

</domain>

<decisions>
## Implementation Decisions

### sunco verify — 5-Layer Swiss Cheese Model (VRF-01 through VRF-09)
- **D-01:** Sequential 5-layer execution: Layer 1 (multi-agent generation) → Layer 2 (deterministic guardrails) → Layer 3 (BDD acceptance criteria) → Layer 4 (permission scoping check) → Layer 5 (adversarial verification). Each layer produces findings. A layer failure doesn't stop subsequent layers — all execute for comprehensive reporting.
- **D-02:** Layer 1 — Multi-Agent Generation (VRF-01): 4 expert agents (Security, Performance, Architecture, Correctness) dispatched in parallel via Promise.allSettled(). A 5th coordinator agent synthesizes findings. Each expert uses role: 'verification' with read + test permissions.
- **D-03:** Layer 2 — Deterministic Guardrails (VRF-02): Calls `sunco lint` and `sunco guard` internally via ctx.run(). No agent dispatch needed — pure deterministic. Results from lint violations and guard anti-patterns feed into the report.
- **D-04:** Layer 3 — BDD Acceptance Criteria (VRF-03): Reads PLAN.md must_haves and acceptance_criteria. For each criterion, runs a verification check (grep, file existence, test command). Reports pass/fail per criterion.
- **D-05:** Layer 4 — Permission Scoping (VRF-04): Verifies that execution agents operated within their permitted paths. Compares git diff file paths against plan's files_modified list. Flags any file modifications outside the declared scope.
- **D-06:** Layer 5 — Adversarial Verification (VRF-05): A separate verification agent (different from execution agents) receives the diff and original intent (CONTEXT.md). Tasked with finding ways the implementation fails to meet the intent. Uses role: 'verification'.
- **D-07:** Intent Reconstruction (VRF-07): Compares results against original intent from CONTEXT.md and PLAN.md must_haves, not just the diff. "Did we build what we intended?" rather than "Does the diff look clean?"
- **D-08:** Scenario Holdout (VRF-08): Reads .sun/scenarios/ (BDD Given/When/Then files created by discuss skill). These scenarios are invisible to coding agents but automatically loaded and checked by verification. If a scenario fails, it's a signal that the implementation drifted from intent.
- **D-09:** Nyquist Principle (VRF-09): Per-task verification — each task commit triggers a focused micro-verification (tests pass, acceptance criteria met) before proceeding. This is built into the execute skill's per-task loop, but verify provides the aggregate view.

### Expert Agents (VRF-06)
- **D-10:** 4 expert agents with focused prompts: Security (OWASP, injection, auth), Performance (complexity, memory, N+1), Architecture (coupling, layer violations, patterns), Correctness (logic, edge cases, data flow). Each returns structured findings with severity.
- **D-11:** Coordinator agent receives all expert findings + the diff and produces a unified verdict: PASS (no critical/high), WARN (only medium/low), FAIL (critical or high findings).
- **D-12:** Expert prompts in `packages/skills-workflow/src/prompts/verify-*.ts` (verify-security.ts, verify-performance.ts, verify-architecture.ts, verify-correctness.ts, verify-coordinator.ts, verify-adversarial.ts, verify-intent.ts).

### sunco validate — Test Coverage Audit (VRF-10)
- **D-13:** Deterministic skill (kind: 'deterministic'). Runs test suite, parses coverage output, produces a structured report: lines covered, branches covered, uncovered files, overall percentage.
- **D-14:** Uses Vitest's coverage reporting (c8/istanbul). Parses JSON coverage output for structured analysis.
- **D-15:** Report includes: overall score, per-file coverage, uncovered critical paths, comparison with previous snapshot (if exists in .sun/ state).

### sunco test-gen — Test Generation (VRF-11)
- **D-16:** Agent-powered skill (kind: 'prompt'). Generates unit and E2E tests for specified files or entire phase output.
- **D-17:** `--mock-external` flag activates Digital Twin mode (REV-04): generates mock servers that mimic external APIs based on API documentation. Uses agent to analyze API docs and produce Express/Fastify mock server code.
- **D-18:** Generated tests written to `__tests__/` directories following project conventions. Mock servers written to `.sun/mocks/` directory.

### Review Pipeline Architecture (REV-01 through REV-03)
- **D-19:** 6-stage pipeline is a routing table, not a new skill. Each stage maps to existing skills: (1) Idea → discuss, (2) Spec → plan, (3) Plan → review, (4) Execute → execute, (5) Verify → verify, (6) Deploy → ship. The recommender engine (Phase 1) already handles this routing via rules.
- **D-20:** Add 10-15 new recommender rules for the verification pipeline routing. Rules connect: execute complete → verify, verify pass → ship, verify fail → debug, plan complete → review.
- **D-21:** Tribal Knowledge (REV-02): verify loads .sun/tribal/ patterns (already implemented in Phase 2 guard skill's tribal-loader). Tribal violations appear as warnings in the verify report.
- **D-22:** Human Gates (REV-03): verify includes a `humanRequired` flag in findings. Tribal knowledge matches and regulatory-flagged items require human approval. Other findings are auto-processed.

### Claude's Discretion
- Expert agent prompt details and finding severity thresholds
- Coverage parsing format specifics
- Digital Twin mock server generation approach
- Adversarial verification prompting strategy
- Scenario holdout matching algorithm

</decisions>

<canonical_refs>
## Canonical References

### Phase 1 Core
- `packages/core/src/agent/router.ts` — AgentRouter.run(), crossVerify()
- `packages/core/src/agent/permission.ts` — PermissionHarness
- `packages/core/src/recommend/rules.ts` — Existing 30 recommendation rules
- `packages/core/src/recommend/engine.ts` — RecommenderEngine

### Phase 2 Harness (deterministic layers)
- `packages/skills-harness/src/lint.skill.ts` — sunco lint (Layer 2)
- `packages/skills-harness/src/guard.skill.ts` — sunco guard (Layer 2)
- `packages/skills-harness/src/guard/tribal-loader.ts` — loadTribalPatterns()

### Phase 5 Planning
- `packages/skills-workflow/src/shared/phase-reader.ts` — readPhaseDir()
- `packages/skills-workflow/src/shared/plan-parser.ts` — parsePlanMd(), acceptance_criteria

### Phase 6 Review
- `packages/skills-workflow/src/review.skill.ts` — Multi-provider review pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ctx.run('lint')` / `ctx.run('guard')` — inter-skill calls for Layer 2
- `loadTribalPatterns()` — already loads .sun/tribal/ patterns
- `parsePlanMd()` — extracts acceptance_criteria for Layer 3
- `AgentRouter.crossVerify()` — multi-provider dispatch for Layer 1 experts
- `Promise.allSettled()` — parallel expert agent dispatch
- Prompt templates in `prompts/` directory

### Established Patterns
- Multi-agent parallel dispatch: scan (7), research (3-5), review (multi-provider)
- Structured findings: review skill's ReviewFinding type
- Synthesis agent: review skill's synthesis pattern
- Inter-skill calls: ctx.run() with circular invocation protection

</code_context>

<specifics>
## Specific Ideas

- The Swiss cheese model means every layer is independent — if one misses something, others catch it
- Scenario holdouts are the "secret tests" that agents can't study for — the ultimate integrity check
- Intent reconstruction prevents the "diff looks clean but doesn't solve the problem" failure mode
- Tribal knowledge is soft (warnings), not hard (errors) — respects that tribal rules can be wrong

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 07-verification-pipeline*
*Context gathered: 2026-03-28 via auto mode*
