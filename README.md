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
- **58 slash commands** covering the full development lifecycle
- **Proactive recommender** — 50+ rules suggesting next-best-action
- **HWPX document generation** — Korean standard document format

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

Activates **auto-routing mode** — every message you type is automatically matched to the best `/sunco:*` command. No need to memorize commands. Just describe what you want.

```
⚡ SUNCO > lint
Running architecture boundary check...

⚡ SUNCO > debug
Analyzing the error...

⚡ SUNCO Mode | Context: ██████████░░░░░░ 65% | Skills used: 3
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
| `/sunco:mode` | Auto-routing mode — every input finds the best skill |
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

SUNCO supports multiple AI coding runtimes:

```bash
npx popcoru --claude              # Claude Code (~/.claude/)
npx popcoru --codex               # Codex CLI (~/.codex/)
npx popcoru --cursor              # Cursor (~/.cursor/)
npx popcoru --antigravity         # Antigravity (~/.antigravity/)
npx popcoru --all                 # All runtimes at once
```

---

## 한국어 설치 가이드

### SUNCO가 뭔가요?

SUNCO는 AI 코딩 에이전트(Claude Code 등)가 실수를 덜 하도록 도와주는 도구입니다.
설치하면 57개의 슬래시 명령어(`/sunco:help`, `/sunco:lint` 등)가 추가되어, AI가 코드를 작성할 때 자동으로 품질을 검사하고 검증합니다.

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

 ✓ Installed commands/sunco (58 skills)
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
`~/.claude/` 폴더에 명령어 파일들이 복사됩니다. 시스템을 건드리지 않으며, `npx popcoru --uninstall`로 깔끔하게 삭제됩니다.

**Q: 요금이 드나요?**
SUNCO 자체는 무료(MIT 라이선스)입니다. 다만 Claude Code 사용 시 Anthropic API 비용이 발생할 수 있습니다. 결정적 스킬(lint, health, guard)은 LLM을 사용하지 않아 비용이 0원입니다.

**Q: Claude Code 없이도 쓸 수 있나요?**
현재는 Claude Code 전용입니다. Codex, Cursor 등 다른 AI 코딩 도구 지원은 준비 중입니다.

## License

MIT
