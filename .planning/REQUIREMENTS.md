# Requirements: SUN (sunco)

**Defined:** 2026-03-27
**Core Value:** 에이전트가 실수를 덜 하게 판을 깔아주는 OS -- 하네스 엔지니어링이 핵심

## v1 Requirements

### Core Platform -- CLI Engine

- [x] **CLI-01**: `sunco` 바이너리가 npm으로 설치 가능 (npx sunco / npm install -g sunco)
- [ ] **CLI-02**: Commander.js 기반 서브커맨드 라우팅, 스킬 자동 발견/등록
- [ ] **CLI-03**: `sunco --help` / `sunco <skill> --help`로 도움말 표시
- [ ] **CLI-04**: 스킬 미설치/미발견 시 명확한 에러 메시지 + 추천

### Core Platform -- Config System

- [x] **CFG-01**: TOML 파일 파싱 (smol-toml), 계층적 오버라이드: global(~/.sun/config.toml) -> project(.sun/config.toml) -> directory(src/.sun.toml)
- [x] **CFG-02**: 배열 병합 시 상위 레벨 값을 대체(replace), 객체는 deep merge
- [x] **CFG-03**: 설정 값 타입 검증 (Zod 스키마)
- [ ] **CFG-04**: `sunco settings` 스킬로 설정 조회/변경 가능

### Core Platform -- Skill System

- [ ] **SKL-01**: Skill 인터페이스 정의: name, description, type(deterministic/prompt/hybrid), execute(ctx)
- [ ] **SKL-02**: SkillContext 제공: config, state, agentRouter, recommend, run(skillName)
- [ ] **SKL-03**: 스킬 로더가 packages/skills-*에서 자동 발견 + 레지스트리 등록
- [ ] **SKL-04**: 결정적 스킬은 Agent Router를 사용하지 않음 (LLM 비용 0)
- [ ] **SKL-05**: Prompt 스킬은 Agent Router를 통해 에이전트 디스패치
- [ ] **SKL-06**: ctx.run('lint') 형태로 스킬 간 직접 호출 가능

### Core Platform -- State Engine

- [x] **STE-01**: .sun/ 디렉토리 구조 관리 (state/, rules/, tribal/, scenarios/, planning/)
- [x] **STE-02**: SQLite WAL 모드로 구조화 상태 저장 (better-sqlite3, busy_timeout=5000)
- [x] **STE-03**: 플랫 파일로 사람이 읽을 수 있는 아티팩트 (규칙, 부족 지식, 계획 등)
- [x] **STE-04**: 병렬 에이전트 쓰기 시 데이터 손상 방지 (파일 잠금 + SQLite WAL)
- [x] **STE-05**: 상태 저장/복원 API (세션 간 연속성)

### Core Platform -- Agent Router

- [ ] **AGT-01**: Provider 추상화 레이어: AgentProvider 인터페이스
- [ ] **AGT-02**: Claude Code CLI 첫 번째 provider 구현
- [ ] **AGT-03**: 에이전트 권한 스코핑: PermissionSet (read/write/execute/deny 글롭 패턴)
- [ ] **AGT-04**: 연구=읽기전용, 계획=.planning/만, 실행=src/만, 검증=읽기+테스트만
- [ ] **AGT-05**: 크로스 검증: 여러 provider에게 독립적으로 검증 요청 가능
- [ ] **AGT-06**: 토큰/비용 추적 (provider별 사용량 기록)

### Core Platform -- Proactive Recommender

- [ ] **REC-01**: 룰 엔진 기반 (state, lastResult) -> Recommendation[] 매핑
- [ ] **REC-02**: 모든 스킬 실행 끝에 Next Best Action 추천 표시
- [ ] **REC-03**: 상태 기반 라우팅: execute 끝->verify, verify 실패->debug, verify 성공->ship
- [ ] **REC-04**: 추천 규칙 20-50개, 결정적 (LLM 사용 안 함), sub-ms 응답

### Harness Skills

