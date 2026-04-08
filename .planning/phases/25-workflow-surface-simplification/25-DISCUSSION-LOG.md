# Phase 25: Workflow Surface Simplification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 25-workflow-surface-simplification
**Areas discussed:** Visibility 메타데이터, Help 재설계, Review auto-routing, do/next 승격
**Mode:** interactive

---

## Visibility 메타데이터 설계

| Option | Description | Selected |
|--------|-------------|----------|
| tier 필드 추가 | defineSkill({ tier: 'user' \| 'workflow' \| 'expert' }) | ✓ |
| category 확장 | category: { name, tier } 형태로 변경 | |
| tags 기반 | defineSkill({ tags: ['user-facing'] }) | |

**User's choice:** tier 필드 추가
**Notes:** 단일 축의 노출 계층 분리이므로 enum이 가장 명확. tags는 과하고 category 확장은 기존 의미와 섞임.

| Option | Description | Selected |
|--------|-------------|----------|
| workflow (기본값) | 새 스킬이 user surface에 실수로 노출 안 됨 | ✓ |
| expert (기본값) | 더 안전하지만 workflow까지 과도하게 숨김 | |

**User's choice:** workflow
**Notes:** user는 명시적 승격, expert도 명시적 선언 필요. 중간층이 기본값으로 가장 안정적.

---

## Help 재설계

| Option | Description | Selected |
|--------|-------------|----------|
| 작업 카드 | 의도 중심 진입점 안내 | ✓ |
| 계층별 목록 | user tier 명령만 나열 | |
| 상황 인식 help | 프로젝트 상태에 따라 변경 | |

**User's choice:** 작업 카드
**Notes:** 기본 화면은 명령 참조가 아니라 시작 화면이어야 한다.

| Option | Description | Selected |
|--------|-------------|----------|
| tier별 그룹 | User/Workflow/Expert 3섹션 | ✓ |
| category별 그룹 | session/composition/debugging 등 | |

**User's choice:** tier별 그룹
**Notes:** 주 그룹핑 축은 tier로 고정. category는 보조.

| Option | Description | Selected |
|--------|-------------|----------|
| 별도 help 스킬 | defineSkill({ id: 'harness.help' }) | ✓ |
| Commander.js configureHelp() | 출력 포맷만 오버라이드 | |

**User's choice:** 별도 help 스킬
**Notes:** registry 메타데이터 직접 활용 가능. 기본 help와 --all을 서로 다른 UX로 제공 용이.

---

## Review Auto-Routing

| Option | Description | Selected |
|--------|-------------|----------|
| 상황 기반 자동 | 아티팩트/diff 상태로 자동 선택 | ✓ |
| 항상 질문 | 매번 사용자에게 선택 요청 | |
| 전부 실행 | ceo+eng+design 모두 실행 | |

**User's choice:** 상황 기반 자동
**Notes:** sunco review는 프런트도어. --type으로만 강제 override.

| Option | Description | Selected |
|--------|-------------|----------|
| review=user, 세부=expert | review만 기본 help에 노출 | ✓ |
| review=workflow, 세부=expert | review도 --all에서만 | |

**User's choice:** review=user, 세부=expert
**Notes:** 기본 help가 의도 중심으로 유지되어야 함.

---

## do/next 승격 전략

| Option | Description | Selected |
|--------|-------------|----------|
| help 작업카드로 충분 | 별도 welcome 없음, sunco → sunco help | ✓ |
| 별도 welcome 흐름 | .sun/ 없으면 온보딩 플로우 실행 | |

**User's choice:** help 작업카드로 충분
**Notes:** 이번 페이즈는 표면 단순화이지 새 온보딩 엔진 추가가 아님.

| Option | Description | Selected |
|--------|-------------|----------|
| next 우선 | 기본 추천 1순위 next, 2순위 do | ✓ |
| do 우선 | 기본 추천 1순위 do, 2순위 next | |

**User's choice:** next 우선
**Notes:** next는 상태 기반 안전한 기본 추천. do는 자유도 높아 초보자에겐 2순위.

---

## Claude's Discretion

- review auto-routing의 구체적 신호 감지 로직
- help 작업 카드 정확한 문구와 정렬
- 기존 스킬들(표에 없는 나머지)의 tier 분류

## Deferred Ideas

- `--dry-run` / `--explain-route` for review routing debugging
- 상황 인식 help (프로젝트 상태에 따라 내용 변경)
