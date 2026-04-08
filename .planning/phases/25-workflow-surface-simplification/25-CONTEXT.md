# Phase 25: Workflow Surface Simplification - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자에게 보이는 명령어 표면을 3계층(User/Workflow/Expert)으로 분리하고, help를 작업 목록 중심으로 재설계하며, review를 상황 기반 자동 라우팅 프런트도어로 만들고, do/next를 메인 진입점으로 승격한다.

핵심 원칙: 사용자에게 파이프라인이 아니라 의도를 보여준다.

</domain>

<decisions>
## Implementation Decisions

### Visibility 메타데이터

- **D-01:** `defineSkill()`에 `tier: 'user' | 'workflow' | 'expert'` enum 필드 추가. 단일 축의 노출 계층 분리이므로 tags나 category 확장이 아닌 전용 enum이 가장 명확하다.
- **D-02:** 기본값은 `'workflow'`. 새 스킬이 실수로 user surface에 노출되지 않는다. user는 명시적 승격, expert도 명시적 선언 필요.

### Help 재설계

- **D-03:** 기본 `sunco help` = 작업 카드 형태. 명령 목록이 아니라 의도 중심 진입점 안내. "시작하기 / 이어서 작업 / 뭐든 시키기 / 지금 상태 / 리뷰 요청 / 도움말" 구조.
- **D-04:** `sunco help --all` = tier별 그룹 (User Commands / Workflow Commands / Expert Commands). 주 그룹핑 축은 tier로 고정, category는 보조 메타데이터.
- **D-05:** help는 별도 스킬 `harness.help`로 구현 (`kind: 'deterministic'`). tier 필터링, 작업 카드 렌더링, --all 플래그 모두 스킬 내부에서 처리. Commander.js configureHelp()가 아닌 defineSkill() 기반.
- **D-06:** `sunco --help`는 `sunco help`로 유도하는 최소 출력으로 둔다.

### Review Auto-Routing

- **D-07:** `sunco review`는 상황 기반 자동 라우팅. 현재 아티팩트/diff 상태를 보고 ceo/eng/design-review 중 하나를 자동 선택. `--type ceo|eng|design`으로 명시적 오버라이드 가능.
  - 라우팅 기준:
    - PRODUCT-SPEC / ROADMAP / REQUIREMENTS 중심 변경, 아직 구현 전 → ceo-review
    - PLAN / 아키텍처 / 테스트 전략 / 구현 diff 중심 → eng-review
    - UI/UX/interaction/screenshot/front-end 결과물 중심 → design-review
  - 우선순위: `--type` > UI 신호 > 구현 diff > 전략/범위
- **D-08:** review = user tier (기본 help에 노출), ceo/eng/design-review = expert tier (--all에서만 노출).
- **D-09:** 자동 선택 후 한 줄 설명 출력: "Auto-selected: eng-review (implementation diff detected)"

### do/next 승격

- **D-10:** 초기 사용자 안내는 help 작업카드로 충분. 별도 welcome/onboarding 흐름 추가 안 함. `sunco` (인자 없이 실행) → `sunco help` 실행.
- **D-11:** 추천 규칙 우선순위: primary `sunco next` > secondary `sunco do "..."` > tertiary `sunco status`. next는 상태 기반 안전한 기본 추천, do는 자유도 높아 초보자에겐 2순위.
- **D-12:** `sunco` (인자 없이) → `sunco help` 실행으로 매핑.

### Tier 분류표

| Command | Tier | 기본 help | --all |
|---------|------|-----------|-------|
| new | user | ✓ | ✓ |
| next | user | ✓ | ✓ |
| do | user | ✓ | ✓ |
| status | user | ✓ | ✓ |
| help | user | ✓ | ✓ |
| review | user | ✓ | ✓ |
| discuss | workflow | | ✓ |
| plan | workflow | | ✓ |
| execute | workflow | | ✓ |
| verify | workflow | | ✓ |
| ceo-review | expert | | ✓ |
| eng-review | expert | | ✓ |
| design-review | expert | | ✓ |
| compound | expert | | ✓ |
| ultraplan | expert | | ✓ |
| assume | expert | | ✓ |
| research | expert | | ✓ |

