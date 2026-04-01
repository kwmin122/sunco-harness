# Settings Workflow

Read and write SUNCO project settings. Manages `.planning/config.json` for per-project configuration and `~/.sun/config.toml` for global user preferences. Supports `--set`, `--key`, `--list`, and `--reset`. Used by `/sunco:settings`.

---

## Overview

Two config layers:

| Layer | File | Scope | Format |
|-------|------|-------|--------|
| Project | `.planning/config.json` | Current project only | JSON |
| Global | `~/.sun/config.toml` | All projects | TOML |

Project config overrides global config. Both are readable by all SUNCO workflows.

Four sub-commands:

| Mode | Example | Effect |
|------|---------|--------|
| List | `/sunco:settings` | Show all settings with source |
| Get | `/sunco:settings --key <key>` | Print one value |
| Set | `/sunco:settings --set <key> <value>` | Write a setting |
| Reset | `/sunco:settings --reset <key>` | Remove a setting (revert to default) |

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--set <key> <value>` | `SET_KEY`, `SET_VALUE` | unset |
| `--key <key>` | `GET_KEY` | unset |
| `--reset <key>` | `RESET_KEY` | unset |
| `--global` | `GLOBAL_SCOPE` | false |
| `--json` | `JSON_OUTPUT` | false |
| `--list` | `LIST_MODE` | false (default when no args) |

Rules:
- If no arguments: treat as `--list`
- `--global` applies to `--set` and `--reset` (writes to `~/.sun/config.toml` instead of `.planning/config.json`)
- `--set` without `--global` writes to project config

---

## Step 2: Locate Config Files

### Project config

```bash
PROJECT_CONFIG=".planning/config.json"
mkdir -p .planning/

if [[ ! -f "$PROJECT_CONFIG" ]]; then
  echo '{}' > "$PROJECT_CONFIG"
fi
```

### Global config

```bash
GLOBAL_CONFIG="${HOME}/.sun/config.toml"
mkdir -p "${HOME}/.sun/"

if [[ ! -f "$GLOBAL_CONFIG" ]]; then
  cat > "$GLOBAL_CONFIG" << 'EOF'
# SUNCO global configuration
# Managed by /sunco:settings --global
# Project config at .planning/config.json overrides these values.

[defaults]
EOF
fi
```

---

## Step 3A: List Settings

If `LIST_MODE`:

Read both config files. Show all keys with their current values and source.

### Render format

```
SUNCO Settings
─────────────────────────────────────────────────────────

Project config (.planning/config.json):

  {key}                  {value}
  {key}                  {value}
  (empty — no project overrides set)

Global config (~/.sun/config.toml):

  {key}                  {value}
  {key}                  {value}
  (empty — no global settings set)

Effective config (merged, project overrides global):

  {key}              {value}          source: {project|global|default}
  {key}              {value}          source: {project|global|default}

─────────────────────────────────────────────────────────
Set:    /sunco:settings --set <key> <value>
Get:    /sunco:settings --key <key>
Global: /sunco:settings --global --set <key> <value>
```

If both files are empty:

```
No settings configured yet.

SUNCO uses defaults for all options. Override with:
  /sunco:settings --set <key> <value>

Common settings:
  /sunco:settings --set defaultModel claude-opus-4-5
  /sunco:settings --set lint.strict true
  /sunco:settings --set phases.autoVerify false
  /sunco:settings --global --set telemetry false
```

---

## Step 3B: Get a Single Key

If `GET_KEY` is set:

Search the effective (merged) config for the key.

```bash
# Support dot-notation: "model.provider" → config.model.provider
```

If key found:

```
{key}: {value}
source: {project (.planning/config.json) | global (~/.sun/config.toml) | default}
```

If key not found:

```
Key not found: {GET_KEY}

No value is set for this key. SUNCO will use the built-in default.

Set it with:
  /sunco:settings --set {GET_KEY} <value>
