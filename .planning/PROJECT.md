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

### 핵심 인용
- "Agents aren't hard; the Harness is hard." — OpenAI Codex팀
- "에이전트가 똑똑해질수록 중요한 건 자유도가 아니라 정리정돈이다." — 빌더 본인
- "AI가 안전망을 제거한 게 아니다. 안전망이 처음부터 영웅에 의존하고 있었다는 것을 드러냈을 뿐." — Bryan Finster
- "검증되지 않은 문제는 생성이 아니라 검증이다." — Addy Osmani
- "코드가 아니라 의도를 리뷰하라." — Ankit Jain, latent.space

### 기술적 기반
- smux R&D: HOST_MANAGED PTY, forkpty, Korean IME, Split pane — SUN Terminal에 재활용
- Flowkater.io 리서치: 나이퀴스트-섀넌 정리의 소프트웨어 적용, 태스크 단위 즉시 검증

### 빌드 원칙
- 각 스킬이 완성품 — 대충 50개 찍지 않고, 하나하나에 모든 역량을 다함
- "목적물이 아니라 목적물을 만드는 에이전트를 관리하는 것에 초점"
- 퀄리티와 디테일이 생명줄
- 각 스킬 = discuss → plan → execute → verify 사이클로 구축

## Constraints

- **Tech Stack**: TypeScript (Node.js), Commander.js, TOML, tsup, Vitest — 확정
- **Distribution**: npm (npx sun / npm install -g sun-cli)
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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript + Node.js 런타임 | npm 에코시스템, 빠른 개발, Commander.js 호환 | — Pending |
| npm 배포 | npx sun으로 즉시 사용 가능, Node.js 에코시스템 활용 | — Pending |
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
