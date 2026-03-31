---
name: sunco:new
description: 아이디어에서 로드맵까지 새 프로젝트 부트스트랩 — 질문, 리서치, 요구사항, 로드맵을 하나의 흐름으로. 그린필드 프로젝트를 시작할 때 사용.
argument-hint: "[idea] [--auto] [--no-research]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Flags:**
- `--auto` — 자동 모드. 아이디어 문서(@file.md 또는 인라인 텍스트)를 입력으로 받아, 확인 단계를 건너뛰고 즉시 모든 산출물을 생성.
- `--no-research` — 병렬 리서치 에이전트를 건너뜀. 질문 후 바로 합성으로 진행.

**This command creates:**
- `.planning/PROJECT.md` — 프로젝트 비전, 요구사항, 핵심 결정사항
- `.planning/REQUIREMENTS.md` — 카테고리별 v1/v2 요구사항 (ID 포함)
- `.planning/ROADMAP.md` — 요구사항에 매핑된 페이즈 구조
- `.planning/STATE.md` — 프로젝트 메모리 (현재 페이즈, 결정사항, 차단요소)
- `.planning/config.json` — 워크플로우 설정

**After this command:** Run `/sunco:discuss 1` to extract decisions for Phase 1 before planning.
</context>

<objective>
아이디어를 받아 프로젝트의 모든 계획 산출물을 생성한다. 이 명령은 프로젝트의 가장 중요한 순간 — 모든 후속 실행의 품질이 이 시점의 질문과 계획의 깊이에 달려 있다. 모든 역량을 투입하라.

**산출물 품질 기준:**
- PROJECT.md: "What This Is" 한 단락 + Core Value 한 문장 + 요구사항 (Active IDs / Validated / Out of Scope) + Key Decisions 표 + Evolution 규칙
- REQUIREMENTS.md: 카테고리별 그룹 (CORE-NN, PERS-NN, UX-NN 등) + v1 / v2 / Out of Scope + Traceability 섹션
- ROADMAP.md: 요약 표 + 페이즈별 Goal / Requirements covered / Success criteria (테스트 가능한 항목 3개 이상)
- STATE.md: 현재 페이즈, next action, 타임스탬프
- config.json: 워크플로우 설정 (mode, granularity, agents 등)
</objective>

<process>

## Step 1: Pre-flight checks

**.planning/ 디렉토리 상태 확인:**

```bash
ls .planning/ 2>/dev/null && echo "EXISTS" || echo "FRESH"
```

**.planning/PROJECT.md 가 이미 존재하면** 에러로 중단:

```
Error: This project has already been initialized.

Run `/sunco:status` to see current state.
Run `/sunco:phase` to add a new phase.
Run `/sunco:new-milestone` to start a new milestone.
```

**git 초기화 확인:**

```bash
git rev-parse --git-dir 2>/dev/null && echo "HAS_GIT" || echo "NO_GIT"
```

git 없으면:

```bash
git init
```

## Step 2: Capture the idea

**`--auto` 플래그가 있으면:** $ARGUMENTS 에서 아이디어 문서를 추출. 없으면 에러:

```
Error: --auto requires an idea document.

Usage:
  /sunco:new --auto @your-idea.md
  /sunco:new --auto [idea text here]
```

**`--auto` 플래그 없으면:** 인라인으로 질문 (AskUserQuestion 아님 — 대화형으로):

```
어떤 것을 만들고 싶으신가요?
```

답변을 기다렸다가, 아래 Step 3으로 넘어간다.

## Step 3: Deep questioning (--auto가 아닐 때)

**`--auto` 플래그면:** Step 3을 건너뛰고 Step 4로.

답변을 받았으면, **AskUserQuestion** 으로 최대 4개의 후속 질문을 묻는다. 한 번에 2개씩 그룹핑:

**Round 1 (2 questions):**

