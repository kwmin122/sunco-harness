# Roadmap: SUN (sunco)

## Overview

SUN is an Agent Workspace OS built as a CLI runtime with 49 skills. This roadmap delivers the v1 product across 10 phases, progressing from the kernel (CLI + infrastructure) through deterministic harness skills, standalone utilities, agent-powered workflow skills in dependency order, and finishing with composition and debugging capabilities. The 6-stage review pipeline and 5-layer Swiss cheese verification are built incrementally across phases -- deterministic layers first (Phase 2), BDD and agent-based layers later (Phase 7). Every phase delivers complete, usable skills. No stubs.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- **Phase 1: Core Platform** - CLI engine, config, skill system, state engine, agent router, recommender, UX foundations (completed)
- **Phase 2: Harness Skills** - init, lint, health, agents, guard -- deterministic backbone, zero LLM cost (completed)
- **Phase 3: Standalone TS Skills** - Session, ideas, phase management, settings, progress -- all deterministic (completed)
- **Phase 4: Project Initialization** - new and scan -- agent-powered project bootstrap (completed)
- **Phase 5: Context + Planning** - discuss, assume, research, plan -- the spec-driven workflow chain (completed)
- **Phase 6: Execution + Review** - execute with worktree isolation and multi-agent cross-review (completed)
- **Phase 7: Verification Pipeline** - 5-layer Swiss cheese, verify, validate, test-gen, review architecture (completed)
- **Phase 8: Shipping + Milestones** - ship, release, milestone lifecycle management (completed)
- **Phase 9: Composition Skills** - auto, quick, fast, do -- power-user orchestration (completed 2026-03-29)
- **Phase 10: Debugging** - debug, diagnose, forensics -- failure recovery and analysis (completed 2026-03-29)
- **Phase 11: Planning Quality Pipeline** - research-integrated planning, revision loop, requirements coverage (completed 2026-03-29)
- **Phase 12: Operational Resilience** - crash recovery, stuck detection, cost dashboard, budget ceiling, 3-tier timeout (v1.1) (completed 2026-03-29)
- **Phase 13: Headless + CI/CD** - headless mode, JSON query, exit codes, HTML reports (v1.1) (completed 2026-03-29)
- **Phase 14: Context Optimization** - context pre-injection, adaptive replanning, complexity routing, token profiles (v1.1) (completed 2026-03-29)
- **Phase 15: Document Generation** - HWPX, markdown docs, template system (v1.1, deferred to after v1.2)
- **Phase 16: Skill Marketplace** - install, publish, community registry (v1.1, deferred to after v1.2)
- **Phase 17: Context Intelligence** - context utilization zones, selective artifact loading, enhanced handoff, artifact summarizer (v1.2, completed 2026-04-06)
- **Phase 18: Smart Routing** - intent gate classification, tier-based model profiles, cost-aware routing, complexity metadata (v1.2, completed 2026-04-06)
- **Phase 19: Hook System v2** - lifecycle hooks, output size limits, declarative catch rules (v1.2, completed 2026-04-06)
- **Phase 20: Infinite Execution** - context rotation, adaptive timeouts, session progress records (v1.2, completed 2026-04-06)
- **Phase 21: Cross-Session Intelligence** - feature-session tracking, skill profiles, harness 5% budget (v1.2, completed 2026-04-06)
- **Phase 22: Ultraplan Integration** - Bridge to Claude Code /ultraplan for browser-based visual plan review (v1.3, completed 2026-04-07)
- **Phase 23a: Debug Iron Law Engine** - Iron Law Gate, 3-Strike Rule, 9-pattern classification, error sanitizer, freeze scope, prior learnings (v1.3)
- **Phase 23b: Review Army** - 8 specialist army, adaptive gating, cross-review dedup, confidence gate, test stub suggestion, multi-provider matrix (v1.3)
- **Phase 24a: Learnings + Timeline** - 범용 learnings system (6 type, decay, dedup), skill timeline, context recovery, welcome briefing (v1.3, completed 2026-04-07)
- **Phase 24b: Smart Review** - scope drift detection, plan completion audit (v1.3, completed 2026-04-07)
- **Phase 24c: Routing + Proactive** - CLAUDE.md skill routing, natural language keyword matching, proactive suggestion (v1.3, completed 2026-04-07)
- **Phase 24d: Harness Evolution** - Product-level planning pivot (PRODUCT-SPEC.md, delivery slices, slice-contracts), review arsenal (ceo/eng/design-review), compound learning loop (v1.3, completed 2026-04-08)
- **Phase 25: Workflow Surface Simplification** - User layer 5개(new/next/do/status/help)만 기본 노출, workflow/expert 명령 hidden 처리, help를 작업 목록으로 재설계, review auto-routing (CEO/ENG/DESIGN 상황 기반 선택) (completed 2026-04-09)
- **Phase 26: Verification Signal Cleanup** - Exclude dist/ from Layer 2, narrow deterministic verify to phase-local scope, normalize ESLint config contract, revisit cross-model --max-turns constraint (completed 2026-04-09)
- [x] **Phase 27: OMO-Inspired Agent Harness UX** - active-work.json dashboard artifact, deterministic 6-category classifier in do, active-work-aware review routing, skill consolidation (fast→quick, debug absorbs diagnose/forensics, status --brief, verify --coverage, note absorbs todo/seed/backlog). 0 new commands, 0 new skill files. (completed 2026-04-10)
- [x] **Phase 28: Claude Code Advisor Harness** - Opus advisor subagent for workflow.plan (pre/post draft calls), AdvisorRunner with call cap + timeout + signature verification, .claude/agents/sunco-advisor.md, default disabled. (completed 2026-04-10)
- [ ] **Phase 29: AST-Grep Deterministic Tools** - AST pattern matching wrapper, graph/scan skill enhancement, 25-language code navigation (candidate)
- [x] **Phase 30: CLI Dashboard TUI** - Read-only Ink TUI behind `sunco status --live`, polls .sun/active-work.json at 1Hz, 5-section layout (Active Phase / Background / Blocked / Next / Recent), TTY guard with graceful non-TTY refusal, compact fallback < 80 cols. 0 new commands, 1 new .tsx file. (completed 2026-04-11)
- [ ] **Phase 31: Hashline Stale-Edit Guard** - Content-hash injection at file read, hash verification at edit, stale-edit prevention (experimental candidate)
- [x] **Phase 32: Alias Infra + P0 Consolidation** - `SkillDefinition.aliases[]` + Zod schema, `SkillRegistry` `resolveCommand`/`resolveId` + alias maps, `skill-router` second-pass alias dispatch with default args injection and deprecation warning (env-suppressible), migrated `fast`→`quick --speed fast` (file deleted) and `progress`→`status` (inline export removed). Zero regressions, ctx.run() backward compat preserved. Unblocks Phase 33 (P1 absorption) and Phase 34 (P2 structure). (completed 2026-04-11)
- [x] **Phase 34: Codex Layer 6 Integration** - CodexCliProvider (family: openai, transport: cli, subprocess via execa), AgentRouter.listProvidersWithFamily(), selectCrossFamilyProviders() deterministic helper, runLayer6CrossModel rewrite (no more providers.slice(0,2)), --require-codex strict flag, skeptical-reviewer fallback preserved. 22 new tests, zero regressions. (completed 2026-04-13)
- [x] **Phase 33: Full Absorption (3 waves)** - Wave 1 ✅ 2026-04-11: query→status --json, context→status --brief, validate→verify --coverage, todo/seed/backlog→note flags (6 skill files DELETED, 4 shared modules). Wave 2 ✅ 2026-04-13: test-gen→verify --generate-tests, assume→plan --assume, export→doc --report (3 skill files DELETED, 3 shared modules). Wave 3 ✅ 2026-04-13: diagnose→debug --parse, forensics→debug --postmortem (2 skill files DELETED, 2 shared modules). review arsenal + compound: standalone 유지 (audit 결과 absorption 부적합). Total: 11 skill files deleted, 9 shared modules created. (completed 2026-04-13)

