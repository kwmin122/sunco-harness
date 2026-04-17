---
name: sunco:new-skill
description: Scaffold a new SUNCO skill file + colocated test (Superpowers writing-skills parity)
argument-hint: "<skill-name> [--kind prompt|deterministic] [--tier user|workflow|admin] [--description \"...\"] [--path <dir>] [--no-test]"
allowed-tools:
  - Read
  - Write
  - Bash
---

<context>
SUNCO is skill-only: every capability ships as a `defineSkill({...})`. Hand-writing the boilerplate every time means naming drift, missing fields, and skipped tests. This command generates the scaffold deterministically — no LLM calls — so the harness guarantees stay intact.

**Arguments:**
- `<skill-name>` — Lowercase kebab-case (e.g. `audit-secrets`, `bundle-size`).

**Flags:**
- `--kind prompt|deterministic` — Default `prompt`. Use `deterministic` when the skill never calls an LLM (lint, reporting, io-only).
- `--tier user|workflow|admin` — Default `user`. Matches SUNCO's tier taxonomy for discoverability.
- `--description "..."` — One-line description used in the skill frontmatter.
- `--path <dir>` — Target directory (default: `packages/skills-extension/src`).
- `--no-test` — Skip scaffolding the colocated test file.
</context>

<objective>
Scaffold `<name>.skill.ts` and `__tests__/<name>.skill.test.ts`, print them as a short punchlist, and tell the user the three wiring steps that remain (barrel export, tsup entry, optional CLI preload). Never overwrite existing files; skip silently if they exist.
</objective>

<process>
The implementation is in `@sunco/skills-workflow/new-skill`. This file is the slash-command entry point for Claude Code, Codex, Cursor, and Antigravity runtimes.

Read and execute: the runtime loads the skill directly via `/sunco:new-skill <name> [flags]`.
</process>

<success_criteria>
- `<target-dir>/<name>.skill.ts` exists and compiles under `tsc --noEmit` (after user wiring)
- `<target-dir>/__tests__/<name>.skill.test.ts` exists unless `--no-test` was passed
- User sees the three wiring steps for barrel/tsup/preload
- No existing files were overwritten
</success_criteria>
