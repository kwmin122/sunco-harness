# SUNCO

에이전트 워크스페이스 OS — AI 코딩 에이전트를 위한 하네스 엔지니어링

[![npm](https://img.shields.io/npm/v/popcoru)](https://www.npmjs.com/package/popcoru)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## SUNCO가 뭔가요?

SUNCO는 Claude Code(그리고 다른 AI 코딩 에이전트)를 위한 스킬 팩입니다. 85개의 슬래시 명령어를 설치해 모든 단계에서 품질을 강제합니다 — 보안 감사, 린트 게이트, 영향 범위 분석, 7계층 검증, 다관점 리뷰, 능동형 추천기까지.

**한 줄로 설치:**

```bash
npx popcoru
```

실행하면 에이전트의 설정 디렉토리(`~/.claude/`, `~/.codex/` 등)에 명령, 엔진, 훅, 워크플로, 레퍼런스, 템플릿을 복사합니다. 이후 Claude Code에서 `/sunco:help`로 시작하세요.

## 왜 SUNCO인가?

AI 에이전트가 코드를 씁니다. 사람의 역할은 에이전트가 실수를 덜 하도록 판을 깔아주는 것입니다. SUNCO가 그 판입니다.

- **결정적 하네스** — lint, health, guard는 LLM 비용 0으로 실행
- **7계층 스위스 치즈 검증(7-layer Swiss cheese verification)** — 멀티 에이전트 리뷰, 가드레일, BDD 기준, 권한 감사, 적대적 테스트, 크로스 모델, 휴먼 평가
- **23개 전용 에이전트** — 플래너, 실행자, 디버거, 검증자, 리서처 등 20개 이상
- **12개 체크포인트 플랜 체커** — 요구사항, 스코프, 수락 기준, Nyquist, CLAUDE.md 준수, 크로스 플랜 계약
- **적응형 수명 주기** — 어느 단계에서든 pivot, rethink, backtrack 가능하며 진행 상황을 잃지 않음
- **영향 범위(Blast radius) 분석** — 실행 전에 의존성 그래프 검사
- **태스크 단위 체크포인팅** — 충돌 복구 시 정확히 그 태스크부터 재개
- **85개 슬래시 명령** — 전체 개발 수명 주기를 커버
- **보안 감사(CSO)** — OWASP Top 10, STRIDE, 시크릿 탐지, 공급망 리스크
- **다관점 리뷰** — 구현 전에 CEO / 엔지니어링 / 디자인 리뷰
- **운영** — 회고, 벤치마크, land-and-deploy, 카나리 모니터링
- **안전 가드레일** — 파괴적 명령 경고, 디렉토리 프리즈
- **다모델 디자인 핑퐁** — Claude + Codex 병렬 디자인과 병합
- **한국어 i18n** — 85개 명령에 한국어 설명, 대화형 설치기

### v0.11.1의 새 기능

- **런타임 인지형 advisor 선택기** — `/sunco:advisor --reconfigure`가 이제 프로바이더가 아니라 런타임을 먼저 기준으로 합니다. Claude Code에서는 Claude 행(Opus/Sonnet/Haiku)이 위에, Codex에서는 GPT-5.4 행(reasoning: high/xhigh)이, Cursor에서는 `cursor-native`, Antigravity는 deterministic으로 떨어집니다. **SUNCO는 현재 런타임을 기본으로 사용합니다. API 키는 선택입니다.**
- **엔진/패밀리 분리** — `AdvisorConfig`가 `engine`(deterministic / runtime-native / external-cli / external-api)과 `family`(claude / codex / cursor / antigravity / local / custom)를 구분합니다. 분류기는 엔진과 상관없이 항상 결정적으로 동작합니다.
- **설치기 중복 제거 수정** — 업그레이드 시 `UserPromptSubmit` 훅이 중복되던 문제를 해결. 이제 cleanup이 네 가지 이벤트 타입(SessionStart, PreToolUse, PostToolUse, UserPromptSubmit)을 모두 정리합니다.
- **워크플로 테스트 1001개**, contract lint 89/89, 슬래시 명령 85개, 훅 8개.

### v0.11.0의 새 기능

- **앰비언트 advisor** — 새 `/sunco:advisor` 스킬 + Claude Code 전용 두 개의 훅(UserPromptSubmit 주입, PostToolUse 큐). 자연어 프롬프트와 파일 편집을 관찰하다가 리스크 신호가 잡히면 `Risk: / Suggestion:` 두 줄을 투하합니다. 기억해야 할 슬래시 명령은 0개. 결정적 분류기(risk-classifier + advisor-policy + advisor-message)로 돌아가며, 코드를 쓰지 않고 스킬도 자동 실행하지 않습니다. `auto_execute_skills = false`는 타입 수준에서 리터럴로 박혀 있어 플래그로 바꿀 수 없습니다.
- **Advisor 선택기** — 첫 실행 시 Opus 4.7(max/high/medium), Sonnet 4.6(max/high), Haiku 4.5(off), Codex CLI, Custom 중 고릅니다. GPT-5 / Gemini 2.5 Pro는 해당 프로바이더가 감지될 때만 노출. 설정은 `~/.sun/config.toml`에 저장됩니다.
- **개입 레벨** — `silent / notice / guarded / blocker`. `blocker`는 기본적으로 `guarded`로 다운그레이드(`blocking=false`). 설정으로 확인 게이트를 켤 수 있습니다.
- **노이즈 예산** — 같은 suppression 키는 30분 디듀프, 세션당 5개 블록, 프롬프트당 1개, user-visible 표시를 위한 confidence 하한은 `medium`.
- **큐 상태 머신** — `pending → surfaced → acknowledged → resolved`(+ 2시간 TTL 후 `expired`). `~/.sun/advisor-queue.json`(스키마 v1)에 저장.
- **런타임 매트릭스** — Claude Code만 앰비언트 훅 전체를 받고, Codex / Cursor / Antigravity는 `/sunco:advisor --json`을 통해 동일한 결정적 엔진을 사용합니다.
- 워크플로 테스트 991개, contract lint 89/89, 슬래시 명령 85개(`/sunco:advisor` 포함), 훅 8개.

### v0.10.0의 새 기능

- **`/sunco:orchestrate`** — 동적 멀티 에이전트 라우터(explorer/librarian/oracle/developer/frontend/docs/verifier/debugger). 결정적 시그널 기반 라우팅, 고정 파이프라인 없음, 오케스트레이터는 코드를 쓰지 않음. OmO Sisyphus(AGPL-3.0, 코드 밴더링 없음)와 gstack의 역할 기반 스프린트 규율에서 영감을 받은 클린룸 재구현.
- **Spec-approval HARD-GATE** — `/sunco:execute`가 승인된 디자인/스펙(`.planning/PROJECT.md`, `docs/superpowers/specs/*.md`, 또는 `.sun/designs/*APPROVED*`) 없이는 실행을 거부합니다. 그린필드나 사소한 패치는 `--bypass-spec-approval <reason>`으로 우회. Superpowers 브레인스토밍 HARD-GATE가 드디어 런타임에서 강제됩니다.
- **gstack ↔ SUNCO 스프린트 맵**과 **OmO ↔ SUNCO 라우팅 맵**을 `/sunco:help`에 문서화했고 contract-lint가 고정 — 세 프레임워크 간 parity가 조용히 깨지지 않습니다.
- 워크플로 테스트 883개, contract lint 66/66, 슬래시 명령 85개.

### v0.9.0의 새 기능

- **Superpowers 14-skill parity** — Superpowers 프레임워크의 내장 스킬(brainstorming, writing-plans, executing-plans, TDD, systematic-debugging, verification-before-completion, requesting/receiving-code-review, subagent-driven development, git-worktrees, finishing-a-branch, writing-skills, visual companion) 전부가 SUNCO 대응을 갖췄습니다.
- **기본 프로젝트 시작 체인** — `/sunco:office-hours` → `/sunco:brainstorming` → `/sunco:new --from-preflight <spec>`가 모든 런타임(Claude Code, Codex, Cursor, Antigravity)에서 기본 경로. Superpowers brainstorming은 소스 오브 트루스로 그대로 벤더링되고 SUNCO 규율로 확장됩니다.
- **Layer 2 TDD gate** — `type: tdd` 태그가 붙은 플랜은 결정적 test-first 강제(테스트 파일 존재, 동일 위치 매칭, test-first 커밋 순서)
- **`/sunco:review --fix`** — receiving-code-review 루프: 합의된 이슈를 자동으로 `/sunco:quick`에 라우팅하고 재검증
- **`/sunco:brainstorming --visual`** — 벤더링된 visual companion 서버를 자동 부팅하고 URL을 플래닝 에이전트에 주입
- **`/sunco:new-skill`** — 새 SUNCO 스킬과 동일 위치 테스트를 결정적으로 스캐폴드(writing-skills parity)
- 워크플로 테스트 847개, contract lint 59/59, 슬래시 명령 85개.

### v0.8.0의 새 기능

- **Alias 인프라** — `SkillDefinition.aliases[]`가 deprecation 경고를 출력하고, 사라진 명령은 흡수처로 자동 라우팅
- **Phase 33 흡수 통합** — 11개 위성 스킬이 4개 흡수처에 공유 모듈로 합쳐져, 스킬 파일 수가 46 → 35로 감소
- **Phase 34 Codex Layer 6** — `CodexCliProvider`로 크로스 패밀리 검증(Claude + OpenAI Codex CLI)이 가능. `--require-codex`로 ship 전 엄격 모드
- **CLI 대시보드 TUI** — `sunco status --live`로 Ink 기반 5섹션 실시간 레이아웃
- 4개 패키지에 걸쳐 1,332 테스트, turbo 10/10 그린

## 퀵 스타트

```bash
# 대화형 설치 — 언어와 런타임을 직접 고릅니다
npx popcoru

# 플래그로 바로 설치
npx popcoru --all --lang ko          # 모든 런타임, 한국어
npx popcoru --claude --codex         # Claude Code + Codex만

# Claude Code에서
/sunco:mode              # SUNCO Mode 활성화 (모든 입력 자동 라우팅)
/sunco:help              # 명령 목록
/sunco:init              # 스택 감지 + 규칙 생성
/sunco:new               # 아이디어부터 프로젝트 부트스트랩
```

## SUNCO Mode

```
/sunco:mode
```

**자동 라우팅 모드**를 켭니다. 슬래시가 아닌 자연어 입력을 `sunco-mode-router` 훅이 가로채 `/sunco:do`로 넘깁니다.

- **Claude Code**: 시스템 레벨 `UserPromptSubmit` 훅이 모든 메시지를 자동 가로챕니다
- **Codex/Cursor**: Mode-active 마커 + 스킬 프롬프트 라우팅(SKILL.md 지시)

```
* SUNCO > lint
Running architecture boundary check...

* SUNCO > debug
Analyzing the error...

* SUNCO Mode | Context: [==========----] 65% | Skills used: 3
```

## 전체 수명 주기

### 첫 흐름 (새 프로젝트 → 배포)

```
/sunco:new ──── 질문 → 리서치(병렬 에이전트 4개) → PROJECT.md + REQUIREMENTS.md + ROADMAP.md
    ↓
/sunco:discuss 1 ──── 회색 지대 해소 → 결정이 잠긴 CONTEXT.md
    ↓
/sunco:plan 1 ──── 수락 기준 → PLAN.md (12개 체크포인트 플랜 체커 검증)
    ↓
/sunco:execute 1 ──── 전용 에이전트 18개 → 코드 + lint-gate + SUMMARY.md
    ↓
/sunco:verify 1 ──── 7계층 스위스 치즈 검증
    ↓
/sunco:ship 1 ──── 검증 증거가 담긴 PR
```

### 피벗 흐름 (방향을 언제든 바꿀 수 있음)

```
"Actually, let's change the auth approach..."
    ↓
/sunco:pivot ──── 아티팩트 변경 감지 → 영향 분석
    ↓
표시: "REQUIREMENTS.md changed → Phase 2 plans invalidated"
    ↓
자동 라우팅 /sunco:rethink 2 → 결정 재수립
    ↓
/sunco:plan 2 → 플랜 재생성 → 일반 흐름 재개
```

### 어느 시점에서든

```
/sunco:where-am-i      # 전체 상태 + 결정 히스토리
/sunco:backtrack D-03  # 결정 D-03 이전으로 롤백
/sunco:reinforce       # 마일스톤 중간에 요구사항 추가
/sunco:mode            # 전부 자동 라우팅(슈퍼 사이어인 모드)
```

## 품질 아키텍처

각 단계에 품질 게이트가 내장되어 있습니다:
- **discuss**: 결정 추출, 스코프 가드레일로 확장 방지, 이전 결정 로드
- **plan**: 12개 체크포인트 플랜 체커(요구사항, 스코프, 수락 기준, Nyquist, CLAUDE.md 준수)
- **execute**: 의무적 lint-gate, 영향 범위 체크, 태스크 단위 체크포인팅
- **verify**: 7계층 스위스 치즈(멀티 에이전트 리뷰, 가드레일, BDD, 권한, 적대적, 크로스 모델, 휴먼 평가)
- **ship**: 검증 통과 후에만 PR 생성

## 명령 카탈로그

### 하네스 (결정적, LLM 비용 0)

| 명령 | 설명 |
|---------|-------------|
| `/sunco:init` | 스택, 레이어, 컨벤션 감지 + 규칙 생성 |
| `/sunco:lint` | 아키텍처 경계 강제 |
| `/sunco:health` | 코드 건강 점수 + 추세 추적 |
| `/sunco:guard` | 변경 즉시 린트 |
| `/sunco:agents` | 에이전트 지시문 파일 분석 |
| `/sunco:status` | 현재 프로젝트 상태 |
| `/sunco:graph` | 코드 의존성 그래프 + 영향 범위 |
| `/sunco:headless` | JSON 출력 CI/CD 모드 |
| `/sunco:settings` | SUNCO 동작 설정 |
| `/sunco:help` | 전체 명령 카탈로그 |

### 워크플로 (에이전트 기반)

| 명령 | 설명 |
|---------|-------------|
| `/sunco:new` | 아이디어 → office-hours → Superpowers 브레인스토밍 → 플래닝 아티팩트 |
| `/sunco:brainstorming` | SUNCO 플래닝 전에 벤더링된 Superpowers 브레인스토밍 실행 |
| `/sunco:new-skill` | 새 SUNCO 스킬 + 동일 위치 테스트 스캐폴드(Superpowers writing-skills parity) |
| `/sunco:orchestrate` | 동적 멀티 에이전트 라우터(explorer/librarian/oracle/developer/frontend/docs/verifier) |
| `/sunco:advisor` | 앰비언트 advisor 디버그 표면 — 태스크 분류, 모델 재설정, 마지막 결정 조회 |
| `/sunco:discuss` | 결정과 회색 지대 추출 |
| `/sunco:plan` | BDD 기준을 가진 실행 플랜 생성 |
| `/sunco:execute` | lint-gate가 있는 병렬 실행 |
| `/sunco:verify` | 7계층 검증, `--coverage`로 테스트 감사, `--generate-tests`로 AI 테스트 생성, `--require-codex`로 엄격 크로스 모델 |
| `/sunco:review` | 다중 프로바이더 크로스 리뷰 |
| `/sunco:ship` | 사전 검증이 붙은 PR |
| `/sunco:auto` | 충돌 복구가 있는 완전 자율 파이프라인 |

### 디버깅

| 명령 | 설명 |
|---------|-------------|
| `/sunco:debug` | 영속 상태 기반 체계적 디버깅, `--parse`로 진단, `--postmortem`으로 포렌식 |

### 세션 & 아이디어

| 명령 | 설명 |
|---------|-------------|
| `/sunco:pause` | 세션 상태 저장 |
| `/sunco:resume` | 마지막 세션에서 복원 |
| `/sunco:next` | 다음 스텝 자동 감지 |
| `/sunco:progress` | 어디까지 왔는지, 다음이 뭔지 |
| `/sunco:note` | 무마찰 아이디어 캡처, `--todo`/`--seed`/`--backlog`로 타입 지정 |

### 조합형

| 명령 | 설명 |
|---------|-------------|
| `/sunco:quick` | 보장 게이트가 붙은 임시 태스크 |
| `/sunco:fast` | 인라인 사소 태스크 |
| `/sunco:do` | 자유 텍스트를 적절한 명령으로 라우팅 |

### 관리 & 신규 기능

| 명령 | 설명 |
|---------|-------------|
| `/sunco:phase` | 페이즈 추가, 삽입, 제거 |
| `/sunco:milestone` | 마일스톤 관리 |
| `/sunco:release` | 버전 업, 체인지로그, 배포 |
| `/sunco:workstreams` | 병렬 워크스트림 관리 |
| `/sunco:workspaces` | 멀티 프로젝트 워크스페이스 |
| `/sunco:ui-phase` | UI 디자인 계약 생성 |
| `/sunco:ui-review` | 6축 시각 UI 감사 |
| `/sunco:mode` | 자동 라우팅 모드(Claude: 시스템 훅, Codex/Cursor: 스킬 프롬프트) |
| `/sunco:manager` | 대화형 명령 센터 |
| `/sunco:stats` | 프로젝트 통계 |
| `/sunco:profile` | 모델 프로필 관리 |
| `/sunco:map-codebase` | 병렬 코드베이스 분석 |
| `/sunco:thread` | 영속 컨텍스트 스레드 |
| `/sunco:pr-branch` | 깨끗한 PR 브랜치 생성 |
| `/sunco:audit-uat` | 사용자 수락 테스트 감사 |

### 보안 & 안전

| 명령 | 설명 |
|---------|-------------|
| `/sunco:cso` | Chief Security Officer 감사 — OWASP, STRIDE, 시크릿 |
| `/sunco:careful` | 파괴적 명령 가드레일 |
| `/sunco:freeze` | 특정 디렉토리로 편집 제한 |
| `/sunco:unfreeze` | 프리즈 경계 해제 |

### 리뷰

| 명령 | 설명 |
|---------|-------------|
| `/sunco:office-hours` | 강제 질문이 있는 프로젝트 전 브레인스토밍 |
| `/sunco:ceo-review` | CEO/창업자 모드 플랜 리뷰 |
| `/sunco:eng-review` | 엔지니어링 매니저 플랜 리뷰 |
| `/sunco:design-review` | 디자이너의 눈 — 차원별 점수제 |

### 운영

| 명령 | 설명 |
|---------|-------------|
| `/sunco:retro` | 주간 엔지니어링 회고 + 추세 추적 |
| `/sunco:benchmark` | 성능 베이스라인 + 회귀 탐지 |
| `/sunco:land` | PR 머지, 배포, 프로덕션 검증 |
| `/sunco:canary` | 배포 후 지속 모니터링 |

## 설치되는 것

**Claude Code** (`~/.claude/`):
```
commands/sunco/           # 85 slash commands
sunco/bin/                # 엔진 + sunco-tools.cjs
sunco/workflows/          # 77 workflow files
sunco/references/         # 16 reference documents
sunco/templates/          # 49 artifact templates
sunco/agents/             # 23 specialized agents
sunco/VERSION
hooks/                    # 8 hooks (update, statusline, context monitor, prompt guard, mode router, advisor-ambient, advisor-postaction, …)
```

**Codex CLI** (`~/.codex/`): 엔진/워크플로/에이전트는 동일하되 `commands/` 대신 `skills/sunco-*/SKILL.md`.
**Cursor** (`~/.cursor/`): 엔진/워크플로/에이전트는 동일하되 `commands/` 대신 `skills-cursor/sunco-*/SKILL.md`.

## 삭제

```bash
npx popcoru --uninstall
```

## 멀티 런타임 지원

| 런타임 | 상태 | 설치 |
|---------|--------|---------|
| Claude Code | Full support | `npx popcoru --claude` |
| Codex CLI | Full support (SKILL.md 어댑터) | `npx popcoru --codex` |
| Cursor | Full support (skills-cursor/ 내 SKILL.md) | `npx popcoru --cursor` |
| Antigravity | Partial (에셋 설치까지, 런타임 등록은 스펙 확정 후) | `npx popcoru --antigravity` |

```bash
npx popcoru --all                 # 감지된 모든 런타임에 설치
```

---

## 설치 가이드 (한국어 스텝바이스텝)

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

이게 끝입니다. 아래 화면이 나오면 설치 완료:

```
 ███████╗██╗   ██╗███╗   ██╗ ██████╗ ██████╗
 ██╔════╝██║   ██║████╗  ██║██╔════╝██╔═══██╗
 ███████╗██║   ██║██╔██╗ ██║██║     ██║   ██║
 ╚════██║██║   ██║██║╚██╗██║██║     ██║   ██║
 ███████║╚██████╔╝██║ ╚████║╚██████╗╚██████╔╝
 ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝

 ✓ Installed commands/sunco (85 skills)
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
/sunco:advisor    ← 앰비언트 advisor 설정/디버그
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
SUNCO 자체는 무료(MIT 라이선스)입니다. 다만 Claude Code 사용 시 Anthropic API 비용이 발생할 수 있습니다. 결정적 스킬(lint, health, guard)은 LLM을 사용하지 않아 비용이 0원입니다. Advisor도 기본은 결정적 모드이므로 추가 비용이 들지 않습니다.

**Q: Claude Code 없이도 쓸 수 있나요?**
Claude Code, Codex CLI, Cursor는 완전 지원됩니다. Antigravity는 에셋 설치까지 지원되며 런타임 등록은 스펙 확정 후 추가됩니다.

**Q: Advisor가 API 키를 요구하나요?**
아닙니다. Advisor는 현재 런타임을 기본으로 사용합니다. API 키는 선택 사항이며, 외부 프로바이더(Anthropic API, OpenAI API 등)로 Advisor voice를 따로 쓰고 싶을 때만 필요합니다. 기본 결정적 모드는 LLM을 호출하지 않습니다.

## 라이선스

MIT
