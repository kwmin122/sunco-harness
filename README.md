# SUNCO

Agent Workspace OS — harness engineering for AI coding agents

[![npm](https://img.shields.io/npm/v/popcoru)](https://www.npmjs.com/package/popcoru)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What is SUNCO?

SUNCO is a skill pack for Claude Code (and other AI coding agents). It installs 82 slash commands that enforce quality at every step — security audits, lint gates, blast radius analysis, 7-layer verification, multi-perspective reviews, and a proactive recommender.

**One command to install:**

```bash
npx popcoru
```

This copies commands, engine, hooks, workflows, references, and templates into your AI agent's config directory (`~/.claude/`, `~/.codex/`, etc.). Then use `/sunco:help` in Claude Code.

## Why SUNCO?

AI agents write code. Your job is setting up the field so they make fewer mistakes. SUNCO is that field.

- **Deterministic harness** — lint, health, guard run with zero LLM cost
- **7-layer Swiss cheese verification** — multi-agent review, guardrails, BDD criteria, permission audit, adversarial test, cross-model, human eval
- **23 specialized agents** — planner, executor, debugger, verifier, researcher, and 17 more
- **12-point plan checker** — requirements, scope, criteria, Nyquist, CLAUDE.md compliance, cross-plan contracts
- **Adaptive lifecycle** — pivot, rethink, backtrack at any stage without losing progress
- **Blast radius analysis** — dependency graph check before every execution
- **Per-task checkpointing** — crash recovery resumes from exact task, not from scratch
- **82 slash commands** covering the full development lifecycle
- **Security audit (CSO)** — OWASP Top 10, STRIDE, secret detection, supply chain risk
- **Multi-perspective reviews** — CEO, engineering, design reviews before implementation
- **Operations** — retro, benchmark, land-and-deploy, canary monitoring
- **Safety guardrails** — destructive command warnings, directory freeze
- **Multi-model design pingpong** — Claude + Codex parallel design with merge
- **Korean i18n** — 82 commands with Korean descriptions, interactive installer

### New in v0.8.0

- **Alias Infrastructure** — `SkillDefinition.aliases[]` with deprecation warnings; deprecated commands auto-route to absorbers
- **Full Absorption (Phase 33)** — 11 satellite skills merged into 4 absorber skills via shared modules. Surface reduced from 46 to 35 skill files.
- **Codex Layer 6 (Phase 34)** — `CodexCliProvider` enables true cross-family verification (Claude + OpenAI Codex CLI). `--require-codex` strict mode for pre-ship gates.
- **CLI Dashboard TUI** — `sunco status --live` with Ink, 5-section real-time layout
- **1,332 tests** across 4 packages, 10/10 turbo green

## Quick Start

```bash
# Install (interactive — choose language + runtimes)
npx popcoru

# Or install with flags
npx popcoru --all --lang ko          # all runtimes, Korean
npx popcoru --claude --codex         # Claude Code + Codex only

# In Claude Code:
/sunco:mode              # Activate SUNCO Mode (auto-routes everything)
/sunco:help              # See all commands
/sunco:init              # Detect stack, generate rules
/sunco:new               # Bootstrap project from idea
```

## SUNCO Mode

```
/sunco:mode
```

Activates **auto-routing mode**. Non-slash natural language input is intercepted by the `sunco-mode-router` hook and routed to the best `/sunco:*` command via `/sunco:do`.

- **Claude Code**: System-level `UserPromptSubmit` hook auto-intercepts every message
- **Codex/Cursor**: Mode-active marker + skill prompt routing (SKILL.md instruction)

```
* SUNCO > lint
Running architecture boundary check...

* SUNCO > debug
Analyzing the error...

* SUNCO Mode | Context: [==========----] 65% | Skills used: 3
```

## The Complete Lifecycle

### First Flow (New Project → Production)

```
/sunco:new ──── questions → research (4 parallel agents) → PROJECT.md + REQUIREMENTS.md + ROADMAP.md
    ↓
/sunco:discuss 1 ──── gray areas → CONTEXT.md with locked decisions
    ↓
/sunco:plan 1 ──── acceptance criteria → PLAN.md (verified by 12-point checker)
    ↓
/sunco:execute 1 ──── 18 specialized agents → code + lint-gate + SUMMARY.md
    ↓
/sunco:verify 1 ──── 7-layer Swiss cheese verification
    ↓
/sunco:ship 1 ──── PR with verification evidence
```

### Pivot Flow (Change Direction Anytime)

```
"Actually, let's change the auth approach..."
    ↓
/sunco:pivot ──── detects artifact changes → impact analysis
    ↓
Shows: "REQUIREMENTS.md changed → Phase 2 plans invalidated"
    ↓
Auto-routes to /sunco:rethink 2 → revised decisions
    ↓
/sunco:plan 2 → revised plans → continues normal flow
```

### At Any Point

```
/sunco:where-am-i      # Complete status + decision history
/sunco:backtrack D-03   # Rollback to before decision D-03
/sunco:reinforce        # Add requirements mid-milestone
/sunco:mode             # Auto-route everything (Super Saiyan mode)
```

## Quality Architecture

Each step has built-in quality gates:
- **discuss**: Extracts decisions, scope guardrail prevents creep, prior decisions loaded
- **plan**: 12-point checker (requirements, scope, criteria, Nyquist, CLAUDE.md compliance)
- **execute**: Mandatory lint-gate, blast radius check, per-task checkpointing
- **verify**: 7-layer Swiss cheese (multi-agent review, guardrails, BDD, permissions, adversarial, cross-model, human eval)
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
| `/sunco:graph` | Code dependency graph + blast radius |
| `/sunco:headless` | CI/CD mode with JSON output |
| `/sunco:settings` | Configure SUNCO behavior |
| `/sunco:help` | Full command catalog |

### Workflow (Agent-Powered)

| Command | Description |
|---------|-------------|
| `/sunco:new` | Bootstrap project from idea via office-hours → Superpowers brainstorming → planning artifacts |
| `/sunco:brainstorming` | Run vendored Superpowers brainstorming before SUNCO planning |
| `/sunco:discuss` | Extract decisions and gray areas |
| `/sunco:plan` | Create execution plans with BDD criteria |
| `/sunco:execute` | Parallel execution with lint-gate |
| `/sunco:verify` | 7-layer verification, `--coverage` for test audit, `--generate-tests` for AI test gen, `--require-codex` for strict cross-model |
| `/sunco:review` | Multi-provider cross-review |
| `/sunco:ship` | PR with verification pre-check |
| `/sunco:auto` | Full autonomous pipeline with crash recovery |

### Debugging

| Command | Description |
|---------|-------------|
| `/sunco:debug` | Systematic debugging with persistent state, `--parse` for diagnostics, `--postmortem` for forensics |

### Session & Ideas

| Command | Description |
|---------|-------------|
| `/sunco:pause` | Save session state |
| `/sunco:resume` | Restore from last session |
| `/sunco:next` | Auto-detect next step |
| `/sunco:progress` | Where am I, what's next |
| `/sunco:note` | Zero-friction idea capture, `--todo`/`--seed`/`--backlog` for task types |

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
| `/sunco:mode` | Auto-routing mode (Claude: system hook, Codex/Cursor: skill prompt) |
| `/sunco:manager` | Interactive command center |
| `/sunco:stats` | Project statistics |
| `/sunco:profile` | Model profile management |
| `/sunco:map-codebase` | Parallel codebase analysis |
| `/sunco:thread` | Persistent context threads |
| `/sunco:pr-branch` | Clean PR branch creation |
| `/sunco:audit-uat` | User acceptance testing audit |

### Security & Safety

| Command | Description |
|---------|-------------|
| `/sunco:cso` | Chief Security Officer audit — OWASP, STRIDE, secrets |
| `/sunco:careful` | Destructive command guardrails |
| `/sunco:freeze` | Restrict edits to a specific directory |
| `/sunco:unfreeze` | Remove freeze boundary |

### Reviews

| Command | Description |
|---------|-------------|
| `/sunco:office-hours` | Pre-project brainstorming with forced questions |
| `/sunco:ceo-review` | CEO/founder-mode plan review |
| `/sunco:eng-review` | Engineering manager plan review |
| `/sunco:design-review` | Designer's eye dimensional scoring |

### Operations

| Command | Description |
|---------|-------------|
| `/sunco:retro` | Weekly engineering retrospective with trends |
| `/sunco:benchmark` | Performance baseline and regression detection |
| `/sunco:land` | Merge PR, deploy, verify production |
| `/sunco:canary` | Post-deploy continuous monitoring |

## What Gets Installed

**Claude Code** (`~/.claude/`):
```
commands/sunco/           # 82 slash commands
sunco/bin/                # Engine + sunco-tools.cjs
sunco/workflows/          # 77 workflow files
sunco/references/         # 16 reference documents
sunco/templates/          # 49 artifact templates
sunco/agents/             # 23 specialized agents
sunco/VERSION
hooks/                    # 5 hooks (update, statusline, context monitor, prompt guard, mode router)
```

**Codex CLI** (`~/.codex/`): same engine/workflows/agents, but `skills/sunco-*/SKILL.md` instead of `commands/`.
**Cursor** (`~/.cursor/`): same engine/workflows/agents, but `skills-cursor/sunco-*/SKILL.md` instead of `commands/`.

## Uninstall

```bash
npx popcoru --uninstall
```

## Multi-Runtime Support

| Runtime | Status | Install |
|---------|--------|---------|
| Claude Code | Full support | `npx popcoru --claude` |
| Codex CLI | Full support (SKILL.md adapters) | `npx popcoru --codex` |
| Cursor | Full support (SKILL.md in skills-cursor/) | `npx popcoru --cursor` |
| Antigravity | Partial (asset install, config registration pending spec) | `npx popcoru --antigravity` |

```bash
npx popcoru --all                 # Install for all available runtimes
```

---

## 한국어 설치 가이드

### SUNCO가 뭔가요?

SUNCO는 AI 코딩 에이전트(Claude Code 등)가 실수를 덜 하도록 도와주는 도구입니다.
설치하면 82개의 슬래시 명령어(`/sunco:help`, `/sunco:lint` 등)가 추가되어, AI가 코드를 작성할 때 자동으로 품질을 검사하고 검증합니다.

### 설치 전 준비

1. **Node.js 설치** (아직 없다면)
   - https://nodejs.org 에서 LTS 버전 다운로드 후 설치
   - 설치 확인: 터미널에서 `node --version` 입력 시 `v22.x.x` 이상 표시되면 OK

2. **Claude Code 설치** (아직 없다면)
   - https://claude.ai/download 에서 다운로드
   - 또는 터미널에서: `npm install -g @anthropic-ai/claude-code`

### 설치 방법

터미널(맥: Terminal.app, 윈도우: PowerShell)을 열고 아래 명령어를 입력하세요:

```bash
npx popcoru
```

이게 끝입니다! 아래와 같은 화면이 나오면 설치 완료:

```
 ███████╗██╗   ██╗███╗   ██╗ ██████╗ ██████╗
 ██╔════╝██║   ██║████╗  ██║██╔════╝██╔═══██╗
 ███████╗██║   ██║██╔██╗ ██║██║     ██║   ██║
 ╚════██║██║   ██║██║╚██╗██║██║     ██║   ██║
 ███████║╚██████╔╝██║ ╚████║╚██████╗╚██████╔╝
 ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝

 ✓ Installed commands/sunco (82 skills)
 ✓ Installed sunco engine
 ✓ Installed hooks
 ✓ Installed docs

 Done! Run /sunco:help to get started.
```

### 사용 방법

Claude Code를 실행한 후, 대화창에서 슬래시 명령어를 입력하면 됩니다:

```
/sunco:help       ← 전체 명령어 목록 보기
/sunco:init       ← 프로젝트 분석 + 규칙 생성
/sunco:lint       ← 아키텍처 경계 검증
/sunco:health     ← 코드 건강 점수 확인
/sunco:new        ← 새 프로젝트 시작
/sunco:auto       ← 전체 자율 파이프라인 실행
```

### 삭제 방법

```bash
npx popcoru --uninstall
```

### 자주 묻는 질문

**Q: `npx`가 뭔가요?**
Node.js를 설치하면 자동으로 함께 설치됩니다. npm 패키지를 설치 없이 바로 실행하는 도구입니다.

**Q: 설치하면 뭐가 어디에 깔리나요?**
AI 에이전트의 설정 폴더(`~/.claude/`, `~/.codex/` 등)에 명령어 파일들이 복사됩니다. 시스템을 건드리지 않으며, `npx popcoru --uninstall`로 깔끔하게 삭제됩니다.

**Q: 요금이 드나요?**
SUNCO 자체는 무료(MIT 라이선스)입니다. 다만 Claude Code 사용 시 Anthropic API 비용이 발생할 수 있습니다. 결정적 스킬(lint, health, guard)은 LLM을 사용하지 않아 비용이 0원입니다.

**Q: Claude Code 없이도 쓸 수 있나요?**
Claude Code, Codex CLI, Cursor는 완전 지원됩니다. Antigravity는 에셋 설치까지 지원되며 런타임 등록은 스펙 확정 후 추가됩니다.

## License

MIT