## Phase Details

### Phase 1: Core Platform

**Goal**: A working `sunco` CLI that loads skills, manages config and state, routes to agents, and recommends next actions -- the kernel everything else depends on
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CFG-01, CFG-02, CFG-03, CFG-04, SKL-01, SKL-02, SKL-03, SKL-04, SKL-05, SKL-06, STE-01, STE-02, STE-03, STE-04, STE-05, AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, REC-01, REC-02, REC-03, REC-04, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):

1. User can install sunco via npm (npx sunco / npm install -g sunco) and run `sunco --help` to see available skills
2. User can run a sample deterministic skill that reads TOML config (global + project + directory layers merged correctly) and writes to .sun/ state
3. User can run a sample prompt skill that dispatches to Claude Code CLI with scoped permissions and returns a result
4. After any skill execution, user sees a Next Best Action recommendation with 2-4 options and a Recommended tag
5. User sees visual feedback (progress bars, status symbols, error boxes) during all skill operations
**Plans:** 12 plans

Plans:

- 01-01-PLAN.md -- Monorepo scaffold (Turborepo + npm workspaces + tsup bundling)
- 01-01b-PLAN.md -- TypeScript type contracts (all Phase 1 interfaces and Zod schemas)
- 01-02-PLAN.md -- Config System (TOML loading, merge, Zod validation)
- 01-03-PLAN.md -- State Engine (SQLite WAL, flat files, .sun/ directory)
- 01-04-PLAN.md -- UI Foundation (primitives, components, adapters)
- 01-05-PLAN.md -- Skill System (defineSkill, scanner, resolver, registry, context)
- 01-06-PLAN.md -- Agent Router (providers, permissions, cross-verify, tracking)
- 01-07-PLAN.md -- UI Patterns (SkillEntry, InteractiveChoice, SkillProgress, SkillResult + tests)
- 01-08-PLAN.md -- CLI Engine (Commander.js, skill router, lifecycle with graceful recommender)
- 01-09-PLAN.md -- Proactive Recommender (rule engine, 25+ rules)
- 01-10-PLAN.md -- Integration (settings skill, sample-prompt skill, E2E verification)
- 01-11-PLAN.md -- Gap closure: Wire AgentRouter providers in boot sequence

### Phase 2: Harness Skills

**Goal**: Users can analyze, lint, and guard any codebase with deterministic harness skills -- the zero-LLM-cost backbone that makes agents make fewer mistakes
**Depends on**: Phase 1
**Requirements**: HRN-01, HRN-02, HRN-03, HRN-04, HRN-05, HRN-06, HRN-07, HRN-08, HRN-09, HRN-10, HRN-11, HRN-12, HRN-13, HRN-14, HRN-15, HRN-16
**Success Criteria** (what must be TRUE):

1. User runs `sunco init` on a TypeScript/Python/Go project and gets .sun/ workspace with auto-detected stack, layer structure, conventions, and generated rules
2. User runs `sunco lint` and sees architecture violations (dependency direction, layer breaches) with agent-readable error messages that explain what to fix and why, plus --fix auto-corrects
3. User runs `sunco health` and gets a numerical score report showing document staleness, anti-pattern spread trends, and pattern drift over time
4. User runs `sunco agents` on a repo with CLAUDE.md and gets an efficiency score, 60-line limit check, and improvement suggestions (no auto-generation)
5. User runs `sunco guard` in watch mode and sees real-time lint-on-change with anti-pattern-to-linter-rule promotion suggestions
**Plans:** 8 plans

Plans:

- 02-01-PLAN.md -- Dependencies, test infra, init detection modules (ecosystem, layer, convention)
- 02-02-PLAN.md -- Init presets, workspace initializer, sunco init skill
- 02-03-PLAN.md -- Lint types, rule store, config generator, ESLint runner
- 02-04-PLAN.md -- Lint formatter (agent-readable messages), fixer, sunco lint skill
- 02-05-PLAN.md -- Health freshness checker, pattern tracker, reporter, sunco health skill
- 02-06-PLAN.md -- Agent doc analyzer, efficiency scorer, suggestion engine, sunco agents skill
- 02-07-PLAN.md -- Guard analyzer, promoter, incremental linter, watcher, sunco guard skill
- 02-08-PLAN.md -- Integration: barrel exports, CLI wiring, build verification, human-verify

### Phase 3: Standalone TS Skills

**Goal**: Users can manage sessions, capture ideas, control phases, adjust settings, and track progress -- all deterministic, all instant
**Depends on**: Phase 1
**Requirements**: SES-01, SES-02, SES-03, SES-04, SES-05, IDX-01, IDX-02, IDX-03, IDX-04, PHZ-01, PHZ-02, PHZ-03, SET-01, WF-08
**Success Criteria** (what must be TRUE):

1. User runs `sunco status` and instantly sees current position (phase, plan, what's done, what's next) with visual progress indicators
2. User runs `sunco note "idea" --tribal` and the note is persisted to .sun/tribal/; `sunco todo add/list/done` manages a working task list; `sunco seed` stores ideas with trigger conditions
3. User runs `sunco phase add/insert/remove` and the roadmap updates correctly with proper numbering (including decimal insertion)
4. User runs `sunco settings` and gets an interactive UI to browse and modify TOML configuration across all layers
5. User runs `sunco resume` after a previous `sunco pause` and the session restores exactly where they left off via HANDOFF.json
**Plans:** 6 plans

Plans:

- 03-01-PLAN.md -- Package scaffold, shared utilities (roadmap-parser, state-reader, handoff, git-state)
- 03-02-PLAN.md -- Status + progress alias + next + context skills
- 03-03-PLAN.md -- Note + todo + seed + backlog (idea capture skills)
- 03-04-PLAN.md -- Pause + resume (session persistence skills)
- 03-05-PLAN.md -- Phase management (add/insert/remove subcommands)
- 03-06-PLAN.md -- Enhanced settings + CLI wiring + integration

### Phase 4: Project Initialization

**Goal**: Users can bootstrap a new project or onboard an existing codebase through agent-powered analysis
**Depends on**: Phase 1, Phase 2
**Requirements**: WF-01, WF-02
**Success Criteria** (what must be TRUE):

1. User runs `sunco new` with an idea and gets guided through interactive questions, parallel research runs, auto-generated requirements, and a roadmap -- all in one flow
2. User runs `sunco scan` on an existing codebase and gets 7 analysis documents (stack, architecture, structure, conventions, tests, integrations, concerns) written to .sun/
**Plans:** 4 plans

Plans:

- 04-01-PLAN.md -- askText() UI infrastructure, detectEcosystems export, pre-scan + planning-writer utilities
- 04-02-PLAN.md -- sunco scan skill with 7 prompt templates and parallel agent dispatch
- 04-03-PLAN.md -- sunco new skill with multi-step orchestration (idea -> questions -> research -> synthesis)
- 04-04-PLAN.md -- CLI wiring, build config, integration verification

### Phase 5: Context + Planning

**Goal**: Users can refine vision, preview agent approaches, research domains, and create BDD-driven execution plans before any code is written
**Depends on**: Phase 1, Phase 4
**Requirements**: WF-09, WF-10, WF-11, WF-12
**Success Criteria** (what must be TRUE):

1. User runs `sunco discuss` and extracts vision, design decisions, and acceptance criteria into CONTEXT.md with holdout scenarios written to .sun/scenarios/
2. User runs `sunco assume` and sees what the agent would do before it does it, with an opportunity to correct the approach
3. User runs `sunco plan` and gets an execution plan with BDD scenario-based completion criteria that passes the built-in plan-checker validation loop
**Plans:** 5 plans

Plans:

- 05-01-PLAN.md -- Shared phase-reader utility + sunco discuss skill (multi-step conversation + holdout scenarios)
- 05-02-PLAN.md -- sunco assume skill (approach preview + CONTEXT.md correction append)
- 05-03-PLAN.md -- sunco research skill (parallel agent dispatch + synthesis into RESEARCH.md)
- 05-04-PLAN.md -- sunco plan skill (plan-checker validation loop + BDD completion criteria)
- 05-05-PLAN.md -- CLI wiring, barrel exports, tsup config, build verification

### Phase 6: Execution + Review

**Goal**: Users can execute plans with parallel agents in isolated worktrees and get independent cross-provider code review
**Depends on**: Phase 5
**Requirements**: WF-13, WF-14
**Success Criteria** (what must be TRUE):

1. User runs `sunco execute` and tasks run in parallel via Git worktrees with atomic commits per task; each task is isolated and rollback-safe
2. User runs `sunco review --codex --gemini` and gets independent reviews from multiple providers that are synthesized into a unified report
**Plans:** 4 plans

Plans:

- 06-01-PLAN.md -- Shared infrastructure: PLAN.md parser + Git worktree manager + tests
- 06-02-PLAN.md -- sunco execute skill (wave orchestration, worktree isolation, cherry-pick merge-back)
- 06-03-PLAN.md -- sunco review skill (multi-provider cross-review, synthesis into REVIEWS.md)
- 06-04-PLAN.md -- CLI wiring, barrel exports, tsup config, build verification

### Phase 7: Verification Pipeline

