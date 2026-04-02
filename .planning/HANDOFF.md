# SUNCO Handoff — 2026-04-01 (Session 2)

## 현재 상태

**프로젝트**: SUNCO — 에이전트 워크스페이스 OS
**v0.3.1**: npm published as `popcoru`
**브랜치**: main
**GitHub**: https://github.com/kwmin122/sunco-harness
**npm**: https://www.npmjs.com/package/popcoru
**Landing**: site/index.html (Vercel 배포됨)

## 이번 세션 완료

### ISSUE-001: Adaptive Lifecycle + Multi-Model Design Pingpong ✅

| 항목 | 내용 | 라인수 |
|------|------|--------|
| sunco-tools.cjs | artifact-hash, rollback-point, impact-analysis 3개 서브커맨드 그룹 | +539 (→2,179 total) |
| 신규 워크플로 7개 | pivot, rethink, backtrack, reinforce, where-am-i, design-pingpong, impact-analysis | +3,341 |
| 신규 커맨드 7개 | thin router 패턴, 각 워크플로에 매핑 | +310 |
| 기존 워크플로 수정 | discuss/plan/execute에 artifact-hash check, new-project/transition에 rollback point | 4개 수정 |
| 커맨드 수정 | discuss/plan/research에 --cross-model 플래그 | 3개 수정 |
| help.md | Adaptive Lifecycle 섹션 추가 | +35 |

**총 커맨드**: 58 → 65
**총 워크플로**: 56 → 64 (guard-watch 포함)

### ISSUE-002: Quality Supremacy ✅

| 에이전트 | 변경 | 핵심 강화 |
|----------|------|-----------|
| executor | 500→535 lines | worktree blast radius sandbox, lint-fix loop 3회+에스컬레이션, hidden test awareness, crash recovery 확장 |
| phase-researcher | 599→627 lines | Source credibility/freshness/contradiction detection을 Appendix에서 메인 프로세스로 통합, stopping conditions |
| integration-checker | 456→468 lines | Data flow/API contract/dead integration/circular deps/regression을 필수 Step 6a-6e로 승격 |
| guard | 25→49 lines + 워크플로 생성 | --draft-claude-rules 옵션, guard-watch.md 워크플로 (255 lines) |

### Codex 비교 테스트 프레임워크 ✅

- `codex-benchmark.cjs` (350 lines) — run/score/report 3개 커맨드
- 6차원 평가: completeness, specificity, actionability, consistency, quality, innovation
- 가중 점수 시스템, 타이밍 비교, blind A/B eval prompt 생성
- 샘플 PRD (benchmark-sample-prd.md) 포함

### SUNCO HQ 부트스트랩 ✅

- `ISSUE-003-sunco-hq.md` — 제품 정의, 기술 스택, MVP 스코프, 레포 구조, 비즈니스 모델
- `bootstrap-hq.sh` — GitHub repo 생성 → Next.js scaffold → 의존성 설치 → SUNCO 하네스 설치 → PRD 복사
- 기술 스택: Next.js 15 + Tailwind 4 + Drizzle ORM + PostgreSQL + Auth.js v5 + tRPC

## 이전 세션 완료 (v0.3.1)

| Phase | 내용 | 상태 |
|-------|------|------|
| 1-16 | Core → Skills → Init → Execute → Verify → Ship → Debug → Publish | 완료 |
| 17 | Skill Pack Pivot (58 commands, installer, hooks, multi-runtime) | 완료 |
| 18 | GSD Parity (전 카테고리 100%+ 달성) | 완료 |

## v0.3.1 최종 수치 + 이번 세션 추가

| 카테고리 | GSD | SUNCO v0.3.1 | 이번 세션 추가 | 현재 |
|----------|-----|-------------|---------------|------|
| Workflows | 18,988 | 21,710 | +3,596 | 25,306 |
| Templates | 5,026 | 7,347 | — | 7,347 |
| References | 3,798 | 5,026 | — | 5,026 |
| Agents | 9,851 | 10,036 | +75 | 10,111 |
| Tools | 918 | 1,640 | +889 | 2,529 |
| **합계** | **38,581** | **45,759** | **+4,560** | **50,319** |
| **달성률** | — | 119% | — | **130%** |

