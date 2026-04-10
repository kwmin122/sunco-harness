# Phase 27 Discussion Log

**Started:** 2026-04-10
**Upstream research:** `.planning/research/opencode-integration.md` §2, §5
**Status:** 5 pre-decisions open, awaiting user answers

---

## Pre-decisions

### D-11: Category 6종 커버리지

> `quick` / `deep` / `planning` / `review` / `debug` / `visual` 로 SUNCO 실제 워크플로를 충분히 커버하는가?

**Candidate gaps:**
- `docs` — 문서 작성/정리 (현재는 `quick`에 흡수 가능)
- `release` — 릴리스/배포 흐름 (현재는 `deep`에 흡수 가능)
- `migrate` — 마이그레이션 (현재는 `deep`에 흡수 가능)
- `research` — 외부 조사 (현재는 `planning`에 흡수 가능)

**Tradeoff:** category 수가 늘면 classifier 정확도 하락, 사용자가 routing table을 의식하기 시작함 (category가 사용자에게 "보이기" 시작).

**Recommendation:** 6개로 시작. 실제 miss가 관측되면 Phase 28+에서 추가.

**Decision:** _pending_

---

### D-12: Classifier 구현 방식

> `/sunco:do`의 category classifier를 **prompt skill (LLM)** 로 둘지, **deterministic keyword matcher** 로 둘지?

| 옵션 | 장점 | 단점 |
|---|---|---|
| **A. Deterministic keyword matcher** | zero LLM cost, 결정적, 테스트 쉬움, `deterministic-first` 원칙 부합 | edge case 많음, "implement advisor support" 같은 문장에서 오판 가능 |
| **B. Prompt skill (LLM)** | 자연어 robust, 판정 근거 설명 가능 | LLM 비용, 느림, 결정적 아님 |
| **C. Hybrid** (keyword 우선 → fallback to LLM) | 흔한 패턴 cheap, 모호할 때만 LLM | 구현 복잡도 ↑ |

**SUNCO 원칙:** deterministic-first. 린터/테스트로 강제 가능한 건 LLM 안 씀.

**Recommendation:** **A로 시작**. Phase 27 scope 안에서 keyword matcher (동사/명사 사전 + phase state hint) 로 1차 구현. 실제 miss가 관측되면 Phase 28 Advisor Harness와 묶어서 B 또는 C로 확장.

**Decision:** _pending_

---

### D-13: `.sun/active-work.json` 스키마

> 초안 (CONTEXT §specifics) 이 필요한 데이터를 다 담는가?

초안 필드:
- `updated_at`
- `active_phase` { id, slug, state, current_step, category }
- `background_work[]` { kind, agent_id, started_at, description, state }
- `blocked_on` nullable { reason, since }
- `next_recommended_action` { command, reason, category }
- `recent_skill_calls[]` { skill, at, duration_ms }

**Potential additions:**
- `active_phase.plan_id` — 현재 실행 중인 plan 식별자 (plan-gate/execute 연동)
- `background_work[].expected_finish_at` — stale 감지용
- `failed_skill_calls[]` — 최근 실패만 따로 추적 (debug 진입 hint)
- `session_id` — 멀티 세션 대응

**Potential removals:**
- `recent_skill_calls` 의 `duration_ms` — 없어도 됨 (timeline skill에 이미 있음)

**Recommendation:** 초안 + `active_phase.plan_id` 1개만 추가. 나머지는 후속 phase에서 확장.

**Decision:** _pending_

---

### D-14: Background work visibility threshold

> foreground skill 출력에 background work 가시화가 spam 되지 않을 규칙?

**Candidate rules:**
- **R1:** 최대 3건만 표시, 가장 최근 순
- **R2:** `state: running` 인 것만 표시, `completed` 는 30분 이내만
- **R3:** 5초 미만 짧은 작업은 skip
- **R4:** `status` 와 `next` 출력에만 노출. `do` / `quick` / `execute` 출력에는 표시 X (classifier/실행 맥락에서 방해 금지)

**Recommendation:** R1 + R2 + R4 조합. R3는 의미 있지만 구현 복잡도 ↑, skip.

**Decision:** _pending_

---

### D-15: Plan 수 (1 vs 2)

