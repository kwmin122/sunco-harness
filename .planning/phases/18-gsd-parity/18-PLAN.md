# Phase 18: GSD Parity — 실행 계획

## Wave 1: 구조 전환 (기반)
**목표**: commands → @workflows 분리 구조 도입

### Task 1-1: 핵심 5개 워크플로 대확장
현재 commands/sunco/*.md에 있는 로직을 workflows/로 분리하고 대폭 확장.

| 워크플로 | 현재 (줄) | 목표 (줄) | GSD 기준 |
|----------|----------|----------|---------|
| discuss-phase.md | 196 → | 800+ | 1,049 |
| plan-phase.md | 192 → | 700+ | 859 |
| execute-phase.md | 245 → | 700+ | 846 |
| new-project.md | 264 → | 1,000+ | 1,250 |
| verify-phase.md | 330 → | 500+ | 637 |

각 워크플로에 추가할 GSD 핵심 기능:
- **discuss**: downstream_awareness, scope_guardrail, prior_decisions, scout_codebase, advisor_mode, batch/analyze, canonical_refs
- **plan**: research 에이전트, plan-checker 루프, wave 자동 할당, Nyquist 검증
- **execute**: execute-plan 분리, checkpoint, lint-gate 강화, resume 지원
- **new-project**: 4-agent 병렬 리서치, 질문 루프, config 세팅 인터랙티브
- **verify**: Human Eval (완료), Nyquist 패턴, UAT 연동

### Task 1-2: Command 파일을 라우터로 전환
commands/sunco/discuss.md 등을 65줄 라우터로 변환:
```markdown
<process>
Read and execute @$HOME/.claude/sunco/workflows/discuss-phase.md end-to-end.
</process>
```

### Task 1-3: sunco-tools.cjs 확장
GSD의 gsd-tools.cjs 기능 완전 매칭:
- `init phase-op` — 페이즈 상태 감지
- `config-get/config-set` — 설정 읽기/쓰기
- `todo match-phase` — 관련 todo 매칭
- `resolve-model` — 모델 프로필 해석
- `agent-skills` — 에이전트 스킬 주입
- `transition` — 페이즈 전환

## Wave 2: Agent 시스템 (실행 품질)
**목표**: 18개 전문 에이전트 정의

| 에이전트 | 역할 | GSD 기준 (줄) |
|----------|------|------------|
| sunco-planner | 계획 생성 전문 | 1,354 |
| sunco-executor | 플랜 실행 전문 | 509 |
| sunco-researcher | 도메인 리서치 | 654 |
| sunco-phase-researcher | 페이즈 구현 리서치 | 697 |
| sunco-research-synthesizer | 리서치 종합 | ~300 |
| sunco-plan-checker | 계획 검증 | 773 |
| sunco-verifier | 페이즈 검증 | 700 |
| sunco-debugger | 디버깅 전문 | 1,373 |
| sunco-codebase-mapper | 코드베이스 분석 | 770 |
| sunco-roadmapper | 로드맵 생성 | 679 |
| sunco-advisor-researcher | 의사결정 리서치 | ~400 |
| sunco-integration-checker | 통합 검증 | ~300 |
| sunco-nyquist-auditor | 테스트 커버리지 | ~300 |
| sunco-ui-researcher | UI 리서치 | ~300 |
| sunco-ui-auditor | UI 감사 | ~300 |
| sunco-ui-checker | UI 검증 | ~300 |
| sunco-user-profiler | 사용자 프로파일 | ~300 |
| sunco-assumptions-analyzer | 가정 분석 | ~300 |

## Wave 3: Templates 확장 (산출물 품질)
**목표**: 7개 → 25+ 템플릿

추가할 템플릿:
- phase-prompt.md — 에이전트 프롬프트 기본 구조 (610줄)
- research.md — 리서치 보고서 (552줄)
- context.md — 확장 (352줄)
- verification-report.md — 검증 리포트 (322줄)
- user-setup.md — 사용자 설정 가이드 (311줄)
- UAT.md — 사용자 수락 테스트 (265줄)
- summary-minimal.md / summary-standard.md / summary-complex.md — 3단계 요약
- DEBUG.md — 디버그 세션 (164줄)
- discovery.md — 코드 발견 문서 (146줄)
- user-profile.md — 사용자 프로파일 (146줄)
- discussion-log.md — 토론 로그
- milestone-archive.md — 마일스톤 아카이브
- claude-md.md — CLAUDE.md 생성 템플릿
- continue-here.md — 이어하기 문서

## Wave 4: References 확장 (지식 기반)
**목표**: 6개 → 15개

추가할 레퍼런스:
- checkpoints.md — 체크포인트 시스템 (778줄)
- verification-patterns.md — 검증 패턴 (612줄)
- user-profiling.md — 사용자 프로파일링 (681줄)
- tdd.md — TDD 가이드 (263줄)
- continuation-format.md — 이어하기 포맷 (249줄)
- planning-config.md — 계획 설정 (202줄)
- ui-brand.md — UI 브랜드 (160줄)
- decimal-phase-calculation.md — 소수점 페이즈 (64줄)
- phase-argument-parsing.md — 인자 파싱 (61줄)

## Wave 5: 누락 워크플로 + 통합 테스트
**목표**: GSD에 있는 57개 워크플로 중 SUNCO에 없는 것 추가

추가할 워크플로:
- discuss-phase-assumptions.md (653줄) — assumptions 모드
- transition.md (671줄) — 페이즈 전환
- autonomous.md (891줄) — 완전 자율
- complete-milestone.md (767줄) — 마일스톤 완료
- discovery-phase.md — 코드 발견
- execute-plan.md (514줄) — 개별 플랜 실행
- validate-phase.md — Nyquist 검증
- add-tests.md (351줄) — 테스트 생성
- audit-milestone.md (340줄) — 마일스톤 감사

## 실행 전략

### 병렬화
- Wave 1 Task 1-1의 5개 워크플로는 병렬로 Sonnet 에이전트에 위임
- Wave 2의 18개 에이전트 정의도 3-4개씩 병렬
- Wave 3, 4는 각각 병렬

### 검증
- 각 Wave 후 Codex 비교 테스트 재실행
- GSD 대비 점수 측정

### 목표 줄 수
| 카테고리 | 현재 | 목표 | GSD |
|----------|------|------|-----|
| Workflows | 2,354 | **20,000+** | 18,988 |
| Templates | 524 | **5,000+** | 5,026 |
| References | 2,195 | **4,000+** | 3,798 |
| Agents | 0 | **10,000+** | 9,851 |
| Tools | 545 | **1,000+** | 918 |
| **합계** | 13,467 | **40,000+** | 38,581 |

## done_when
- [ ] discuss-phase.md 워크플로 800줄+, 모든 GSD 기능 포함
- [ ] plan-phase.md 워크플로 700줄+, plan-checker 루프 포함
- [ ] execute-phase.md 워크플로 700줄+, checkpoint + resume 포함
- [ ] new-project.md 워크플로 1,000줄+, 4-agent 리서치 포함
- [ ] 18개 agent 정의 파일 생성
- [ ] 25+ 템플릿 파일
- [ ] 15개 레퍼런스 파일
- [ ] sunco-tools.cjs 1,000줄+
- [ ] Codex 비교 테스트에서 SUNCO ≥ GSD 전 항목
- [ ] npm publish v0.3.0
