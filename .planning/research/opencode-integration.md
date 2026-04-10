# OMO (Oh-My-OpenCode) UX 이식 — Phase 27 재정렬

**Date:** 2026-04-10
**Refocused from:** OpenCode core 아키텍처 전체 이식 → OMO harness UX 패턴 부분 차용
**Reason:** SUNCO의 현재 병목은 "기능 부족"이 아니라 **"사용자가 뭘 써야 하는지 모름"**. Phase 25 (workflow surface simplification) 직후라 명령어 확장은 역행. OpenCode core (server/SDK/MCP/LSP)는 너무 크고 scope 충돌 위험.

---

## 0. 재정렬 요약

### 이전 계획 (폐기)

> Phase 27-31: OpenCode core 전체 이식 (permission+config → watcher+MD commands → session schema → MCP+instructions → server+SDK). 병렬 실행 가능.

**왜 폐기:**
1. Phase 25 surface simplification 직후 command zoo 확장은 역행
2. server/SDK/MCP/session schema는 서로 충돌 (provider, config, state 동시 수정)
3. 병렬 실행 주장은 위험 — 모두 core layer 건드림
4. 실제 사용자 문제 ("뭘 써야 하는지 모름")와 거리가 멈

### 수정 계획

> **Phase 27 — OMO-Inspired Agent Harness UX**
>
> OMO의 "사용자가 agent를 몰라도 harness가 알아서 굴러가는" 패턴만 기존 front door (`do`, `next`, `review`, `status`) 내부에 흡수한다. 새 명령 없음, 새 agent zoo 없음.

후속 phase는 제품 가치가 증명된 후 결정:
- Phase 28 후보: LSP/AST-Grep deterministic tools
- Phase 29 후보: Hashline stale-edit guard (실험)
- Phase 30 후보: Read-only dashboard

OpenCode core (server/SDK/MCP/세션 DB/데스크톱)는 **전면 보류**.

---

## 1. OMO에서 배울 것 vs 배우지 말 것

### 1.1 배울 것 — Phase 27 scope 안에 포함

| OMO 패턴 | SUNCO 적용 지점 | 구현 부담 |
|---|---|---|
| **Category routing** (`visual-engineering`/`deep`/`quick`/`ultrabrain`) | 기존 `sunco do` 내부 classifier + 기존 `/sunco:quick`, `/sunco:auto`, `/sunco:review` 등으로 라우팅 | 낮음 (새 명령 X) |
| **Discipline agents** (planner/debug/search/deep worker as internal roles) | 기존 SUNCO review 라우팅 (`ceo-review`, `eng-review`, `design-review`)과 category를 결합 | 중간 |
| **Background agent visibility** (보이지 않는 동시 작업) | `sunco next`, `sunco status`에 "진행 중인 백그라운드 워크" 요약 | 중간 |
| **Boulder/dashboard artifact pattern** (`.sisyphus/boulder.json` 같은 read-only status) | `.sun/active-work.json` 생성, `sunco status` + recommender가 consume | 낮음 |
| **ultrawork / loop UX** (장기 작업을 loop로 굴림) | 기존 `/sunco:auto`, `/sunco:execute`의 **UX mode**로 흡수 (새 명령 X) | 낮음 |

### 1.2 배우지 말 것 — 명시적 defer

| OMO/OpenCode 패턴 | 왜 defer |
|---|---|
| OpenCode client-server split, typed SDK | Phase 25 직후 역방향, core 재작성 수준 |
| MCP full support | 유혹 크지만 scope 폭발. 별도 phase로 격리 후 plan |
| LSP 30+ server wiring | 같은 이유 |
| MD slash commands | skill-only 모델 흐림. 추후 "MD → skill compile" 방식으로 재검토 |
| OMO agent zoo (Sisyphus/Hephaestus/Prometheus/...) 이름 복제 | 사용자는 더 혼란. 내부 역할로만 흡수 |
| Hashline edit guard | 가치 큼, 단 실행 엔진 깊숙이 건드림 — 별도 실험 phase (29 후보) |
| Desktop/Electron/ghostty-web 임베드 | SUNCO Swift/libghostty 계획과 경쟁. 사용자 결정 후 |
| Config variable substitution `{env:}`/`{file:}` | 매력적이지만 Phase 27 scope 초과. Phase 30+에서 재검토 |
| AGENTS.md remote URL fetch | 비결정적 network 의존. Phase 30+에서 allowlist 고민 |
| Permission pattern matching 확장 | 현재 `PermissionSet`이 부족하지만 Phase 27의 사용자 UX 개선과 무관. 별도 phase |

