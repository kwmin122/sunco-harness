# Planning Configuration Guide

All fields in `.planning/config.json` explained, with their effects, defaults, and profile-specific overrides. Applied by every SUNCO command that reads project configuration.

---

## Overview

`.planning/config.json` controls SUNCO's runtime behavior for this project. It is distinct from `.sun/config.toml` (harness settings) and `~/.sun/config.toml` (global settings).

**Edit via command:**
```bash
sunco settings --set mode=yolo
sunco settings --set workflow.auto_advance=true
sunco settings --view
```

**Edit directly:** Any text editor. Changes take effect on the next SUNCO command.

**Config hierarchy** (highest precedence wins):
```
Environment variables (SUNCO_*)
.sun/local.toml (directory-level, gitignored)
.planning/config.json (project-level, committed)
~/.sun/config.toml (global user defaults)
Built-in defaults (this document)
```

---

## Top-Level Fields

### `mode`

Controls agent autonomy during execution.

```json
{ "mode": "yolo" }
```

| Value | Description |
|-------|-------------|
| `"yolo"` | Agents proceed without asking for confirmation. No interruption prompts. Fastest path through execution. |
| `"interactive"` | Agents pause at key decision points and ask for confirmation before proceeding. |

**Default:** `"interactive"`

**When to use `"yolo"`:** Trusted phases with well-written plans, CI/CD pipelines, high-confidence refactors.
**When to use `"interactive"`:** Ambiguous phases, large blast radius, whenever you want a human in the loop.

**Environment override:** `SUNCO_MODE=yolo`

---

### `granularity`

Controls how much planning detail is required before execution.

```json
{ "granularity": "plan" }
```

| Value | Description |
|-------|-------------|
| `"phase"` | One plan file covers the entire phase. Less planning, faster start. |
| `"plan"` | Each phase has multiple numbered plan files. Standard granularity. |
| `"task"` | Each task within a plan has explicit subtask breakdown. Maximum control. |

**Default:** `"plan"`

**When to use `"phase"`:** Prototyping, spike work, or phases you've done many times and know well.
**When to use `"task"`:** High-stakes phases, onboarding new team members, or any phase where blast radius is large.

---

### `profile`

Active model profile for agent calls. Controls cost vs. quality tradeoff.

```json
{ "profile": "quality" }
```

| Value | Models used | Use case |
|-------|-------------|----------|
| `"economy"` | claude-haiku-3-5, gpt-4o-mini | Draft work, brainstorming, non-critical tasks |
| `"balanced"` | claude-sonnet-4, gpt-4o | Most phases, good default |
| `"quality"` | claude-opus-4, gpt-4.1 | Complex architecture, final verification, ship-critical |

**Default:** `"balanced"`

**Environment override:** `SUNCO_PROFILE=quality`

---

## Workflow Settings

### `workflow.auto_advance`

When `true`, human-verify and decision checkpoints auto-advance without human input. human-action checkpoints (auth gates) always stop regardless of this setting.

```json
{ "workflow": { "auto_advance": false } }
```

**Default:** `false`

**When to enable:** Fully automated CI runs, batch phase execution when you trust the plans completely.

**Note:** This is the equivalent of "YOLO mode for checkpoints." Combined with `mode: "yolo"`, this produces fully unattended execution.

---

### `workflow.require_wave_checkpoints`

When `true`, deterministic wave checkpoints (lint-gate, test pass) are required between waves. When `false`, waves run continuously without intermediate checks.

```json
{ "workflow": { "require_wave_checkpoints": true } }
```

**Default:** `true`

**When to disable:** Rapid iteration on small phases where you'll run the full lint-gate at the end anyway. Not recommended for phases with 3+ waves.

---

### `workflow.auto_chain_phases`

When `true`, completing one phase automatically starts the next phase in the roadmap after a brief pause. The pause duration is set by `workflow.chain_pause_seconds`.

```json
{ "workflow": { "auto_chain_phases": false, "chain_pause_seconds": 5 } }
```

**Default:** `false`, `chain_pause_seconds`: `5`

**When to enable:** When running `/sunco:auto` or letting SUNCO work unattended through multiple phases.

---

### `workflow.skip_discuss`

When `true`, `/sunco:plan` does not require a prior `/sunco:discuss` run. Assumes the plan was written with sufficient context.

```json
{ "workflow": { "skip_discuss": false } }
```

**Default:** `false`

**When to enable:** Projects where the builder writes plans manually without the discuss flow. Advanced use case.

---

### `workflow.lint_gate_on_commit`

When `true`, runs the full lint-gate check before allowing commits in this project. Requires the SUNCO git hook to be installed (`sunco init` installs it).

```json
{ "workflow": { "lint_gate_on_commit": true } }
```

**Default:** `true`