```
AskUserQuestion([
  {
    header: "Project Type",
    question: "어떤 종류의 프로젝트인가요?",
    multiSelect: false,
    options: [
      { label: "CLI 도구", description: "터미널에서 실행하는 명령줄 도구" },
      { label: "Web 앱", description: "브라우저 기반 애플리케이션" },
      { label: "API 서비스", description: "백엔드 REST/GraphQL/gRPC 서비스" },
      { label: "라이브러리/SDK", description: "다른 프로젝트에서 임포트하는 패키지" },
      { label: "모바일 앱", description: "iOS / Android 네이티브 또는 크로스플랫폼" },
      { label: "기타", description: "위 카테고리에 맞지 않음" }
    ]
  },
  {
    header: "Target Users",
    question: "주요 사용자는 누구인가요? (한 문장으로)",
    freeform: true
  }
])
```

**Round 2 (2 questions):**

```
AskUserQuestion([
  {
    header: "v1 Scope",
    question: "v1에서 반드시 있어야 할 것과 명시적으로 빠져야 할 것은?",
    freeform: true
  },
  {
    header: "Tech Stack",
    question: "기술 스택 선호도가 있나요?",
    multiSelect: false,
    options: [
      { label: "TypeScript / Node.js", description: "" },
      { label: "Python", description: "" },
      { label: "Rust", description: "" },
      { label: "Go", description: "" },
      { label: "아직 미결정", description: "리서치 후 결정" }
    ]
  }
])
```

**Decision gate:**

충분한 컨텍스트가 모이면 (PROJECT.md를 작성할 수 있는 수준):

```
AskUserQuestion([
  {
    header: "Ready?",
    question: "이해한 내용을 바탕으로 PROJECT.md를 작성할 준비가 됐습니다.",
    multiSelect: false,
    options: [
      { label: "PROJECT.md 작성", description: "진행합니다" },
      { label: "계속 탐색", description: "더 공유하거나 더 물어봐 주세요" }
    ]
  }
])
```

"계속 탐색"이면 → 자연스럽게 추가 질문. 루프 반복.

## Step 4: Workflow preferences

**`--auto` 플래그면:** 기본값으로 config.json 생성하고 Step 5로.

**Round 1 — Core settings:**

```
AskUserQuestion([
  {
    header: "Mode",
    question: "작업 방식을 선택하세요",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "자동 승인, 바로 실행" },
      { label: "Interactive", description: "각 단계에서 확인" }
    ]
  },
  {
    header: "Granularity",
    question: "페이즈 크기를 선택하세요",
    multiSelect: false,
    options: [
      { label: "Coarse", description: "적은 수의 큰 페이즈 (3-5개, 각 1-3 플랜)" },
      { label: "Standard (Recommended)", description: "균형 잡힌 페이즈 크기 (5-8개, 각 3-5 플랜)" },
      { label: "Fine", description: "많은 수의 작은 페이즈 (8-12개, 각 5-10 플랜)" }
    ]
  },
  {
    header: "Git Tracking",
    question: "플래닝 문서를 git으로 추적할까요?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "버전 관리에 포함" },
      { label: "No", description: ".planning/을 로컬 전용으로 (.gitignore에 추가)" }
    ]
  }
])
```

**Round 2 — Workflow agents:**

```
AskUserQuestion([
  {
    header: "Research Agent",
    question: "각 페이즈 플래닝 전에 리서치 에이전트를 실행할까요? (토큰/시간 추가)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "도메인 조사, 패턴 발견, 함정 방지" },
      { label: "No", description: "요구사항 기반으로 바로 플래닝" }
    ]
  },
  {
    header: "Verifier Agent",
    question: "각 페이즈 실행 후 검증 에이전트를 실행할까요? (토큰/시간 추가)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "요구사항 충족 여부 확인" },
      { label: "No", description: "검증 건너뜀" }
    ]
  },
  {
    header: "AI Models",
    question: "플래닝 에이전트에 사용할 AI 모델은?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet — 좋은 품질/비용 비율" },
      { label: "Quality", description: "Opus — 높은 비용, 깊은 분석" },
      { label: "Budget", description: "Haiku — 빠르고 저렴" },
      { label: "Inherit", description: "현재 세션 모델 사용" }
    ]
  }
])
```

**git-tracking = No 이면:**

```bash
echo ".planning/" >> .gitignore
```

**config.json 생성:**

```bash
mkdir -p .planning
```

다음 구조로 `.planning/config.json` 작성:

