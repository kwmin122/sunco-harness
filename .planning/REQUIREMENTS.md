# Requirements: SUN (sunco)

**Defined:** 2026-03-27
**Core Value:** 에이전트가 실수를 덜 하게 판을 깔아주는 OS -- 하네스 엔지니어링이 핵심

## v1 Requirements

### Core Platform -- CLI Engine

- [x] **CLI-01**: `sunco` 바이너리가 npm으로 설치 가능 (npx sunco / npm install -g sunco)
- [x] **CLI-02**: Commander.js 기반 서브커맨드 라우팅, 스킬 자동 발견/등록
- [x] **CLI-03**: `sunco --help` / `sunco <skill> --help`로 도움말 표시
- [x] **CLI-04**: 스킬 미설치/미발견 시 명확한 에러 메시지 + 추천

### Core Platform -- Config System

- [x] **CFG-01**: TOML 파일 파싱 (smol-toml), 계층적 오버라이드: global(~/.sun/config.toml) -> project(.sun/config.toml) -> directory(src/.sun.toml)
- [x] **CFG-02**: 배열 병합 시 상위 레벨 값을 대체(replace), 객체는 deep merge
- [x] **CFG-03**: 설정 값 타입 검증 (Zod 스키마)
- [x] **CFG-04**: `sunco settings` 스킬로 설정 조회/변경 가능

### Core Platform -- Skill System

- [x] **SKL-01**: Skill 인터페이스 정의: name, description, type(deterministic/prompt/hybrid), execute(ctx)
- [x] **SKL-02**: SkillContext 제공: config, state, agentRouter, recommend, run(skillName)
- [x] **SKL-03**: 스킬 로더가 packages/skills-*에서 자동 발견 + 레지스트리 등록
- [x] **SKL-04**: 결정적 스킬은 Agent Router를 사용하지 않음 (LLM 비용 0)
- [x] **SKL-05**: Prompt 스킬은 Agent Router를 통해 에이전트 디스패치
- [x] **SKL-06**: ctx.run('lint') 형태로 스킬 간 직접 호출 가능

### Core Platform -- State Engine

- [x] **STE-01**: .sun/ 디렉토리 구조 관리 (state/, rules/, tribal/, scenarios/, planning/)
- [x] **STE-02**: SQLite WAL 모드로 구조화 상태 저장 (better-sqlite3, busy_timeout=5000)
- [x] **STE-03**: 플랫 파일로 사람이 읽을 수 있는 아티팩트 (규칙, 부족 지식, 계획 등)
- [x] **STE-04**: 병렬 에이전트 쓰기 시 데이터 손상 방지 (파일 잠금 + SQLite WAL)
- [x] **STE-05**: 상태 저장/복원 API (세션 간 연속성)

### Core Platform -- Agent Router

- [x] **AGT-01**: Provider 추상화 레이어: AgentProvider 인터페이스
- [x] **AGT-02**: Claude Code CLI 첫 번째 provider 구현
- [x] **AGT-03**: 에이전트 권한 스코핑: PermissionSet (read/write/execute/deny 글롭 패턴)
- [x] **AGT-04**: 연구=읽기전용, 계획=.planning/만, 실행=src/만, 검증=읽기+테스트만
- [x] **AGT-05**: 크로스 검증: 여러 provider에게 독립적으로 검증 요청 가능
- [x] **AGT-06**: 토큰/비용 추적 (provider별 사용량 기록)

### Core Platform -- Proactive Recommender

- [x] **REC-01**: 룰 엔진 기반 (state, lastResult) -> Recommendation[] 매핑
- [x] **REC-02**: 모든 스킬 실행 끝에 Next Best Action 추천 표시
- [x] **REC-03**: 상태 기반 라우팅: execute 끝->verify, verify 실패->debug, verify 성공->ship
- [x] **REC-04**: 추천 규칙 20-50개, 결정적 (LLM 사용 안 함), sub-ms 응답

### Harness Skills

- [x] **HRN-01**: `sunco init` -- 기술스택 감지 (package.json, tsconfig, Cargo.toml, go.mod 등 15+ 에코시스템)
- [x] **HRN-02**: `sunco init` -- 디렉토리 구조 -> 레이어 패턴 감지 (Types->Config->Service->Handler->UI)
- [x] **HRN-03**: `sunco init` -- 코드에서 컨벤션 추출 (네이밍, 패턴, import 스타일)
- [x] **HRN-04**: `sunco init` -- .sun/ 워크스페이스 초기화 + 규칙 자동 생성 + 프로젝트 타입별 기본 템플릿
- [x] **HRN-05**: `sunco lint` -- init이 감지한 레이어 구조 -> ESLint rule 자동 생성 (eslint-plugin-boundaries)
- [x] **HRN-06**: `sunco lint` -- 의존성 방향 위반 검사 (UI->DB 직접 import 잡음)
- [x] **HRN-07**: `sunco lint` -- 에러 메시지가 에이전트가 이해하는 수정 지시 형태 ("린터가 가르치면서 막는다")
- [x] **HRN-08**: `sunco lint` -- 100% 결정적, --fix 옵션으로 자동 수정
- [x] **HRN-09**: `sunco health` -- 문서 위생: 코드와 동기 안 되는 문서 감지, 교차참조 깨짐, 문서 나이
- [x] **HRN-10**: `sunco health` -- 패턴 건강도: 안티패턴 확산 추적 ("any 타입이 3파일->12파일"), 트렌드
- [x] **HRN-11**: `sunco health` -- 점수 기반 리포트 (숫자로 보여줌)
- [x] **HRN-12**: `sunco agents` -- CLAUDE.md/agents.md/AGENTS.md 분석, 효율성 점수, 60줄 이하 검증
- [x] **HRN-13**: `sunco agents` -- 분석+제안만, 자동 생성 안 함 (ETH Zurich 연구 반영)
- [x] **HRN-14**: `sunco guard` -- 안티패턴 감지 -> 린터 규칙 자동 승격 제안
- [x] **HRN-15**: `sunco guard` -- 매 에이전트 변경 후 자동 린트 (auto-lint-after-change)
- [x] **HRN-16**: `sunco guard` -- `sunco watch` 모드: 파일 변경 실시간 감시

### Workflow -- 초기화 + 마일스톤