```

---

## Step 3C: Set a Value

If `SET_KEY` and `SET_VALUE` are set:

### Validate the key

Known keys and their valid values:

| Key | Type | Valid values | Default | Description |
|-----|------|-------------|---------|-------------|
| `defaultModel` | string | claude-*, gpt-*, etc. | `claude-opus-4-5` | Default AI model for prompt skills |
| `defaultProvider` | string | anthropic, openai, google, ollama | `anthropic` | Default AI provider |
| `lint.strict` | boolean | true, false | `true` | Fail on lint warnings |
| `lint.autoFix` | boolean | true, false | `false` | Auto-fix on lint |
| `phases.autoVerify` | boolean | true, false | `false` | Run verify automatically after execute |
| `phases.waveSize` | integer | 1-10 | `3` | Default wave size for execute |
| `telemetry` | boolean | true, false | `true` | Usage telemetry (global only) |
| `commit.autoCommit` | boolean | true, false | `false` | Auto-commit after each plan execution |
| `commit.messageStyle` | string | conventional, simple | `conventional` | Commit message format |
| `output.color` | boolean | true, false | `true` | Colored terminal output |
| `output.compact` | boolean | true, false | `false` | Compact output by default |

If key is unknown: warn but allow (unknown keys are passed through without validation).

```
Warning: {SET_KEY} is not a recognized SUNCO setting.
Setting it anyway. Use /sunco:settings --list to see known settings.
```

### Write the value

**Project scope** (default):

Read `.planning/config.json`, set the key using dot-notation parsing, write back.

```bash
node -e "
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync('${PROJECT_CONFIG}', 'utf8'));
  const keys = '${SET_KEY}'.split('.');
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = ${SET_VALUE_PARSED};
  fs.writeFileSync('${PROJECT_CONFIG}', JSON.stringify(config, null, 2));
"
```

**Global scope** (`--global`):

Parse `~/.sun/config.toml`, set the key, serialize back to TOML using smol-toml.

### Confirm

```
Setting saved.

  {key}: {value}
  Scope: {project (.planning/config.json) | global (~/.sun/config.toml)}

  Effective immediately for all /sunco: commands.
```

---

## Step 3D: Reset a Key

If `RESET_KEY` is set:

### Determine scope

If `--global`: modify `~/.sun/config.toml`.
Otherwise: modify `.planning/config.json`.

### Remove the key

Read the config file. Delete the specified key (dot-notation). If the key is nested, remove the leaf. If the parent is now empty, remove the parent too.

Write the modified config back.

### Confirm

```
Setting removed: {RESET_KEY}

  SUNCO will use the built-in default for this key.
  Default value: {default_value or "(none — key was custom)"}
```

If key was not found:

```
Key not found: {RESET_KEY}
Nothing was changed.
```

---

## Project Config Schema (.planning/config.json)

```json
{
  "defaultModel": "claude-opus-4-5",
  "defaultProvider": "anthropic",
  "lint": {
    "strict": true,
    "autoFix": false
  },
  "phases": {
    "autoVerify": false,
    "waveSize": 3
  },
  "commit": {
    "autoCommit": false,
    "messageStyle": "conventional"
  },
  "output": {
    "color": true,
    "compact": false
  }
}
```

---

## Global Config Schema (~/.sun/config.toml)

```toml
# SUNCO global configuration

[defaults]
defaultModel = "claude-opus-4-5"
defaultProvider = "anthropic"

[telemetry]
enabled = true

[output]
color = true
compact = false
```

---

## Merge Behavior

When SUNCO reads configuration, it merges project and global in this order:

1. Built-in defaults (hardcoded in `packages/core`)
2. Global config (`~/.sun/config.toml`)
3. Project config (`.planning/config.json`)
4. Environment variables (`SUNCO_*` prefix overrides all)

Later entries win. Project config always overrides global.

Environment variable mapping:

| Env var | Config key |
|---------|------------|
| `SUNCO_MODEL` | `defaultModel` |
| `SUNCO_PROVIDER` | `defaultProvider` |
| `SUNCO_NO_COLOR` | `output.color = false` |
| `SUNCO_COMPACT` | `output.compact` |

---

## JSON Output (--json)

If `--json`:

```json
{
  "effective": {
    "defaultModel": "claude-opus-4-5",
    "defaultProvider": "anthropic",
    "lint": { "strict": true, "autoFix": false },
    "phases": { "autoVerify": false, "waveSize": 3 },
    "commit": { "autoCommit": false, "messageStyle": "conventional" },
    "output": { "color": true, "compact": false },
    "telemetry": true
  },
  "sources": {
    "defaultModel": "project",
    "telemetry": "global",
    "lint.strict": "default"
  },
  "files": {
    "project": ".planning/config.json",
    "global": "~/.sun/config.toml"
  }
}
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| `.planning/` not found and not `--global` | "No SUNCO project found. Run `/sunco:init` first." |
| `~/.sun/` not writable | "Cannot write to `~/.sun/`. Check permissions." |
| JSON parse error in config.json | "config.json is malformed. Repair or delete it: `rm .planning/config.json`" |
| TOML parse error in global config | "~/.sun/config.toml is malformed. Repair or delete it." |
| Value type mismatch (e.g. string for boolean key) | "Expected boolean for {key}. Use `true` or `false`." |

---

## Route

After `--set`: settings are effective immediately. No restart required.

If `telemetry` was set to `false` globally: "Telemetry disabled globally. This applies to all SUNCO projects."

If `defaultModel` was changed: "Model changed to `{value}`. All prompt skills will use this model unless overridden per-command."