### 1.3 SUNCO가 이미 더 나은 것 — 유지, 이식 X

- **Skill-Only richness** — OpenCode가 plugin/agent/skill 3개로 분리한 걸 `defineSkill()` 하나로 통합. 3개의 독립 community skill-manager plugin이 OpenCode native 부족을 증명. 희석 금지.
- **Deterministic gate 철학** — `harness.lint`, `harness.health`, `harness.guard`는 zero-LLM. OpenCode엔 없음. 유지.
- **7-layer Swiss cheese verify** — `workflow.verify`. 유지.
- **Planning artifacts (ROADMAP/PLAN/CONTEXT/VERIFICATION)** — 유지.
- **Proactive recommender** (`packages/core/src/recommend/rules.ts` 30+ rules) — 유지, Phase 27에서 확장.
- **Korean-first** — 유지.

---

## 2. Phase 27 — OMO-Inspired Agent Harness UX (정식 스펙)

### 2.1 Goal

> 사용자가 자연어 요청을 입력하면 SUNCO가 작업 유형을 분류하고 기존 front door skill로 라우팅한다. 사용자는 expert 명령(`/sunco:plan-gate`, `/sunco:dogfood-gate` 등)을 알 필요가 없다.

### 2.2 Core principle

**새 명령어를 추가하지 않는다.** 모든 변경은 **기존 front door 내부 개선**.

- `/sunco:do` — classifier + 라우팅 확장
- `/sunco:next` — 추천 이유 + background work 가시화
- `/sunco:review` — category-aware 라우팅
- `/sunco:status` — active work 요약 섹션 추가
- 신규 skill 수: **0개**
- 신규 명령 수: **0개**

### 2.3 Scope (exact list)

#### 2.3.1 Category classifier

6개 category (OMO 참고, SUNCO-쪽 이름):

| Category | SUNCO 매핑 |
|---|---|
| `quick` | `/sunco:quick`, `/sunco:fast` — 10분 이내 ad-hoc 작업 |
| `deep` | `/sunco:execute` + `/sunco:auto` — 현재 phase 실행 |
| `planning` | `/sunco:discuss` → `/sunco:plan` |
| `review` | `/sunco:review` → ceo/eng/design 자동 라우팅 |
| `debug` | `/sunco:debug`, `/sunco:diagnose`, `/sunco:forensics` |
| `visual` | `/sunco:ui-phase`, `/sunco:design-review`, `/sunco:ui-review` |

`/sunco:do`에 category classifier 추가 — 자연어 입력에서 category 추출 후 기존 skill로 위임. Classifier는 **prompt skill** (기존 `do.skill.ts` 내부 LLM 호출 강화).

#### 2.3.2 Active work artifact

신규 파일: `.sun/active-work.json` (read-only status source)

```jsonc
{
  "updated_at": "2026-04-10T12:34:56Z",
  "active_phase": {
    "id": "27",
    "slug": "omo-inspired-harness-ux",
    "state": "in_progress",
    "current_step": "execute",
    "category": "deep"
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
  ]
}
```

**Write:** `packages/core/src/state/active-work.ts` 신규 — skill lifecycle hook에서 업데이트
**Read:** `/sunco:status`, `/sunco:next`, recommender rules

#### 2.3.3 Front door 개선

