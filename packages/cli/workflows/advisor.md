# Advisor Workflow

The advisor is SUNCO's ambient policy layer. Most users never invoke `/sunco:advisor` directly — the Phase 2 UserPromptSubmit hook and the Phase 3 PostToolUse queue do the work automatically. This workflow documents the debug surface for when you DO want to invoke it manually.

## When to invoke manually

- **First run.** `/sunco:advisor --reconfigure` runs the picker and writes `~/.sun/config.toml`.
- **Dry-run a task.** You want to know what the advisor would say for a task before running it. Use `/sunco:advisor "<task>" --verbose`.
- **Non-Claude runtimes.** Codex CLI / Cursor / Antigravity don't get the ambient hooks. They use `/sunco:advisor "<task>" --json` and parse the result.
- **Post-mortem.** `/sunco:advisor --last` prints the last 10 decisions from `~/.sun/advisor.log`.

## Model picker

The first-run picker (and `--reconfigure`) lists:

- Opus 4.7 (thinking=max / high / medium)
- Sonnet 4.6 (thinking=max / high)
- Haiku 4.5 (thinking=off)
- Codex CLI (cross-family)
- Custom (edit `~/.sun/config.toml` manually)

Plus detected-only advanced options (GPT-5, Gemini 2.5 Pro, local provider) — hidden until their API key or binary is detected.

## Output format

Default / `--verbose`:

```
Risk: <one-line risk summary>.
Suggestion: <one-line recommended next step>
[Skip: <what NOT to spend time on>]
```

`--verbose` also prints:

```
level=guarded  confidence=high
reasonCodes: touchesAuth, missingTests
preGates: spec-approval
postGates: lint(changed), test(targeted), review(security)
confirmationReason: security_sensitive
<sunco_advisor visibility="internal" level="guarded" confidence="high" ...>
Risk: ...
Suggestion: ...
</sunco_advisor>
```

`--json` emits:

```json
{
  "decision": { /* AdvisorDecision */ },
  "config": { /* current AdvisorConfig */ },
  "picker": false
}
```

## Hard invariants

- The skill never writes code.
- The skill never runs other `/sunco:*` skills (autoExecuteSkills is typed as literal `false`).
- The skill never pushes, deploys, or merges.
- Writes to `~/.sun/config.toml` only happen on `--reconfigure`.
- Writes to `~/.sun/advisor.log` happen only through the hooks, not this skill.

## Config shape (for reference)

```toml
[advisor]
enabled = true
model = "claude-opus-4-7"
thinking = "high"
profile = "inherit"
cost_cap_per_session_usd = 5.0
fallback = "claude-sonnet-4-6"
prompt_injection = true
post_action_queue = true
auto_execute_skills = false
blocking = false
max_visible_per_session = 5
suppress_same_key_minutes = 30
```

Full contract: `packages/cli/references/advisor-contract.md`.
