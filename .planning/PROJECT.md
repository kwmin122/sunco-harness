# SUN

## What This Is

SUN is an independent workspace OS for agent-era builders. In an era where AI agents write code, the builder's job is not writing code — it's setting up the field so agents make fewer mistakes. SUN is that field. A standalone CLI runtime with a skill-based architecture, harness engineering at its core, a 6-stage review pipeline with 5-layer Swiss cheese verification, and a dedicated terminal for real-time agent observation. The first workspace OS for Korean developers. Zero competitors.

## Core Value

**에이전트가 실수를 덜 하게 판을 깔아주는 OS** — 하네스 엔지니어링이 핵심이다. 린터가 가르치면서 막고, 코드가 아니라 의도를 검증하고, 모든 것을 스킬로 구성한다. 각 스킬이 완성품이며, 퀄리티와 디테일이 생명줄이다.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Core Platform (영역 1)**
- [ ] CLI Engine: `sun` 바이너리, Commander.js + TypeScript, npx/global install
- [ ] Config System: TOML 설정, 계층적 오버라이드 (global~/.sun/ → project .sun/ → directory src/.sun.toml)
- [ ] Skill System: TypeScript 스킬(결정적) + Prompt 스킬(에이전트) 하이브리드 로더/API/레지스트리
- [ ] State Engine: .sun/ 디렉토리 (상태 저장/복원, 분석 결과, 규칙, 건강도 이력, tribal/, scenarios/, planning/)
- [ ] Agent Router: Provider-agnostic (Claude Code 우선), 크로스 검증, 에이전트 권한 스코핑
- [ ] Proactive Recommender: 모든 스킬 실행 끝에 Next Best Action 추천, 상태 기반 라우팅

**Harness Skills (영역 2) — 핵심 차별점**
- [ ] `sun init`: 기술스택 감지, 디렉토리 구조/레이어 패턴 분석, 컨벤션 추출, .sun/ 초기화, 규칙 자동 생성
- [ ] `sun lint`: 아키텍처 린터, 의존성 방향 위반 검사, 에이전트가 이해하는 에러 메시지, 100% 결정적, --fix
- [ ] `sun health`: 문서 위생(코드-문서 동기화 감지), 패턴 건강도(안티패턴 확산 추적), 점수 기반 리포트
- [ ] `sun agents`: CLAUDE.md/agents.md 분석, 효율성 점수, 분석+제안만(자동 생성 안 함)
- [ ] `sun guard`: 안티패턴→린터 승격, auto-lint-after-change, tribal→린터/테스트 전환, `sun watch` 모드

**Workflow Skills (영역 3) — GSD급, clean room 재구현**
- [ ] `sun new`: 아이디어→질문→병렬 리서치→요구사항→로드맵 자동 생성
- [ ] `sun scan`: 기존 코드베이스 7개 문서 분석 (스택, 아키텍처, 구조, 컨벤션, 테스트, 통합, 우려점)
- [ ] `sun discuss`: 비전 추출, 디자인 결정, 수용 기준 캡처 → CONTEXT.md
- [ ] `sun assume`: 에이전트 접근 방식 미리 보기
- [ ] `sun research`: 도메인 리서치
- [ ] `sun plan`: 실행 계획 + BDD 시나리오 기반 완료 조건 + plan-checker
- [ ] `sun review --codex --gemini`: 멀티에이전트 크로스 리뷰
- [ ] `sun execute`: 웨이브 기반 병렬 실행 + 원자적 커밋 + Git worktree 격리
- [ ] `sun auto`: 전체 페이즈 자율 실행
- [ ] `sun quick`/`sun fast`/`sun do`: 경량 작업
- [ ] `sun verify`: 5겹 필터 (시나리오 holdout + 전문가 에이전트 + 적대적 검증 + 의도 재구성)
- [ ] `sun validate`: 테스트 커버리지 감사
- [ ] `sun audit`: 마일스톤 달성도 검증
- [ ] `sun test-gen`: 유닛/E2E 테스트 + 외부 API Mock 서버 자동 생성 (Digital Twin)
- [ ] `sun ship`/`sun release`: PR 생성, 마일스톤 아카이브
- [ ] `sun milestone`: 마일스톤 관리
- [ ] `sun status`/`sun next`/`sun resume`/`sun pause`/`sun context`: 세션 관리
- [ ] `sun debug`/`sun diagnose`/`sun forensics`: 디버깅
- [ ] `sun note`/`sun todo`/`sun seed`/`sun backlog`: 아이디어 캡처