### Claude's Discretion

- review auto-routing의 구체적 신호 감지 로직 (파일 패턴, diff 분석 방식)
- help 작업 카드의 정확한 문구와 정렬
- 기존 스킬들의 tier 분류 (위 표에 없는 나머지 스킬들)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SUNCO Conventions
- `CLAUDE.md` — Skill patterns, file naming conventions, import rules, testing approach
- `.claude/rules/conventions.md` — defineSkill() contract, naming, import patterns
- `.claude/rules/architecture.md` — Monorepo structure, key patterns

### Skill System
- `packages/core/src/skill/define.ts` — defineSkill() factory, Zod validation
- `packages/core/src/skill/types.ts` — SkillDefinition interface (tier 필드 추가 대상)
- `packages/core/src/cli/skill-router.ts` — Commander.js skill registration
- `packages/core/src/cli/program.ts` — CLI program creation, unknown command handling

### Target Skills
- `packages/skills-workflow/src/do.skill.ts` — do skill (NL router)
- `packages/skills-workflow/src/next.skill.ts` — next skill (state-based recommendation)
- `packages/skills-workflow/src/review.skill.ts` — review skill (auto-routing 대상)
- `packages/skills-workflow/src/ceo-review.skill.ts` — CEO review
- `packages/skills-workflow/src/eng-review.skill.ts` — Engineering review
- `packages/skills-workflow/src/design-review.skill.ts` — Design review

### Recommender
- `packages/core/src/recommend/rules.ts` — 30+ deterministic rules (우선순위 조정 대상)

### Product Contract
- `packages/cli/references/product-contract.md` — Runtime paths, bin names, state/config schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `defineSkill()` factory with Zod validation — tier 필드 추가만 하면 됨
- `SkillRegistry` — tier 기반 필터링 메서드 추가 가능
- `SkillUi` adapter — help 스킬에서 result/entry/askText 활용 가능
- Recommender rules engine — priority 조정으로 next 우선순위 반영

### Established Patterns
- 스킬 메타데이터: id, command, description, kind, stage, category, routing, complexity
- Commander.js subcommand 자동 등록: skill-router.ts의 registerSkills()
- 추천: 30+ 규칙, lastResult/state 기반 Recommendation[] 반환

### Integration Points
- `packages/core/src/skill/types.ts` — SkillDefinition에 tier 필드 추가
- `packages/core/src/skill/define.ts` — Zod schema에 tier 추가 + 기본값 'workflow'
- `packages/core/src/cli/skill-router.ts` — tier 기반 Commander.js 등록 필터링
- `packages/core/src/cli/program.ts` — `sunco` (no args) → help 라우팅
- `packages/skills-harness/` — help.skill.ts 신규 생성
- `packages/core/src/recommend/rules.ts` — next 우선순위 상향

</code_context>

<specifics>
## Specific Ideas

- help 작업카드 프리뷰:
  ```
  시작하기        sunco new
  이어서 작업     sunco next
  뭐든 시키기     sunco do "..."
  지금 상태       sunco status
  리뷰 요청       sunco review
  도움말          sunco help --all
  ```
- review 자동 선택 출력: "Auto-selected: eng-review (implementation diff detected)"
- `sunco help --all` 출력은 User / Workflow / Expert 3섹션으로 구분
- `5 commands shown. 33 more with --all` 형태의 카운트 표시

</specifics>

<deferred>
## Deferred Ideas

- `--dry-run` / `--explain-route` for review routing debugging — 유용하지만 이번 페이즈 필수 아님
- 상황 인식 help (프로젝트 상태에 따라 help 내용 변경) — 별도 페이즈 후보

</deferred>

---

*Phase: 25-workflow-surface-simplification*
*Context gathered: 2026-04-08*
