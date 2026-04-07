# gstack → SUN 적용 설계서

> gstack의 /investigate + /review 핵심 기능을 SUN의 기존 debug/review 스킬에 강화 적용

## Module A: sun debug (Iron Law Engine) — 9개 메커니즘

기존 Phase 10 debug/diagnose/forensics 스킬 위에 gstack의 체계적 디버깅 메커니즘 추가.

| 메커니즘 | 설명 | SUN 연동 |
|----------|------|----------|
| **Iron Law Gate** | 근본 원인 확인 전 Edit/Write 차단 (PreToolUse 훅) | Phase 19 Hook System v2 활용 |
| **3-Strike Rule** | 가설 3개 실패 → 자동 에스컬레이션 | Phase 12 StuckDetector 확장 |
| **Freeze Scope** | 디버깅 중 관련 디렉토리만 편집 허용 | sun guard 연동 (Phase 2) |
| **Prior Learnings** | .sun/debug/learnings/에 세션 간 학습 축적 + 검색 | Phase 21 Cross-Session Intelligence 활용 |
| **9가지 버그 패턴** | SUN 3유형 + gstack 6패턴 = 2단계 분류 체계 | Phase 10 debug 확장 |
| **에러 새니타이징** | WebSearch 전 PII/내부정보 자동 제거 | 새 유틸리티 |

### SUN 기존 3유형 (Phase 10)
1. context_shortage — 컨텍스트 부족
2. direction_error — 방향 오류
3. structural_conflict — 구조적 충돌

### gstack 6패턴 (추가)
4. state_corruption — 상태 오염
5. race_condition — 경쟁 조건
6. type_mismatch — 타입 불일치
7. dependency_conflict — 의존성 충돌
8. boundary_violation — 경계 위반
9. silent_failure — 조용한 실패

## Module B: sun review (Review Army) — 11개 메커니즘

기존 Phase 6 review 스킬(multi-provider cross-review) 위에 gstack의 전문가 군단 패턴 추가.

| 메커니즘 | 설명 | SUN 연동 |
|----------|------|----------|
| **8 Specialist Army** | Testing, Security, Performance, API, Design, Migration, Maintainability, Red Team | Phase 7 verify 5-expert와 통합 |
| **Adaptive Gating** | 10회+ 무발견 specialist 자동 비활성화 (토큰 절약 ~30%) | Phase 18 Smart Routing 활용 |
| **Cross-Review Dedup** | 이전 리뷰에서 스킵한 finding 자동 억제 | Phase 21 skill-profile 활용 |
| **Test Stub Suggestion** | finding마다 테스트 스켈레톤 자동 생성 | Phase 7 test-gen 확장 |
| **Confidence Gate** | 7+ 메인, 3-4 부록, 1-2 숨김 | 새 필터링 로직 |
| **Multi-Provider 매트릭스** | 8 specialist × 3 provider (SUN 고유 차별점) | Phase 6 crossVerify 확장 |

## 의존성 매핑 (현재 SUN 상태 기준)

Module A는 이미 구현된 기반 위에 올림:
- Phase 10 debug.skill.ts — 기본 디버깅 (확장 대상)
- Phase 12 StuckDetector — 3-Strike Rule 기반
- Phase 19 lifecycle-hooks.ts — Iron Law Gate의 PreToolUse 훅
- Phase 21 skill-profile.ts — Prior Learnings 기반

Module B도 기존 기반 활용:
- Phase 6 review.skill.ts — 기본 cross-review (확장 대상)
- Phase 7 verify.skill.ts — 5-expert 패턴 (8 Specialist로 확장)
- Phase 18 routing-tracker.ts — Adaptive Gating 기반
- Phase 21 skill-profile.ts — Cross-Review Dedup 기반

## 구현 전략

기존 스킬을 **교체하지 않고 확장**:
- debug.skill.ts에 Iron Law Gate + 3-Strike + 9패턴 추가
- review.skill.ts에 8 Specialist + Adaptive Gating + Confidence Gate 추가
- 새 shared 유틸리티: error-sanitizer.ts, specialist-army.ts, adaptive-gate.ts
- 새 프롬프트: debug-ironlaw.ts, review-specialist-*.ts (8개)

## 예상 Phase 구조

- **Phase 23a: Debug Iron Law Engine** — Module A 전체
- **Phase 23b: Review Army** — Module B 전체

(원래 3.9a/3.9b로 계획되었으나, 현재 Phase 22까지 진행되어 23a/23b로 재번호)
