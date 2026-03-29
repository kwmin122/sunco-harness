# Phase 10: Debugging - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected

<domain>
## Phase Boundary

3 debugging skills: `sunco debug` (failure classification + root cause + fix suggestions), `sunco diagnose` (deterministic log analysis), `sunco forensics` (post-mortem workflow analysis). These are the failure recovery skills — used when things go wrong.

3 requirements: DBG-01, DBG-02, DBG-03

</domain>

<decisions>
## Implementation Decisions

### sunco debug — Intelligent Failure Analysis (DBG-01)
- **D-01:** Agent-powered failure classifier: categorizes failures as context shortage, direction error, or structural conflict.
- **D-02:** Reads recent git history, test output, build logs, and .sun/ state to build failure context.
- **D-03:** Produces structured output: failure type, root cause analysis, actionable fix suggestions with specific files/lines.
- **D-04:** kind: 'prompt' — uses agent for analysis. role: 'verification' (read + test permissions).

### sunco diagnose — Deterministic Log Analysis (DBG-02)
- **D-05:** Deterministic skill (kind: 'deterministic'). Parses build/test output to extract structured error information.
- **D-06:** Runs test suite, captures output, extracts: failed tests, error messages, stack traces, assertion failures.
- **D-07:** Also parses TypeScript compiler errors (`tsc --noEmit` output) and ESLint output.
- **D-08:** Structured output: JSON with test_failures, type_errors, lint_errors, each with file/line/message.

### sunco forensics — Workflow Post-Mortem (DBG-03)
- **D-09:** Agent-powered analysis of a failed workflow: reads git history, .sun/ state snapshots, PLAN.md files, SUMMARY.md files, and VERIFICATION.md reports.
- **D-10:** Produces a forensics report: timeline of events, where things diverged from plan, root cause hypothesis, prevention recommendations.
- **D-11:** kind: 'prompt' — uses agent for deep analysis with full project context.
- **D-12:** `--session <id>` flag to analyze a specific session. Default: most recent session from STATE.md.

### Shared
- **D-13:** All skills in `packages/skills-workflow/src/` as debug.skill.ts, diagnose.skill.ts, forensics.skill.ts.
- **D-14:** Reuse captureGitState() from Phase 3, phase-reader from Phase 5.
- **D-15:** Debug and forensics prompts in `packages/skills-workflow/src/prompts/`.

### Claude's Discretion
- Failure classification heuristics for debug
- Log parsing regex patterns for diagnose
- Forensics timeline reconstruction algorithm
- Fix suggestion prompt engineering

</decisions>

<canonical_refs>
## Canonical References

### Core
- `packages/core/src/skill/types.ts` — defineSkill, SkillContext

### Phase 3
- `packages/skills-workflow/src/shared/git-state.ts` — captureGitState()
- `packages/skills-workflow/src/shared/state-reader.ts` — readStateField()

### Phase 5
- `packages/skills-workflow/src/shared/phase-reader.ts` — readPhaseDir()

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable
- `captureGitState()` — git branch, status, recent log
- `readPhaseDir()` — find phase artifacts
- `execa` — run tsc, vitest for diagnose
- `ctx.agent.run()` — agent dispatch for debug/forensics

### Patterns
- Phase 2's health skill: parses build output deterministically
- Phase 7's verify skill: structured findings with severity

</code_context>

<specifics>
## Specific Ideas

- debug is "what went wrong?" — failure triage
- diagnose is "show me the errors" — deterministic extraction
- forensics is "how did we get here?" — full post-mortem timeline

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 10-debugging*
*Context gathered: 2026-03-28 via auto mode*
