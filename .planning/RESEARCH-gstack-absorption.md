# gstack → SUNCO 흡수 설계서 v2

> gstack의 모든 고유 기능을 SUNCO에 흡수. 교체가 아닌 강화.

## SUNCO에 없는 gstack 고유 기능 (우선순위순)

### P1: 핵심 메커니즘

| # | 기능 | gstack 구현 | SUNCO 현재 | 흡수 전략 |
|---|------|------------|-----------|----------|
| 1 | **Scope Drift Detection** | review에서 diff vs stated intent 비교, CLEAN/DRIFT/MISSING 분류 | 없음 | verify Layer 5 adversarial에 통합 |
| 2 | **Plan Completion Audit** | plan 체크박스 추출 → diff 대비 DONE/PARTIAL/NOT DONE | 없음 | verify Layer 3 acceptance에 통합 |
| 3 | **Fix-First Review** | AUTO-FIX vs ASK 분류, batch 프레젠테이션, test stub override | 없음 | review.skill.ts에 추가 |
| 4 | **Confidence Calibration** | 1-10 점수 + 사용자 확인 시 재보정 | 없음 | VerifyFinding에 confidence 필드 추가 |
| 5 | **Dual-Model Adversarial** | Claude + Codex 독립 패스, 다중 모델 합의 시 신뢰도 부스트 | crossVerify (부분) | Layer 6 강화 |
| 6 | **Prior Skipped Finding Suppression** | 이전 리뷰에서 skip한 finding 자동 억제 | 없음 | skill-profile에 finding history 추가 |

### P2: 인프라

| # | 기능 | gstack 구현 | SUNCO 현재 | 흡수 전략 |
|---|------|------------|-----------|----------|
| 7 | **범용 Learnings System** | learnings.jsonl + 6개 타입 + confidence decay + dedup + cross-project | debug-learnings (부분) | debug-learnings를 범용으로 확장 |
| 8 | **Timeline + Predictive** | timeline.jsonl + 패턴 기반 다음 스킬 예측 | session-recorder (부분) | skill 레벨 타임라인 추가 |
| 9 | **Skill Routing Rules** | CLAUDE.md `## Skill routing` 섹션 | 없음 | init에서 자동 추가 옵션 |
| 10 | **Proactive Detection** | 키워드 기반 스킬 자동 제안 + config toggle | recommender (규칙 기반) | 자연어 키워드 매칭 레이어 추가 |
| 11 | **Context Recovery** | 세션 시작 시 자동 복구 (checkpoint/timeline/review) | pause/resume (수동) | SessionStart 훅에서 자동 |
| 12 | **Operational Self-Improvement** | PostSkill에서 자동 learning 저장 | 없음 | PostSkill 훅 등록 |

### P3: UX/철학

| # | 기능 | 핵심 | 흡수 전략 |
|---|------|------|----------|
| 13 | **Boil the Lake + 압축 표** | 100x/50x/30x/20x 노력 비율 | recommender에 effort delta 표시 |
| 14 | **Batch AskUserQuestion** | 여러 항목 한 번에 제시 | 스킬 UX 패턴으로 정의 |
| 15 | **Documentation Staleness** | diff vs .md 파일 비교 경고 | verify에 doc freshness 레이어 추가 |
| 16 | **Welcome-back Briefing** | 세션 시작 시 1문단 브리핑 | context recovery에 포함 |
| 17 | **Completion Status Protocol** | DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT | 스킬 result 타입에 추가 |
| 18 | **Escalation Protocol** | "Bad work is worse than no work" — 3회 실패 시 중단 | StuckDetector에 이미 있음 (확장) |

## gstack 철학 중 SUNCO에 흡수할 문장

1. "Building is not the performance of building. It is not tech for tech's sake."
2. "The complete implementation costs minutes more than the shortcut — do the complete thing."
3. "The most valuable outcome of searching is understanding WHY, then applying first-principles."
4. "Fixing symptoms creates whack-a-mole debugging."
5. "It is always OK to stop and say 'this is too hard for me'. Bad work is worse than no work."
6. "Assume the user hasn't looked at this window in 20 minutes."
7. "If claiming 'this is safe', cite the specific line proving it."
8. "Never output 'this looks fine' without evidence."

## Phase 24 구조 (예상)

- **Phase 24a: Learnings + Timeline** — 범용 learnings, timeline, context recovery, operational self-improvement
- **Phase 24b: Smart Review** — scope drift, plan audit, fix-first, confidence calibration, prior suppression
- **Phase 24c: Routing + Proactive** — CLAUDE.md routing, 자연어 매칭, welcome-back briefing