## 프로젝트 구조 (업데이트)

```
packages/
  core/           — CLI 엔진, config, state, skill system
  skills-harness/ — 결정적 스킬 (lint, guard, health)
  skills-workflow/ — 워크플로 스킬 (plan, execute, verify)
  cli/            — 스킬팩 인스톨러 + 커맨드 + 훅
    bin/
      install.cjs          ← npm entry point
      sunco-tools.cjs      ← workflow automation (2,179 lines)
      codex-benchmark.cjs  ← A/B 비교 테스트 (NEW)
      bootstrap-hq.sh      ← SUNCO HQ 부트스트랩 (NEW)
    commands/sunco/*.md    ← 65 커맨드 (+7 adaptive lifecycle)
    hooks/*.cjs            ← 4 훅
    workflows/*.md         ← 64 워크플로 (+8 new)
    agents/*.md            ← 18 에이전트 (3 enhanced)
    references/*.md        ← 15 참조 문서
    templates/             ← 25+ 템플릿
site/
  index.html             ← 랜딩 페이지 (Vercel)
```

## 다음 세션 작업

### 즉시 (v0.4.0)
1. **gstack 기능 흡수 Tier 1** — 5개 신규 스킬 (워크플로 + 커맨드 + 필요시 sunco-tools.cjs)
   - `/sunco:cso` — 보안 감사 (OWASP Top 10, STRIDE, npm audit, secret detection). 결정적 스킬 가능.
   - `/sunco:careful` + `/sunco:freeze` — 파괴적 명령어 경고 + 디렉토리 스코프 잠금
   - `/sunco:retro` — 주간 회고 (git log 분석, 커밋 패턴, 테스트 건강도 추세)
   - `/sunco:benchmark` — 성능 베이스라인 (vitest bench, 번들 사이즈, 빌드 시간)
   - `/sunco:land` — 배포 파이프라인 (PR 머지 → CI 대기 → 배포 → 헬스체크, gh CLI)

2. **gstack 기능 흡수 Tier 2** — 5개 신규 스킬
   - `/sunco:office-hours` — 프로젝트 시작 전 강제 질문 (6가지 핵심 질문)
   - `/sunco:ceo-review` — CEO 관점 플랜 리뷰 (스코프, 10-star 제품)
   - `/sunco:eng-review` — Eng 관점 플랜 리뷰 (아키텍처, 데이터 플로우, 엣지 케이스)
   - `/sunco:design-review` — 디자인 관점 리뷰 (차원별 0-10 점수)
   - `/sunco:canary` — 배포 후 모니터링 (헬스체크, 에러 로그, 롤백 트리거)

3. **v0.4.0 배포** — 버전 범프 + npm publish + 랜딩 페이지 업데이트 (75 skills)

### 이후
4. **SUN Terminal** — Swift/AppKit + libghostty R&D
5. **gstack Tier 3** — `/sunco:qa`, `/sunco:browse` (SUN Terminal + Playwright)
6. **Codex 실행** — codex-benchmark.cjs 실제 A/B
7. **SUNCO HQ** — bootstrap-hq.sh 실행

## 빌드/테스트

```bash
npx turbo build              # 빌드
npx vitest run               # 883 tests
node packages/cli/bin/install.cjs --help
node packages/cli/bin/codex-benchmark.cjs --help
bash packages/cli/bin/bootstrap-hq.sh --skip-github --dir /tmp/sunco-hq-test
npm publish --workspace=packages/cli --access public
```

## 메모

- npm publish 시 버전 반드시 확인 (이미 publish된 버전은 재사용 불가)
- `npm login` 세션 만료 주의
- Codex 테스트 시 `gpt-5.4` medium 이상 권장
- GSD 코드 복사 금지 — 개념만 참고, SUNCO 고유 콘텐츠로 작성
- SUNCO HQ는 별도 레포 (kwmin122/sunco-hq) — 이 레포의 .planning/issues/ISSUE-003에 PRD
- codex-benchmark.cjs는 Codex CLI가 설치된 환경에서만 run 가능 (score/report는 로컬)