```json
{
  "version": "1.0",
  "created": "[ISO timestamp]",
  "mode": "[yolo|interactive]",
  "granularity": "[coarse|standard|fine]",
  "commit_docs": true,
  "model_profile": "[balanced|quality|budget|inherit]",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "parallelization": true,
    "auto_advance": true
  }
}
```

## Step 5: Research (--no-research가 아닐 때)

**`--no-research` 플래그이면:** Step 5를 건너뜀.

**리서치 결정 확인 (--auto가 아닐 때):**

```
AskUserQuestion([
  {
    header: "Research",
    question: "요구사항 정의 전에 도메인 리서치를 할까요?",
    multiSelect: false,
    options: [
      { label: "Research first (Recommended)", description: "표준 스택, 예상 기능, 아키텍처 패턴 탐색" },
      { label: "Skip research", description: "이 도메인에 익숙하면 바로 요구사항으로" }
    ]
  }
])
```

**"Research first"이면:** 4개 병렬 Task 에이전트를 실행:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 4개 리서치 에이전트 병렬 실행 중...
  → Tech stack research
  → Feature benchmarking
  → Architecture patterns
  → Risks & pitfalls
```

```bash
mkdir -p .planning/research
```

**Agent 1 — Tech Stack:**

```
Task(
  prompt="[project description] 에 가장 적합한 기술 스택을 리서치하라.
  - 언어 선호: [tech stack preference]
  - 프로젝트 타입: [project type]
  - 스케일: [target scale]
  주요 라이브러리 3-5개 (버전 포함), 각각의 이유, 대안과 비교를 포함.
  결과를 .planning/research/STACK.md 에 저장.",
  description="Tech stack research"
)
```

**Agent 2 — Feature Benchmarking:**

```
Task(
  prompt="[project description] 과 유사한 기존 도구/제품을 분석하라.
  각 항목: 이름, 핵심 기능, 한계점, 남겨진 갭.
  table stakes (없으면 사용자가 떠나는 기능) vs differentiators (차별점) 명확히 분류.
  결과를 .planning/research/FEATURES.md 에 저장.",
  description="Feature benchmarking"
)
```

**Agent 3 — Architecture Patterns:**

```
Task(
  prompt="[project description] 에 적합한 아키텍처 패턴을 리서치하라.
  2-3개 패턴: 각각의 장단점, 이 프로젝트와의 적합성.
  주요 컴포넌트와 경계 설명.
  결과를 .planning/research/ARCHITECTURE.md 에 저장.",
  description="Architecture patterns"
)
```

**Agent 4 — Risks & Pitfalls:**

```
Task(
  prompt="[project description] 구현 시 상위 5개 기술 리스크와 도전 과제를 파악하라.
  각 항목: 리스크, 발생 가능성 (High/Medium/Low), 완화 전략.
  결과를 .planning/research/RISKS.md 에 저장.",
  description="Risks & pitfalls"
)
```

에이전트 실패 시 graceful degradation: 남은 결과로 계속 진행.

## Step 6: Write PROJECT.md

리서치 결과 + 질문 답변 + 아이디어 를 합성하여 `.planning/PROJECT.md` 를 작성.

**반드시 다음 구조를 따를 것 (템플릿: `packages/cli/templates/project.md` 참고):**

```markdown
# [Project Name]

> [Core Value — 한 문장, 동사로 시작]

## What This Is

[한 단락. 이것이 무엇인지, 누구를 위한 것인지, 왜 중요한지. 기술적 세부사항 없이.]

## Problem

[해결하는 핵심 문제. 현재 대안이 왜 부족한지.]

## Target Users

[주요 사용자 설명. 현재 대안: [X]. 10분 성공 기준: [Y].]

## Requirements

### Active

요구사항은 카테고리별 ID를 사용한다. ID 형식: [CATEGORY]-[NN]
예: CORE-01, PERS-01, UX-01, API-01, PERF-01

- [ ] CORE-01: [핵심 기능 요구사항 — 검증 가능한 한 가지 행동]
- [ ] CORE-02: [핵심 기능 요구사항]
- [ ] UX-01: [사용자 경험 요구사항]
- [ ] PERS-01: [영속성/저장 요구사항]

### Validated

(없음 — 출시 후 검증)

### Out of Scope