**Goal**: Users can verify agent output through 5 independent safety layers, run test coverage audits, and generate tests with mock servers -- the Swiss cheese model is fully operational
**Depends on**: Phase 2, Phase 6
**Requirements**: VRF-01, VRF-02, VRF-03, VRF-04, VRF-05, VRF-06, VRF-07, VRF-08, VRF-09, VRF-10, VRF-11, REV-01, REV-02, REV-03, REV-04
**Success Criteria** (what must be TRUE):

1. User runs `sunco verify` and all 5 Swiss cheese layers execute in sequence: multi-agent generation, deterministic guardrails (lint+guard), BDD acceptance criteria, permission scoping check, and adversarial verification
2. User sees verification results from 4 expert agents (Security, Performance, Architecture, Correctness) coordinated by a 5th, plus intent reconstruction that compares results against original intent (not just diff)
3. User runs `sunco validate` and gets a deterministic test coverage audit; `sunco test-gen` generates unit/E2E tests including Digital Twin mock servers for external APIs
4. Scenario holdout tests in .sun/scenarios/ are invisible to coding agents but automatically loaded by verification agents
5. The 6-stage review pipeline (idea to deploy) auto-connects the right skill at each stage; tribal knowledge from .sun/tribal/ is loaded during verification; human gates block only for tribal knowledge and regulatory paths
**Plans:** 4 plans

Plans:

- 07-01-PLAN.md -- Foundation: verify types, coverage parser, 9 prompt builders (7 verify expert + 2 test-gen)
- 07-02-PLAN.md -- sunco verify skill (5-layer Swiss cheese model with parallel expert agents)
- 07-03-PLAN.md -- sunco validate (coverage audit) + sunco test-gen (test generation + Digital Twin)
- 07-04-PLAN.md -- Recommender rules for verification pipeline + CLI wiring + build verification

### Phase 8: Shipping + Milestones

**Goal**: Users can ship PRs through quality gates, publish releases, and manage full milestone lifecycles
**Depends on**: Phase 7
**Requirements**: SHP-01, SHP-02, WF-03, WF-04, WF-05, WF-06, WF-07
**Success Criteria** (what must be TRUE):

1. User runs `sunco ship` and gets a PR with 5-layer verification pre-check, automatic/manual gates, and clear pass/fail status
2. User runs `sunco release` and gets version tagging, archive creation, and npm publish in one command
3. User runs `sunco milestone new/audit/complete/summary/gaps` and can start milestones, verify achievement vs intent, archive completed work, generate onboarding reports, and create catch-up phases for gaps
**Plans:** 4 plans

Plans:

- 08-01-PLAN.md -- Shared infrastructure: version-bumper, changelog-writer, milestone-helpers, 4 prompt builders
- 08-02-PLAN.md -- sunco ship (verify pre-check + PR creation) + sunco release (version bump + tag + publish)
- 08-03-PLAN.md -- sunco milestone skill (5 subcommands: new, audit, complete, summary, gaps)
- 08-04-PLAN.md -- CLI wiring, barrel exports, recommender rules, build verification

### Phase 9: Composition Skills

**Goal**: Users can orchestrate entire workflows automatically, run lightweight tasks, and route natural language to the right skill
**Depends on**: Phase 5, Phase 6, Phase 7
**Requirements**: WF-15, WF-16, WF-17, WF-18
**Success Criteria** (what must be TRUE):

1. User runs `sunco auto` and remaining phases execute autonomously (discuss, plan, execute, verify chain) -- stopping only at blockers or gray areas requiring human judgment
2. User runs `sunco quick --full` for a lightweight task with optional discuss/research steps, or `sunco fast` for immediate execution skipping planning
3. User types `sunco do "fix the login bug"` in natural language and the correct skill chain is identified and executed
**Plans:** 3/3 plans complete

Plans:

- 09-01-PLAN.md -- sunco auto (autonomous pipeline) + sunco do (NL router with prompt builder)
- 09-02-PLAN.md -- sunco quick (lightweight task) + sunco fast (immediate execution)
- 09-03-PLAN.md -- CLI wiring, barrel exports, tsup config, recommender rules, build verification

### Phase 10: Debugging

**Goal**: Users can diagnose failures, analyze root causes, and perform post-mortem forensics on workflow breakdowns
**Depends on**: Phase 1
**Requirements**: DBG-01, DBG-02, DBG-03
**Success Criteria** (what must be TRUE):

1. User runs `sunco debug` after a failure and gets automatic classification (context shortage / direction error / structural conflict), root cause analysis, and actionable fix suggestions
2. User runs `sunco diagnose` for deterministic log analysis of build/test failures with structured output
3. User runs `sunco forensics` and gets a full post-mortem of a workflow failure including git history analysis and .sun/ state reconstruction
**Plans:** 3/3 plans complete

Plans:

- 10-01-PLAN.md -- Shared debug types, diagnose skill (deterministic), debug/forensics prompt builders
- 10-02-PLAN.md -- sunco debug (agent failure classification) + sunco forensics (workflow post-mortem)
- 10-03-PLAN.md -- CLI wiring, barrel exports, tsup config, recommender rules, build verification

### Phase 11: Planning Quality Pipeline

**Goal**: Upgrade `sunco plan` with integrated research, revision loop, and requirements coverage — GSD-level quality but as independent CLI
**Depends on**: Phase 5 (plan skill exists), Phase 10
**Requirements**: PQP-01, PQP-02, PQP-03, PQP-04, PQP-05
**Success Criteria** (what must be TRUE):

1. User runs `sunco plan --research` and research runs automatically before planning, producing RESEARCH.md that feeds into the planner
2. Plan-checker validates plan quality and iterates up to 3 times (planner ↔ checker) until VERIFICATION PASSED
3. After planning, a requirements coverage check ensures every phase REQ-ID appears in at least one plan
4. Each plan task has mandatory read_first, acceptance_criteria (grep-verifiable), and concrete action fields
**Plans:** 0 plans (not yet planned)

### Phase 12: Operational Resilience