**Extension Skills (영역 4)**
- [ ] `sun search:kr`: 네이버 트렌드, 카카오, 국내 스타트업, 규제 환경, 한국어 NLP
- [ ] `sun search:paper`: arXiv, Google Scholar, Semantic Scholar, DBpia, RISS, KCI
- [ ] `sun search:patent`: KIPRIS, USPTO, Google Patents, 선행기술 조사
- [ ] `sun design`: 디자인 시스템, UI 스타일 가이드, `sun ui-spec`

**SUN Terminal (영역 5) — smux R&D 재활용**
- [ ] 에이전트 PTY 실시간 시각화 (여러 에이전트 동시 관찰)
- [ ] 대시보드 (진행도 + 건강도 + 컨텍스트 + Next Best Action)
- [ ] 에이전트 제어 (일시정지, 개입, 작업 인계)
- [ ] 한국어 IME 완벽 지원
- [ ] Swift/AppKit (HOST_MANAGED PTY, forkpty, Split pane)

**Review Architecture (전 영역 관통)**
- [ ] 6단계 리뷰 파이프라인 (아이디어→스펙→플랜→실행→검증→배포)
- [ ] 5겹 스위스 치즈 모델 (Multi-Agent, Deterministic, BDD, Permission Scoping, Adversarial)
- [ ] Scenario Holdout Testing (.sun/scenarios/ — 코딩 에이전트 접근 불가)
- [ ] 전문가 에이전트 리뷰 (Security, Performance, Architecture, Correctness + Coordinator)
- [ ] Intent Reconstruction (diff가 아닌 의도 대비 결과 검증)
- [ ] Tribal Knowledge Store (.sun/tribal/ → 린터/테스트로 점진적 전환)
- [ ] Human Gate (부족 지식 + 규제 경로만 사람이 블로킹)
- [ ] Digital Twin (외부 API Mock 서버 자동 생성)
- [ ] 나이퀴스트 원칙 (태스크 단위 50-100줄 즉시 검증, 검증 주파수 ≥ 2x 생산 주파수)

### Out of Scope

- 웹 UI / SaaS 대시보드 — 터미널 네이티브, 브라우저 불필요
- 자체 LLM 호스팅 — Provider-agnostic이지만 직접 모델을 호스팅하지는 않음
- 팀 협업 기능 (RBAC, 팀 대시보드) — 1인 빌더 최적화, 팀 기능은 성장 후
- GSD 코드 복사/포크 — 개념만 참고, 처음부터 clean room 작성
- 모바일 앱 — 터미널 + CLI 우선

## Context

### 시장 상황
- "2025 = Agents, 2026 = Agent Harnesses" — 타이밍 완벽
- LangChain 연구: 하네스만 개선해도 벤치마크 13.7점 향상 (동일 모델)
- OpenAI Codex팀: "Agents aren't hard; the Harness is hard."
- 한국 개발자 워크플로우 OS 시장 = 경쟁자 0

### 경쟁 포지셔닝
| 경쟁사 | SUN의 차별점 |
|--------|-------------|
| GSD | 독립 CLI 런타임 vs Claude Code 스킬 팩. 하네스 내장 vs 없음. Provider-agnostic vs Claude 종속 |
| BMAD/Speckit | 1인 빌더 최적화 vs 기업 프로세스 과잉 |
| Aider/Claude Code | 하네스 엔지니어링 핵심 vs 하네스 없음 |