- [명시적 제외 항목 1] — [이유]
- [명시적 제외 항목 2] — [이유]

## Key Decisions

질문 중 내려진 결정들. 모든 후속 페이즈를 지배한다.

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [결정 1] | [이유] | — Pending |
| [결정 2] | [이유] | — Pending |

## Technical Constraints

**Primary stack:** [기술 스택]
**Deployment target:** [배포 대상]
**Performance requirements:** [성능 요구사항]

## Goals

- [목표 1]
- [목표 2]
- [목표 3]

## Milestone: v0.1 (MVP)

[마일스톤 설명]

**Goal:** [마일스톤 목표]
**Exit criteria:** [완료 기준]

## Evolution

이 문서는 페이즈 전환과 마일스톤 경계에서 업데이트된다.

**각 페이즈 전환 후:**
1. 무효화된 요구사항? → Out of Scope로 이동 (이유 포함)
2. 검증된 요구사항? → Validated로 이동 (페이즈 참조 포함)
3. 새로운 요구사항 등장? → Active에 추가
4. 기록할 결정사항? → Key Decisions에 추가
5. "What This Is"가 여전히 정확한가? → 드리프트 시 업데이트

**각 마일스톤 후:**
1. 모든 섹션 전체 검토
2. Core Value 확인 — 여전히 올바른 우선순위인가?
3. Out of Scope 감사 — 이유가 여전히 유효한가?

---

*Created: [YYYY-MM-DD]*
*Last updated: [YYYY-MM-DD] after initialization*
*Bootstrap method: /sunco:new*
```

**예시 (CLI 도구의 경우):**

```markdown
# Litmus

> CLI에서 API 응답을 즉시 검증하는 도구.

## What This Is

Litmus는 개발자가 터미널을 떠나지 않고 HTTP API 응답의 스키마, 성능, 계약을 검증할 수 있게 해주는 CLI 도구다. Postman의 UI 없이 curl의 단순함과 Jest의 단언(assertion) 파워를 결합한다.

## Requirements

### Active

- [ ] CORE-01: `litmus run <test-file>` 명령으로 YAML 정의 테스트를 실행한다
- [ ] CORE-02: HTTP 응답 상태 코드, 헤더, JSON 바디를 검증한다
- [ ] UX-01: 각 실패한 단언의 컬러 diff를 표시한다
- [ ] PERS-01: 실행 이력을 `.litmus/history.json`에 저장한다

### Out of Scope

- GUI 대시보드 — 이것은 CLI 우선 도구
- WebSocket 지원 — v2로 연기
```

## Step 7: Write REQUIREMENTS.md

PROJECT.md의 요구사항을 `.planning/REQUIREMENTS.md` 로 확장한다.

**반드시 다음 구조를 따를 것 (템플릿: `packages/cli/templates/requirements.md` 참고):**

```markdown
# Requirements

Generated by `/sunco:new`. 각 요구사항은 검증 가능하다 — 테스트, 자동화된 검사, 또는 문서화된 수락 절차로 확인할 수 있다.

**Format:** `[CATEGORY]-[NN]: [description]` — 요구사항 하나당 행동 하나, 구현 세부사항 없음.

---

## v1 — Must Have

핵심 가치 제안을 깨지 않고 미룰 수 없는 요구사항들.

### Core Functionality

- [ ] CORE-01: [요구사항 — 검증 가능한 행동 설명]
- [ ] CORE-02: [요구사항]
- [ ] CORE-03: [요구사항]

### Persistence

- [ ] PERS-01: [데이터 저장/로드 요구사항]

### User Experience

- [ ] UX-01: [UX 요구사항]
- [ ] UX-02: [UX 요구사항]

### [Other Category as needed]

- [ ] [CATEGORY]-01: [요구사항]

---

## v2 — Should Have

v1 채택 후 첫 번째 사용자 피드백을 받은 다음 일정을 잡을 값진 확장들.

- [ ] [CATEGORY]-[NN]: [요구사항]
- [ ] [CATEGORY]-[NN]: [요구사항]

---

## Out of Scope

명시적 제외 목록. 사용자가 기대할 수 있지만 v1에서 의도적으로 만들지 않는 것들. 플래닝 중 스코프 크리프를 방지하기 위해 명시적으로 명명.