**When to disable:** Emergency hotfixes where you need to commit broken code temporarily. Always re-enable after.

---

## Verification Settings

### `verification.skip_layers`

Array of layer numbers to skip during `/sunco:verify`. Affects the verification report and ship decision.

```json
{ "verification": { "skip_layers": [] } }
```

| Layer | Skip condition |
|-------|---------------|
| `5` (adversarial) | Phases with no external inputs or user-supplied data |
| `6` (cross-model) | Codex plugin not installed, or time-critical fixes |

**Never skip:** Layer 2 (guardrails). It is the fastest, most reliable layer.

**Default:** `[]` (run all layers)

---

### `verification.require_green_before_ship`

When `true`, `/sunco:ship` refuses to create a PR if any verification layer is in `failed` status.

```json
{ "verification": { "require_green_before_ship": true } }
```

**Default:** `true`

**When to disable:** Never. If you need to ship with a known failure, document it explicitly in the PR description and re-enable immediately after.

---

### `verification.coverage_thresholds`

Per-layer minimum coverage required before the Layer 4 test coverage check passes.

```json
{
  "verification": {
    "coverage_thresholds": {
      "domain": 90,
      "services": 75,
      "infra": 60,
      "cli": 40
    }
  }
}
```

**Defaults:** As shown above. TDD plans override these upward (see `tdd.md`).

---

## Git Settings

### `git.auto_commit`

When `true`, SUNCO commits after each plan completes during execution without asking.

```json
{ "git": { "auto_commit": true } }
```

**Default:** `true`

**Commit message format:** `feat(phase-plan): [auto-generated from plan objective]`

---

### `git.branch_strategy`

Controls branch behavior during execution.

```json
{ "git": { "branch_strategy": "main" } }
```

| Value | Description |
|-------|-------------|
| `"main"` | All work on main branch. Simpler, requires clean history discipline. |
| `"phase"` | One branch per phase, merged after verification. |
| `"plan"` | One branch per plan, merged after each plan completes. |

**Default:** `"main"`

---

### `git.push_on_ship`

When `true`, `/sunco:ship` pushes the branch to origin after creating the PR.

```json
{ "git": { "push_on_ship": true } }
```

**Default:** `true`

---

## Display Settings

### `display.verbosity`

Controls how much output SUNCO shows during execution.

```json
{ "display": { "verbosity": "normal" } }
```

| Value | Description |
|-------|-------------|
| `"silent"` | No output except errors and final results |
| `"normal"` | Progress indicators, key events, errors |
| `"verbose"` | All agent output, full task logs |
| `"debug"` | Everything including internal state transitions |

**Default:** `"normal"`

**Environment override:** `SUNCO_VERBOSITY=verbose`

---

### `display.use_ink`

When `true`, uses Ink (React for terminal) for interactive output. When `false`, falls back to plain text output (useful for CI or terminals that don't support ANSI).

```json
{ "display": { "use_ink": true } }
```

**Default:** `true` on interactive terminals, `false` in CI (detected via `process.env.CI`)

---

## Profile-Specific Defaults

Profiles set at `/sunco:profile` adjust config defaults differently per tier:

| Setting | Guided | Standard | Expert | Principal |
|---------|--------|----------|--------|-----------|
| `mode` | `"interactive"` | `"interactive"` | `"yolo"` | `"yolo"` |
| `workflow.auto_advance` | `false` | `false` | `false` | `true` |
| `workflow.require_wave_checkpoints` | `true` | `true` | `true` | `false` |
| `display.verbosity` | `"verbose"` | `"normal"` | `"normal"` | `"silent"` |
| `granularity` | `"task"` | `"plan"` | `"plan"` | `"phase"` |

These are defaults only. Any field explicitly set in `.planning/config.json` overrides the profile default.

---

## Environment Variable Overrides

All top-level settings have an environment variable override for CI/CD use:

| Environment variable | Config field | Notes |
|---------------------|--------------|-------|
| `SUNCO_MODE` | `mode` | |
| `SUNCO_PROFILE` | `profile` | |
| `SUNCO_VERBOSITY` | `display.verbosity` | |
| `SUNCO_AUTO_ADVANCE` | `workflow.auto_advance` | Set to `"true"` |
| `SUNCO_SKIP_LAYERS` | `verification.skip_layers` | Comma-separated: `"5,6"` |
| `SUNCO_NO_GIT` | `git.auto_commit` | Set to `"true"` to disable commits |
| `SUNCO_NO_INK` | `display.use_ink` | Set to `"true"` to disable Ink |

**Example CI configuration:**
```yaml
env:
  SUNCO_MODE: yolo
  SUNCO_AUTO_ADVANCE: "true"
  SUNCO_NO_INK: "true"
  SUNCO_VERBOSITY: normal
```
