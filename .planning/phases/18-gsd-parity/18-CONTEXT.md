# Phase 18: GSD Parity — SUNCO를 GSD 이상으로

## 목표
SUNCO의 모든 워크플로를 GSD 수준 이상으로 끌어올리기.
현재 GSD 대비 2.9배 콘텐츠 격차 (38,581줄 vs 13,467줄).

## 감사 결과

### 구조적 차이 (근본)
1. **GSD**: commands (라우터 65줄) → @workflows (1,000줄+) 분리
2. **SUNCO**: commands에 모든 로직 (300줄 평균) → 깊이 부족
3. **GSD**: 18개 agent 정의 파일 (.md + .toml) → 역할별 전문화
4. **SUNCO**: 0개 agent 정의 → 범용 Agent만 사용

### 콘텐츠 격차

| 카테고리 | GSD | SUNCO | 필요량 |
|----------|-----|-------|--------|
| Workflows | 18,988줄 (57파일) | 2,354줄 (9파일) | +16,634줄 |
| Templates | 5,026줄 (32파일) | 524줄 (7파일) | +4,502줄 |
| References | 3,798줄 (15파일) | 2,195줄 (6파일) | +1,603줄 |
| Agents | 9,851줄 (18파일) | 0 | +9,851줄 |
| Tools | 918줄 | 545줄 | +373줄 |

### GSD만의 핵심 기능 (SUNCO에 없음)
1. downstream_awareness — CONTEXT.md → researcher → planner 체인
2. scope_guardrail — 스코프 크립 자동 감지/차단
3. prior_decisions — 이전 페이즈 결정 자동 로드
4. scout_codebase — 기존 코드 스캔 → gray area에 코드 컨텍스트
5. advisor_mode — 병렬 리서치 에이전트 → 비교 테이블
6. batch/analyze 모드 — 질문 묶기 + 트레이드오프 분석
7. canonical_refs — 참조 문서 경로 누적
8. text_mode — 리모트 세션 지원
9. transition 워크플로 — 페이즈 간 전환 자동화
10. checkpoint 시스템 — 중간 저장점
11. user-profiling — 사용자 행동 분석
12. todo matching — 관련 todo 자동 페이즈 매칭
13. 3종 summary (minimal/standard/complex)
14. execute-plan (개별 플랜 실행) vs execute-phase (전체 페이즈)

## 결정사항
- SUNCO도 commands → @workflows 분리 구조 채택
- Agent 정의 파일 시스템 도입
- 5단계 웨이브로 구현 (의존성 순서)