| Item | Reason | Revisit |
|------|--------|---------|
| [제외 항목 1] | [이유] | v2 / Never |
| [제외 항목 2] | [이유] | v2 / Never |

---

## Traceability

요구사항과 PROJECT.md 간의 연결 추적.

| ID | Description | PROJECT.md Section | Phase | Status |
|----|-------------|-------------------|-------|--------|
| CORE-01 | [요구사항 요약] | Requirements > Active | Phase 1 | not started |
| CORE-02 | [요구사항 요약] | Requirements > Active | Phase 1 | not started |
| UX-01 | [요구사항 요약] | Requirements > Active | Phase 2 | not started |
| PERS-01 | [요구사항 요약] | Requirements > Active | Phase 2 | not started |

---

*Requirements last reviewed: [YYYY-MM-DD]*
*Coverage: 0/[total_v1_count] v1 requirements covered by planned phases*
```

**카테고리 가이드:**
- `CORE` — 핵심 기능 (없으면 제품이 동작하지 않음)
- `PERS` — 영속성 / 데이터 저장
- `UX` — 사용자 경험 / 인터페이스
- `API` — 외부 API / 통합
- `PERF` — 성능 / 확장성
- `SEC` — 보안 / 인증
- `DX` — 개발자 경험 (도구/라이브러리의 경우)
- `OPS` — 운영 / 배포

## Step 8: Write ROADMAP.md

REQUIREMENTS.md의 모든 v1 요구사항을 2-4개 페이즈로 매핑하여 `.planning/ROADMAP.md` 를 작성한다.

**매핑 규칙:**
- 각 페이즈는 독립적으로 배포 가능한 동작하는 산출물을 만들어야 함
- 의존성 관계 고려: CORE 요구사항은 PERS/UX 요구사항보다 먼저
- 각 페이즈의 Success criteria는 테스트 가능한 항목 3개 이상

**반드시 다음 구조를 따를 것 (템플릿: `packages/cli/templates/roadmap.md` 참고):**

```markdown
# Roadmap

Generated by `/sunco:new`. 페이즈는 순서가 있고 독립적으로 배포 가능하다 — 각 페이즈는 중간 코드가 아닌 동작하는 산출물을 만든다.

---

## Summary

| # | Phase | Requirements | Status |
|---|-------|-------------|--------|
| 1 | [Phase 1 Name] | CORE-01, CORE-02 | not started |
| 2 | [Phase 2 Name] | UX-01, PERS-01 | not started |
| 3 | [Phase 3 Name] | CORE-03, UX-02 | not started |

**Total phases:** [N] | **v1 requirements covered:** [M]/[total]
**Milestone:** v0.1 (MVP) — [milestone exit criteria one sentence]

---

## Milestone 1: v0.1 (MVP)

**Goal:** [마일스톤 목표]
**Exit criteria:** [완료 기준]
**Estimated phases:** [N]

---

### Phase 1: [Name — 동사로 시작, 예: "Bootstrap Core Engine"]

**Goal:** [이 페이즈가 달성하는 것 — 한 문장]
**Requirements covered:** CORE-01, CORE-02
**Delivers:** [산출물/기능 설명]
**Complexity:** [Low | Medium | High]
**Depends on:** none (first phase)

**Success criteria:**
- [ ] `[specific command]` 를 실행하면 `[specific output]` 을 반환한다
- [ ] [두 번째 테스트 가능한 기준]
- [ ] [세 번째 테스트 가능한 기준]

---

### Phase 2: [Name]

**Goal:** [이 페이즈가 달성하는 것 — 한 문장]
**Requirements covered:** UX-01, PERS-01
**Delivers:** [산출물/기능 설명]
**Complexity:** [Low | Medium | High]
**Depends on:** Phase 1

**Success criteria:**
- [ ] [테스트 가능한 기준 1]
- [ ] [테스트 가능한 기준 2]
- [ ] [테스트 가능한 기준 3]

---

### Phase 3: [Name]

**Goal:** [이 페이즈가 달성하는 것 — 한 문장]
**Requirements covered:** CORE-03, UX-02
**Delivers:** [산출물/기능 설명]
**Complexity:** [Low | Medium | High]
**Depends on:** Phase 2

