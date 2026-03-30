# SUNCO Handoff — 2026-03-30

## 현재 상태

**프로젝트**: SUNCO — 에이전트 워크스페이스 OS (독립 CLI 런타임)
**v1.0**: Phase 1-10 완료 (53 plans, 39 skills, 790 tests)
**v1.1**: Phase 11-14 완료 (추가 8 plans, 42 skills, 867 tests)
**브랜치**: main
**마지막 커밋**: `d77fbc5` docs: complete execution plans for Wave 1-4

## 완료된 것

| Phase | 내용 | Plans |
|-------|------|-------|
| 1-10 | Core → Harness → Skills → Init → Context → Execute → Verify → Ship → Compose → Debug | 53 |
| 11 | Planning Quality (--research, checker loop 3x, coverage gate, deep work rules) | 1 |
| 12 | Operational Resilience (AutoLock 크래시 복구, StuckDetector 멈춤 감지, BudgetGuard 예산 한도) | 2 |
| 13 (partial) | Headless + CI/CD (sunco headless, sunco query — JSON output + exit codes) | 1 |
| 14 (partial) | Context Optimization (output discipline, acceptance auto-link, garbage collection, CodeGraph blast radius) | 2 |

**품질 감사 수정 (commit 015f6aa)**:
- mandatory lint-gate in auto pipeline (Stripe Minions 패턴)
- 규칙 수 "100+" → "50+" (실제 47개)
- Quality Gate: configurable thresholds (maxCritical=0, maxHigh=0, maxMedium=5)

## 다음 할 것 — 7개 Plan 실행 (계획 이미 작성됨)

**모든 plan은 `.planning/phases/`에 이미 작성 완료. 검증 → 실행만 하면 됨.**

### Wave 1 (병렬 가능):
1. **14-03-PLAN.md**: 적응형 재계획 (auto에서 roadmap 재읽기) + Docker (Dockerfile + docker-compose.yml)
2. **13-02-PLAN.md**: HTML 리포트 (sunco export --html, self-contained)

### Wave 2:
3. **15-01-PLAN.md**: 문서 생성 — HWPX writer (KS X 6101 자체 구현, zero dep ZIP 생성) + doc.skill.ts (--hwpx/--md/--template) + 프롬프트

### Wave 3 (품질):
4. **16-01-PLAN.md**: 패키지 준비 — package.json(bin:sunco), LICENSE(MIT), README.md(bilingual), CI/CD(GitHub Actions), .npmignore
5. **16-02-PLAN.md**: 품질 게이트 — E2E 통합 테스트, 에러 메시지 정리, 부트 성능 검증

### Wave 4:
6. npm publish 🚀

## 실행 워크플로

각 plan에 대해:
1. Plan 파일 읽기 (`.planning/phases/{phase}/{plan}.md`)
2. 소넷으로 코드 구현 위임 (Agent subagent_type=gsd-executor, model=sonnet, mode=auto)
3. 빌드 검증: `npx turbo build`
4. 테스트 검증: `npx vitest run`
5. 커밋

## 프로젝트 구조

```
packages/
  core/           — CLI 엔진, config(TOML), state(SQLite), skill system, agent router, recommender, UI
  skills-harness/ — 결정적 스킬: init, lint, health, agents, guard (LLM 비용 0)
  skills-workflow/ — 워크플로 스킬: plan, execute, verify, auto, debug, graph, query 등 35개
  skills-extension/ — 확장 포인트
  cli/            — Commander.js 진입점, 스킬 등록
```

## 핵심 규칙

- **모든 기능은 스킬** (하드코딩 명령어 금지)
- **결정적 우선** (린터/테스트로 강제할 수 있으면 LLM 안 씀)
- **외부 의존성 최소화** (HWPX도 자체 구현, 한글 처리도 자체)
- **GSD 코드 복사 금지** (개념만 참고)

## 빌드/테스트 명령어

```bash
npx turbo build                    # 5 packages 빌드
npx vitest run                     # 867 tests
node packages/cli/dist/cli.js --help  # 42 skills 확인
```

## 리서치 문서 위치

- `.planning/research/v1.1-RESEARCH.md` — GSD 분석 + 한국 시장 + Tips
- `.planning/research/quality-audit-2026-03-29.md` — 품질 감사 결과
- `.planning/research/global-harness-research-2026-03-29.md` — US/EU 하네스 인사이트
