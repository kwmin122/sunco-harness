# Phase 1: Core Platform - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 01-core-platform
**Areas discussed:** Monorepo structure, Skill discovery, Claude Code integration, Interactive UX pattern

---

## Monorepo Structure

### Q1: 패키지 구조

| Option | Description | Selected |
|--------|-------------|----------|
| Monorepo | packages/core + skills-harness + skills-workflow + skills-extension. 독립 빌드/테스트. sunco 단일 번들 publish | ✓ |
| Single package | src/ 아래 도메인별 폴더. 빌드 단순. 스킬 늘어나면 나중에 분리 | |
| Core + Skills 분리 | 스킬 각각 독립 패키지 (49개). 최대 격리. 관리 비용 높음 | |

**User's choice:** Monorepo
**Notes:** 개발 시 독립 빌드/테스트, 배포 시 단일 번들의 장점을 모두 취함

### Q2: Workspace 관리자

| Option | Description | Selected |
|--------|-------------|----------|
| npm workspaces | Node 24 + npm 11 내장. 추가 도구 없음 | |
| pnpm workspaces | 빠른 install, 엄격한 의존성 격리 | |
| Turborepo + npm | npm workspaces 위에 빌드 캐시 + 병렬 빌드 | ✓ |

**User's choice:** Turborepo + npm
**Notes:** 빌드 캐시와 병렬 실행 이점

### Q3: npm publish 단위

| Option | Description | Selected |
|--------|-------------|----------|
| sunco 단일 번들 | tsup으로 전체 번들. npm에 하나만 publish | ✓ |
| 영역별 분리 publish | @sunco/core + @sunco/skills-harness + sunco aggregator | |

**User's choice:** sunco 단일 번들
**Notes:** 사용자 입장에서 가장 단순

---

## Skill Discovery

### Q1: 스킬 등록 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 컨벤션 기반 자동 스캔 | skills-*/src/ 자동 발견 + 빌드 타임 manifest | |
| 명시적 매니페스트 | skills.json 작성. 새 스킬마다 JSON 업데이트 | |
| 하이브리드 | 자동 스캔 발견 + 매니페스트 활성화 | ✓ |

**User's choice:** 하이브리드 (자동 스캔 발견 + 명시적 매니페스트 활성화)
**Notes:** "SUN은 단순 플러그인 모음이 아니라 스킬이 곧 OS의 실행 단위라서, DX와 운영 통제를 둘 다 잡아야 한다." 6가지 원칙 제시: (1) 스킬은 자기 메타데이터를 스스로 가져야 함 (2) 매니페스트는 '등록표'가 아니라 '정책 파일' (3) 자동 스캔은 엄격해야 함 (4) 스킬 ID와 CLI command 분리 (5) experimental/stable/canary 단계 (6) routable/directExec 구분

### Q2: 메타데이터 Source of Truth

| Option | Description | Selected |
|--------|-------------|----------|
| defineSkill() 함수 | 하나의 함수에 메타데이터 + 실행 로직. Zod 검증 | ✓ |
| TOML frontmatter | 파일 상단 TOML 블록. SUN TOML 기반 일관성 | |

**User's choice:** defineSkill() = source of truth, TOML = 정책만, frontmatter 안 씀
**Notes:** "정의(source of truth) = defineSkill(), 설정/활성 정책 = TOML, frontmatter = 안 쓰거나 써도 부가 정보만"

### Q3: 활성화 정책 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 화이트리스트 (기본 비활성) | 검증된 것만 켠다. 프리셋 + 개별 override | ✓ |
| 블랙리스트 (기본 활성) | 전체 활성, 비활성화할 것만 명시 | |

**User's choice:** 화이트리스트
**Notes:** "SUN은 모든 기능이 스킬이고, sun auto/do/next가 활성 스킬 집합을 신뢰해야 하므로 '검증된 것만 켠다'가 맞다. 기본 전체 활성화는 위험." 프리셋 + 개별 override, 내부는 항상 ID 집합으로 해소.

### Q4: 프리셋 구현

**User's choice:** 프리셋 + 개별 override
**Notes:** "실제 식별자는 개별 ID, 실용적 선택은 프리셋". 프리셋은 시스템 제공 registry. 해석 순서: scan → validate → preset 펼침 → add → remove → stage/provider/platform 필터. 충돌 정책: 중복 id/command → fail-fast.

---

## Claude Code Integration

### Q1: Agent Router 통신 방식

| Option | Description | Selected |
|--------|-------------|----------|
| execa subprocess | Claude Code CLI를 execa로 스폰. --print 모드 | |
| Vercel AI SDK 직접 | AI SDK 6.x로 Anthropic API 직접 호출 | |
| 둘 다 (이중 경로) | CLI + SDK, 동일 AgentProvider 계약. 태스크에 따라 선택 | ✓ |

**User's choice:** 이중 경로 아키텍처
**Notes:** "처음부터 이중 경로 아키텍처로 설계. Router는 transport 세부사항을 알면 안 된다." 5층 아키텍처: Router → Permission Harness → Provider Adapter → Result Normalizer → Cost Tracker. Provider = family + transport. 4가지 설계 원칙 제시.

### 구현 잠금핀 (User 제안)

1. **스트리밍**: Phase 1 비스트리밍 + 로그 수집
2. **취소/타임아웃**: AbortSignal + typed error + CLI kill/SDK cancel 공통
3. **에러 4종**: ProviderUnavailable, PermissionDenied, ExecutionTimeout, ProviderExecution
4. **아티팩트**: `Artifact { path, kind, description? }` 구조화 (bare string[] 아님으로 수정)
5. **권한 강제**: Phase 1에서 PermissionSet 6개 필드 전부 hard enforcement (최소 경로만에서 수정)

---

## Interactive UX Pattern

### Q1: UX 컴포넌트 아키텍처

| Option | Description | Selected |
|--------|-------------|----------|
| 공유 컴포넌트 라이브러리 | packages/core/src/ui/에 공유 Ink 컴포넌트 | |
| 스킬별 자유 UI | 각 스킬이 자체 UI 구현 | |
| 테마 시스템 포함 | 공유 컴포넌트 + 테마 토큰 | |
| 3층 구조 + ctx.ui | Primitives → Components → Patterns + 스킬은 ctx.ui만 | ✓ |

**User's choice:** 3층 구조 + ctx.ui 추상화
**Notes:** "공유 컴포넌트 라이브러리 중심, 작은 테마 시스템 포함, 스킬별 자유 UI는 escape hatch로만." 3층: Primitives (Ink 래퍼) → Components → Patterns (핵심). "SUN에서 진짜 중요한 건 컴포넌트보다 패턴이다." ctx.ui로 UI 추상화 — 스킬은 Ink를 모름. 2계층 인터페이스: SkillUi (스킬 계약) + UiAdapter (렌더러 계약). 의도 중심 pattern API. progress는 ProgressHandle 반환. ask()는 UiChoiceResult 반환. StatusBar는 세션 관심사로 분리.

---

## Claude's Discretion

- TOML 스키마 세부 필드명
- 프리셋 내부 스킬 목록
- 테마 토큰 구체 값
- SkillContext API 세부 시그니처
- Commander.js 서브커맨드 등록 구현

## Deferred Ideas

None — discussion stayed within phase scope
