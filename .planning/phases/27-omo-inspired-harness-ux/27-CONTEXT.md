# Phase 27: OMO-Inspired Agent Harness UX - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning — all 15 decisions locked (see `27-DISCUSSION-LOG.md`)
**Upstream research:** `.planning/research/opencode-integration.md` §2

<domain>
## Phase Boundary

사용자가 자연어 요청을 입력하면 SUNCO가 작업 유형을 분류하고 기존 front door skill로 라우팅한다. 사용자는 expert 명령(`/sunco:plan-gate`, `/sunco:dogfood-gate` 등)을 알 필요가 없다.

핵심 원칙: **새 명령어를 추가하지 않는다.** 모든 변경은 기존 front door 내부 개선.

**바깥 경계:**
- OMO/OpenCode의 agent zoo 이름(Sisyphus, Hephaestus, Prometheus, Oracle, Librarian 등)을 SUNCO로 가져오지 않는다.
- Advisor harness, MCP, LSP, server/SDK, MD slash commands, Hashline edit guard, config variable substitution, AGENTS.md remote fetch, permission pattern matching 확장은 **전면 제외**.
- `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, Anthropic beta 헤더 의존 금지. SUNCO는 Claude Code 구독 런타임 위에서만 동작.

</domain>

<decisions>
## Implementation Decisions

### 확정된 것 (재정렬 문서에서 이미 합의)

- **D-01:** Phase 27은 **OMO UX 패턴만** 차용한다. OpenCode core(server/SDK/MCP/LSP/session DB)는 전면 보류.
- **D-02:** 신규 `.skill.ts` 파일 수 = **0개**. `active-work` 관련 core 모듈(`packages/core/src/state/active-work.{ts,types.ts}`)만 신규 허용.
- **D-03:** 신규 `/sunco:*` 명령 수 = **0개**. 기존 `do` / `next` / `review` / `status` 내부 개선만.
- **D-04:** Category 6종은 **내부 routing primitive**로만 존재한다. 사용자에게 taxonomy로 노출하지 않는다 (help에서 노출 X).
- **D-05:** Phase 27은 **최대 2 plan, 순차 실행**. 같은 `skills-workflow/` 디렉토리를 만지므로 병렬 금지.
- **D-06:** Plan A = active-work artifact + status/next integration. Plan B = classifier + do/review routing + recommender rules. 순서는 A → B.
- **D-07:** `.sun/active-work.json`은 **read-only dashboard source artifact**. 새 UI/대시보드 화면이 아님. `status`/`next`/recommender 소비 대상.
- **D-08:** Lifecycle hook이 skill 완료 시 artifact를 갱신한다. `packages/skills-workflow/src/shared/lifecycle-hooks.ts`만 수정.
- **D-09:** OMO agent zoo 이름 복제 금지. 내부 role 이름은 SUNCO 기존 네이밍(`eng-review`, `ceo-review`, `design-review` 등)에 맞춘다.
- **D-10:** Claude Code 구독 전제. API 경로 의존 코드(@anthropic-ai/sdk, beta header) 도입 금지.

### Discuss 단계에서 locked (2026-04-10)

- **D-11:** **6 categories** (`quick` / `deep` / `planning` / `review` / `debug` / `visual`). Category는 internal routing primitive이지 user-facing taxonomy가 아님. docs는 quick 또는 deep으로 intent-driven 라우팅, release는 별도 category가 아니라 verified/done 상태에서 next가 추천할 action. 추가 category는 *관측된* routing miss 발생 시에만 검토.
  - **Consequence:** active-work.json + recommender에 **routing-miss telemetry** 필드 필수 추가.

- **D-12:** **Deterministic keyword matcher** for `/sunco:do` classifier. Phase 27의 목적은 surface simplification이지 intent AI가 아님. `do`는 front-door이므로 LLM latency/cost 금지. Verb/noun keyword 사전 + phase state hint 조합.
  - **Classifier output shape** (Plan B 계약): `{ category, confidence, matched_signals[], fallback_reason? }`
  - **Low-confidence fallback:** LLM 호출 금지. 저신뢰도면 `deep` 또는 `next`로 라우팅.
  - **Tests required:** Korean + English trigger phrase coverage (verb/noun 사전 양방향).
  - **Phase 28 hook:** advisor-assisted hybrid routing은 Phase 28 advisor harness 완료 후 옵트인. Phase 27에서 LLM fallback은 없음.

- **D-13:** `.sun/active-work.json` = 초안 + `active_phase.plan_id` 1개 필드만 추가. 추가로 D-11 consequence로 **`routing_misses[]`** 필드 필수. 나머지 확장(failed_skill_calls, expected_finish_at, session_id)은 후속 phase.

- **D-14:** Background work visibility = **status/next 에만 노출**. `do`, `quick`, `execute` 등 action-oriented 명령에는 표시 X. 규칙:
  - 최대 **3건** 표시
  - `running` 상태 포함
  - `completed` 는 최근 **30분 이내**만 포함
  - 정보 전용. 사용자 선택을 요구하지 않음 (no interactive choice).
  - Rationale: status/next = orientation command, action command는 실행 집중.

- **D-15:** **2 plan 순차** (A → B, 병렬 금지):
  - **Plan A** = active-work artifact + lifecycle hook + status integration + next integration + background visibility rules
  - **Plan B** = category classifier + do routing + review routing integration + recommender rule updates
  - Rationale: A = 상태 표면, B = 라우팅 표면. 실패 모드가 다름. 같은 `packages/skills-workflow/`를 공유하므로 병렬 금지.

### Claude's Discretion

- Classifier 판정 근거 문구의 정확한 형식 ("→ quick: ad-hoc fix" 류)
- Active-work 섹션의 `status`/`next` 출력 포맷 (Ink 컴포넌트 재사용)
- Recommender rule priority 조정 (기존 30+ rule과 충돌 회피)
- Lifecycle hook 재진입 방지 (skill 내부에서 skill 호출 시 double-write 방지)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 27 스펙 원문
- `.planning/research/opencode-integration.md` §2 — Phase 27 정식 스펙
- `.planning/research/advisor-tool-integration.md` — Phase 28 예정, **Phase 27에서는 읽지 말 것** (scope 오염 방지)

### SUNCO 규약
- `CLAUDE.md` — Skill-only, deterministic-first, ESM-only
- `.claude/rules/conventions.md` — `defineSkill()` 패턴, import 규약
- `.claude/rules/architecture.md` — Monorepo 구조
- `.claude/rules/workflow.md` — 게이트 정의
- `packages/cli/references/product-contract.md` — Runtime paths, state/config schema, hook contracts

### Skill 타깃 (수정 대상)
- `packages/skills-workflow/src/do.skill.ts` — classifier + routing
- `packages/skills-workflow/src/next.skill.ts` — active-work 소비, 3-section output
- `packages/skills-workflow/src/review.skill.ts` — category-aware auto-delegation
- `packages/skills-workflow/src/status.skill.ts` — active-work 섹션 추가

### Core (수정/신규)
- `packages/core/src/state/active-work.ts` **(신규)** — write/read API
- `packages/core/src/state/active-work.types.ts` **(신규)** — Zod schema
- `packages/core/src/recommend/rules.ts` — 4 rule 추가
- `packages/skills-workflow/src/shared/lifecycle-hooks.ts` — active-work 업데이트 hook

### 참고 (건드리지 말 것)
- `packages/core/src/agent/providers/claude-cli.ts` — Phase 28 advisor 전용
- `packages/core/src/agent/providers/claude-sdk.ts` — Phase 28 advisor 전용
- Permission schema — Phase 27 scope 아님

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `defineSkill()` + `kind: 'prompt' | 'deterministic'` — classifier를 prompt skill 대신 do.skill.ts 내부 분기로 흡수 가능
- `SkillRegistry` + `tier` 필드 (Phase 25에서 추가됨) — Phase 27은 tier 추가 없이 기존 것 소비
- `recommend/rules.ts` — 30+ 규칙, priority 조정 가능
- `shared/lifecycle-hooks.ts` — pre/post skill hook 등록 메커니즘 이미 존재
- `.sun/state.db` + `.sun/` 플랫 파일 — active-work.json 위치로 적합

### Established Patterns
- 스킬 간 호출: `await ctx.run('workflow.quick')` via skill ID
- 상태 persistence: `ctx.state.set('skillName.lastResult', data)`
- JSON artifact write: 기존 state engine 플랫 파일 API 재사용
- Ink adapter 출력: `ctx.ui.section('Background work')` 패턴 (status skill 기존 코드)

### Integration Points
- `do.skill.ts` entry — category 판정 → `ctx.run('workflow.quick' | 'workflow.execute' | ...)`
- `next.skill.ts` — STATE.md + active-work.json 병합해서 추천
- `review.skill.ts` — Phase 25 auto-routing 로직에 category 신호 추가 (ceo/eng/design + category)
- `status.skill.ts` — 기존 section 아래 "Background work" / "Active phase" 섹션 추가
- `lifecycle-hooks.ts` — post-skill hook에서 `active-work.ts` write 호출

</code_context>

<specifics>
## Specific Ideas

### Category 6종 → 기존 skill 매핑

| Category | Target skill(s) | 판정 예시 |
|---|---|---|
| `quick` | `workflow.quick`, `workflow.fast` | "typo in README", "rename this var" |
| `deep` | `workflow.execute`, `workflow.auto` | "implement phase 27", "run plan A" |
| `planning` | `workflow.discuss`, `workflow.plan` | "I want to add X feature", "design the approach" |
| `review` | `workflow.review` (→ ceo/eng/design) | "review my PR", "audit this" |
| `debug` | `workflow.debug`, `workflow.diagnose`, `workflow.forensics` | "tests failing", "why is X broken" |
| `visual` | `workflow.ui-phase`, `workflow.design-review`, `workflow.ui-review` | "fix the button hover", "improve layout" |

### `do` 출력 프리뷰
```
→ quick: ad-hoc fix
running workflow.quick "typo in README line 42"
```

### `next` 3-section 출력 프리뷰
```
## Next
→ /sunco:verify — execute complete, 7-layer verification pending

