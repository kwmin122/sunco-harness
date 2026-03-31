---
name: sunco:profile
description: Manage model profiles — choose which AI model runs each SUNCO command stage. Profiles: quality, balanced, budget, inherit. Stored in .planning/config.json.
argument-hint: "<subcommand> [profile]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `show` — Display the current active profile with a model mapping table.
- `set <profile>` — Switch to a named profile or a custom model string.
- `list` — Show all available profiles with descriptions and model mappings.

**Flags:**
- `--global` — Apply the profile to `~/.sun/config.json` (all projects) instead of the current project's `.planning/config.json`.
</context>

<objective>
Manage which AI model is used at each stage of the SUNCO pipeline. Profiles let you trade off quality and cost: use `quality` for thorough work, `balanced` for daily development, `budget` for high-velocity iteration. The active profile is stored in `.planning/config.json` and read by all commands that invoke an AI agent.

**Creates / modifies:**
- `.planning/config.json` — project-level profile setting (default)
- `~/.sun/config.json` — global profile setting (if `--global`)

**After this command:** Run any SUNCO pipeline command — it will use the newly selected profile's model assignments.
</objective>

<process>
## Profile definitions

The four built-in profiles map pipeline stages to models as follows:

| Stage | quality | balanced | budget | inherit |
|-------|---------|----------|--------|---------|
| discuss | claude-opus-4-5 | claude-opus-4-5 | claude-sonnet-4-5 | (runtime model) |
| plan | claude-opus-4-5 | claude-opus-4-5 | claude-sonnet-4-5 | (runtime model) |
| execute | claude-opus-4-5 | claude-sonnet-4-5 | claude-sonnet-4-5 | (runtime model) |
| verify | claude-opus-4-5 | claude-sonnet-4-5 | claude-haiku-3-5 | (runtime model) |
| review | claude-opus-4-5 | claude-sonnet-4-5 | claude-haiku-3-5 | (runtime model) |
| ui-phase | claude-opus-4-5 | claude-sonnet-4-5 | claude-sonnet-4-5 | (runtime model) |
| ui-review | claude-opus-4-5 | claude-sonnet-4-5 | claude-haiku-3-5 | (runtime model) |

**Profile descriptions:**
- `quality` — Opus everywhere. Maximum reasoning depth. Best for complex architecture, critical features, and final review passes. Highest cost.
- `balanced` — Opus for planning (discuss + plan), Sonnet for execution and verification. Best for day-to-day development. Recommended default.
- `budget` — Sonnet for planning and execution, Haiku for verification and review. Best for high-volume iteration, spike work, and experimentation. Lowest cost.
- `inherit` — All stages use the model Claude Code is currently running as. No overrides. Useful when you control the model externally via `claude --model`.

Custom profiles are also supported: any stage can be set to an arbitrary model string.

---

## If `list`

Display the full profile table:

```
SUNCO MODEL PROFILES
====================

PROFILE     DESCRIPTION
-------     -----------
quality     Opus everywhere — maximum reasoning, highest cost
balanced    Opus plan, Sonnet execute/verify — recommended default
budget      Sonnet plan/execute, Haiku verify — high-velocity iteration
inherit     Use current runtime model for all stages — no overrides

STAGE          QUALITY                  BALANCED                 BUDGET                   INHERIT
-----          -------                  --------                 ------                   -------
discuss        claude-opus-4-5          claude-opus-4-5          claude-sonnet-4-5        (runtime)
plan           claude-opus-4-5          claude-opus-4-5          claude-sonnet-4-5        (runtime)
execute        claude-opus-4-5          claude-sonnet-4-5        claude-sonnet-4-5        (runtime)
verify         claude-opus-4-5          claude-sonnet-4-5        claude-haiku-3-5         (runtime)
review         claude-opus-4-5          claude-sonnet-4-5        claude-haiku-3-5         (runtime)
ui-phase       claude-opus-4-5          claude-sonnet-4-5        claude-sonnet-4-5        (runtime)
ui-review      claude-opus-4-5          claude-sonnet-4-5        claude-haiku-3-5         (runtime)

Active profile: [name] ([source: project|global|default])
```

---

## If `show`

Read `.planning/config.json`.
If file does not exist: check `~/.sun/config.json`.
If neither exists: show "No profile configured. Default is `balanced`."

Display the current profile and its full model mapping:

```
CURRENT PROFILE: [name]
Source: [.planning/config.json | ~/.sun/config.json | default]

STAGE          MODEL
-----          -----
discuss        [model]
plan           [model]
execute        [model]
verify         [model]
review         [model]
ui-phase       [model]
ui-review      [model]

To change: /sunco:profile set <quality|balanced|budget|inherit>
```

If the current profile has any custom per-stage overrides (not matching a named preset exactly): show them clearly with a `(custom)` label.

---

## If `set <profile>`

Validate the value:
- If it matches a named profile (`quality`, `balanced`, `budget`, `inherit`): use that preset.
- If it does not match: ask "Unknown profile '[value]'. Available profiles: quality, balanced, budget, inherit. Did you mean one of these?"

Determine target config file:
- Default: `.planning/config.json` (project-level)
- With `--global`: `~/.sun/config.json` (global)

Read existing config file (create `{}` if missing).

Update the `profile` key:
```json
{
  "profile": {
    "active": "[name]",
    "updatedAt": "[timestamp]",
    "models": {
      "discuss": "[model]",
      "plan": "[model]",
      "execute": "[model]",
      "verify": "[model]",
      "review": "[model]",
      "ui-phase": "[model]",
      "ui-review": "[model]"
    }
  }
}
```

Write the updated config file.

Show confirmation:
```
Profile updated: [old profile] → [new profile]
Config:          [file path]

STAGE          MODEL
-----          -----
discuss        [model]
plan           [model]
execute        [model]
verify         [model]
review         [model]
ui-phase       [model]
ui-review      [model]
```

Tell user: "All subsequent SUNCO pipeline commands will use the `[name]` profile."

If switching to `quality` from `budget`: note "Quality profile uses Opus for all stages — expect higher token costs."
If switching to `inherit`: note "Inherit profile uses whatever model Claude Code is currently running as. Pass `--model` to the `claude` CLI to control this externally."
</process>