- [ ] **HRN-01**: `sunco init` -- 기술스택 감지 (package.json, tsconfig, Cargo.toml, go.mod 등 15+ 에코시스템)
- [ ] **HRN-02**: `sunco init` -- 디렉토리 구조 -> 레이어 패턴 감지 (Types->Config->Service->Handler->UI)
- [ ] **HRN-03**: `sunco init` -- 코드에서 컨벤션 추출 (네이밍, 패턴, import 스타일)
- [ ] **HRN-04**: `sunco init` -- .sun/ 워크스페이스 초기화 + 규칙 자동 생성 + 프로젝트 타입별 기본 템플릿
- [ ] **HRN-05**: `sunco lint` -- init이 감지한 레이어 구조 -> ESLint rule 자동 생성 (eslint-plugin-boundaries)
- [ ] **HRN-06**: `sunco lint` -- 의존성 방향 위반 검사 (UI->DB 직접 import 잡음)
- [ ] **HRN-07**: `sunco lint` -- 에러 메시지가 에이전트가 이해하는 수정 지시 형태 ("린터가 가르치면서 막는다")
- [ ] **HRN-08**: `sunco lint` -- 100% 결정적, --fix 옵션으로 자동 수정
- [ ] **HRN-09**: `sunco health` -- 문서 위생: 코드와 동기 안 되는 문서 감지, 교차참조 깨짐, 문서 나이
- [ ] **HRN-10**: `sunco health` -- 패턴 건강도: 안티패턴 확산 추적 ("any 타입이 3파일->12파일"), 트렌드
- [ ] **HRN-11**: `sunco health` -- 점수 기반 리포트 (숫자로 보여줌)
- [ ] **HRN-12**: `sunco agents` -- CLAUDE.md/agents.md/AGENTS.md 분석, 효율성 점수, 60줄 이하 검증
- [ ] **HRN-13**: `sunco agents` -- 분석+제안만, 자동 생성 안 함 (ETH Zurich 연구 반영)
- [ ] **HRN-14**: `sunco guard` -- 안티패턴 감지 -> 린터 규칙 자동 승격 제안
- [ ] **HRN-15**: `sunco guard` -- 매 에이전트 변경 후 자동 린트 (auto-lint-after-change)
- [ ] **HRN-16**: `sunco guard` -- `sunco watch` 모드: 파일 변경 실시간 감시

### Workflow -- 초기화 + 마일스톤

- [ ] **WF-01**: `sunco new` -- 아이디어->질문->병렬 리서치->요구사항->로드맵 자동 생성
- [ ] **WF-02**: `sunco scan` -- 기존 코드베이스 7개 문서 분석
- [ ] **WF-03**: `sunco milestone new` -- 다음 마일스톤 시작 (질문->리서치->요구사항->로드맵)
- [ ] **WF-04**: `sunco milestone audit` -- 마일스톤 달성도 검증 (의도 vs 실제)
- [ ] **WF-05**: `sunco milestone complete` -- 아카이브 + 태그 + 다음 준비
- [ ] **WF-06**: `sunco milestone summary` -- 종합 보고서 (온보딩/리뷰용)
- [ ] **WF-07**: `sunco milestone gaps` -- audit 격차 -> 추가 페이즈 생성
- [ ] **WF-08**: `sunco progress` -- 전체 진행 상황 + 다음 액션 라우팅

### Workflow -- 맥락 + 계획

- [ ] **WF-09**: `sunco discuss` -- 비전 추출, 디자인 결정, 수용 기준 + Holdout 시나리오 생성 -> CONTEXT.md
- [ ] **WF-10**: `sunco assume` -- 에이전트 접근 방식 미리보기 (교정 기회)
- [ ] **WF-11**: `sunco research` -- 병렬 에이전트 도메인 리서치
- [ ] **WF-12**: `sunco plan` -- 실행 계획 + BDD 시나리오 기반 완료 조건 + plan-checker 검증 루프

### Workflow -- 실행 + 리뷰

- [ ] **WF-13**: `sunco review` -- 멀티에이전트 크로스 리뷰 (--codex --gemini 플래그)
- [ ] **WF-14**: `sunco execute` -- 웨이브 기반 병렬 실행 + 원자적 커밋 + Git worktree 격리

### Workflow -- 조합