### 채택하는 업계 패턴
| 패턴 | 출처 | SUN 적용 |
|------|------|---------|
| Judge Agent | Qodo | 에이전트 출력 필터링 평가 에이전트 |
| Artifacts | Google Antigravity | 매 단계 검사 가능한 산출물 |
| Living Specs | Augment Intent | .planning/ 문서 구현 자동 동기화 |
| Git Worktree 격리 | Composio | 병렬 에이전트마다 독립 worktree |
| Auto-lint-after-change | Aider | 모든 변경 후 자동 린트 |
| 계층적 Config | Codex AGENTS.md | global→project→directory 설정 |
| Evaluator Pattern | Anthropic | Generator ≠ Evaluator 분리 |
| Deterministic+Agentic 분리 | Stripe Minions | 린트/포맷=자동, 구현=에이전트 |
| Scenario Holdout | StrongDM | 에이전트가 못 보는 검증 시나리오 |
| Digital Twin Universe | StrongDM | 외부 API 행동 클론 서버 |
| Intent Reconstruction | Salesforce Prizm | diff 아닌 의도 대비 결과 검증 |
| Next Best Action | CRM 패턴 | 대시보드에 최적 다음 행동 추천 |
| Calibrated Evaluator | Anthropic Harness Blog (2026-03) | `sun verify` 전문가 에이전트에 few-shot calibration set 제공. `.sun/calibration/`에 PASS/FAIL 예제로 판단 기준 고정. 평가자의 관대함 보정 |
| Weighted Grading Dimensions | Anthropic Harness Blog (2026-03) | 검증 차원별 가중치 — 모델이 이미 잘하는 건 낮추고, 자주 실패하는 걸 높임. 프로젝트별 `.sun/config.toml`에서 조정 |
| Harness Simplification Principle | Anthropic Harness Blog (2026-03) | "하네스의 모든 컴포넌트는 모델이 못하는 것에 대한 가정. 그 가정을 정기적으로 스트레스 테스트하라." `sun health`에 하네스 복잡도 감사 추가 |
| Live Interaction QA | Anthropic Harness Blog (2026-03) | Playwright MCP로 평가자가 실제 앱을 사용하며 QA. `sun verify`에 브라우저 테스트 통합 (Extension skill) |
| Single Continuous Session | Anthropic Harness Blog (2026-03) | Opus 4.6급 모델은 컨텍스트 압축만으로 장시간 일관성 유지. 세션 핸드오프와 단일 세션 양쪽 지원 |
| Cold Evaluator Protocol | Anthropic Harness Blog (2026-03) | 평가자는 기본적으로 회의적. 기준별 하드 임계값 — ANY 미달 = 전체 FAIL. Sprint contract(BDD) 합의 후 실행, 합의 기준으로만 검증 |

### 에이전틱 엔지니어링 9가지 스킬 — SUN이 시스템으로 해결하는 것
Karpathy가 명명한 에이전틱 엔지니어링 시대에 필요한 9가지 스킬(Flowkater.io, Tony Cho). SUN은 이 스킬들을 개인의 역량에 의존하지 않고 **시스템으로 해결**한다.

