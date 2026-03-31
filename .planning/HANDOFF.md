# SUNCO Handoff — 2026-03-31

## 현재 상태

**프로젝트**: SUNCO — 에이전트 워크스페이스 OS
**v0.1.0**: npm published as `popcoru` (standalone CLI)
**v0.2.0**: 진행 중 — Claude Code 스킬팩 전환
**브랜치**: main
**GitHub**: https://github.com/kwmin122/sunco-harness
**npm**: https://www.npmjs.com/package/popcoru

## 완료된 것

| Phase | 내용 | Plans | 상태 |
|-------|------|-------|------|
| 1-10 | Core → Harness → Skills → Init → Context → Execute → Verify → Ship → Compose → Debug | 53 | 완료 |
| 11 | Planning Quality | 1 | 완료 |
| 12 | Operational Resilience | 2 | 완료 |
| 13 | Headless + CI/CD + HTML Report | 2 | 완료 |
| 14 | Context Optimization (output, acceptance, GC, CodeGraph, adaptive replan, Docker) | 3 | 완료 |
| 15 | Document Generation (HWPX + doc skill) | 1 | 완료 |
| 16 | Publish Ready (package, README, CI, E2E) | 2 | 완료 |

**v0.1.0 출시 (2026-03-30)**:
- npm publish: popcoru@0.1.0 → 이름 변경 (sunco → popcoru, syncso 충돌)
- GitHub push: kwmin122/sunco-harness
- 빌드 5/5, 테스트 883/883, 스킬 44개

## 다음 할 것 — Phase 17: Skill Pack Pivot

**목표**: standalone CLI → GSD 스타일 스킬팩으로 전환
**핵심**: `npx popcoru` → `~/.claude/`에 설치 → `/sunco:init` 형태로 사용
**경쟁**: GSD의 모든 기능 커버 + 차별화 (harness, 5-layer verify, blast radius, HWPX)

### Wave 1 (병렬 가능):
1. **17-01-PLAN.md**: Multi-runtime installer + ASCII art + hooks (4개)
2. **17-02-PLAN.md**: 결정적 스킬 13개 → .md 커맨드 변환
3. **17-03-PLAN.md**: 프롬프트 스킬 37개 → .md 커맨드 변환

### Wave 2:
4. **17-04-PLAN.md**: 신규 기능 (workstreams, workspaces, ui-phase, manager, stats, profile) + workflows/references/templates

### Wave 3:
5. **17-05-PLAN.md**: 통합 테스트 + npm publish v0.2.0

## 실행 워크플로

각 plan에 대해:
1. Plan 파일 읽기
2. 소넷으로 코드 구현 (Agent model=sonnet, mode=auto)
3. 오푸스로 검증 (수락 기준 체크)
4. 커밋

## GSD 대비 차별화 요약

| SUNCO만의 기능 | 설명 |
|---------------|------|
| Deterministic Harness | lint, health, guard — LLM 비용 0원 |
| 6-Layer Swiss Cheese | multi-agent → guardrails → BDD → permissions → adversarial → cross-model (Codex) |
| Blast Radius Analysis | 코드 의존성 그래프로 변경 영향 분석 |
| Proactive Recommender | 50+ 규칙 자동 제안 |
| HWPX Document Gen | 한국 표준 문서 포맷 |
| Headless/CI Mode | JSON + exit codes |
| Docker Isolation | 컨테이너 격리 실행 |
| HTML Reports | self-contained 프로젝트 리포트 |
| Architecture Enforcement | import 방향, 레이어 위반 실시간 감지 |

## 프로젝트 구조

```
packages/
  core/           — CLI 엔진, config, state, skill system
  skills-harness/ — 결정적 스킬 (lint, guard, health)
  skills-workflow/ — 워크플로 스킬 (plan, execute, verify)
  cli/            — 인스톨러 + 커맨드 + 훅
    bin/install.cjs          ← npm entry point
    commands/sunco/*.md      ← 50+ 커맨드
    hooks/*.cjs              ← 훅
    dist/                    ← 빌드된 엔진
    workflows/*.md           ← 워크플로 로직
    references/*.md          ← 참조 문서
    templates/*.md           ← 아티팩트 템플릿
```

## 빌드/테스트 명령어

```bash
npx turbo build              # 빌드
npx vitest run               # 883 tests
node packages/cli/bin/install.cjs --help  # 인스톨러 테스트
```