- [x] **WF-01**: `sunco new` -- 아이디어->질문->병렬 리서치->요구사항->로드맵 자동 생성
- [x] **WF-02**: `sunco scan` -- 기존 코드베이스 7개 문서 분석
- [x] **WF-03**: `sunco milestone new` -- 다음 마일스톤 시작 (질문->리서치->요구사항->로드맵)
- [x] **WF-04**: `sunco milestone audit` -- 마일스톤 달성도 검증 (의도 vs 실제)
- [x] **WF-05**: `sunco milestone complete` -- 아카이브 + 태그 + 다음 준비
- [x] **WF-06**: `sunco milestone summary` -- 종합 보고서 (온보딩/리뷰용)
- [x] **WF-07**: `sunco milestone gaps` -- audit 격차 -> 추가 페이즈 생성
- [x] **WF-08**: `sunco progress` -- 전체 진행 상황 + 다음 액션 라우팅

### Workflow -- 맥락 + 계획

- [x] **WF-09**: `sunco discuss` -- 비전 추출, 디자인 결정, 수용 기준 + Holdout 시나리오 생성 -> CONTEXT.md
- [x] **WF-10**: `sunco assume` -- 에이전트 접근 방식 미리보기 (교정 기회)
- [x] **WF-11**: `sunco research` -- 병렬 에이전트 도메인 리서치
- [x] **WF-12**: `sunco plan` -- 실행 계획 + BDD 시나리오 기반 완료 조건 + plan-checker 검증 루프

### Workflow -- 실행 + 리뷰

- [x] **WF-13**: `sunco review` -- 멀티에이전트 크로스 리뷰 (--codex --gemini 플래그)
- [x] **WF-14**: `sunco execute` -- 웨이브 기반 병렬 실행 + 원자적 커밋 + Git worktree 격리

### Workflow -- 조합

- [x] **WF-15**: `sunco auto` -- 전체 남은 페이즈 자율 실행 (discuss->plan->execute->verify 체인). 블로커/회색지대만 멈춤
- [x] **WF-16**: `sunco quick` -- 경량 작업 (--discuss/--research/--full 플래그)
- [x] **WF-17**: `sunco fast` -- 즉시 실행, 계획 스킵
- [x] **WF-18**: `sunco do` -- 자연어->스킬 자동 라우팅

### Workflow -- 검증 (Review Architecture)

- [x] **VRF-01**: `sunco verify` -- Layer 1: Multi-Agent Generation (여러 에이전트 독립 검증)
- [x] **VRF-02**: `sunco verify` -- Layer 2: Deterministic Guardrails (sunco lint + guard + pre-commit)
- [x] **VRF-03**: `sunco verify` -- Layer 3: Human-Defined Acceptance Criteria (BDD 시나리오)
- [x] **VRF-04**: `sunco verify` -- Layer 4: Agent Permission Scoping (역할별 권한)
- [x] **VRF-05**: `sunco verify` -- Layer 5: Adversarial Verification (실행 != 검증 에이전트)
- [x] **VRF-06**: `sunco verify` -- 전문가 에이전트: Security, Performance, Architecture, Correctness + Coordinator
- [x] **VRF-07**: `sunco verify` -- Intent Reconstruction: diff가 아닌 의도 대비 결과
- [x] **VRF-08**: `sunco verify` -- Scenario Holdout: .sun/scenarios/ (코딩 에이전트 접근 불가, 검증 에이전트만)
- [x] **VRF-09**: `sunco verify` -- 나이퀴스트 원칙: 태스크 단위(50-100줄) 즉시 검증
- [x] **VRF-10**: `sunco validate` -- 테스트 커버리지 감사 (결정적)
- [x] **VRF-11**: `sunco test-gen` -- 유닛/E2E 테스트 자동 생성 + --mock-external (Digital Twin Mock 서버)

### Workflow -- 출시

- [x] **SHP-01**: `sunco ship` -- PR 생성 + 5겹 필터 통과 확인 + 자동/수동 게이트
- [x] **SHP-02**: `sunco release` -- 버전 태깅 + 아카이브 + npm publish

### Workflow -- 세션 관리

- [x] **SES-01**: `sunco status` -- 현재 상태 요약 (어디에 있는지, 뭐가 남았는지)
- [x] **SES-02**: `sunco next` -- 상태->다음 스킬 자동 라우팅
- [x] **SES-03**: `sunco resume` -- HANDOFF.json -> 이전 세션 복원
- [x] **SES-04**: `sunco pause` -- 세션 중단 시 HANDOFF.json 생성
- [x] **SES-05**: `sunco context` -- 현재 결정/블로커/다음 액션 요약

### Workflow -- 디버깅

- [x] **DBG-01**: `sunco debug` -- 실패 유형 분류 (컨텍스트 부족/방향 오류/구조 충돌) + 근본 원인 + 수정 제안
- [x] **DBG-02**: `sunco diagnose` -- 결정적 로그 분석 (빌드/테스트)
- [x] **DBG-03**: `sunco forensics` -- 워크플로우 실패 사후 분석 (git 히스토리 + .sun/)

### Workflow -- 아이디어 캡처

- [x] **IDX-01**: `sunco note` -- 마찰 없는 메모 + `--tribal` 부족 지식 저장
- [x] **IDX-02**: `sunco todo` -- 할 일 추가/목록/완료
- [x] **IDX-03**: `sunco seed` -- 미래 아이디어 + 트리거 조건 (조건 충족 시 자동 표면화)
- [x] **IDX-04**: `sunco backlog` -- 백로그 주차장

### Workflow -- 페이즈 관리

- [x] **PHZ-01**: `sunco phase add` -- 로드맵에 페이즈 추가
- [x] **PHZ-02**: `sunco phase insert` -- 페이즈 사이에 긴급 작업 삽입 (소수점 번호)
- [x] **PHZ-03**: `sunco phase remove` -- 미래 페이즈 제거 + 번호 재지정

### Workflow -- 설정

- [x] **SET-01**: `sunco settings` -- TOML 설정 조회/변경 인터랙티브 UI

### Review Architecture (전 영역 관통)

- [x] **REV-01**: 6단계 리뷰 파이프라인 (아이디어->스펙->플랜->실행->검증->배포) 각 단계에서 해당 스킬 자동 연결
- [x] **REV-02**: Tribal Knowledge Store (.sun/tribal/) -- sunco note --tribal로 캡처, sunco verify가 자동 로드
- [x] **REV-03**: Human Gate -- 부족 지식 + 규제 경로만 사람이 블로킹, 나머지 자동
- [x] **REV-04**: Digital Twin -- sunco test-gen --mock-external이 API 문서->모방 서버 생성