| # | 스킬 | 문제 | SUN의 시스템적 해결 |
|---|------|------|-------------------|
| 1 | **분해 능력** (Decomposition) | 큰 작업을 에이전트 한 턴에 가능한 크기로 쪼개야 함. 분해 실패 → 모든 에이전트가 삽질 | `sun plan`: BDD 시나리오 기반 자동 분해 + plan-checker 검증. 수동 분해 불필요 |
| 2 | **컨텍스트 설계** (Context Architecture) | 에이전트에게 필요한 맥락을 어떻게 전달하느냐가 결과 품질 결정. AGENTS.md 150개 넘으면 따르는 비율 급락 | `sun init`: 프로젝트 자동 분석→규칙 생성. `sun agents`: 안내문 60줄 이하 강제. 계층적 TOML 설정으로 디렉토리별 컨텍스트 자동 제공 |
| 3 | **완료 정의** (Definition of Done) | 에이전트의 "완료"는 사람의 "완료"와 다름. 스텁만 남기고 "완료" 보고. 테스트 조작 | `sun verify`: 5겹 필터로 진짜 완료 검증. Holdout 시나리오는 코딩 에이전트가 볼 수 없음. BDD 수용 기준이 기본 산출물 |
| 4 | **실패 복구** (Failure Recovery Loop) | 같은 프롬프트 재시도 = 벽에 머리 박기. A↔B 무한루프 | `sun debug`/`sun diagnose`: 실패 유형 자동 분류 (컨텍스트 부족/방향 오류/구조 충돌). `sun guard`: Must NOT Have 가드레일로 루프 차단 |
| 5 | **관찰 가능성** (Observability) | "이상한데 그냥 두자"가 가장 비싼 판단. 에이전트 방치 → 20개 파일 엉킴 | SUN Terminal: 에이전트 PTY 실시간 관찰 + 대시보드. `sun health`: 패턴 확산 추적. 원자적 커밋으로 롤백 포인트 확보 |
| 6 | **메모리 설계** (Memory Architecture) | 매 세션이 첫 만남. 15분씩 맥락 설명 | .sun/ State Engine: 상태 자동 저장/복원. .sun/tribal/: 부족 지식 누적. 세션 간 컨텍스트 자동 연결 |
| 7 | **병렬 관리** (Parallel Orchestration) | 5개 에이전트 동시 실행 시 충돌/중복/방향 분산 | `sun execute`: 웨이브 기반 병렬 실행 + Git worktree 격리. Agent Router: 에이전트 권한 스코핑으로 컨텍스트 분리 |
| 8 | **추상화 계층** (Abstraction Layering) | 같은 지시 반복 = Level 1에 머무름. 레버리지 낭비 | Skill System: 반복을 스킬로 승격. TypeScript 스킬(결정적) + Prompt 스킬(에이전트) 하이브리드. ctx.run() 체이닝 |
| 9 | **감각** (Taste) | AI 결과물 80%는 "무난". 나머지 20%가 차별화. "동작한다" ≠ "훌륭하다" | `sun discuss`: 구현 전에 비전 추출. 6단계 리뷰 파이프라인: 아이디어→스펙→플랜→실행→검증→배포. 사람은 의도와 감각에 집중 |

**핵심 통찰**: "에이전트가 잘 작동하는 조건을 설계하는 능력이 핵심" (Karpathy). SUN은 그 조건 자체를 OS로 만드는 것.
- 위임 패러독스: 개발자 60% AI 사용, 완전 위임은 0-20% (2026 Agentic Coding Trends Report)
- SUN이 위임 패러독스를 해결: 하네스가 신뢰를 만들고, 신뢰가 위임을 가능하게 함
- "Do you trust your agents?" (IndyDevDan) → SUN의 답: 시스템이 신뢰를 보장하면 된다

### 핵심 인용
- "Agents aren't hard; the Harness is hard." — OpenAI Codex팀
- "에이전트가 똑똑해질수록 중요한 건 자유도가 아니라 정리정돈이다." — 빌더 본인
- "AI가 안전망을 제거한 게 아니다. 안전망이 처음부터 영웅에 의존하고 있었다는 것을 드러냈을 뿐." — Bryan Finster
- "검증되지 않은 문제는 생성이 아니라 검증이다." — Addy Osmani
- "코드가 아니라 의도를 리뷰하라." — Ankit Jain, latent.space
- "The highest leverage is in designing a long-running orchestrator with the right tools, memory, and instructions." — Karpathy
- "끝난 건 타이핑이지 엔지니어링이 아니다." — Tony Cho (Flowkater)
- "Every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing." — Prithvi Rajasekharan, Anthropic
- "에이전트는 자기 결과물에 관대하다. 독립 평가자를 회의적으로 보정하는 게, 생성자를 자기비판적으로 만드는 것보다 훨씬 쉽다." — Anthropic Harness Blog
- "Find the simplest solution possible, and only increase complexity when needed." — Building Effective Agents, Anthropic
- "Do you trust your agents?" — IndyDevDan

### 기술적 기반
- smux R&D: HOST_MANAGED PTY, forkpty, Korean IME, Split pane — SUN Terminal에 재활용
- Flowkater.io 리서치: 나이퀴스트-섀넌 정리의 소프트웨어 적용, 태스크 단위 즉시 검증

