# Phase 18: Smart Routing

## Vision
작업 복잡도와 의도에 따라 최적 모델을 자동 선택하여 30-50% 토큰을 절감한다. 인텐트 게이트가 사용자 입력을 분류하고, 티어 기반 프로필이 모델을 선택하며, 비용 인식 라우팅이 예산에 맞게 자동 조정한다.

## Key Decisions

- D-267: 인텐트 분류는 결정적 (LLM 불필요) — 키워드 매칭 + 패턴 인식
- D-268: 복잡도 메타데이터는 defineSkill()에 optional 필드로 추가 (기존 스킬 깨지지 않음)
- D-269: 모델 프로필은 config.toml [agent.profile] 섹션에 저장
- D-270: 라우팅 성공률은 SQLite state에 기록 (lightweight)
- D-271: sunco-mode-router.cjs 훅에서 인텐트 분류 수행

## Acceptance Criteria

1. 사용자 입력이 5가지 인텐트(lookup/implement/investigate/plan/review)로 분류
2. defineSkill()에 complexity 필드 추가, 라우터가 자동 참조
3. BudgetGuard 75%+ 시 cheaper 모델 다운그레이드
4. 스킬×모델 성공률 SQLite 기록

## References
- OMC: tier-based model routing (30-50% token savings)
- OMO: intent gate classification with multi-model routing
- Phase 14: CTX-03 complexity routing (extends existing work)