- [ ] **WF-15**: `sunco auto` -- 전체 남은 페이즈 자율 실행 (discuss->plan->execute->verify 체인). 블로커/회색지대만 멈춤
- [ ] **WF-16**: `sunco quick` -- 경량 작업 (--discuss/--research/--full 플래그)
- [ ] **WF-17**: `sunco fast` -- 즉시 실행, 계획 스킵
- [ ] **WF-18**: `sunco do` -- 자연어->스킬 자동 라우팅

### Workflow -- 검증 (Review Architecture)

- [ ] **VRF-01**: `sunco verify` -- Layer 1: Multi-Agent Generation (여러 에이전트 독립 검증)
- [ ] **VRF-02**: `sunco verify` -- Layer 2: Deterministic Guardrails (sunco lint + guard + pre-commit)
- [ ] **VRF-03**: `sunco verify` -- Layer 3: Human-Defined Acceptance Criteria (BDD 시나리오)
- [ ] **VRF-04**: `sunco verify` -- Layer 4: Agent Permission Scoping (역할별 권한)
- [ ] **VRF-05**: `sunco verify` -- Layer 5: Adversarial Verification (실행 != 검증 에이전트)
- [ ] **VRF-06**: `sunco verify` -- 전문가 에이전트: Security, Performance, Architecture, Correctness + Coordinator
- [ ] **VRF-07**: `sunco verify` -- Intent Reconstruction: diff가 아닌 의도 대비 결과
- [ ] **VRF-08**: `sunco verify` -- Scenario Holdout: .sun/scenarios/ (코딩 에이전트 접근 불가, 검증 에이전트만)
- [ ] **VRF-09**: `sunco verify` -- 나이퀴스트 원칙: 태스크 단위(50-100줄) 즉시 검증
- [ ] **VRF-10**: `sunco validate` -- 테스트 커버리지 감사 (결정적)
- [ ] **VRF-11**: `sunco test-gen` -- 유닛/E2E 테스트 자동 생성 + --mock-external (Digital Twin Mock 서버)

### Workflow -- 출시

- [ ] **SHP-01**: `sunco ship` -- PR 생성 + 5겹 필터 통과 확인 + 자동/수동 게이트
- [ ] **SHP-02**: `sunco release` -- 버전 태깅 + 아카이브 + npm publish

### Workflow -- 세션 관리

- [ ] **SES-01**: `sunco status` -- 현재 상태 요약 (어디에 있는지, 뭐가 남았는지)
- [ ] **SES-02**: `sunco next` -- 상태->다음 스킬 자동 라우팅
- [ ] **SES-03**: `sunco resume` -- HANDOFF.json -> 이전 세션 복원
- [ ] **SES-04**: `sunco pause` -- 세션 중단 시 HANDOFF.json 생성
- [ ] **SES-05**: `sunco context` -- 현재 결정/블로커/다음 액션 요약

### Workflow -- 디버깅

- [ ] **DBG-01**: `sunco debug` -- 실패 유형 분류 (컨텍스트 부족/방향 오류/구조 충돌) + 근본 원인 + 수정 제안
- [ ] **DBG-02**: `sunco diagnose` -- 결정적 로그 분석 (빌드/테스트)
- [ ] **DBG-03**: `sunco forensics` -- 워크플로우 실패 사후 분석 (git 히스토리 + .sun/)

### Workflow -- 아이디어 캡처

- [ ] **IDX-01**: `sunco note` -- 마찰 없는 메모 + `--tribal` 부족 지식 저장
- [ ] **IDX-02**: `sunco todo` -- 할 일 추가/목록/완료
- [ ] **IDX-03**: `sunco seed` -- 미래 아이디어 + 트리거 조건 (조건 충족 시 자동 표면화)
- [ ] **IDX-04**: `sunco backlog` -- 백로그 주차장

### Workflow -- 페이즈 관리

- [ ] **PHZ-01**: `sunco phase add` -- 로드맵에 페이즈 추가
- [ ] **PHZ-02**: `sunco phase insert` -- 페이즈 사이에 긴급 작업 삽입 (소수점 번호)
- [ ] **PHZ-03**: `sunco phase remove` -- 미래 페이즈 제거 + 번호 재지정

### Workflow -- 설정

- [ ] **SET-01**: `sunco settings` -- TOML 설정 조회/변경 인터랙티브 UI

