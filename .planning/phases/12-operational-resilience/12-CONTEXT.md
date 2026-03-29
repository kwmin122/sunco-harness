# Phase 12: Operational Resilience - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

## Phase Boundary

Make `sunco auto` production-grade: crash recovery, stuck detection, cost dashboard with budget ceiling, and 3-tier timeout supervision. All changes are in core + auto skill. No new CLI commands (stats skill already exists).

## Current State

### What exists:
- `auto.skill.ts` (301 lines): Thin pipeline loop (discuss→plan→execute→verify per phase). Error recovery asks user retry/skip/abort.
- `UsageTracker` in core: Accumulates inputTokens, outputTokens, estimatedCostUsd, wallTimeMs per session. No persistence, no per-skill breakdown.
- `ctx.state` (SQLite WAL): General key-value state. Can store crash state and cost history.
- `ctx.agent.run()`: Returns `AgentResult` with `usage: AgentUsage`. Timeout per call only.

### What's missing:
- No lock file for crash detection
- No automatic resume after crash
- No stuck detection (infinite loop = money drain)
- No per-skill cost breakdown or budget enforcement
- No timeout tiers (soft/idle/hard)

## Implementation Decisions

### OPS-01: Crash Recovery

**Lock file approach** (GSD v2 pattern):
- On auto mode start: write `.sun/auto.lock` with `{ pid, phase, step, startedAt }`
- On each step start: update lock with current `{ phase, step }`
- On step completion: update lock
- On auto mode clean exit: delete lock file
- On next `sunco auto` start: if lock exists AND pid is dead → crash detected → resume from lock state

**Recovery flow:**
1. Read `.sun/auto.lock`
2. Check if PID is alive (`process.kill(pid, 0)`)
3. If PID dead → crash confirmed
4. Read last successful step from lock
5. Resume from next step (skip completed work)
6. Log recovery event to state

**No session forensics** (unlike GSD v2) — we don't have access to raw LLM session files. Just checkpoint-based resume.

### OPS-02: Stuck Detection

**Sliding window approach:**
- Track last N skill invocations in a circular buffer: `[{ skillId, success, timestamp }]`
- **Stuck condition**: same skillId fails 3 consecutive times within 10 minutes
- **On detection**:
  1. First: retry with `sunco debug` diagnostic (ctx.run('workflow.debug'))
  2. If debug also fails: stop auto mode with structured report
- Buffer stored in `.sun/auto.lock` (same file, extend the schema)
- Window size: 10 entries

### OPS-03: Cost Dashboard

**Extend existing UsageTracker:**
- After each `ctx.agent.run()`, persist to state: `ctx.state.set('usage.history', [...])`
- Schema per entry: `{ skillId, phase, model, inputTokens, outputTokens, costUsd, timestamp }`
- `sunco stats` skill already exists — extend it to read usage history from state and display:
  - Per-skill cost breakdown
  - Per-phase totals
  - Per-model split
  - Running total

**No separate dashboard UI** — just enhance `sunco stats` output.

### OPS-04: Budget Ceiling

**Config-driven:**
- `sunco.budget_ceiling` in TOML config (number, USD)
- Before each agent dispatch in auto mode: check cumulative cost vs ceiling
- Warning thresholds: 50%, 75%, 90% of ceiling → log warning
- At 100%: stop auto mode, return `{ success: false, summary: "Budget ceiling reached" }`
- Budget check is in auto.skill.ts, not in AgentRouter (auto-mode only enforcement)

### OPS-05: Timeout 3-Tier

**In auto.skill.ts per-step execution:**
- `soft_timeout_minutes` (default 20): warn agent to wrap up (via prompt suffix)
- `idle_timeout_minutes` (default 10): if no agent activity for N minutes, force-stop current step
- `hard_timeout_minutes` (default 30): absolute maximum per step, kill regardless

**Implementation:**
- Wrap `ctx.run(skillId)` in a timeout controller
- Soft timeout: no-op for now (would need agent steering, which we don't have yet). Store config for future use.
- Idle timeout: track last state change timestamp, check with setInterval
- Hard timeout: AbortController + setTimeout

**Config:**
```toml
[auto_supervisor]
soft_timeout_minutes = 20
idle_timeout_minutes = 10
hard_timeout_minutes = 30
```

Read from `ctx.config.get('auto_supervisor')` with defaults.

### Claude's Discretion
- Exact format of `.sun/auto.lock` JSON schema
- How many usage history entries to keep (suggest: last 1000)
- Whether stuck detection should also check for oscillation (A→B→A→B pattern)
- Whether to add `--no-resume` flag to force fresh start ignoring lock

## Files to Modify

### Core changes:
- `packages/core/src/agent/tracker.ts` — extend with per-call metadata + persistence helper
- `packages/core/src/agent/types.ts` — add UsageEntry type

### Skill changes:
- `packages/skills-workflow/src/auto.skill.ts` — crash recovery, stuck detection, budget check, timeout tiers
- `packages/skills-workflow/src/status.skill.ts` — extend with cost breakdown display

### New files:
- `packages/skills-workflow/src/shared/auto-lock.ts` — lock file read/write/check helpers
- `packages/skills-workflow/src/shared/stuck-detector.ts` — sliding window stuck detection
- `packages/skills-workflow/src/shared/budget-guard.ts` — budget ceiling enforcement

### Tests:
- `packages/skills-workflow/src/__tests__/auto-lock.test.ts`
- `packages/skills-workflow/src/__tests__/stuck-detector.test.ts`
- `packages/skills-workflow/src/__tests__/budget-guard.test.ts`