| 명령 | 추가할 것 |
|---|---|
| `/sunco:do "..."` | classifier → category 판정 → 기존 skill 라우팅 + 판정 근거 1줄 표시 |
| `/sunco:next` | "다음 할 일" + "현재 백그라운드 진행 중인 것" + "블록된 것" 3 섹션 |
| `/sunco:review` | category 자동 감지 (plan 진행 중이면 eng-review, UI phase면 design-review) |
| `/sunco:status` | 기존 출력 + `active-work.json` 요약 섹션 |

**구현 파일:**
- `packages/skills-workflow/src/do.skill.ts` — classifier 추가
- `packages/skills-workflow/src/next.skill.ts` — active-work 통합
- `packages/skills-workflow/src/review.skill.ts` — category-aware routing
- `packages/skills-workflow/src/status.skill.ts` — active-work 섹션

#### 2.3.4 Recommender rules 확장

`packages/core/src/recommend/rules.ts`에 추가:

- `category_detected_quick` — 입력이 quick category로 판정되면 `/sunco:quick` 권장
- `background_work_stale` — background agent가 5분 이상 대기 중이면 status 확인 권장
- `blocked_but_no_advisor` — blocked 상태에서 30분 이상이면 (Phase 27 완료 후) advisor 호출 권장
- `next_action_ambiguous` — STATE.md 읽어도 다음 액션이 불분명하면 `/sunco:discuss` 권장

### 2.4 Non-goals (out of scope)

- **새 skill, 새 명령 추가 금지**
- **OMO agent 이름 복제 금지** (Sisyphus/Hephaestus/Oracle/Librarian 이름으로 SUNCO에 등장 X)
- **OMO의 /ultrawork 같은 별도 엔트리 추가 금지** — 기존 `/sunco:auto`의 UX mode로 흡수
- **OpenCode server/SDK/MCP/LSP 일체 미포함**
- **MD slash commands 미포함**
- **Hashline edit guard 미포함**
- **Config variable substitution 미포함**
- **AGENTS.md remote fetch 미포함**
- **Permission pattern matching 확장 미포함**

### 2.5 Acceptance criteria (BDD)

```gherkin
Feature: OMO-inspired front door harness

  Scenario: Natural language routes to quick category
    Given user types `/sunco:do "typo in README line 42"`
    When classifier runs
    Then category is "quick"
    And SUNCO invokes `/sunco:quick` with the original text
    And the output shows "→ quick: ad-hoc fix"

  Scenario: Natural language routes to planning category
    Given user types `/sunco:do "I want to add advisor support to plan skill"`
    When classifier runs
    Then category is "planning"
    And SUNCO suggests `/sunco:discuss` or `/sunco:plan` depending on phase state
    And the output shows "→ planning: phase context needed"

  Scenario: Status shows background work
    Given a research agent is running in background
    When user runs `/sunco:status`
    Then output includes "Background work" section
    And the background agent is listed with its ID and state

  Scenario: Next action reason is visible
    Given STATE.md says phase 27 execute is complete
    When user runs `/sunco:next`
    Then output shows "→ /sunco:verify" with reason "execute completed, 7-layer verification pending"
    And the output cites `.sun/active-work.json` as source

  Scenario: Review auto-routes to eng-review for plan phase
    Given active phase is in `plan` state
    When user runs `/sunco:review`
    Then SUNCO invokes `/sunco:eng-review` without asking
    And output shows "→ eng-review: active plan detected"

  Scenario: Active work artifact is written on skill completion
    Given any prompt skill completes
    When the lifecycle hook fires
    Then `.sun/active-work.json` is updated with the skill call entry
    And updated_at timestamp is current
```

### 2.6 대상 파일

