---
name: sunco:settings
description: View and manage TOML configuration
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO settings skill to view and manage the TOML configuration hierarchy — global (~/.sun/config.toml), project (.sun/config.toml), and directory-level overrides. Supports listing all active settings, setting individual key-value pairs, and understanding which config level each value comes from.
</objective>

<process>
1. Run one of:
   - `node $HOME/.claude/sunco/bin/cli.js settings --list` — show all active configuration values with their source level
   - `node $HOME/.claude/sunco/bin/cli.js settings --set <key>=<value>` — set a configuration value
   - `node $HOME/.claude/sunco/bin/cli.js settings` — show settings overview and current config file paths
2. Display the output clearly:
   - For `--list`: show each setting as `key = value  [source: global|project|directory]`
   - Group settings by section (e.g., [lint], [health], [agent], [ui])
   - Highlight any settings that differ from defaults
   - For `--set`: confirm the value was written and show the config file it was written to
3. Config hierarchy reminder:
   - Global config (`~/.sun/config.toml`) — applies to all projects
   - Project config (`.sun/config.toml`) — applies to this project, overrides global
   - Directory config (`.sun/local.toml`) — applies to current directory, highest precedence
4. After displaying or updating settings, suggest:
   - "Run `/sunco:lint` to verify your rule settings are working as expected"
   - "Run `/sunco:health` to see how your configuration affects the health score"
</process>