### 빌드 원칙
- 각 스킬이 완성품 — 대충 50개 찍지 않고, 하나하나에 모든 역량을 다함
- "목적물이 아니라 목적물을 만드는 에이전트를 관리하는 것에 초점"
- 퀄리티와 디테일이 생명줄
- 각 스킬 = discuss → plan → execute → verify 사이클로 구축
- **인터랙티브 UX 필수**: 모든 의사결정 지점에서 선택지를 제시하고 사용자가 고르는 방식. 벽에 텍스트를 던지지 않음. GSD의 AskUserQuestion 패턴처럼 — 옵션 2-4개 + 설명 + (Recommended) 태그. SUN의 모든 스킬이 이 패턴을 따름

## Constraints

- **Tech Stack**: TypeScript (Node.js), Commander.js, TOML, tsup, Vitest — 확정
- **Distribution**: npm (npx sunco / npm install -g sunco) — `sun`/`sun-cli`는 npm에서 이미 사용 중, `sunco` 확인 완료
- **First Agent Provider**: Claude Code CLI 우선, Provider-agnostic 추상화 레이어 위에
- **Terminal**: Swift/AppKit (macOS) — smux R&D 코드 재활용
- **Clean Room**: GSD 코드 복사 금지. 개념만 참고하여 처음부터 작성
- **Skill-Only**: 모든 기능은 스킬. 하드코딩된 명령어 금지
- **Deterministic First**: 린터/테스트로 강제할 수 있는 건 LLM 사용 안 함
- **Quality**: 각 스킬은 완성품. 하나 작성하는 데 모든 역량/스킬/서치 투입

## Non-Negotiables

1. 모든 기능은 스킬 — 하드코딩 금지
2. 린터/테스트로 강제할 수 있는 건 문서화하지 않음 — 기계적 강제만
3. agents.md는 60줄 이하 — 목차 역할만
4. 에이전트가 하는 건 자동화, 사람은 판단만
5. 시각적 피드백 필수 — 안 보이면 안 쓴다
6. GSD 코드 복사 금지 — 개념만 참고, 처음부터 작성
7. Provider-agnostic — Claude 이외에도 동작
8. 각 스킬이 완성품 — 하나하나에 온 힘을 다해
9. 모든 동작 끝에 다음 스킬 추천 — 프로액티브 추천 필수
10. 코드 리뷰가 아니라 의도 리뷰 — 6단계 파이프라인 + 5겹 필터

## Skill Catalog (41 Skills + 6 Infra Modules + Terminal App)

### 집계
| 영역 | TypeScript (결정적) | Prompt (에이전트) | Hybrid | 합계 |
|------|-------------------|------------------|--------|------|
| Harness (영역 2) | 5 | 0 | 0 | **5** |
| Workflow (영역 3) | 15 | 21 | 4 | **40** |
| Extension (영역 4) | 0 | 4 | 0 | **4** |
| **합계** | **20** | **25** | **4** | **49** |

### 영역 1: Core Platform (인프라 6개 모듈)
| 모듈 | 역할 |
|------|------|
| CLI Engine | `sun` 바이너리, Commander.js, 서브커맨드 라우팅 |
| Config System | TOML 로더, global→project→directory 계층적 오버라이드 |
| Skill Loader/Registry/API | 스킬 발견/로드/실행, ctx.run() 체이닝 |
| State Engine | .sun/ 디렉토리 CRUD, 상태 저장/복원 |
| Agent Router | Provider 추상화 (Claude Code 우선), 권한 스코핑, 크로스 검증 |
| Proactive Recommender | 상태→추천 매핑, Next Best Action 엔진 |