| 파일 | 변경 |
|---|---|
| `packages/skills-workflow/src/do.skill.ts` | Category classifier + routing |
| `packages/skills-workflow/src/next.skill.ts` | active-work consumption + 3-section output |
| `packages/skills-workflow/src/review.skill.ts` | category detection + delegation |
| `packages/skills-workflow/src/status.skill.ts` | active-work 섹션 |
| `packages/core/src/state/active-work.ts` **(신규)** | write/read API |
| `packages/core/src/state/active-work.types.ts` **(신규)** | Zod schema |
| `packages/core/src/recommend/rules.ts` | 4 rule 추가 |
| `packages/skills-workflow/src/shared/lifecycle-hooks.ts` | active-work 업데이트 hook |
| `__tests__/workflow/do-classifier.test.ts` **(신규)** | classifier 단위 테스트 |
| `__tests__/state/active-work.test.ts` **(신규)** | artifact write/read 테스트 |
| `.planning/phases/27-omo-inspired-harness-ux/CONTEXT.md` | product-level UX 결정 |
| `.planning/phases/27-omo-inspired-harness-ux/PLAN.md` | 1-2 plan 최대 |

### 2.7 Plan 수

**최대 2 plan:**
1. **Plan A: Active work artifact + status/next integration** — `.sun/active-work.json` 생성 API, lifecycle hook, status/next 소비
2. **Plan B: Category classifier + do/review routing** — `do.skill.ts` classifier, review auto-delegation, recommender rules

두 plan은 **순차 실행** (병렬 금지 — 같은 skills-workflow 디렉토리 건드림).

---

## 3. Phase 28+ 후보 (승인 시)

### 3.1 Phase 28 — LSP / AST-Grep Deterministic Tools (후보)

**전제:** Phase 27 완료 + 사용자가 "코드 탐색 품질 개선 필요" 확인 후.

- `packages/core/src/tools/ast-grep.ts` — AST-Grep 래퍼 (cli 의존)
- `packages/skills-harness/src/graph.skill.ts` 확장 — AST 패턴 매칭
- `packages/skills-workflow/src/scan.skill.ts` — LSP-like 코드 이해 강화

OMO/OpenCode의 25-language AST-Grep 통합 아이디어 차용.

### 3.2 Phase 29 — Hashline Stale-Edit Guard (실험)

**전제:** Phase 27-28 완료 + 실제 stale-edit 사고 발생 후.

- Executor가 파일 read 시 각 줄에 content-hash 주입 (agent prompt에 공개)
- Edit 시 hash 검증, 불일치면 fail
- 실행 엔진 깊숙이 건드리므로 격리된 실험 phase

### 3.3 Phase 30 — Read-only Dashboard (후보)

**전제:** Phase 27의 `.sun/active-work.json`이 정착한 후.

- `packages/server` 없이 CLI `sunco dashboard` — Ink TUI로 read-only view
- `.sun/active-work.json` + `.planning/` 읽어서 real-time 표시
- Web dashboard는 요구 사항 확인 후

**OpenCode의 `oh-my-opencode-dashboard` 참고** — 127.0.0.1 바인딩, read-only, artifact 기반.

### 3.4 절대 안 할 것 (장기)

- OpenCode client-server split (대형 재작성)
- `@opencode-ai/sdk` 스타일 typed SDK (premature)
- MCP full support (scope 폭발)
- Desktop/Electron (범위 초과)
- Agent marketplace/registry (premature)

---

## 4. OMO/OpenCode 조사 요약 (참조용, 단순 참고 자료)

전체 세부 findings는 이전 버전 문서 git history 참고. 여기서는 **Phase 27에 직접 영향을 주는 것만** 요약.

### 4.1 OMO 핵심 아이디어 (Phase 27에 반영됨)

- **Category-based routing** (`visual-engineering`/`deep`/`quick`/`ultrabrain`) → SUNCO Phase 27 category classifier
- **Discipline agents** (Sisyphus orchestrator / Prometheus planner / Oracle debug / Librarian search) → SUNCO는 **이름 복제 X**, 기존 review 라우팅에 category 결합만
- **`.sisyphus/boulder.json` dashboard source** → SUNCO `.sun/active-work.json`
- **ultrawork loop command** → SUNCO는 **기존 `/sunco:auto` UX mode로 흡수**, 새 명령 X

### 4.2 OMO 아이디어 중 의도적으로 거부한 것

