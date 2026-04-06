# Phase 17: Context Intelligence

## Vision
컨텍스트 윈도우를 지능적으로 관리하여 토큰 낭비를 최소화한다. 4단계 유틸리제이션 존으로 실시간 모니터링하고, 선택적 아티팩트 로딩으로 78% 절감하며, 구조화된 핸드오프로 세션 연속성을 보장한다.

## Key Decisions

- D-262: 4-tier context zone: Green(0-50%)/Yellow(50-70%)/Orange(70-85%)/Red(85%+)
- D-263: 선택적 로딩은 phase-reader.ts에 wrapper 함수로 구현 (기존 함수 수정 안 함)
- D-264: HANDOFF.json schema version 1 유지 (optional 필드 추가)
- D-265: 아티팩트 요약은 결정적 (LLM 불필요) — 첫 3줄 + 메타데이터 추출
- D-266: context-monitor.cjs 훅 확장 (새 파일 안 만듦)

## Acceptance Criteria

1. 컨텍스트 70%+ → Yellow/Orange 경고 statusline 표시
2. 완료 페이즈 아티팩트 → 3줄 요약 로드 (full 대비 78%+ 절감)
3. HANDOFF.json → resumeCommand 포함, 새 세션에서 즉시 이어서 실행 가능
4. sunco-context-monitor.cjs → 4단계 존 모니터링 + pause 추천

## References
- LTH (long-task-harness): 78% context reduction via selective session loading
- HarnessOS: 5.2% harness budget target
- OMC: tier-based context management
- Claudikins: 60% saturation monitoring
