---
name: sunco:init
description: Initialize project harness — detect stack, generate lint rules
allowed-tools:
  - Bash
  - Read
---

<objective>
Run the SUNCO init skill to detect the project's technology stack, architectural layers, and coding conventions, then generate lint rules and scaffold the .sun/ workspace directory. This is the mandatory first step before using lint, health, or guard.
</objective>

<process>
1. Run: `node $HOME/.claude/sunco/bin/cli.js init`
   - Optional: add `--preset <name>` to force a specific preset instead of auto-detection
   - Optional: add `--force` to overwrite an existing .sun/ configuration
2. Display the output clearly:
   - Ecosystems detected (e.g., typescript-monorepo, react, node)
   - Layers detected (e.g., domain, service, infra, ui)
   - Naming and import style conventions
   - Number of lint rules generated
   - Preset applied
3. If init succeeds, suggest: "Run `/sunco:lint` to check architecture boundaries, or `/sunco:health` for a full health score."
4. If init fails (e.g., unsupported stack), show the error message and suggest running with `--preset <name>` to force a known preset.
</process>