### 인터랙티브 UX

- [x] **UX-01**: 모든 의사결정 지점에서 선택지 제시 (옵션 2-4개 + 설명 + Recommended 태그)
- [x] **UX-02**: 프로액티브 추천: 모든 스킬 실행 끝에 다음 스킬 추천
- [x] **UX-03**: 시각적 피드백: 진행도 바, 상태 심볼, 스포닝 인디케이터, 에러 박스
- [ ] **UX-04**: 상태바: 모델 사용량(토큰 %) + 세션 컨텍스트 사용량(%) + provider명 항상 표시 (Claude Code 하단바 패턴)
- [ ] **UX-05**: 상태바: 에이전트 실행 중 실시간 업데이트, 비용 누적 표시

## v1.1 Requirements

### Planning Quality Pipeline (Phase 11 — COMPLETE)

- [x] **PQP-01**: `sunco plan --research` -- plan 스킬에 research 자동 통합
- [x] **PQP-02**: Plan-checker revision loop -- planner ↔ checker 최대 3회 반복
- [x] **PQP-03**: Requirements coverage gate -- plan REQ-ID 커버리지 검증
- [x] **PQP-04**: Validation strategy -- RESEARCH.md → VALIDATION.md 생성
- [x] **PQP-05**: Deep work rules -- read_first, acceptance_criteria, concrete action 필수

### Operational Resilience (Phase 12)

- **OPS-01**: 크래시 복구 -- .sun/auto.lock 잠금파일로 현재 작업 추적. 세션 사망 시 다음 sunco auto가 마지막 상태에서 자동 재개. SUMMARY.md 존재하면 완료 처리, 없으면 복구 브리핑 생성
- **OPS-02**: 멈춤 감지 -- 슬라이딩 윈도우로 반복 디스패치 패턴 인식 (같은 스킬 3회 연속 실패 = stuck). 감지 시 1회 심층 진단 재시도 후 실패면 자동 정지 + 원인 보고
- **OPS-03**: 비용 대시보드 -- `sunco stats` 스킬에 실시간 비용 추적 추가. 단위별 토큰/비용, phase별 집계, 모델별 분류. SQLite state에 저장
- **OPS-04**: 예산 한도 -- `sunco.budget_ceiling` 설정 (USD). auto 모드에서 한도 도달 시 자동 정지. 50%/75%/90% 경고 단계
- **OPS-05**: 타임아웃 3단계 -- soft(LLM에게 마무리 경고), idle(활동 없음 감지), hard(강제 정지). 설정: `auto_supervisor.soft_timeout_minutes`, `idle_timeout_minutes`, `hard_timeout_minutes`

### Headless + CI/CD (Phase 13)

- **HLS-01**: `sunco headless` -- TUI 없는 CLI 모드. CI 파이프라인, cron, 스크립트 자동화용. 인터랙티브 프롬프트 자동 응답
- **HLS-02**: `sunco headless query` -- 즉시 JSON 스냅샷 (LLM 호출 없이 ~50ms). 현재 상태, 다음 디스패치, 비용
- **HLS-03**: 종료 코드 규약 -- 0=완료, 1=에러/타임아웃, 2=블로킹(사람 필요)
- **HLS-04**: `sunco headless --timeout <ms>` -- 최대 실행 시간 제한. CI 예산 보호
- **HLS-05**: HTML 리포트 -- `sunco export --html` 마일스톤 완료 후 자체 포함 HTML 리포트 자동 생성. CSS/JS 인라인, 외부 의존 없음

### Context Optimization + Quality Depth (Phase 14)

- **CTX-01**: 코드 지식 그래프 -- Tree-sitter AST 파싱 → .sun/graph.db (SQLite). 변경 파일 → blast radius 분석 → 관련 파일만 에이전트에 제공. 토큰 6-49x 절감. code-review-graph 인사이트 + Manus KV-cache 패턴 결합. `sunco graph` 스킬로 구축, `sunco guard --watch`에서 증분 업데이트
- **CTX-02**: 적응형 재계획 -- 각 plan 실행 완료 후 로드맵 자동 재평가. 새 정보가 계획을 바꿀 경우 plan 재정렬/추가/삭제
- **CTX-03**: 복잡도 기반 모델 라우팅 -- 작업 복잡도 자동 분류 (simple/standard/complex) → 적절한 모델 자동 선택. sub-ms 휴리스틱, LLM 호출 없음
- **CTX-04**: 토큰 프로파일 -- budget/balanced/quality 프리셋. budget=40-60% 절약 (저렴 모델, 리서치 스킵), quality=전체 파워
- **CTX-05**: Garbage Collection 스킬 -- `sunco health --deep` 에이전트가 코드-문서 불일치, 죽은 import, 오래된 TODO, 아키텍처 엔트로피 탐지+수정 제안. OpenAI 3대 기둥 중 하나
- **CTX-06**: Plan→Verify 자동 연결 -- verify Layer 3에서 해당 phase의 PLAN.md를 파싱하여 acceptance_criteria 자동 추출 → 검증. Opslane/Verify spec-first 패턴
- **CTX-07**: fail loudly, succeed silently -- verify/lint 출력 패턴 개선. PASS=1줄 요약, FAIL=전체 상세 보고서+수정 제안. 컨텍스트 오염 방지. HumanLayer 패턴
- **CTX-08**: Docker 격리 모드 -- `sunco auto --docker` 컨테이너 안에서 에이전트 실행. 호스트 파일시스템/네트워크 격리. Dockerfile 자체 제공. CI/CD + 위험한 자동 모드용

### Document Generation (Phase 15)

- **DOC-01**: `sunco doc:hwpx` -- HWPX(OWPML) 문서 생성. KS X 6101 스펙 기반 자체 구현. 프로젝트 컨텍스트에서 제안서/수행계획서/보고서 자동 생성
- **DOC-02**: `sunco doc:md` -- 마크다운 문서 생성. README, API 문서, 아키텍처 문서 등
- **DOC-03**: 문서 템플릿 시스템 -- .sun/templates/에 사용자 정의 템플릿. `sunco doc --template <name>`

### Skill Marketplace (Phase 16)