**Goal**: SUNCO auto mode가 프로덕션급 안정성을 가짐 — 크래시 복구, 멈춤 감지, 비용 제어, 타임아웃 감독. GSD v2 수준의 운영 안정성
**Depends on**: Phase 9 (auto skill), Phase 10 (debugging)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05
**Success Criteria** (what must be TRUE):

1. User runs `sunco auto`, session crashes mid-task, user runs `sunco auto` again → resumes from last checkpoint with recovery briefing (no work lost)
2. Agent enters infinite loop (same skill fails 3x) → auto mode stops with diagnostic report explaining what got stuck and why
3. User runs `sunco stats` → sees per-skill token/cost breakdown, phase totals, model-level split
4. User sets `sunco.budget_ceiling = 10.00` → auto mode pauses at $10 with 50%/75%/90% warnings
5. Soft timeout warns agent to wrap up, idle timeout detects stalls, hard timeout force-stops — all configurable
**Plans:** 2/2 plans complete

### Phase 13: Headless + CI/CD

**Goal**: SUNCO runs in CI pipelines, cron jobs, and scripts without TUI — enabling team adoption and automation
**Depends on**: Phase 12 (operational resilience)
**Requirements**: HLS-01, HLS-02, HLS-03, HLS-04, HLS-05
**Success Criteria** (what must be TRUE):

1. `sunco headless auto --timeout 600000` runs in GitHub Actions, auto-responds to prompts, exits with code 0/1/2
2. `sunco headless query` returns JSON snapshot in <100ms without LLM calls
3. `sunco export --html` generates self-contained HTML report with progress, costs, timeline
4. CI pipeline can run `sunco headless next` per cron tick, advancing one unit at a time
**Plans:** 1/1 plans complete

### Phase 14: Context Optimization + Quality Depth

**Goal**: Minimize token waste, maximize agent effectiveness, close remaining quality gaps — KV-cache optimization, garbage collection, plan→verify auto-link, output discipline
**Depends on**: Phase 1 (agent router), Phase 12 (cost tracking)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, CTX-06, CTX-07
**Success Criteria** (what must be TRUE):

1. Agent prompts use stable prefix + variable suffix — measured cache hit rate improvement
2. After plan execution, roadmap is automatically reassessed
3. Simple tasks route to cheap models, complex to capable — automatic
4. `sunco.token_profile = "budget"` → 40-60% cost reduction
5. `sunco health --deep` detects code-doc mismatches, dead imports, stale TODOs via agent
6. `sunco verify` auto-loads acceptance_criteria from PLAN.md
7. verify PASS = 1-line summary, FAIL = full report with fix suggestions
**Plans:** 2/2 plans complete

### Phase 15: Document Generation

**Goal**: Generate project documents (HWPX, markdown) from project context — "한글파일로 작성해드릴까요?"
**Depends on**: Phase 1 (core platform)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):

1. User runs `sunco doc:hwpx --template 제안서` → properly formatted HWPX file generated from project context
2. User runs `sunco doc:md --type readme` → README.md generated from project analysis
3. User creates custom template in .sun/templates/ → `sunco doc --template <name>` uses it
**Plans:** 0 plans (not yet planned)

### Phase 16: Skill Marketplace

**Goal**: Community-driven skill ecosystem with npm-based distribution
**Depends on**: Phase 1 (skill system)
**Requirements**: MKT-01, MKT-02, MKT-03
**Success Criteria** (what must be TRUE):

1. User runs `sunco install @sunco/skill-tdd` → skill downloaded and registered
2. User runs `sunco publish` → skill published to npm with validated metadata
3. Community skills discoverable via `sunco search:skills <keyword>`
**Plans:** 0 plans (not yet planned)

### Phase 17: Context Intelligence

**Goal**: 컨텍스트 윈도우를 지능적으로 관리하여 토큰 낭비 최소화 — 유틸리제이션 존 모니터링, 선택적 아티팩트 로딩(78% 절감), 자동 핸드오프
**Depends on**: Phase 14 (context optimization), Phase 3 (pause/resume)
**Requirements**: LH-01, LH-02, LH-03, LH-04, LH-05
**Success Criteria** (what must be TRUE):

1. 컨텍스트 사용량이 70%를 넘으면 Yellow→Orange 경고가 표시되고, `/sunco:pause` 자동 추천이 나타남
2. 완료된 페이즈 아티팩트는 3줄 요약으로 로드되어 토큰 사용량이 full 로드 대비 78% 이상 절감됨
3. HANDOFF.json에 `resumeCommand`가 포함되어 새 세션에서 즉시 이어서 실행 가능한 프롬프트가 생성됨
4. `sunco-context-monitor.cjs` 훅이 4단계 존(Green/Yellow/Orange/Red)을 실시간 모니터링하고 statusline에 표시
**Plans:** 0 plans (not yet planned)

### Phase 18: Smart Routing

**Goal**: 작업 복잡도와 의도에 따라 최적 모델을 자동 선택 — 30-50% 토큰 절감, 라우팅 정확도 시간 경과에 따라 향상
**Depends on**: Phase 17 (context intelligence), Phase 14 (complexity routing)
**Requirements**: LH-06, LH-07, LH-08, LH-09, LH-10
**Success Criteria** (what must be TRUE):

1. 사용자 입력이 5가지 인텐트(lookup/implement/investigate/plan/review)로 분류되어 최적 모델이 자동 선택됨
2. `defineSkill()`에 complexity 필드가 추가되고 라우터가 이를 참조하여 모델 선택
3. BudgetGuard 임계치 75% 이상일 때 자동으로 cheaper 모델로 다운그레이드됨
4. 스킬×모델 성공률이 SQLite에 기록되고 라우팅 결정에 반영됨
**Plans:** 0 plans (not yet planned)

### Phase 19: Hook System v2