### Review Architecture (전 영역 관통)

- [ ] **REV-01**: 6단계 리뷰 파이프라인 (아이디어->스펙->플랜->실행->검증->배포) 각 단계에서 해당 스킬 자동 연결
- [ ] **REV-02**: Tribal Knowledge Store (.sun/tribal/) -- sunco note --tribal로 캡처, sunco verify가 자동 로드
- [ ] **REV-03**: Human Gate -- 부족 지식 + 규제 경로만 사람이 블로킹, 나머지 자동
- [ ] **REV-04**: Digital Twin -- sunco test-gen --mock-external이 API 문서->모방 서버 생성

### 인터랙티브 UX

- [ ] **UX-01**: 모든 의사결정 지점에서 선택지 제시 (옵션 2-4개 + 설명 + Recommended 태그)
- [ ] **UX-02**: 프로액티브 추천: 모든 스킬 실행 끝에 다음 스킬 추천
- [ ] **UX-03**: 시각적 피드백: 진행도 바, 상태 심볼, 스포닝 인디케이터, 에러 박스
- [ ] **UX-04**: 상태바: 모델 사용량(토큰 %) + 세션 컨텍스트 사용량(%) + provider명 항상 표시 (Claude Code 하단바 패턴)
- [ ] **UX-05**: 상태바: 에이전트 실행 중 실시간 업데이트, 비용 누적 표시

## v2 Requirements

### Extension Skills

