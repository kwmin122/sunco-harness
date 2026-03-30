# SUNCO

Agent Workspace OS — 에이전트가 실수를 덜 하게 판을 깔아주는 OS

[![npm](https://img.shields.io/npm/v/sunco)](https://www.npmjs.com/package/sunco)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What is SUNCO?

SUNCO is a standalone CLI runtime for agent-era builders. While AI agents write code, your job is setting up the field so they make fewer mistakes. SUNCO is that field.

- **39+ skills** covering the full development lifecycle
- **5-layer Swiss cheese verification** pipeline
- **Deterministic harness** (lint, guard, health) — zero LLM cost
- **Provider-agnostic** agent router (Claude, OpenAI, Google, Ollama)
- **Proactive recommender** suggesting next-best-action after every skill

## Installation

```bash
npm install -g sunco
# or
npx sunco --help
```

## Quick Start

```bash
sunco init          # Detect stack, generate rules
sunco lint          # Check architecture boundaries
sunco health        # Codebase health score
sunco plan          # Create execution plans with BDD criteria
sunco execute       # Run plans in parallel with worktree isolation
sunco verify        # 5-layer verification pipeline
sunco auto          # Full autonomous pipeline
```

## Skill Catalog

### Harness (Deterministic, Zero LLM)
| Skill | Description |
|-------|-------------|
| `sunco init` | Detect stack, layers, conventions, generate rules |
| `sunco lint` | Architecture boundary enforcement |
| `sunco health` | Codebase health score with trend tracking |
| `sunco agents` | Agent instruction file analysis |
| `sunco guard` | Real-time lint-on-change + rule promotion |

### Workflow (Agent-Powered)
| Skill | Description |
|-------|-------------|
| `sunco new` | Bootstrap project from idea |
| `sunco discuss` | Extract vision and acceptance criteria |
| `sunco plan` | BDD execution plans with research integration |
| `sunco execute` | Parallel execution with worktree isolation |
| `sunco verify` | 5-layer Swiss cheese verification |
| `sunco review` | Multi-provider cross-review |
| `sunco ship` | PR with verification pre-check |
| `sunco auto` | Full autonomous pipeline with crash recovery |
| `sunco debug` | Failure classification and fix suggestions |

### Utility
| Skill | Description |
|-------|-------------|
| `sunco status` | Current project state |
| `sunco graph` | Code dependency graph + blast radius |
| `sunco headless` | CI/CD mode with JSON output |
| `sunco doc` | Generate HWPX/markdown documents |
| `sunco export` | HTML project reports |

[Full catalog: 42+ skills →](docs/skills.md)

## Architecture

```
packages/
  core/          — CLI engine, config, state, skill system, agent router
  skills-harness/ — Deterministic skills (lint, guard, health)
  skills-workflow/ — Workflow skills (plan, execute, verify, auto)
  cli/           — CLI entry point
```

## 한국어 (Korean)

SUNCO는 에이전트 시대 빌더를 위한 독립 워크스페이스 OS입니다.
하네스 엔지니어링이 핵심 — 린터가 가르치면서 막고, 코드가 아니라 의도를 검증합니다.

```bash
npm install -g sunco
sunco init    # 프로젝트 분석 + 규칙 생성
sunco lint    # 아키텍처 경계 검증
sunco auto    # 전체 자율 파이프라인
```

## License

MIT
