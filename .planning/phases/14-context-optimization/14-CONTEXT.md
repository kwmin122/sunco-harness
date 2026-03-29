# Phase 14: Context Optimization + Quality Depth - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

## Phase Boundary

Three quality depth improvements (CTX-05, CTX-06, CTX-07) + four context optimization features (CTX-01~04). Priority: quality depth first (closes audit gaps), then context optimization (cost savings).

## Implementation Decisions

### CTX-05: Garbage Collection (sunco health --deep)
- Add `--deep` flag to existing health.skill.ts
- When --deep: dispatch agent to analyze code-doc mismatches beyond what deterministic checks catch
- Agent reads: .sun/ state, README.md, CLAUDE.md, recent git log, source files
- Agent finds: outdated docs, dead imports, stale TODOs >30 days, architectural entropy
- Output: structured findings added to health report
- This is OpenAI's "third pillar" — agents fighting entropy

### CTX-06: Plan→Verify acceptance_criteria auto-link
- In verify-layers.ts Layer 3 (BDD Acceptance Criteria):
  - Read all PLAN.md files from the phase directory
  - Parse each `<acceptance_criteria>` XML section
  - For grep-verifiable criteria: run the grep/check deterministically
  - For non-greppable criteria: pass to the existing LLM verification agent
- This closes the audit gap: "Layer 3 acceptance checking is shallow for non-file-path criteria"

### CTX-07: fail loudly, succeed silently
- Modify verify.skill.ts result output:
  - PASS verdict: single-line summary only (e.g., "Verified: 5/5 layers passed, 0 findings")
  - WARN verdict: brief summary + list of warnings
  - FAIL verdict: full detailed report with per-finding description + fix suggestion
- Modify lint.skill.ts result output:
  - 0 violations: "Lint passed" (1 line)
  - Violations found: full structured output with fix_instruction per violation
- This prevents context pollution in auto mode — successful checks don't waste tokens

### CTX-01: KV-cache optimization (stable prefix)
- In Agent Router's run() method:
  - Structure prompt as: [STABLE PREFIX] + [CACHE BREAK] + [VARIABLE SUFFIX]
  - STABLE PREFIX: system instructions, skill rules, permissions
  - VARIABLE SUFFIX: current task context, files, user input
- Add `cacheBreakpoint` marker to AgentRequest type
- Provider implementations can use this for API-level cache hints (Anthropic prompt caching)

### CTX-02~04: Adaptive replan, complexity routing, token profiles
- Deferred to separate plan (lower priority than quality depth)

### Claude's Discretion
- Exact format of acceptance_criteria parsing from PLAN.md XML
- Which grep patterns to auto-execute vs pass to agent
- Health --deep prompt design