## Background work
- research_agent (afb87…) Oh-My-OpenAgent research — completed 2m ago

## Blocked
(none)
```

### `.sun/active-work.json` locked schema (D-13 + D-11 routing-miss)
```jsonc
{
  "updated_at": "2026-04-10T12:34:56Z",
  "active_phase": {
    "id": "27",
    "slug": "omo-inspired-harness-ux",
    "state": "in_progress",
    "current_step": "execute",
    "category": "deep",
    "plan_id": "27-01"
  },
  "background_work": [
    {
      "kind": "research_agent",
      "agent_id": "afb872b67e1b2a497",
      "started_at": "2026-04-10T12:20:00Z",
      "description": "Oh-My-OpenCode ecosystem research",
      "state": "completed"
    }
  ],
  "blocked_on": null,
  "next_recommended_action": {
    "command": "/sunco:verify",
    "reason": "execute phase completed, 7-layer verification pending",
    "category": "review"
  },
  "recent_skill_calls": [
    { "skill": "workflow.plan", "at": "2026-04-10T12:10:00Z", "duration_ms": 48000 }
  ],
  "routing_misses": [
    {
      "at": "2026-04-10T12:15:00Z",
      "input": "write docs for active-work",
      "classified_as": "quick",
      "fallback_reason": "low_confidence_no_verb_match",
      "user_correction": null
    }
  ]
}
```

### Classifier output shape (D-12 locked)
```ts
type ClassifierResult = {
  category: Category; // quick | deep | planning | review | debug | visual
  confidence: number; // 0..1
  matched_signals: Array<{ kind: 'verb' | 'noun' | 'phase_state' | 'phrase'; value: string }>;
  fallback_reason?: 'low_confidence' | 'ambiguous_multi_match' | 'no_match';
  // Low-confidence requests MUST route to `deep` or `next`. NO LLM fallback in Phase 27.
};
```

### 신규 recommender rule (4개)
- `category_detected_quick` — classifier가 quick 판정 시 `/sunco:quick` 권장
- `background_work_stale` — background agent 5분 이상 대기 시 status 확인 권장
- `blocked_but_no_advisor` — blocked 30분 이상이면 (Phase 28 완료 후) advisor 호출 권장 — **Phase 27에서는 stub만**, advisor 호출 X
- `next_action_ambiguous` — STATE.md 읽어도 다음 액션 불분명하면 `/sunco:discuss` 권장

</specifics>

<deferred>
## Deferred Ideas

- **Advisor 호출** — Phase 28 Claude Code Advisor Harness에서 처리. Phase 27의 `blocked_but_no_advisor` rule은 **stub trigger**만 작성하고 실제 advisor 호출은 Phase 28 머지 후 배선.
- **LSP / AST-Grep deterministic tools** — Phase 28+ 후보
- **Hashline stale-edit guard** — Phase 29 후보 (실험)
- **Read-only CLI dashboard TUI** — Phase 30 후보 (`sunco dashboard`, active-work.json 소비)
- **`sunco do` classifier의 다국어(영어/한국어 외) 지원** — 기본은 ko/en만
- **Category 확장**(`docs`, `release`, `migrate` 등) — D-11 논의 결과에 따라 후속 phase로 이관

</deferred>

---

*Phase: 27-omo-inspired-harness-ux*
*Context gathered: 2026-04-10*
