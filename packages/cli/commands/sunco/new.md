---
name: sunco:new
description: 아이디어에서 로드맵까지 새 프로젝트 부트스트랩 — 질문, 리서치, 요구사항, 로드맵을 하나의 흐름으로. 그린필드 프로젝트를 시작할 때 사용.
argument-hint: "[idea] [--auto] [--no-research]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Flags:**
- `--auto` — 자동 모드. 아이디어 문서(@file.md 또는 인라인 텍스트)를 입력으로 받아, 확인 단계를 건너뛰고 즉시 모든 산출물을 생성.
- `--no-research` — 병렬 리서치 에이전트를 건너뜀. 질문 후 바로 합성으로 진행.

**Default project-start flow:**
1. Office hours — pressure-test the problem, user, demand evidence, status quo, and narrowest wedge.
2. Brainstorming — generate multiple candidate directions before committing to a plan.
3. SUNCO new — synthesize the selected direction into planning artifacts.

**This command creates:**
- `.planning/PROJECT.md` — 프로젝트 비전, 요구사항, 핵심 결정사항
- `.planning/REQUIREMENTS.md` — 카테고리별 v1/v2 요구사항 (ID 포함)
- `.planning/ROADMAP.md` — 요구사항에 매핑된 페이즈 구조
- `.planning/STATE.md` — 프로젝트 메모리 (현재 페이즈, 결정사항, 차단요소)
- `.planning/config.json` — 워크플로우 설정

**After this command:** Run `/sunco:discuss 1` to extract decisions for Phase 1 before planning.
</context>

<objective>
아이디어를 받아 프로젝트의 모든 계획 산출물을 생성한다. 모든 후속 실행의 품질이 이 시점의 질문과 계획의 깊이에 달려 있다. 모든 역량을 투입하라.

오피스아워 → 브레인스토밍 → 리서치 (4개 병렬 에이전트) → PROJECT.md → REQUIREMENTS.md → ROADMAP.md → STATE.md → config.json → 커밋.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/new-project.md end-to-end.
</process>

<success_criteria>
- Office-hours and brainstorming context used as primary source material, not discarded
- `.planning/PROJECT.md` written: What This Is, Requirements (Active/Validated/Out of Scope), Key Decisions table, Evolution rules
- `.planning/REQUIREMENTS.md` written: categorized v1/v2/Out of Scope requirements with IDs, Traceability section
- `.planning/ROADMAP.md` written: summary table, 2-4 phases each with Goal, Requirements covered, and 3+ testable Success criteria
- `.planning/STATE.md` written: current phase 1, next action set to `/sunco:discuss 1`
- `.planning/config.json` written: mode, granularity, workflow agent settings
- All artifacts committed: `docs: initialize [project name] planning artifacts`
- Summary report shown with project name, core value, requirement count, phase count
- User directed to run `/sunco:discuss 1`
</success_criteria>