**Goal**: 확장 가능한 훅 시스템으로 에이전트 행동을 사전/사후에 제어 — 라이프사이클 훅, 해시 앵커 검증, 선언적 규칙
**Depends on**: Phase 17 (context monitor hooks), Phase 2 (guard)
**Requirements**: LH-11, LH-12, LH-13, LH-14, LH-15
**Success Criteria** (what must be TRUE):

1. PreSkill/PostSkill 훅이 스킬 실행 전후에 발동되어 상태 저장/로깅 가능
2. PreCompact 훅이 auto-compact 전에 현재 phase/task 상태를 HANDOFF.json에 저장
3. 훅 출력이 10K자로 제한되고 초과 시 자동 트렁케이션 + 경고
4. 파일 에딧 전 라인 해시 검증으로 스테일 에딧이 차단됨
**Plans:** 0 plans (not yet planned)

### Phase 20: Infinite Execution

**Goal**: 컨텍스트 한계를 넘어 무한히 작업 — 자동 로테이션, 적응형 타임아웃, 세션 기록
**Depends on**: Phase 17 (context zones), Phase 9 (auto skill), Phase 12 (crash recovery)
**Requirements**: LH-16, LH-17, LH-18, LH-19
**Success Criteria** (what must be TRUE):

1. `sunco auto` 실행 중 컨텍스트 70%에서 자동 핸드오프 → 새 세션 → resume로 끊김 없이 이어서 실행
2. 스킬 복잡도에 따라 타임아웃이 동적 조정됨 (simple 5min, standard 30min, complex 60min)
3. `.sun/sessions/`에 세션별 진행 기록이 MD로 저장되고 최근 3개만 로드됨
4. 서브에이전트가 전체 이력 대신 관련 이력만 검색하여 메인 컨텍스트 오염 방지
**Plans:** 0 plans (not yet planned)

### Phase 21: Cross-Session Intelligence

**Goal**: 세션을 넘어 학습하고 개인화 — 피처 추적, 성공률 학습, 하네스 5% 예산
**Depends on**: Phase 20 (session records), Phase 18 (routing success tracking)
**Requirements**: LH-20, LH-21, LH-22, LH-23, LH-24
**Success Criteria** (what must be TRUE):

1. `.sun/features.json`에서 피처→세션 양방향 매핑으로 관련 컨텍스트만 선택 로딩
2. 스킬×모델 성공률 데이터가 recommender에 반영되어 추천 개인화
3. 하네스 로딩(CLAUDE.md + 훅 + 상태)이 전체 컨텍스트의 5% 이하로 유지됨
4. 사용자 스킬 사용 패턴 분석으로 자동 추천이 개인화됨
**Plans:** 0 plans (not yet planned)

### Phase 22: Ultraplan Integration

**Goal**: Users can export SUNCO phase plans to Claude Code's /ultraplan for browser-based visual review, and import reviewed plans back into SUNCO PLAN.md format
**Depends on**: Phase 5 (planning pipeline)
**Requirements**: ULP-01, ULP-02, ULP-03
**Success Criteria** (what must be TRUE):

1. User runs `sunco ultraplan --phase 5` and gets a formatted review prompt written to NN-ULTRAPLAN-PROMPT.md
2. User runs `sunco ultraplan --import --file plan.md` and gets validated PLAN.md files written to the phase directory
3. After `sunco plan` completes, recommender suggests ultraplan as a browser review option (low priority)
4. Import mode rejects unstructured markdown to prevent accidental plan overwrite
**Plans:** TBD

## Progress

**Execution Order:**
v1 Phases: 1 -> 2 -> 3 -> ... -> 10 (COMPLETE)
v1.1 Phases: 11 -> 12 -> 13 -> 14 (COMPLETE), 15-16 (deferred)
v1.2 Phases: 17 -> 18 -> 19 -> 20 -> 21 (Light Harness)


| Phase                               | Plans Complete | Status      | Completed  |
| ----------------------------------- | -------------- | ----------- | ---------- |
| 1. Core Platform                    | 12/12          | Complete    |            |
| 2. Harness Skills                   | 8/8            | Complete    |            |
| 3. Standalone TS Skills             | 6/6            | Complete    |            |
| 4. Project Initialization           | 4/4            | Complete    |            |
| 5. Context + Planning               | 5/5            | Complete    |            |
| 6. Execution + Review               | 4/4            | Complete    |            |
| 7. Verification Pipeline            | 4/4            | Complete    |            |
| 8. Shipping + Milestones            | 4/4            | Complete    |            |
| 9. Composition Skills               | 3/3            | Complete    | 2026-03-29 |
| 10. Debugging                       | 3/3            | Complete    | 2026-03-29 |
| 11. Planning Quality Pipeline       | 1/1            | Complete    | 2026-03-29 |
| 12. Operational Resilience          | 2/2            | Complete    | 2026-03-29 |
| 13. Headless + CI/CD                | 1/1            | Complete    | 2026-03-29 |
| 14. Context Optimization            | 2/2            | Complete    | 2026-03-30 |
| 15. Document Generation             | 0/?            | Deferred    | -          |
| 16. Skill Marketplace               | 0/?            | Deferred    | -          |
| 17. Context Intelligence            | 3/3            | Complete    | 2026-04-06 |
| 18. Smart Routing                   | 2/2            | Complete    | 2026-04-06 |
| 19. Hook System v2                  | 1/1            | Complete    | 2026-04-06 |
| 20. Infinite Execution              | 1/1            | Complete    | 2026-04-06 |
| 21. Cross-Session Intelligence      | 1/1            | Complete    | 2026-04-06 |
| 22. Ultraplan Integration           | 0/?            | Not started | -          |
| 24d. Harness Evolution              | -              | Complete    | 2026-04-08 |
| 25. Workflow Surface Simplification | 0/?            | Not started | -          |

---