- **MKT-01**: `sunco install <skill-name>` -- npm 기반 스킬 설치
- **MKT-02**: `sunco publish` -- 스킬 npm 배포
- **MKT-03**: Community skill registry

## v1.2 Requirements — Light Harness

### Context Intelligence (Phase 17)

- **LH-01**: 컨텍스트 유틸리제이션 존 -- Green(0-50%)/Yellow(50-70%)/Orange(70-85%)/Red(85%+) 4단계 시각적 경고. `sunco-context-monitor.cjs` 훅이 실시간 모니터링
- **LH-02**: Orange 존(70-85%)에서 `/sunco:pause` 자동 추천 + HANDOFF.json 자동 저장. Red 존(85%+)에서 auto-compact 전 상태 캡처
- **LH-03**: 선택적 아티팩트 로딩 -- 현재 페이즈 full 로드, 완료 페이즈 요약만 로드. `.planning/` 토큰 예산 측정 → 초과 시 요약 전환. 목표: 78% 컨텍스트 절감 (LTH 패턴)
- **LH-04**: 구조화된 핸드오프 강화 -- HANDOFF.json에 `resumeCommand`, `completedTasks[]`, `inProgressTask`, `lastDecisions[]` 추가. 새 세션에서 즉시 이어서 할 수 있는 프롬프트 자동 생성
- **LH-05**: 아티팩트 요약 엔진 -- phase CONTEXT.md/PLAN.md를 3줄 요약으로 압축하는 결정적 함수. 로딩 시 full/summary 모드 선택

### Smart Routing (Phase 18)

- **LH-06**: 인텐트 게이트 분류 -- 사용자 입력을 5가지(`lookup`/`implement`/`investigate`/`plan`/`review`)로 분류. 분류 기반 최적 모델 자동 선택. `sunco-mode-router.cjs` 훅 확장
- **LH-07**: 티어 기반 모델 프로필 -- Fast(Haiku: lint, format, 조회), Balanced(Sonnet: 구현, 디버깅), Quality(Opus: 아키텍처, 리뷰). `router.ts` role-based 라우팅에 complexity 차원 추가
- **LH-08**: 비용 인식 라우팅 -- 실행 전 예상 토큰 비용 산출. BudgetGuard 임계치 가까우면 자동 cheaper 모델 다운그레이드. `UsageTracker`에 예측 기능 추가
- **LH-09**: 스킬별 복잡도 메타데이터 -- `defineSkill()`에 `complexity: 'simple'|'standard'|'complex'` 필드 추가. 라우터가 자동 참조
- **LH-10**: 라우팅 성공률 추적 -- 어떤 모델이 어떤 스킬에서 성공률 높은지 SQLite에 기록. 시간이 지날수록 라우팅 정확도 향상

### Hook System v2 (Phase 19)

- **LH-11**: 라이프사이클 훅 확장 -- `PreSkill`/`PostSkill`(스킬 실행 전후), `PreCompact`(auto-compact 전 상태 저장), `SessionStart`/`SessionEnd`(세션 라이프사이클). `.sun/config.toml`에서 훅 활성/비활성
- **LH-12**: 훅 출력 크기 제한 -- 10K자 캡. 초과 시 자동 트렁케이션 + 경고 (Claude Code 공식 패턴)
- **LH-13**: 해시 앵커 에딧 검증 -- 파일 에딧 전 라인 해시 검증 → 스테일 에딧 차단 (OMO 패턴). `sunco-prompt-guard.cjs` 강화
- **LH-14**: 훅 미들웨어 체인 -- 여러 훅을 파이프라인으로 연결. 이전 훅 출력이 다음 훅 입력. `.sun/config.toml` [hooks] 섹션
- **LH-15**: 선언적 캐치 룰 -- 마크다운 기반 pre-commit 검증 규칙 (OMC declarative catch rules 패턴)

### Infinite Execution (Phase 20)

- **LH-16**: 컨텍스트 로테이션 -- `/sunco:auto`에서 70% 도달 시: 상태 저장 → compact/새 세션 → `/sunco:resume` + 이어서 실행. 이론상 무한 작업 가능
- **LH-17**: 적응형 타임아웃 -- 단순 스킬 5분, 복잡 스킬 30분, 연구 60분. 스킬 `kind`와 복잡도 기반 동적 조정
- **LH-18**: 세션 진행 기록 -- `.sun/sessions/` 디렉토리에 세션별 진행 상태 MD 파일. 최근 3개 세션만 로드 (LTH 패턴, 78% 절감)
- **LH-19**: 히스토리 리서치 프로토콜 -- 서브에이전트가 전체 이력 대신 관련 이력만 검색. 메인 컨텍스트 오염 방지

### Cross-Session Intelligence (Phase 21)

- **LH-20**: 피처-세션 양방향 추적 -- `.sun/features.json` 피처 → 세션 매핑. 특정 피처 관련 컨텍스트만 선택 로딩
- **LH-21**: 학습 기반 스킬 최적화 -- 스킬×모델 성공률 SQLite 추적. `recommender.ts`에 성공률 피드백 추가
- **LH-22**: 크로스 세션 메모리 MCP -- 세션 간 학습 내용 영구 저장. 패턴 인식, 선호도 추적
- **LH-23**: 스킬 학습 프로필 -- 사용자별 스킬 사용 패턴 분석 → 자동 추천 개인화
- **LH-24**: 하네스 자체 토큰 예산 5% 제한 -- 하네스 로딩(CLAUDE.md, 훅, 상태)이 전체 컨텍스트의 5% 이하 (HarnessOS 목표)

## v1.3 Historical Note (no backfill)

v1.3 work (Phase 22–34) was executed as internal consolidation / pivot absorption without formal REQ-ID assignment. See `ROADMAP.md` § v1.3 Closeout for phase-level detail and `.planning/phases/22-*` through `34-*` for implementation artifacts. Retroactive REQ documentation is intentionally out of scope. v1.4 onward resumes formal REQ-ID discipline.

---

## v1.4 Requirements — Impeccable Fusion