- **26개 custom tool** (LSP, AST-Grep, Tmux, background agents) — 너무 많음, Phase 28 후보로 격리
- **Hashline edit guard** — 가치 크지만 위험 — Phase 29 후보
- **Category-based model selection** (visual-engineering → GPT-5.4, deep → Opus) — SUNCO는 Claude Code 구독, model selection은 advisor harness (Phase 27의 advisor 부분 또는 별도)
- **6개 discipline agent 이름 복제** — 사용자 혼란 가중, 절대 안 함

### 4.3 OpenCode core 중 Phase 27과 무관한 것 (defer)

- Client-server split (Hono server)
- Typed SDK (`@opencode-ai/sdk`)
- Session DB (Drizzle SessionTable + revert/snapshot)
- MCP native support
- LSP 30+ server wiring
- ACP (Agent Client Protocol)
- `.opencode/commands/*.md` template syntax
- AGENTS.md 8-tier precedence + remote fetch
- Permission pattern matching 확장 (`"bash": { "git *": "allow" }`)
- Config variable substitution (`{env:}`, `{file:}`)
- File watcher hook
- Compaction hook
- Desktop/Electron/PWA
- Managed config paths

**전부 value 있지만 현재 scope 초과.** Phase 27 검증 + 사용자 승인 후 개별 evaluation.

---

## 5. 의사결정 체크포인트

Phase 27 진입 전 사용자 승인 필요:

1. **Category 6개** (`quick`/`deep`/`planning`/`review`/`debug`/`visual`)가 SUNCO 실제 워크플로 커버리지로 충분한가? 빠진 category 있는가?
2. **`/sunco:do` classifier**를 prompt skill로 둘지, deterministic keyword matcher로 시작할지? (후자가 cheap, 전자가 robust)
3. **`.sun/active-work.json`** 스키마 초안이 필요한 데이터를 다 담고 있는가?
4. **Background work visibility**가 foreground skill에 대한 spam이 되지 않을 threshold?
5. **Phase 27은 1 plan으로 줄일지 2 plan 유지할지?** (사용자 preference)

이 5개가 정해지면 `/sunco:discuss 27` → `/sunco:plan 27` 진행.

---

## 6. 재작성 전/후 비교

| 측면 | 이전 버전 | 수정 버전 |
|---|---|---|
| Phase 범위 | 27-31 (5 phase) | 27 (1 phase) |
| Plan 수 | 10+ plan | 최대 2 plan |
| 신규 명령 | 많음 (MD commands, server, SDK) | **0개** |
| 신규 skill | 많음 | **0개** (기존 skill 개선만) |
| Core 건드림 | provider, config, session, MCP 동시 | state + recommender 만 |
| 병렬 가능 | 주장했으나 위험 | 명시적 순차 |
| 사용자 문제 해결 | 간접 (기능 추가) | 직접 (뭘 써야 할지 안내) |

---

## 7. 참조

**OMO:**
- https://github.com/code-yeongyu/oh-my-openagent
- https://ohmyopenagent.com/
- https://github.com/alvinunreal/oh-my-opencode-slim
- https://github.com/WilliamJudge94/oh-my-opencode-dashboard

**OpenCode (참고만, 이식 대상 아님):**
- https://opencode.ai/docs
- https://github.com/sst/opencode
- https://github.com/awesome-opencode/awesome-opencode

**SUNCO 대상 파일:**
- `packages/skills-workflow/src/{do,next,review,status}.skill.ts`
- `packages/core/src/state/` (active-work 신규)
- `packages/core/src/recommend/rules.ts`
- `packages/skills-workflow/src/shared/lifecycle-hooks.ts`
- `.planning/phases/27-omo-inspired-harness-ux/`

**사용자 메모리 관련:**
- `project_ux_surface.md` — UX surface redesign (3계층 분리: user 5개 / workflow 5개 / expert 숨김)
- `project_light_harness.md` — OMC/OMO/OMX 리서치 기반 Phase 17-21 배경
- `feedback_model_preference.md` — Opus=계획/디버깅, Sonnet=구현/단순작업