> Phase 27을 1 plan 통합으로 갈지, 2 plan 순차로 갈지?

| 옵션 | 장점 | 단점 |
|---|---|---|
| **1 plan** | reviewer 한 번, commit stream 응집 | single plan 안에서 사실상 2개 흐름 혼재, reviewer 부담 ↑ |
| **2 plan 순차 (A → B)** | 관심사 분리 (Plan A = core artifact/state, Plan B = skill UX), plan-gate 중간 체크포인트 | 계획 오버헤드, 2번 review |

- Plan A = active-work artifact + lifecycle hook + status/next 소비
- Plan B = do classifier + review auto-routing 확장 + recommender rules

**Recommendation:** **2 plan 순차.** A가 먼저 완성되면 B가 `.sun/active-work.json` 를 전제로 작성 가능. A 없이 B 작성하면 status/next 가 consume 할 데이터가 없음.

**Decision:** _pending_

---

## User answers (2026-04-10)

### D-11 → option 1 (6 categories)
> "지금 목표는 taxonomy를 완성하는 게 아니라 사용자가 category를 몰라도 SUNCO가 알아서 라우팅하는 것입니다. category가 8개로 늘면 classifier가 '정확한 분류기'가 되어야 하고, 실패 시 사용자가 다시 구분을 의식하게 됩니다. docs는 현재 quick 또는 deep 안에서 intent/action으로 처리하면 충분합니다. release는 별도 category라기보다 workflow state가 verified/done일 때 next가 추천할 action입니다."
>
> **Consequence:** Add routing-miss telemetry to active-work/recommender artifacts. If docs/release misroutes recur, revisit in a later phase.

### D-12 → option 1 (deterministic keyword matcher)
> "Phase 27 목적은 'surface simplification'이지 '고급 intent AI classifier'가 아닙니다. do는 front-door라 느려지면 안 됩니다. deterministic이면 routing miss를 테스트와 telemetry로 잡을 수 있습니다. Phase 28 Advisor Harness가 들어오면 그때 ambiguous fallback을 붙이면 됩니다. 처음부터 hybrid로 가면 classifier 자체가 새 엔진이 되어 scope가 커집니다."
>
> **Consequences:**
> - Classifier output must include `category, confidence, matched_signals, fallback_reason`
> - Low-confidence requests route to `deep` or `next`, NOT to LLM
> - Tests must cover Korean and English trigger phrases
> - No LLM classifier in Phase 27

### D-13 → option 1 (초안 + plan_id)
> 초안 + `active_phase.plan_id` 1 field. Plus **`routing_misses[]`** (D-11 consequence). 나머지 확장은 후속 phase로.

### D-14 → option 1 (R1+R2+R4)
> "background visibility는 너무 많이 보이면 Phase 25에서 줄인 surface가 다시 복잡해집니다. status/next에만 노출하는 게 맞습니다. do, quick, execute는 사용자가 목적을 실행하는 흐름이라 background 정보를 끼워 넣으면 산만해집니다. running + 최근 30분 completed만 보여주면 '지금 무슨 일이 돌아가나'는 보이고, 오래된 완료 작업은 노이즈가 안 됩니다."
>
> **Rules:**
> - At most 3 background work items
> - Include running work
> - Include completed work only if completed within last 30 minutes
> - NOT shown in `do`, `quick`, `execute`, or other action-oriented flows
> - Informational only, no user choice required

### D-15 → option 1 (2 plan 순차)
> "Plan은 2개로 나누는 게 맞습니다. active-work/status/next는 상태 표면이고, classifier/do/review는 routing 표면이라 실패 모드가 다릅니다. 같은 packages/skills-workflow를 만지므로 병렬 금지도 맞습니다."
>
> **Plan A:** active-work artifact + lifecycle hook + status integration + next integration + background visibility rules
> **Plan B:** category classifier + do routing + review routing integration + recommender rule updates
> **Order:** A → B (sequential, no parallel)

---

## Locked decisions

All 15 decisions (D-01 through D-15) are locked. See `27-CONTEXT.md` <decisions> section for the canonical list.

**Ready for:** Plan A + Plan B drafting.
**Blocker on drafting:** none.
