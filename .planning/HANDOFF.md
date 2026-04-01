# SUNCO Handoff — 2026-04-01

## 현재 상태

**프로젝트**: SUNCO — 에이전트 워크스페이스 OS
**v0.3.1**: npm published as `popcoru`
**브랜치**: main
**GitHub**: https://github.com/kwmin122/sunco-harness
**npm**: https://www.npmjs.com/package/popcoru
**Landing**: site/index.html (Vercel 배포됨)

## 완료된 것

| Phase | 내용 | 상태 |
|-------|------|------|
| 1-16 | Core → Skills → Init → Execute → Verify → Ship → Debug → Publish | 완료 |
| 17 | Skill Pack Pivot (58 commands, installer, hooks, multi-runtime) | 완료 |
| 18 | GSD Parity (전 카테고리 100%+ 달성) | 완료 |

## v0.3.1 최종 수치 (Phase 18 완료)

| 카테고리 | GSD | SUNCO | 달성률 |
|----------|-----|-------|--------|
| Workflows | 18,988 | 21,710 | 114% |
| Templates | 5,026 | 7,347 | 146% |
| References | 3,798 | 5,026 | 132% |
| Agents | 9,851 | 10,036 | 102% |
| Tools | 918 | 1,640 | 178% |
| **합계** | **38,581** | **45,759** | **119%** |

### 품질 판정 (Codex 5.4 + Opus 직접 검증)
- 18/18 에이전트에서 SUNCO ≥ GSD
- GSD가 이기는 에이전트: 0개
- SUNCO >> GSD: 4개 (advisor, assumptions, nyquist, user-profiler)
- SUNCO > GSD: 6개 (plan-checker, executor, phase-researcher, integration-checker, verifier, ui-checker)

### SUNCO 차별화 (GSD에 없는 기능)
- 7-layer Swiss cheese verification (Layer 7: Human Eval)
- 12-point plan checker (GSD: 9점) with BLOCK/WARN/PASS severity
- 3-type failure classification + 30-minute reclassification rule
- Goal-backward must_haves derivation in planner
- Per-task checkpointing + crash recovery + poka-yoke
- Source credibility scoring + research freshness gate
- Data flow tracing + circular dependency detection
- Conditional Claude rule loading (.claude/rules/ with frontmatter)
- Multi-runtime installer (Claude Code, Codex, Cursor, Antigravity)
- Korean i18n (58 commands)
- /sunco:mode (auto-routing Super Saiyan mode)

## 진행 중인 설계 (미구현)

### ISSUE-001: Adaptive Lifecycle + Multi-Model Design Pingpong
- 설계 완료: `.planning/issues/ISSUE-001-DESIGN.md`
- State machine, impact analysis algorithm, rollback system 설계됨
- Multi-model merge + debate protocol 설계됨
- 구현 필요: 7개 새 워크플로 (pivot, rethink, backtrack, reinforce, where-am-i, design-pingpong, impact-analysis)
- sunco-tools.cjs 3개 신규 서브커맨드 (artifact-hash, rollback-point, impact-analysis)

### ISSUE-002: Quality Supremacy
- 계획 완료: `.planning/issues/ISSUE-002-quality-supremacy.md`
- guard `--draft-claude-rules` 옵션 미구현
- Anthropic 인사이트 적용 완료 (poka-yoke, tool > prompt, hidden test)

## 프로젝트 구조

```
packages/
  core/           — CLI 엔진, config, state, skill system
  skills-harness/ — 결정적 스킬 (lint, guard, health)
  skills-workflow/ — 워크플로 스킬 (plan, execute, verify)
  cli/            — 스킬팩 인스톨러 + 커맨드 + 훅
    bin/
      install.cjs          ← npm entry point (interactive installer)
      sunco-tools.cjs      ← workflow automation (1,640 lines)
    commands/sunco/*.md    ← 58 커맨드 (thin routers → workflows)
    hooks/*.cjs            ← 4 훅
    workflows/*.md         ← 57 워크플로 (21,710 lines)
    agents/*.md            ← 18 에이전트 정의 (10,036 lines)
    references/*.md        ← 15 참조 문서 (5,026 lines)
    templates/             ← 25+ 템플릿 (7,347 lines)
      claude-rules/        ← 조건부 규칙 템플릿 5개
      codebase/            ← 코드베이스 매핑 템플릿 7개
      research-project/    ← 리서치 출력 템플릿 5개
site/
  index.html             ← 랜딩 페이지 (Vercel)
  vercel.json
```

## 다음 세션 작업

1. **ISSUE-001 구현** — 적응형 라이프사이클 7개 워크플로
2. **ISSUE-002 구현** — guard --draft-claude-rules
3. **Codex 비교 테스트** — v0.3.1 기준 풀 파이프라인 A/B
4. **SUNCO HQ** — 두 번째 제품 (별도 레포, GSD 파이프라인으로 시작)

## 빌드/테스트

```bash
npx turbo build              # 빌드
npx vitest run               # 883 tests
node packages/cli/bin/install.cjs --help
npm publish --workspace=packages/cli --access public
```

## 메모

- npm publish 시 버전 반드시 확인 (이미 publish된 버전은 재사용 불가)
- `npm login` 세션 만료 주의
- Codex 테스트 시 `gpt-5.4` medium 이상 권장 (codex-mini는 ChatGPT 계정에서 제한)
- GSD 코드 복사 금지 — 개념만 참고, SUNCO 고유 콘텐츠로 작성