### 영역 2: Harness Skills (5개, 전부 TypeScript 결정적)
| ID | 스킬 | 입력 | 출력 | 핵심 동작 |
|----|------|------|------|----------|
| H1 | `sun init` | 프로젝트 디렉토리 | .sun/ + 규칙 파일 | 스택 감지→구조 분석→컨벤션 추출→규칙 생성 |
| H2 | `sun lint` | 소스 코드 + .sun/rules/ | 위반 리포트 (--fix시 수정) | 의존성 방향, 레이어 위반, 에이전트용 에러 메시지 |
| H3 | `sun health` | 코드베이스 + .sun/ | 점수 기반 건강도 리포트 | 문서 위생 + 패턴 확산 추적 + 진행 시각화 |
| H4 | `sun agents` | CLAUDE.md 등 | 효율성 점수 + 제안 | 분석만, 자동 생성 안 함 |
| H5 | `sun guard` | 파일 변경 + .sun/rules/ | 린트 결과 + 승격 제안 | auto-lint + 안티패턴→린터 승격 + watch |

### 영역 3: Workflow Skills (32개)
**3A. 초기화 + 마일스톤 (8개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W1 | `sun new` | Prompt | 질문→병렬 리서치→요구사항→로드맵 |
| W2 | `sun scan` | Prompt | 기존 코드베이스 7개 문서 분석 |
| W3 | `sun milestone new` | Prompt | 다음 마일스톤 시작: 질문→리서치→요구사항→로드맵 |
| W3a | `sun milestone audit` | Prompt | 마일스톤 달성도 검증 (원래 의도 vs 실제 결과) |
| W3b | `sun milestone complete` | Hybrid | 아카이브 + 태그 + 다음 준비 |
| W3c | `sun milestone summary` | Prompt | 종합 보고서 (온보딩/리뷰용) |
| W3d | `sun milestone gaps` | Prompt | audit 격차 → 추가 페이즈 생성 |
| W36 | `sun progress` | TS | 전체 진행 상황 + 다음 액션 라우팅 |

**3B. 맥락+계획 (5개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W4 | `sun discuss` | Prompt | 비전 추출 + 수용 기준 + Holdout 시나리오 |
| W5 | `sun assume` | Prompt | 에이전트 접근 방식 미리보기 → 교정 |
| W6 | `sun research` | Prompt | 병렬 도메인 리서치 |
| W7 | `sun plan` | Prompt | BDD 시나리오 + plan-checker |
| W8 | `sun review` | Prompt | 멀티에이전트 크로스 리뷰 (--codex --gemini) |

**3C. 실행 (4개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W9 | `sun execute` | Prompt | 웨이브 병렬 + 원자적 커밋 + worktree |
| W10 | `sun auto` | Prompt | **전체 남은 페이즈 자율 실행**: discuss→plan→execute→verify 체인. 블로커/회색지대만 멈춤 |
| W11 | `sun quick` | Prompt | 경량 (--discuss/--research/--full) |
| W12 | `sun fast` | Prompt | 즉시 실행, 계획 스킵 |

**3D. 검증 (4개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W13 | `sun verify` | Prompt | 5겹 필터: holdout + 전문가(4) + 적대적 + 의도 재구성 |
| W14 | `sun validate` | TS | 테스트 커버리지 감사 (결정적) |
| W15 | `sun audit` | Prompt | 마일스톤 달성도 검증 |
| W16 | `sun test-gen` | Prompt | 유닛/E2E + Digital Twin Mock 서버 |

**3E. 출시 (2개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W17 | `sun ship` | Hybrid | PR + 5겹 필터 확인 + 자동/수동 게이트 |
| W18 | `sun release` | TS | 버전 태깅 + 아카이브 + npm publish |

**3F. 세션 (5개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W19 | `sun status` | TS | 현재 상태 요약 |
| W20 | `sun next` | TS | 상태→다음 스킬 자동 라우팅 |
| W21 | `sun resume` | TS | HANDOFF.json → 세션 복원 |
| W22 | `sun pause` | TS | 세션 중단 → HANDOFF.json |
| W23 | `sun context` | TS | 결정/블로커/다음 액션 요약 |

**3G. 디버깅 (3개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W24 | `sun debug` | Prompt | 실패 유형 분류 + 근본 원인 + 수정 제안 |
| W25 | `sun diagnose` | TS | 결정적 로그 분석 |
| W26 | `sun forensics` | Prompt | 워크플로우 실패 사후 분석 |

**3H. 아이디어 (4개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W27 | `sun note` | TS | 마찰 없는 메모 (--tribal 부족 지식) |
| W28 | `sun todo` | TS | 할 일 추가/목록/완료 |
| W29 | `sun seed` | TS | 미래 아이디어 + 트리거 조건 |
| W30 | `sun backlog` | TS | 백로그 주차장 |

**3I. 페이즈 관리 (3개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W33 | `sun phase add` | TS | 로드맵에 페이즈 추가 |
| W34 | `sun phase insert` | TS | 페이즈 사이에 긴급 작업 삽입 (소수점 번호) |
| W35 | `sun phase remove` | TS | 미래 페이즈 제거 + 번호 재지정 |

**3J. 유틸리티 (2개)**
| ID | 스킬 | 유형 | 핵심 동작 |
|----|------|------|----------|
| W31 | `sun do` | Prompt | 자연어→스킬 자동 라우팅 |
| W32 | `sun settings` | TS | 설정 조회/변경 |

### 영역 4: Extension Skills (4개, 전부 Prompt)
| ID | 스킬 | 핵심 동작 |
|----|------|----------|
| E1 | `sun search:kr` | 네이버/카카오/스타트업/규제. 한국어 NLP |
| E2 | `sun search:paper` | arXiv/Scholar/DBpia/RISS/KCI. 인용 네트워크 |
| E3 | `sun search:patent` | KIPRIS/USPTO/Google Patents. 선행기술 |
| E4 | `sun design` | 디자인 시스템 + `sun ui-spec` 계약서 |

### 영역 5: SUN Terminal (별도 Swift/AppKit 앱)
| 컴포넌트 | 역할 |
|----------|------|
| Agent PTY View | 에이전트 실시간 작업 관찰 (다수 동시) |
| Dashboard View | 진행도 + 건강도 + 컨텍스트 + Next Best Action |
| Agent Control | 일시정지/개입/인계 |
| Korean IME | 한국어 입력 완벽 지원 |
| Recommender Widget | Proactive Recommender 시각화 |

### 구현 파이프라인 (의존성 기반 순서)
```
Phase 1: Core Platform (CLI + Config + Skill System + State + Agent Router + Recommender)
Phase 2: Harness Skills (H1→H2→H3/H4→H5 순서, init이 선행)
Phase 3: Workflow Skills
  Wave 1: 독립 TS 스킬 (status/next/progress/note/todo/seed/backlog/settings)
  Wave 2: 페이즈 관리 TS (phase add/insert/remove)
  Wave 3: Agent 기반 초기화 (new/scan)
  Wave 4: 맥락+계획 (discuss/assume/research/plan)
  Wave 5: 실행+리뷰 (execute/review)
  Wave 6: 검증 (verify/validate/test-gen)
  Wave 7: 출시 (ship/release)
  Wave 8: 마일스톤 (milestone new/audit/complete/summary/gaps)
  Wave 9: 조합 (auto/quick/fast/do)
  Wave 10: 보조 (resume/pause/context/debug/diagnose/forensics)
Phase 4: Extension Skills (search:kr/paper/patent + design)
Phase 5: SUN Terminal (별도 Swift 프로젝트)
```

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript + Node.js 런타임 | npm 에코시스템, 빠른 개발, Commander.js 호환 | — Pending |
| npm 패키지명 sunco | sun/sun-cli 이미 사용 중, sunco 확인 완료 (2026-03-27) | — Pending |
| Claude Code CLI 첫 provider | 본인이 이미 사용 중, 검증된 환경 | — Pending |
| GSD clean room | 법적 안전 + 더 나은 설계 기회 | — Pending |
| TOML 설정 | JSON보다 가독성, YAML보다 명확함 | — Pending |
| Skill-only 아키텍처 | 확장성 + 유지보수성, 하드코딩 방지 | — Pending |
| 결정적+에이전트 분리 | Stripe 패턴 — 린트/포맷은 LLM 없이, 구현만 에이전트 | — Pending |
| Scenario Holdout | StrongDM 패턴 — ML train/test split 원리 적용 | — Pending |
| Swift/AppKit 터미널 | smux R&D 재활용, macOS 네이티브 성능 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after initialization*