**Success criteria:**
- [ ] [테스트 가능한 기준 1]
- [ ] [테스트 가능한 기준 2]
- [ ] [테스트 가능한 기준 3]

---

## Backlog (unscheduled)

현재 마일스톤 밖의 기능들. 사용자 피드백 후 일정 조정.

- [v2 기능 1]
- [v2 기능 2]

---

*Roadmap created: [YYYY-MM-DD]*
*Last updated: [YYYY-MM-DD]*
*Total phases: [N] | Completed: 0 | Remaining: [N]*
```

**Success criteria 작성 가이드 (중요):**

각 Success criteria는 반드시:
1. **구체적 명령어/입력** → **구체적 출력/결과** 형식
2. 자동화 테스트 또는 수동 체크리스트로 검증 가능
3. 모호한 용어 ("잘 동작한다", "빠르다") 금지

나쁜 예: `- [ ] CLI가 잘 동작한다`
좋은 예: `- [ ] \`litmus run fixtures/basic.yaml\` 실행 시 exit code 0과 "2 passed" 메시지를 출력한다`

## Step 9: Write STATE.md

현재 프로젝트 상태를 `.planning/STATE.md` 에 작성한다.

**반드시 다음 구조를 따를 것 (템플릿: `packages/cli/templates/state.md` 참고):**

```markdown
# Project State

Live project memory. SUNCO 명령이 각 중요한 작업 후 업데이트한다. 모든 명령이 현재 컨텍스트를 파악하기 위해 읽는다.

---

## Current Phase

1

**Status:** not started
*(not started | in progress | executing | verifying | complete)*

## Current Milestone

1 — v0.1 (MVP)

## Last Action

**Command:** /sunco:new
**Date:** [YYYY-MM-DD]
**Result:** Project initialized. Planning artifacts created.

## Next Action

Run `/sunco:discuss 1` to extract decisions for Phase 1 before planning.

---

## Progress

| Phase | Name | Status | Plans | Verified |
|-------|------|--------|-------|----------|
| 1 | [Phase 1 Name] | not started | 0 | — |
| 2 | [Phase 2 Name] | not started | 0 | — |
| 3 | [Phase 3 Name] | not started | 0 | — |

**Requirements covered:** 0/[total_v1] v1

---

## Decisions

질문 단계에서 내려진 핵심 결정사항. 모든 후속 페이즈에 적용.

| Decision | Chosen | Reason | Date |
|----------|--------|--------|------|
| [결정 주제] | [선택] | [이유] | [YYYY-MM-DD] |

---

## Blockers

*(없음)*

---

## Model Profile

**Current profile:** [balanced|quality|budget|inherit]

---

*State initialized: [YYYY-MM-DD]*
*Last updated: [YYYY-MM-DD] by /sunco:new*
```

## Step 10: Add .gitignore entries

프로젝트 루트에 `.gitignore` 가 없으면 생성. 있으면 아래 항목이 없을 경우에만 추가:

```bash
# .gitignore 에 추가할 항목 (없을 경우):
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
```

**commit_docs = No 인 경우 추가:**

```
.planning/
```

## Step 11: Commit all artifacts

모든 산출물이 생성되면 커밋:

```bash
git add .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/STATE.md .planning/config.json .gitignore
git commit -m "docs: initialize [project name] planning artifacts

- PROJECT.md: vision, requirements, key decisions
- REQUIREMENTS.md: [N] v1 requirements across [M] categories
- ROADMAP.md: [N] phases mapped to requirements
- STATE.md: project memory initialized
- config.json: workflow settings"
```

## Step 12: Summary report

완료 후 다음 형식으로 요약 출력:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► NEW PROJECT INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project:       [Project Name]
Core Value:    [one-sentence core value]
v1 Reqs:       [N] requirements across [M] categories
Phases:        [N] phases planned
Milestone:     v0.1 (MVP) — [exit criteria]

Planning artifacts:
  ✓ .planning/PROJECT.md
  ✓ .planning/REQUIREMENTS.md
  ✓ .planning/ROADMAP.md
  ✓ .planning/STATE.md
  ✓ .planning/config.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next: /sunco:discuss 1
```

</process>