## v1.3 Closeout (2026-04-18)

v1.3 is closed as a consolidation milestone. Its absorption/pivot work (Phase 22–28, 30, 32, 33, 34) is preserved as the foundation for the v1.4 Impeccable Fusion direction. Candidate/unmarked items (Phase 23a, 23b, 29, 31) remain historical or may be reintroduced explicitly in v1.4+.

**Note on internal drift**: The Milestones progress table above contains additional drift (e.g., Phase 22/25 marked "Not started" despite the Phase entry list showing completion dates). Comprehensive ROADMAP refresh is deferred to a dedicated cleanup task; this closeout note establishes the canonical v1.3 record.

---

## v1.4: Impeccable Fusion

**Initialized**: 2026-04-18
**Theme**: External value delivery — craft-quality layer for downstream SUNCO-user projects via vendored Impeccable + clean-room Backend Excellence.
**Spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` (locked at commit `6e6761a`)

### Structure

17 phases across 5 milestones. Phase numbers use integer continuation (35–51) — compatible with existing `%02d` tool convention; spec aliases (M1.1–M5.2) preserved as cross-reference in phase CONTEXT.md and milestone headers below.

### Milestone M1 — Foundation (Phases 35–37)

- **Phase 35 (spec M1.1)**: File layout + attribution scaffolding — `packages/cli/references/{impeccable,backend-excellence}/` + `packages/cli/schemas/` + SUNCO-ATTRIBUTION.md + CHANGELOG entry. REQ: IF-01.
- **Phase 36 (spec M1.2)**: UI dispatcher skeleton — `workflows/ui-phase.md` (router) + `ui-phase-{cli,web,native}.md` + sanity pre-check (stderr warning only). Default surface=cli for 0 regression. REQ: IF-02.
- **Phase 37 (spec M1.3)**: Backend dispatcher skeleton — `workflows/backend-phase.md` + `backend-phase-{api,data,event,ops}.md` + `backend-review.md` router + 4 symmetric review surfaces. `--surface` required (no default). REQ: IF-03.

### Milestone M2 — Frontend Fusion (Phases 38–41) [depends M1]

- **Phase 38 (spec M2.1)**: Impeccable vendoring via wrapper injection pattern — `references/impeccable/source/` pristine; `references/impeccable/wrapper/` SUNCO-authored adapters. Done when wrapper e2e test passes. REQ: IF-04.
- **Phase 39 (spec M2.2)**: `discuss-phase.md` frontend teach — inline teach questions for `domains:[frontend]` or `--domain frontend` only. Populates DESIGN-CONTEXT.md. REQ: IF-05.
- **Phase 40 (spec M2.3)**: `ui-phase-web` workflow — generates UI-SPEC.md with SPEC-BLOCK YAML + prose; DESIGN-CONTEXT.md required. REQ: IF-06.
- **Phase 41 (spec M2.4)**: `ui-review --surface web` WRAP — Impeccable detector + LLM critique → IMPECCABLE-AUDIT.md + UI-REVIEW.md. Explicit-only (no auto-default to web). REQ: IF-07.

### Milestone M3 — Backend Excellence (Phases 42–47) [depends M1, parallel with M2]

- **Phase 42 (spec M3.1)**: 8 clean-room backend reference documents (api-design, data-modeling, boundaries-and-architecture, reliability-and-failure-modes, security-and-permissions, performance-and-scale, observability-and-operations, migrations-and-compatibility) — each ≥1500 words with ≥5 anti-patterns. REQ: IF-08.
- **Phase 43 (spec M3.2)**: Deterministic backend detector (7 high-confidence rules). JSON findings output. REQ: IF-09.
- **Phase 44 (spec M3.3)**: `discuss-phase.md` backend teach — explicit-only trigger via `domains:[backend]` or `--domain backend`. Populates BACKEND-CONTEXT.md. REQ: IF-10.
- **Phase 45 (spec M3.4)**: `backend-phase-api` + `backend-phase-data` with SPEC-BLOCK outputs. REQ: IF-11.
- **Phase 46 (spec M3.5)**: `backend-phase-event` + `backend-phase-ops` with SPEC-BLOCK outputs. REQ: IF-12.
- **Phase 47 (spec M3.6)**: `backend-review` 4 surfaces — detector subset + LLM review → BACKEND-AUDIT.md. REQ: IF-13.

### Milestone M4 — Cross-Domain Integration (Phases 48–49) [depends M2+M3]

- **Phase 48 (spec M4.1)**: `CROSS-DOMAIN.md` auto-generation from UI-SPEC + API-SPEC SPEC-BLOCK extraction (deterministic grep + YAML parse). `schemas/cross-domain.schema.json` with version field. REQ: IF-14.
- **Phase 49 (spec M4.2)**: Verify gate cross-domain layer — 4 finding types with severity × state lifecycle (HIGH hard-block, MED block with dismiss, LOW configurable). REQ: IF-15.

### Milestone M5 — Rollout Hardening (Phases 50–51) [depends M1–M4]

- **Phase 50 (spec M5.1)**: Documentation + migration guide — `docs/impeccable-integration.md`, `docs/backend-excellence.md`, `docs/migration-v0.X.md`, README. REQ: IF-16.
- **Phase 51 (spec M5.2)**: Dogfood sunco-harness itself + test fixtures + CI integration. REQ: IF-17.

### Timeline

7 weeks single-person / 4 weeks two-person parallel. M2 and M3 parallelizable after M1; spec R3 resolves `discuss-phase.md` merge-conflict risk via M1 Phase 37 stub landing domain-switch skeleton first.

### Success criteria (Done for v1.4)

See spec §14 "Done for v1". Key markers:
1. `/sunco:ui-phase --surface cli` — 0 regression vs existing
2. `/sunco:backend-phase --surface {api,data,event,ops}` — all 4 produce SPEC.md
3. Cross-domain gate enforces with severity × state; proceed-gate blocks HIGH/MED open
4. Dogfood sunco-harness finds ≥5 findings in its own API surface
5. All COEXIST commands unchanged (0 regression)

**v1.4 status**: SHIPPED 2026-04-20 as `popcoru@0.12.0` (git tag `v0.12.0`, release commit `94041a2`). 17/17 phases, all 5 milestones (M1-M5) CLOSED. Rollback anchor `sunco-pre-dogfood` branch preserved at `3ac0ee9`. See CHANGELOG.md `## [0.12.0]` for full release notes.

