# SUNCO

Agent Workspace OS — harness engineering for AI coding agents

[![npm](https://img.shields.io/npm/v/popcoru)](https://www.npmjs.com/package/popcoru)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What is SUNCO?

SUNCO is a skill pack for Claude Code (and other AI coding agents). It installs 57 slash commands that enforce quality at every step — lint gates, blast radius analysis, 6-layer verification, and a proactive recommender.

**One command to install:**

```bash
npx popcoru
```

This copies commands, engine, hooks, workflows, references, and templates into `~/.claude/`. Then use `/sunco:help` in Claude Code.

## Why SUNCO?

AI agents write code. Your job is setting up the field so they make fewer mistakes. SUNCO is that field.

- **Deterministic harness** — lint, health, guard run with zero LLM cost
- **6-layer Swiss cheese verification** — multi-agent review, guardrails, BDD criteria, permission audit, adversarial test, cross-model (Codex)
- **Blast radius analysis** — dependency graph check before every execution
- **57 slash commands** covering the full development lifecycle
- **Proactive recommender** — 50+ rules suggesting next-best-action
- **HWPX document generation** — Korean standard document format

## Quick Start

```bash
# Install
npx popcoru

# In Claude Code:
/sunco:help              # See all commands
/sunco:init              # Detect stack, generate rules
/sunco:new               # Bootstrap project from idea
/sunco:lint              # Architecture boundary enforcement
/sunco:health            # Codebase health score
```

## The Pipeline

```
/sunco:new → /sunco:discuss → /sunco:plan → /sunco:execute → /sunco:verify → /sunco:ship
```

Each step has built-in quality gates:
- **discuss**: Extracts decisions and gray areas before planning
- **plan**: Creates BDD acceptance criteria with research integration
- **execute**: Parallel execution with mandatory lint-gate after each task
- **verify**: 6-layer Swiss cheese verification pipeline
- **ship**: Creates PR only after verification passes

## Command Catalog

### Harness (Deterministic, Zero LLM)

| Command | Description |
|---------|-------------|
| `/sunco:init` | Detect stack, layers, conventions, generate rules |
| `/sunco:lint` | Architecture boundary enforcement |
| `/sunco:health` | Codebase health score with trend tracking |
| `/sunco:guard` | Real-time lint-on-change |
| `/sunco:agents` | Agent instruction file analysis |
| `/sunco:status` | Current project state |
| `/sunco:query` | Query project data |
| `/sunco:graph` | Code dependency graph + blast radius |
| `/sunco:export` | HTML project reports |
| `/sunco:headless` | CI/CD mode with JSON output |
| `/sunco:validate` | Validate planning artifacts |
| `/sunco:settings` | Configure SUNCO behavior |
| `/sunco:help` | Full command catalog |

### Workflow (Agent-Powered)

| Command | Description |
|---------|-------------|
| `/sunco:new` | Bootstrap project from idea |
| `/sunco:discuss` | Extract decisions and gray areas |
| `/sunco:plan` | Create execution plans with BDD criteria |
| `/sunco:execute` | Parallel execution with lint-gate |
| `/sunco:verify` | 6-layer Swiss cheese verification |
| `/sunco:review` | Multi-provider cross-review |
| `/sunco:ship` | PR with verification pre-check |
| `/sunco:auto` | Full autonomous pipeline with crash recovery |

### Debugging

| Command | Description |
|---------|-------------|
| `/sunco:debug` | Systematic debugging with persistent state |
| `/sunco:diagnose` | Analyze build/test output |
| `/sunco:forensics` | Post-mortem investigation |

### Session & Ideas

| Command | Description |
|---------|-------------|
| `/sunco:pause` | Save session state |
| `/sunco:resume` | Restore from last session |
| `/sunco:next` | Auto-detect next step |
| `/sunco:progress` | Where am I, what's next |
| `/sunco:note` | Zero-friction idea capture |
| `/sunco:todo` | Task management |
| `/sunco:seed` | Plant ideas with trigger conditions |
| `/sunco:backlog` | Parking lot for ideas |

### Composition

| Command | Description |
|---------|-------------|
| `/sunco:quick` | Ad-hoc task with guarantees |
| `/sunco:fast` | Inline trivial tasks |
| `/sunco:do` | Route freeform text to right command |

### Management & New Features

| Command | Description |
|---------|-------------|
| `/sunco:phase` | Add, insert, remove phases |
| `/sunco:milestone` | Milestone management |
| `/sunco:release` | Version bump, changelog, publish |
| `/sunco:workstreams` | Parallel workstream management |
| `/sunco:workspaces` | Multi-project workspaces |
| `/sunco:ui-phase` | UI design contract generation |
| `/sunco:ui-review` | 6-pillar visual UI audit |
| `/sunco:manager` | Interactive command center |
| `/sunco:stats` | Project statistics |
| `/sunco:profile` | Model profile management |
| `/sunco:map-codebase` | Parallel codebase analysis |
| `/sunco:thread` | Persistent context threads |
| `/sunco:pr-branch` | Clean PR branch creation |
| `/sunco:audit-uat` | User acceptance testing audit |

## What Gets Installed

```
~/.claude/
  commands/sunco/         # 57 slash commands
  sunco/
    bin/                  # Engine (deterministic skills)
    workflows/            # 9 workflow logic files
    references/           # 6 reference documents
    templates/            # 7 artifact templates
    VERSION
  hooks/                  # 4 hooks (update check, statusline, context monitor, prompt guard)
```

## Uninstall

```bash
npx popcoru --uninstall
```

## Multi-Runtime Support

SUNCO is designed for Claude Code first, with planned support for:
- Codex CLI
- Cursor
- Gemini
- Antigravity
- Any agent that supports slash commands

## License

MIT