Source spec: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` (locked at commit `6e6761a`). Each requirement maps to exactly one phase in ROADMAP § v1.4.

### Foundation (M1)

- **IF-01**: Vendored Apache-2.0 Impeccable license/attribution skeleton — `packages/cli/references/impeccable/` with LICENSE/NOTICE.md/SUNCO-ATTRIBUTION.md; `packages/cli/references/backend-excellence/` with NOTICE.md (clean-room declaration); `packages/cli/schemas/` directory. Covered by Phase 35 (spec M1.1).
- **IF-02**: UI dispatcher `/sunco:ui-phase [--surface cli|web|native]` with sanity pre-check warning (stderr-only, non-blocking) and explicit-only triggers. Default=cli for 0 regression. Internal: `ui-phase.md` (router), `ui-phase-{cli,web,native}.md`. Covered by Phase 36 (spec M1.2).
- **IF-03**: Backend dispatcher `/sunco:backend-phase --surface {api|data|event|ops}` + symmetric `/sunco:backend-review` (no default; `--surface` required). Covered by Phase 37 (spec M1.3).

### Frontend Fusion (M2)

- **IF-04**: Impeccable vendoring via wrapper injection (not patchset) — `packages/cli/references/impeccable/source/` pristine, `packages/cli/references/impeccable/wrapper/` SUNCO-authored adapters (context-injector.mjs, detector-adapter.mjs). Done when wrapper e2e test passes. Covered by Phase 38 (spec M2.1).
- **IF-05**: `discuss-phase.md` inline frontend teach questions — triggered only by `domains:[frontend]` in phase YAML or `--domain frontend` flag. Populates `.planning/domains/frontend/DESIGN-CONTEXT.md`. Covered by Phase 39 (spec M2.2).
- **IF-06**: `ui-phase-web` workflow generates `UI-SPEC.md` with required `<!-- SUNCO:SPEC-BLOCK -->` YAML block (structured schema) + prose. DESIGN-CONTEXT.md required as input. Covered by Phase 40 (spec M2.3).
- **IF-07**: `/sunco:ui-review --surface web` explicit wraps Impeccable detector + LLM critique → `IMPECCABLE-AUDIT.md` (raw findings) + `UI-REVIEW.md` (6-pillar wrapping). Default flagless invocation preserves cli behavior (0 regression). Covered by Phase 41 (spec M2.4).

### Backend Excellence (M3)

- **IF-08**: 8 clean-room backend reference documents (api-design, data-modeling, boundaries-and-architecture, reliability-and-failure-modes, security-and-permissions, performance-and-scale, observability-and-operations, migrations-and-compatibility), each ≥1500 words with ≥5 anti-patterns + code examples. Covered by Phase 42 (spec M3.1).
- **IF-09**: Deterministic backend detector with 7 high-confidence rules (raw-sql-interpolation, missing-timeout, swallowed-catch, any-typed-body, missing-validation-public-route, non-reversible-migration, logged-secret) emitting JSON findings with severity/kind=deterministic/file/line/match/fix_hint. Covered by Phase 43 (spec M3.2).
- **IF-10**: `discuss-phase.md` inline backend teach questions — triggered only by `domains:[backend]` or `--domain backend`. Populates `.planning/domains/backend/BACKEND-CONTEXT.md`. Covered by Phase 44 (spec M3.3).
- **IF-11**: `backend-phase-api` + `backend-phase-data` workflows output `API-SPEC.md` + `DATA-SPEC.md` with SPEC-BLOCK structured YAML (endpoints, error_envelope, entities, indexes, migration_strategy). Covered by Phase 45 (spec M3.4).
- **IF-12**: `backend-phase-event` + `backend-phase-ops` workflows output `EVENT-SPEC.md` + `OPS-SPEC.md` with SPEC-BLOCK YAML (events/DLQ/idempotency; deployment_topology/SLO/runbook). Covered by Phase 46 (spec M3.5).
- **IF-13**: `backend-review --surface {api|data|event|ops}` executes deterministic detector subset + LLM review → `BACKEND-AUDIT.md` with surface sections and labeled findings (deterministic/heuristic/requires-human-confirmation). Covered by Phase 47 (spec M3.6).

### Cross-Domain (M4)

- **IF-14**: `CROSS-DOMAIN.md` auto-generation from UI-SPEC.md + API-SPEC.md SPEC-BLOCK extraction (grep + YAML parse, deterministic). Schema: `schemas/cross-domain.schema.json` with version field. Covered by Phase 48 (spec M4.1).
- **IF-15**: Verify gate cross-domain layer with 4 checks (missing-endpoint HIGH, type-drift HIGH, error-state-mismatch MED, orphan-endpoint LOW) and finding-state lifecycle (open/resolved/dismissed-with-rationale); HIGH open = hard block, MED open = block (dismissable with ≥50-char rationale), LOW open = configurable. Covered by Phase 49 (spec M4.2).

### Rollout Hardening (M5)

- **IF-16**: Documentation and migration guide — `docs/impeccable-integration.md`, `docs/backend-excellence.md`, `docs/migration-v0.X.md`, README update with v1.4 usage. Covered by Phase 50 (spec M5.1).
- **IF-17**: Dogfood sunco-harness itself — apply `backend-phase-api` to the CLI's own API surface; fixtures `test/fixtures/frontend-web-sample`, `backend-rest-sample`, `cross-domain-conflict`; CI integration (vitest). Covered by Phase 51 (spec M5.2).

---

## v1.5 Requirements — SUNCO Workflow Router

Source: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at `30e2041`, 4-round convergent review). Clean-room design; no external workflow/compound-plugin vendoring.

### Router Core (M6)

- **IF-18**: Router state machine — 10-stage enum (BRAINSTORM, PLAN, WORK, REVIEW, VERIFY, PROCEED, SHIP, RELEASE, COMPOUND, PAUSE) + UNKNOWN (classifier-internal); each stage has `entry_preconditions`, `exit_conditions`, `authorized_mutations`, `forbidden_mutations`, and for PAUSE additionally `persistence_location` + `resume_trigger` + `re_entrance`. Forward edges + explicit regress edges + stage reset primitive. Covered by Phase 52a (state machine docs) + Phase 53 (wrapper integration).

- **IF-19**: Evidence model + 7-point Freshness Gate — 4 source tiers (deterministic required / deterministic derived / optional-pasted / unavailable). Freshness Gate runs as Router Step 0 before every stage decision. Drift → UNKNOWN + drift report. Risk-level-keyed drift policy (read_only soft-fresh, local_mutate soft-fresh+warn, repo_mutate/official hard-block, remote/external hard-block + double-ACK). Covered by Phase 52a (spec + docs) + Phase 52b (runtime classifier/collector + enforcement).

- **IF-20**: Route Decision JSON Schema (draft-07) — `kind: route-decision`, `version: 1`, required fields `ts`, `freshness`, `current_stage`, `recommended_next`, `confidence` (0-1 numeric), `reason[]` (minItems 1), `preconditions.{satisfied,missing}`, `action.{command,mode}`, `approval_envelope.{risk_level,triggers_required}`. Ephemeral tier at `.sun/router/session/*.json` (gitignored, 14-day prune). Durable tier at `.planning/router/decisions/*.json` (git-tracked) with deterministic promotion criteria (RELEASE/COMPOUND/milestone-close/freshness-conflicted/first-per-phase/explicit-durable). Covered by Phase 52a (schema + persistence spec) + Phase 52b (writer runtime).

- **IF-21**: Approval Boundary — 6 risk levels (read_only / local_mutate / repo_mutate_official / repo_mutate / remote_mutate / external_mutate) with `repo_mutate_official` defined as a **class** (inclusive: official planning artifacts under `.planning/` + `.claude/rules/` + memory + backlog + SDI counter; explicit exceptions: `.planning/router/decisions/`, `.planning/router/paused-state.json`, `.planning/router/archive/`, `.sun/`, compound draft writes). Blessed orchestrator batched-ACK for `/sunco:execute`, `/sunco:verify`, `/sunco:release`. Forbidden-without-ACK hard-lock list (push/tag/publish/npm-login/dep-install/rm-rf/memory-rules mutation/schema mutation/network fetch). Covered by Phase 52a (docs + class definition) + Phase 52b (runtime enforcement).

### Compound Engine (M6)

- **IF-22**: Compound-router — post-stage hook with trigger-score model (RELEASE/MILESTONE always-on; others score-gated with SDI-observational +2 / spec-rule-prescriptive +3 / CI-recovery +2 / post-judge fix +3 / rollback anchor +2 / plan debt +1 / gate RED/YELLOW +1 / user correction +1; dampeners for docs-only -3 / no-new-debt -2 / window-too-short -2). Artifact auto-write to `.planning/compound/<scope>-<ref>-<date>.md` with 8 required sections (context/learnings/patterns/automation/seeds/memory/rules/approval-log); sink proposals (memory/rules/backlog/SDI) as proposal-only requiring user ACK. `compound.schema.json` with `status` lifecycle (draft→proposed→partially-approved→approved→archived). Covered by Phase 54.

### Router Dogfood (M6)

- **IF-23**: Router dogfood — 5 fixture scenarios under `test/fixtures/router/`: (1) greenfield new feature → BRAINSTORM, (2) bugfix mid-phase → WORK, (3) release completion → COMPOUND always-on, (4) incident recovery with rollback → COMPOUND score ≥5 + SDI candidate, (5) milestone close → COMPOUND always-on. Deterministic assertions per scenario (stage enum + confidence band + compound artifact expectation + approval_envelope.risk_level). Retroactive v1.4 compound artifact at `.planning/compound/release-v0.12.0-20260420.md` + route decision log backfill for v1.4 window. Covered by Phase 55.

**Coverage by phase (v1.5)**:
| Phase | Reqs | IDs |
|-------|------|-----|
| 52a Router core schemas + state machine docs | 4 | IF-18, IF-20, (spec) IF-19, (spec) IF-21 |
| 52b Router classifier + evidence + runtime | 2 | (runtime) IF-19, (enforcement) IF-21 |
| 53 Router wrappers | 4 | (integration) IF-18, IF-19, IF-20, IF-21 |
| 54 Compound-router | 1 | IF-22 |
| 55 Router dogfood | 1 | IF-23 |
| 56 Release-router hardening (provisional) | (cross-cut) | IF-21 (release approval envelope) |
| 57 `/sunco:auto` (deferred) | (cross-cut) | IF-21 (auto-safe boundary) |

Hard-lock common to v1.5 phases: `.github/workflows/ci.yml` untouched (v1.4 Path-A continuation); no mutations to `finding.schema.json`, `cross-domain.schema.json`, `ui-spec.schema.json`; no modifications to existing stage commands except Phase 53/56 scoped wrappers; `/sunco:auto` frozen until Phase 57.

---

## v1.6 Requirements — Proof-first Runtime Foundation

Source: `docs/architecture/runtime-foundation.md` (Phase 58). M7 reframes SUNCO from command-heavy skill pack toward proof-first runtime: tasks cannot be marked done without evidence.

### Runtime Core (M7)

- **IF-24**: Runtime Architecture Contract — define product constitution (`No evidence, no done` and related laws), M7 package boundaries, task/evidence/done/edit/verify contracts, deferred surfaces, and the first runtime vertical slice. Covered by Phase 58.

- **IF-25**: Core Types + Schemas — define canonical records for `Task`, `TaskStatus`, `RiskLevel`, `EvidenceRecord`, `CheckResult`, `DoneGateResult`, `ApprovalRecord`, `EditTransaction`, and `RuntimeDecision`. Types must support future agent-adapter/code-intel interfaces without requiring those packages in M7. Covered by Phase 59.

- **IF-26**: Evidence Store — persist task-scoped evidence under `.sunco/tasks/<task-id>/` with `task.json`, `evidence.json`, `checks/`, `diffs/`, and append-only `decisions.jsonl`. Missing evidence is a blocker, not a warning. Covered by Phase 60.

- **IF-27**: Verify Engine — detect JavaScript/TypeScript verification commands from package-manager and package-script signals, run selected checks, capture logs, summarize results, and write `CheckResult` evidence. Covered by Phase 61.

- **IF-28**: Done Gate — block completion when evidence is missing, required checks failed or were not run, approval is missing, risk exceeds approval boundary, unresolved failures remain, or edit evidence is stale/failed. Covered by Phase 62.

- **IF-29**: Hash Edit Engine — capture before hashes, detect changed files, store diff patches, store rollback patches, and detect stale context before applying or accepting edit evidence. Covered by Phase 63.

- **IF-30**: Runtime Loop MVP — provide a finite loop shell that can create/accept a task, observe or execute edits, collect edit evidence, run verifier, run Done Gate, and report `done` or `blocked`. Covered by Phase 64.

- **IF-31**: Simple UX — front-door flow centers on `sunco do`, `sunco verify`, `sunco status`, and `sunco ship` plus slash equivalents. Existing advanced commands remain installed but are no longer the primary first-use path. Covered by Phase 65.

- **IF-32**: Benchmark Seed — create first benchmark seeds for false-done prevention and basic bugfix flow with metrics `false_done_prevented`, `checks_required`, `checks_passed`, `user_interventions`, and `time_to_green`. Covered by Phase 66.

- **IF-33**: v1.6 Release Hardening — release notes, migration docs, final verification, and runtime-foundation evidence for publish. Covered by Phase 67.

**Coverage by phase (v1.6/M7)**:
| Phase | Reqs | IDs |
|-------|------|-----|
| 58 Runtime Architecture Contract | 1 | IF-24 |
| 59 Core Types + Schemas | 1 | IF-25 |
| 60 Evidence Store | 1 | IF-26 |
| 61 Verify Engine | 1 | IF-27 |
| 62 Done Gate | 1 | IF-28 |
| 63 Hash Edit Engine | 1 | IF-29 |
| 64 Runtime Loop MVP | 1 | IF-30 |
| 65 Simple UX | 1 | IF-31 |
| 66 Benchmark Seed | 1 | IF-32 |
| 67 v1.6 Release Hardening | 1 | IF-33 |

M7 excluded surfaces: TUI, Studio/web UI, full LSP, multi-agent runtime, marketplace, all-language verifier support, and full code-intel graph.

---

## M8 Requirements — Productization Gate

Source: M7 verification review and Phase 68 productization context. M8 closes the gap between source-tree runtime correctness and installed-product runtime correctness.

Status on 2026-04-27: IF-34 through IF-38 are implemented locally. External npm publish and registry verification remain blocked until npm credentials or a GitHub `NPM_TOKEN` secret exists.

### Productization Core (M8)

- **IF-34**: Runtime Front Door Productization — `sunco-runtime` must be exposed as an npm bin and installed into each runtime home as an executable front door. Installed runtime directories must not require unpublished workspace packages. Covered by Phase 68.

- **IF-35**: Release Artifact Gate — validate `npm pack -> clean npm prefix install -> temp HOME runtime install -> installed sunco-runtime do/status/verify/ship` across Claude, Codex, Cursor, and Antigravity. Covered by Phase 68 and Phase 69.

- **IF-36**: Version/Release Truth — package version, README, STATE, release docs, changelog, git tag, npm publish, registry verification, and canary language must describe the same artifact state. Covered by Phase 70.

- **IF-37**: Install Matrix — release verification must cover supported Node versions, operating systems, package-manager paths, and clean HOME installs. Covered by Phase 71.

- **IF-38**: Dogfood Release Evidence — SUNCO's own release must be represented as `.sunco/tasks/<release-id>/` evidence before publish. Covered by Phase 72.

**Coverage by phase (M8)**:
| Phase | Reqs | IDs |
|-------|------|-----|
| 68 Runtime Front Door Productization | 2 | IF-34, IF-35 |
| 69 Release Artifact Gate CI | 1 | IF-35 |
| 70 Version/Release Truth | 1 | IF-36 |
| 71 Install Matrix | 1 | IF-37 |
| 72 Dogfood Release Evidence | 1 | IF-38 |

M8 excluded surfaces: approval UX, true stale-edit preflight authority, loop guardrails, evidence durability hash-chain, benchmark runner, and full ship/release semantics. Those move to M9-M12.

---

## v2 Requirements

### Extension Skills

- **EXT-04**: `sunco design` -- 디자인 시스템 + UI 스타일 가이드 + `sunco ui-spec` 계약서

### SUNCO Terminal

- **TRM-01**: Agent PTY View -- 에이전트 실시간 작업 관찰 (다수 동시)
- **TRM-02**: Dashboard View -- 진행도 + 건강도 + 컨텍스트 + Next Best Action
- **TRM-03**: Agent Control -- 일시정지/개입/인계
- **TRM-04**: Korean IME -- 한국어 입력 완벽 지원
- **TRM-05**: Recommender Widget -- Proactive Recommender 시각화
- **TRM-06**: Swift/AppKit 네이티브 + libghostty 터미널 에뮬레이션
- **TRM-07**: IPC -- Unix Domain Socket + JSON-RPC로 CLI와 통신

## Out of Scope

| Feature | Reason |
|---------|--------|
| 웹 UI / SaaS 대시보드 | 터미널 네이티브, 브라우저 불필요 |
| 자체 LLM 호스팅 | Provider-agnostic이지만 직접 모델 호스팅 안 함 |
| 팀 협업 (RBAC, 팀 대시보드) | 1인 빌더 최적화. 팀 기능은 성장 후 |
| GSD 코드 복사/포크 | Clean room -- 개념만 참고, 처음부터 작성 |
| 모바일 앱 | 터미널 + CLI 우선 |
| Windows/Linux 터미널 | v2 Terminal은 macOS 우선 (Swift/AppKit) |
| 에이전트 자동 생성 안내문 | ETH Zurich 연구: 자동 생성은 오히려 성능 저하. 분석+제안만 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1: Core Platform | Complete |
| CLI-02 | Phase 1: Core Platform | Complete |
| CLI-03 | Phase 1: Core Platform | Complete |
| CLI-04 | Phase 1: Core Platform | Complete |
| CFG-01 | Phase 1: Core Platform | Complete |
| CFG-02 | Phase 1: Core Platform | Complete |
| CFG-03 | Phase 1: Core Platform | Complete |
| CFG-04 | Phase 1: Core Platform | Complete |
| SKL-01 | Phase 1: Core Platform | Complete |
| SKL-02 | Phase 1: Core Platform | Complete |
| SKL-03 | Phase 1: Core Platform | Complete |
| SKL-04 | Phase 1: Core Platform | Complete |
| SKL-05 | Phase 1: Core Platform | Complete |
| SKL-06 | Phase 1: Core Platform | Complete |
| STE-01 | Phase 1: Core Platform | Complete |
| STE-02 | Phase 1: Core Platform | Complete |
| STE-03 | Phase 1: Core Platform | Complete |
| STE-04 | Phase 1: Core Platform | Complete |
| STE-05 | Phase 1: Core Platform | Complete |
| AGT-01 | Phase 1: Core Platform | Complete |
| AGT-02 | Phase 1: Core Platform | Complete |
| AGT-03 | Phase 1: Core Platform | Complete |
| AGT-04 | Phase 1: Core Platform | Complete |
| AGT-05 | Phase 1: Core Platform | Complete |
| AGT-06 | Phase 1: Core Platform | Complete |
| REC-01 | Phase 1: Core Platform | Complete |
| REC-02 | Phase 1: Core Platform | Complete |
| REC-03 | Phase 1: Core Platform | Complete |
| REC-04 | Phase 1: Core Platform | Complete |
| UX-01 | Phase 1: Core Platform | Complete |
| UX-02 | Phase 1: Core Platform | Complete |
| UX-03 | Phase 1: Core Platform | Complete |
| HRN-01 | Phase 2: Harness Skills | Complete |
| HRN-02 | Phase 2: Harness Skills | Complete |
| HRN-03 | Phase 2: Harness Skills | Complete |
| HRN-04 | Phase 2: Harness Skills | Complete |
| HRN-05 | Phase 2: Harness Skills | Complete |
| HRN-06 | Phase 2: Harness Skills | Complete |
| HRN-07 | Phase 2: Harness Skills | Complete |
| HRN-08 | Phase 2: Harness Skills | Complete |
| HRN-09 | Phase 2: Harness Skills | Complete |
| HRN-10 | Phase 2: Harness Skills | Complete |
| HRN-11 | Phase 2: Harness Skills | Complete |
| HRN-12 | Phase 2: Harness Skills | Complete |
| HRN-13 | Phase 2: Harness Skills | Complete |
| HRN-14 | Phase 2: Harness Skills | Complete |
| HRN-15 | Phase 2: Harness Skills | Complete |
| HRN-16 | Phase 2: Harness Skills | Complete |
| SES-01 | Phase 3: Standalone TS Skills | Complete |
| SES-02 | Phase 3: Standalone TS Skills | Complete |
| SES-03 | Phase 3: Standalone TS Skills | Complete |
| SES-04 | Phase 3: Standalone TS Skills | Complete |
| SES-05 | Phase 3: Standalone TS Skills | Complete |
| IDX-01 | Phase 3: Standalone TS Skills | Complete |
| IDX-02 | Phase 3: Standalone TS Skills | Complete |
| IDX-03 | Phase 3: Standalone TS Skills | Complete |
| IDX-04 | Phase 3: Standalone TS Skills | Complete |
| PHZ-01 | Phase 3: Standalone TS Skills | Complete |
| PHZ-02 | Phase 3: Standalone TS Skills | Complete |
| PHZ-03 | Phase 3: Standalone TS Skills | Complete |
| SET-01 | Phase 3: Standalone TS Skills | Complete |
| WF-08 | Phase 3: Standalone TS Skills | Complete |
| WF-01 | Phase 4: Project Initialization | Complete |
| WF-02 | Phase 4: Project Initialization | Complete |
| WF-09 | Phase 5: Context + Planning | Complete |
| WF-10 | Phase 5: Context + Planning | Complete |
| WF-11 | Phase 5: Context + Planning | Complete |
| WF-12 | Phase 5: Context + Planning | Complete |
| WF-13 | Phase 6: Execution + Review | Complete |
| WF-14 | Phase 6: Execution + Review | Complete |
| VRF-01 | Phase 7: Verification Pipeline | Complete |
| VRF-02 | Phase 7: Verification Pipeline | Complete |
| VRF-03 | Phase 7: Verification Pipeline | Complete |
| VRF-04 | Phase 7: Verification Pipeline | Complete |
| VRF-05 | Phase 7: Verification Pipeline | Complete |
| VRF-06 | Phase 7: Verification Pipeline | Complete |
| VRF-07 | Phase 7: Verification Pipeline | Complete |
| VRF-08 | Phase 7: Verification Pipeline | Complete |
| VRF-09 | Phase 7: Verification Pipeline | Complete |
| VRF-10 | Phase 7: Verification Pipeline | Complete |
| VRF-11 | Phase 7: Verification Pipeline | Complete |
| REV-01 | Phase 7: Verification Pipeline | Complete |
| REV-02 | Phase 7: Verification Pipeline | Complete |
| REV-03 | Phase 7: Verification Pipeline | Complete |
| REV-04 | Phase 7: Verification Pipeline | Complete |
| SHP-01 | Phase 8: Shipping + Milestones | Complete |
| SHP-02 | Phase 8: Shipping + Milestones | Complete |
| WF-03 | Phase 8: Shipping + Milestones | Complete |
| WF-04 | Phase 8: Shipping + Milestones | Complete |
| WF-05 | Phase 8: Shipping + Milestones | Complete |
| WF-06 | Phase 8: Shipping + Milestones | Complete |
| WF-07 | Phase 8: Shipping + Milestones | Complete |
| WF-15 | Phase 9: Composition Skills | Complete |
| WF-16 | Phase 9: Composition Skills | Complete |
| WF-17 | Phase 9: Composition Skills | Complete |
| WF-18 | Phase 9: Composition Skills | Complete |
| DBG-01 | Phase 10: Debugging | Complete |
| DBG-02 | Phase 10: Debugging | Complete |
| DBG-03 | Phase 10: Debugging | Complete |

**Coverage:**
- v1 requirements: 99 total
- Mapped to phases: 99
- Unmapped: 0

**Coverage by phase:**
| Phase | Reqs | IDs |
|-------|------|-----|
| Phase 1: Core Platform | 32 | CLI-01~04, CFG-01~04, SKL-01~06, STE-01~05, AGT-01~06, REC-01~04, UX-01~03 |
| Phase 2: Harness Skills | 16 | HRN-01~16 |
| Phase 3: Standalone TS Skills | 14 | SES-01~05, IDX-01~04, PHZ-01~03, SET-01, WF-08 |
| Phase 4: Project Initialization | 2 | WF-01, WF-02 |
| Phase 5: Context + Planning | 4 | WF-09~12 |
| Phase 6: Execution + Review | 2 | WF-13, WF-14 |
| Phase 7: Verification Pipeline | 15 | VRF-01~11, REV-01~04 |
| Phase 8: Shipping + Milestones | 7 | SHP-01~02, WF-03~07 |
| Phase 9: Composition Skills | 4 | WF-15~18 |
| Phase 10: Debugging | 3 | DBG-01~03 |
| **Total** | **99** | |

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation (10 phases, 99 requirements)*