- **EXT-01**: `sunco search:kr` -- 네이버 트렌드, 카카오, 국내 스타트업, 규제 환경. 한국어 NLP
- **EXT-02**: `sunco search:paper` -- arXiv, Scholar, Semantic Scholar, DBpia, RISS, KCI. 인용 네트워크
- **EXT-03**: `sunco search:patent` -- KIPRIS, USPTO, Google Patents. 선행기술 조사
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
| CLI-02 | Phase 1: Core Platform | Pending |
| CLI-03 | Phase 1: Core Platform | Pending |
| CLI-04 | Phase 1: Core Platform | Pending |
| CFG-01 | Phase 1: Core Platform | Complete |
| CFG-02 | Phase 1: Core Platform | Complete |
| CFG-03 | Phase 1: Core Platform | Complete |
| CFG-04 | Phase 1: Core Platform | Pending |
| SKL-01 | Phase 1: Core Platform | Pending |
| SKL-02 | Phase 1: Core Platform | Pending |
| SKL-03 | Phase 1: Core Platform | Pending |
| SKL-04 | Phase 1: Core Platform | Pending |
| SKL-05 | Phase 1: Core Platform | Pending |
| SKL-06 | Phase 1: Core Platform | Pending |
| STE-01 | Phase 1: Core Platform | Complete |
| STE-02 | Phase 1: Core Platform | Complete |
| STE-03 | Phase 1: Core Platform | Complete |
| STE-04 | Phase 1: Core Platform | Complete |
| STE-05 | Phase 1: Core Platform | Complete |
| AGT-01 | Phase 1: Core Platform | Pending |
| AGT-02 | Phase 1: Core Platform | Pending |
| AGT-03 | Phase 1: Core Platform | Pending |
| AGT-04 | Phase 1: Core Platform | Pending |
| AGT-05 | Phase 1: Core Platform | Pending |
| AGT-06 | Phase 1: Core Platform | Pending |
| REC-01 | Phase 1: Core Platform | Pending |
| REC-02 | Phase 1: Core Platform | Pending |
| REC-03 | Phase 1: Core Platform | Pending |
| REC-04 | Phase 1: Core Platform | Pending |
| UX-01 | Phase 1: Core Platform | Pending |
| UX-02 | Phase 1: Core Platform | Pending |
| UX-03 | Phase 1: Core Platform | Pending |
| HRN-01 | Phase 2: Harness Skills | Pending |
| HRN-02 | Phase 2: Harness Skills | Pending |
| HRN-03 | Phase 2: Harness Skills | Pending |
| HRN-04 | Phase 2: Harness Skills | Pending |
| HRN-05 | Phase 2: Harness Skills | Pending |
| HRN-06 | Phase 2: Harness Skills | Pending |
| HRN-07 | Phase 2: Harness Skills | Pending |
| HRN-08 | Phase 2: Harness Skills | Pending |
| HRN-09 | Phase 2: Harness Skills | Pending |
| HRN-10 | Phase 2: Harness Skills | Pending |
| HRN-11 | Phase 2: Harness Skills | Pending |
| HRN-12 | Phase 2: Harness Skills | Pending |
| HRN-13 | Phase 2: Harness Skills | Pending |
| HRN-14 | Phase 2: Harness Skills | Pending |
| HRN-15 | Phase 2: Harness Skills | Pending |
| HRN-16 | Phase 2: Harness Skills | Pending |
| SES-01 | Phase 3: Standalone TS Skills | Pending |
| SES-02 | Phase 3: Standalone TS Skills | Pending |
| SES-03 | Phase 3: Standalone TS Skills | Pending |
| SES-04 | Phase 3: Standalone TS Skills | Pending |
| SES-05 | Phase 3: Standalone TS Skills | Pending |
| IDX-01 | Phase 3: Standalone TS Skills | Pending |
| IDX-02 | Phase 3: Standalone TS Skills | Pending |
| IDX-03 | Phase 3: Standalone TS Skills | Pending |
| IDX-04 | Phase 3: Standalone TS Skills | Pending |
| PHZ-01 | Phase 3: Standalone TS Skills | Pending |
| PHZ-02 | Phase 3: Standalone TS Skills | Pending |
| PHZ-03 | Phase 3: Standalone TS Skills | Pending |
| SET-01 | Phase 3: Standalone TS Skills | Pending |
| WF-08 | Phase 3: Standalone TS Skills | Pending |
| WF-01 | Phase 4: Project Initialization | Pending |
| WF-02 | Phase 4: Project Initialization | Pending |
| WF-09 | Phase 5: Context + Planning | Pending |
| WF-10 | Phase 5: Context + Planning | Pending |
| WF-11 | Phase 5: Context + Planning | Pending |
| WF-12 | Phase 5: Context + Planning | Pending |
| WF-13 | Phase 6: Execution + Review | Pending |
| WF-14 | Phase 6: Execution + Review | Pending |
| VRF-01 | Phase 7: Verification Pipeline | Pending |
| VRF-02 | Phase 7: Verification Pipeline | Pending |
| VRF-03 | Phase 7: Verification Pipeline | Pending |
| VRF-04 | Phase 7: Verification Pipeline | Pending |
| VRF-05 | Phase 7: Verification Pipeline | Pending |
| VRF-06 | Phase 7: Verification Pipeline | Pending |
| VRF-07 | Phase 7: Verification Pipeline | Pending |
| VRF-08 | Phase 7: Verification Pipeline | Pending |
| VRF-09 | Phase 7: Verification Pipeline | Pending |
| VRF-10 | Phase 7: Verification Pipeline | Pending |
| VRF-11 | Phase 7: Verification Pipeline | Pending |
| REV-01 | Phase 7: Verification Pipeline | Pending |
| REV-02 | Phase 7: Verification Pipeline | Pending |
| REV-03 | Phase 7: Verification Pipeline | Pending |
| REV-04 | Phase 7: Verification Pipeline | Pending |
| SHP-01 | Phase 8: Shipping + Milestones | Pending |
| SHP-02 | Phase 8: Shipping + Milestones | Pending |
| WF-03 | Phase 8: Shipping + Milestones | Pending |
| WF-04 | Phase 8: Shipping + Milestones | Pending |
| WF-05 | Phase 8: Shipping + Milestones | Pending |
| WF-06 | Phase 8: Shipping + Milestones | Pending |
| WF-07 | Phase 8: Shipping + Milestones | Pending |
| WF-15 | Phase 9: Composition Skills | Pending |
| WF-16 | Phase 9: Composition Skills | Pending |
| WF-17 | Phase 9: Composition Skills | Pending |
| WF-18 | Phase 9: Composition Skills | Pending |
| DBG-01 | Phase 10: Debugging | Pending |
| DBG-02 | Phase 10: Debugging | Pending |
| DBG-03 | Phase 10: Debugging | Pending |

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
