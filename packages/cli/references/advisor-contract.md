# Advisor Contract

Single source of truth for SUNCO's ambient advisor. This document
describes WHAT is guaranteed by the contract. Implementation details
live in the modules named below — this file does not duplicate them.

## Vision

> Users keep developing in natural language. The advisor stays silent
> until it detects risk, then surfaces a short Risk/Suggestion block
> just in time. It never writes code on its own, never auto-executes
> skills, and never blocks the agent unless blocking is explicitly
> enabled.

## Intervention levels

```
silent   — logged only, never shown
notice   — short XML block injected into next user prompt
guarded  — notice + preGates/postGates the agent must honor
blocker  — guarded + requires user confirmation before proceeding
```

`blocker` is only surfaced as blocking when `sunco.advisor.blocking=true`.
Default is false — `blocker` downgrades to `guarded` at runtime.

## Decision shape

All code consumes `AdvisorDecision` from
`packages/skills-workflow/src/shared/advisor-types.ts`. New consumers
MUST import the type, never redefine it.

Required fields: `level`, `confidence`, `reasonCodes`, `preGates`,
`postGates`, `confirmationReason`, `suppressionKey`, `expiresAt`.

Optional fields that only matter when `level >= 'notice'`:
`userVisibleMessage`, `systemInjection`, `recommendedRoute`.

## Config shape

All config is serialized to `.sun/config.toml` under `[advisor]`:

```toml
[advisor]
enabled = true
model = "claude-opus-4-7"
thinking = "high"             # off | low | medium | high | max
profile = "inherit"           # inherits from /sunco:profile
cost_cap_per_session_usd = 5.0
fallback = "claude-sonnet-4-6"
prompt_injection = true
post_action_queue = true
auto_execute_skills = false   # PERMANENT FALSE — runtime ignores true
blocking = false
max_visible_per_session = 5
suppress_same_key_minutes = 30
```

The `auto_execute_skills` field is hard-coded to `false` in the type
system (`autoExecuteSkills: false`). Attempts to set it true are
treated as false at runtime and flagged by contract-lint.

## Model picker

Picker contract: `AdvisorModelOption[]` with `defaultVisible` and
`requiresProvider` filters. First-run UI shows default-visible rows
that pass provider detection. Detected-only rows (GPT-5, Gemini 2.5
Pro, local providers) only appear when the corresponding provider is
detected. `custom` is always visible as the escape hatch.

## Suppression / Noise budget

| Rule | Default |
|---|---|
| Same suppressionKey re-shown | after 30 minutes |
| Max visible per session | 5 |
| Max advisor blocks per prompt | 1 |
| Min confidence for user-visible surface | medium |

If any of these thresholds is hit, the decision is logged to
`.sun/advisor.log` but not shown.

## Runtime matrix

| Runtime | Ambient prompt hook | Post-action hook | Manual skill | JSON output |
|---|---|---|---|---|
| Claude Code | yes | yes | yes | yes |
| Codex CLI | no | no | yes | yes |
| Cursor | no | no | yes | yes |
| Antigravity | no | no | yes | yes |

Rationale: the ambient path depends on Claude Code's hook contract.
Other runtimes ship with the engine and the skill; callers invoke
`/sunco:advisor --json` for programmatic access.

## Queue schema (post-action)

Queue lives at `.sun/advisor-queue.json`. Schema version is pinned to
`1`. State transitions:

```
pending → surfaced → acknowledged → resolved
pending → surfaced → expired
```

`pending` items are created by the PostToolUse hook. The ambient
hook promotes eligible items to `surfaced` when injecting into the
next prompt. An item becomes `acknowledged` when the agent references
it in its next output, `resolved` when the underlying concern is
cleared, and `expired` after 2 hours without state change.

## What the advisor is NOT allowed to do

- Write code (any file edit).
- Run `git push`, `npm publish`, `vercel deploy`, or any external
  deploy command.
- Execute skills other than read-only analysis.
- Consume the user's API credits silently (every call is accounted
  against `cost_cap_per_session_usd` with a best-effort estimate).
- Block the agent's primary action when `blocking=false`.

## Invariants enforced by contract-lint

- `advisor-types.ts` exports `AdvisorDecision`, `AdvisorConfig`,
  `DEFAULT_ADVISOR_CONFIG`, `DEFAULT_ADVISOR_MODEL_OPTIONS`,
  `DEFAULT_SUPPRESSION_POLICY`, `InterventionLevel`, `AdvisorModelOption`.
- `AdvisorConfig.autoExecuteSkills` is typed as the literal `false`.
- `advisor-runtime-matrix.ts` exports exactly 4 rows (one per runtime).
- `references/advisor-contract.md` exists and contains the phrases
  "Intervention levels", "Runtime matrix", and
  "auto_execute_skills = false".
