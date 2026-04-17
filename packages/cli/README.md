# SUNCO

**Agent Workspace OS** — harness engineering for AI coding agents.

83 skills. 7-layer verification. Cross-model review. Zero mistakes.

```bash
npx popcoru
```

## What is SUNCO?

In an era where AI agents write code, the builder's job is not writing code — it's **setting up the field so agents make fewer mistakes**. SUNCO is that field.

- **Harness Engineering** — lint, health check, and guard enforce quality deterministically (zero LLM cost)
- **83 Skills** — every capability is a skill. No hardcoded commands.
- **7-Layer Verification** — multi-agent review, guardrails, BDD, permissions, adversarial, cross-model (Codex), human eval
- **Skill Absorption** — related commands merge via aliases, keeping the surface clean
- **Multi-Runtime** — Claude Code, Codex CLI, Cursor, Antigravity
- **Cross-Model** — Layer 6 uses Codex CLI for true cross-family verification (not same-model theater)

## Install

```bash
npx popcoru
```

Interactive installer asks: language (EN/KR), runtime (Claude Code/Codex/Cursor/Antigravity/All).

## Quick Start

```bash
/sunco:new           # idea -> questions -> research -> roadmap
/sunco:discuss 1     # extract decisions for Phase 1
/sunco:plan 1        # create atomic execution plans
/sunco:execute 1     # run plans in parallel waves
/sunco:verify 1      # 7-layer Swiss cheese verification
/sunco:ship 1        # create PR and release
```

## Commands (83)

### User Tier (Daily)
| Command | Description |
|---------|-------------|
| `new` | Bootstrap from idea to roadmap |
| `next` | Auto-detect and advance to the next step |
| `do` | Natural language -> command routing |
| `status` | Current state, `--live` for TUI dashboard, `--brief` for context |
| `help` | Full command guide |
| `review` | Auto-routed review (CEO/eng/design) |

### Workflow
| Command | Description |
|---------|-------------|
| `discuss` | Extract decisions before planning |
| `plan` | Create execution plans, `--assume` for approach preview |
| `execute` | Wave-based parallel execution |
| `verify` | 7-layer verification, `--coverage` for test audit, `--generate-tests` for AI test gen, `--require-codex` for strict cross-model |
| `ship` | Create PR after verification |
| `release` | Version bump, changelog, tag, npm publish |
| `auto` | Full autonomous pipeline (discuss -> ship) |
| `quick` | Fast execution with guarantees |

### Debug
| Command | Description |
|---------|-------------|
| `debug` | Systematic debugging with Iron Law, `--parse` for diagnostics, `--postmortem` for forensics |
| `doc` | Document generation (HWPX/markdown), `--report` for HTML export |

### Harness (Zero LLM Cost)
| Command | Description |
|---------|-------------|
| `init` | Scaffold .sun/ and .planning/ |
| `lint` | Architecture boundary check |
| `health` | Codebase health score with trends |
| `guard` | Real-time lint-on-change + rule drafting |
| `agents` | Agent instruction analysis |

### Session
| Command | Description |
|---------|-------------|
| `note` | Idea capture, `--todo`/`--seed`/`--backlog` for task types |
| `pause` / `resume` | Session management |
| `where-am-i` | Full orientation dashboard |
| `progress` | Phase completion overview |

## Architecture

```
packages/
  core/              — CLI engine, config, state, skill system, agent router
  skills-harness/    — Deterministic backbone (zero LLM cost)
  skills-workflow/   — 35 workflow skills + 9 shared modules
  skills-extension/  — Extension point for user-defined skills
  cli/               — CLI entry point + published artifacts

Published artifacts:
  83 commands          — Skill definitions
  77 workflows         — Process implementations
  23 agents            — Specialized AI agent instructions
  16 references        — Domain knowledge documents
  37 templates         — Artifact templates
  6 hooks              — Lifecycle hooks
```

## v0.9.0 Highlights

- **Superpowers 14-skill parity** — every built-in Superpowers skill now has a SUNCO equivalent; `brainstorming` is vendored verbatim and extended with SUNCO rigor
- **Default project-start chain** — `/sunco:office-hours` → `/sunco:brainstorming` → `/sunco:new` on all four runtimes
- **TDD gate** — `type: tdd` plans get deterministic Red-Green-Refactor enforcement in verify Layer 2
- **`/sunco:review --fix`** — auto-routes agreed issues through `/sunco:quick` and re-verifies
- **`/sunco:brainstorming --visual`** — auto-boots the vendored visual companion server
- **`/sunco:new-skill`** — scaffolds new SUNCO skills + colocated tests
- **83 slash commands**, 847 workflow tests, 59/59 contract lint

## v0.8.0 Highlights

- **Alias Infrastructure** — `SkillDefinition.aliases[]` with deprecation warnings and default args injection
- **Full Absorption** — 11 satellite skills merged into 4 absorbers via shared modules (35 skills from 46)
- **Codex Layer 6** — `CodexCliProvider` for true cross-family verification (Claude + OpenAI Codex)
- **`--require-codex`** — strict mode flag for pre-ship cross-model gates
- **CLI Dashboard TUI** — `sunco status --live` with Ink, 5-section layout, 1Hz polling
- **1,332 tests** — 10/10 turbo tasks green

## Stats

| Package | Tests | Source Files |
|---------|-------|-------------|
| @sunco/core | 368 | 244 |
| @sunco/skills-harness | 146 | — |
| @sunco/skills-workflow | 795 | — |
| popcoru (meta) | 23 | — |
| **Total** | **1,332** | **63,466 lines** |

## Links

- [GitHub](https://github.com/kwmin122/sunco-harness)
- [npm](https://www.npmjs.com/package/popcoru)

## License

MIT