---

## v1.5 SUNCO Workflow Router (Milestone M6 — 7 phases, 5 committed + 1 provisional + 1 deferred)

**Design source**: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at `30e2041`; 4-round convergent review with plan-verifier + Codex; no v2-relay divergence). Clean-room design inspired only by the general workflow idea (Brainstorm → Plan → Work → Review → Compound → Repeat); no compound-engineering-plugin code/prompts/files vendored.

**Milestone goal**: Promote SUNCO from "bag of slash commands" to "workflow router" — evidence-based stage state machine with 10-stage enum (BRAINSTORM, PLAN, WORK, REVIEW, VERIFY, PROCEED, SHIP, RELEASE, COMPOUND, PAUSE), deterministic classifier with frozen-weight confidence, approval-boundary-enforced auto-execution (auto-routing ≠ auto-execution), and Compound as post-stage hook. v1.5 is **additive**: existing stage commands (`/sunco:brainstorm`, `/sunco:plan`, `/sunco:execute`, `/sunco:verify`, `/sunco:proceed-gate`, `/sunco:ship`, `/sunco:release`, `/sunco:compound`) remain byte-identical when invoked directly (R1 regression guarantee continued from v1.4).

### Milestone M6 — v1.5 Router (Phases 52a-57)

**Committed**:
- **Phase 52a (spec §9 Phase 52a)**: Router core schemas + state machine docs — `schemas/route-decision.schema.json`, `references/router/{README,STAGE-MACHINE,EVIDENCE-MODEL,CONFIDENCE-CALIBRATION,APPROVAL-BOUNDARY}.md`, smoke Section 27 static subset. REQ: IF-18, IF-20, (partial) IF-19, (partial) IF-21.
- **Phase 52b (spec §9 Phase 52b)**: Router classifier + evidence collector + decision writer + confidence module + router.md command + workflows/router.md + vitest runtime tests (deterministic confidence, freshness parsers, promotion criteria, Y1 class-definition), smoke Section 27 runtime subset + Section 28 placeholder. REQ: (runtime) IF-19, (enforcement) IF-21.
- **Phase 53**: Router wrappers (minus `/sunco:auto`) — `commands/sunco/{router,do,next,mode,manager}.md` updates routing through 52b classifier; existing stage commands byte-identical; smoke Section 28. REQ: (integration) IF-18, IF-19, IF-20, IF-21.
- **Phase 54**: Compound-router — `schemas/compound.schema.json`, `references/compound/{README,template}.md`, `references/compound/src/{compound-router,sink-proposer}.mjs`, `commands/sunco/compound.md`, `workflows/compound.md`, router post-stage hook integration, smoke Section 29. REQ: IF-22.
- **Phase 55**: Router dogfood — 5 fixture scenarios (new feature / bugfix / release completion / incident recovery / milestone close) + vitest runner + retroactive v1.4 compound artifact + retroactive route decision backfill, smoke Section 30. REQ: IF-23.

**Mid-milestone review gate** (between 55 and 56): Phase 55 dogfood results drive Phase 56/57 scope confirmation. FAIL → replan; no auto-continue.

**Provisional**:
- **Phase 56**: Release-router hardening — `workflows/release.md` sub-stage decomposition (PRE_FLIGHT → VERSION_BUMP → CHANGELOG → COMMIT → TAG → PUSH → PUBLISH → VERIFY_REGISTRY → TAG_PUSH → COMPOUND_HOOK), `/sunco:artifact-gate` extension, workspace consistency check, smoke Section 31. Scope confirmed at mid-milestone gate.

**Deferred (explicit gate post-56)**:
- **Phase 57**: `/sunco:auto` integration — risk-level-keyed `--allow` flags; autonomous loop constrained by 52b classifier + 53 wrappers. Frozen until Phase 56 complete + explicit gate opening.

### Timeline

Indicative: 3-5 weeks (52a small / 52b medium / 53 medium / 54 medium / 55 medium). Mid-milestone gate absorbs 56/57 replanning. Phase 57 `/sunco:auto` touch is deferred indefinitely pending 56 outcomes and explicit gate.

### Success criteria (Done for v1.5)

1. `/sunco:router <no-args>` produces schema-valid RouteDecision artifact with deterministic confidence (determinism invariant verified in Section 27 runtime)
2. 10-stage enum + forward + regress + reset transitions enforced by classifier
3. `.sun/router/session/` ephemeral tier + `.planning/router/decisions/` durable tier with deterministic promotion criteria
4. `repo_mutate_official` class definition enforces ACK on memory/rules/backlog/official planning artifacts; blessed orchestrator batched-ACK covers `/sunco:execute`, `/sunco:verify`, `/sunco:release`
5. Compound-router auto-writes `.planning/compound/release-*.md` on RELEASE stage exit (always-on)
6. Freshness Gate (7-point) runs before every route decision; repo_mutate_official+ hard-blocks on drift
7. Existing stage commands remain byte-identical when invoked directly (R1 guarantee preserved)
8. Clean-room invariant: `grep -r "compound-engineering-plugin"` over 10-path scope-set returns 0 matches outside verbatim clean-room notices
9. SDI-2 counter preserved or justified (v1.5 should not regress the counter budget)
10. Phase 55 dogfood green on all 5 scenarios


