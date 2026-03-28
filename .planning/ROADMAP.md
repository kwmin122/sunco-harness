# Roadmap: SUN (sunco)

## Overview

SUN is an Agent Workspace OS built as a CLI runtime with 49 skills. This roadmap delivers the v1 product across 10 phases, progressing from the kernel (CLI + infrastructure) through deterministic harness skills, standalone utilities, agent-powered workflow skills in dependency order, and finishing with composition and debugging capabilities. The 6-stage review pipeline and 5-layer Swiss cheese verification are built incrementally across phases -- deterministic layers first (Phase 2), BDD and agent-based layers later (Phase 7). Every phase delivers complete, usable skills. No stubs.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Platform** - CLI engine, config, skill system, state engine, agent router, recommender, UX foundations
- [ ] **Phase 2: Harness Skills** - init, lint, health, agents, guard -- deterministic backbone, zero LLM cost
- [ ] **Phase 3: Standalone TS Skills** - Session, ideas, phase management, settings, progress -- all deterministic
- [ ] **Phase 4: Project Initialization** - new and scan -- agent-powered project bootstrap
- [ ] **Phase 5: Context + Planning** - discuss, assume, research, plan -- the spec-driven workflow chain
- [ ] **Phase 6: Execution + Review** - execute with worktree isolation and multi-agent cross-review
- [ ] **Phase 7: Verification Pipeline** - 5-layer Swiss cheese, verify, validate, test-gen, review architecture
- [ ] **Phase 8: Shipping + Milestones** - ship, release, milestone lifecycle management
- [ ] **Phase 9: Composition Skills** - auto, quick, fast, do -- power-user orchestration
- [ ] **Phase 10: Debugging** - debug, diagnose, forensics -- failure recovery and analysis

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
- [x] 01-01-PLAN.md -- Monorepo scaffold (Turborepo + npm workspaces + tsup bundling)
- [x] 01-01b-PLAN.md -- TypeScript type contracts (all Phase 1 interfaces and Zod schemas)
- [x] 01-02-PLAN.md -- Config System (TOML loading, merge, Zod validation)
- [x] 01-03-PLAN.md -- State Engine (SQLite WAL, flat files, .sun/ directory)
- [x] 01-04-PLAN.md -- UI Foundation (primitives, components, adapters)
- [x] 01-05-PLAN.md -- Skill System (defineSkill, scanner, resolver, registry, context)
- [x] 01-06-PLAN.md -- Agent Router (providers, permissions, cross-verify, tracking)
- [x] 01-07-PLAN.md -- UI Patterns (SkillEntry, InteractiveChoice, SkillProgress, SkillResult + tests)
- [x] 01-08-PLAN.md -- CLI Engine (Commander.js, skill router, lifecycle with graceful recommender)
- [x] 01-09-PLAN.md -- Proactive Recommender (rule engine, 25+ rules)
- [x] 01-10-PLAN.md -- Integration (settings skill, sample-prompt skill, E2E verification)
- [x] 01-11-PLAN.md -- Gap closure: Wire AgentRouter providers in boot sequence

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
- [x] 02-01-PLAN.md -- Dependencies, test infra, init detection modules (ecosystem, layer, convention)
- [x] 02-02-PLAN.md -- Init presets, workspace initializer, sunco init skill
- [x] 02-03-PLAN.md -- Lint types, rule store, config generator, ESLint runner
- [x] 02-04-PLAN.md -- Lint formatter (agent-readable messages), fixer, sunco lint skill
- [x] 02-05-PLAN.md -- Health freshness checker, pattern tracker, reporter, sunco health skill
- [x] 02-06-PLAN.md -- Agent doc analyzer, efficiency scorer, suggestion engine, sunco agents skill
- [x] 02-07-PLAN.md -- Guard analyzer, promoter, incremental linter, watcher, sunco guard skill
- [x] 02-08-PLAN.md -- Integration: barrel exports, CLI wiring, build verification, human-verify

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
- [x] 03-01-PLAN.md -- Package scaffold, shared utilities (roadmap-parser, state-reader, handoff, git-state)
- [x] 03-02-PLAN.md -- Status + progress alias + next + context skills
- [x] 03-03-PLAN.md -- Note + todo + seed + backlog (idea capture skills)
- [x] 03-04-PLAN.md -- Pause + resume (session persistence skills)
- [x] 03-05-PLAN.md -- Phase management (add/insert/remove subcommands)
- [x] 03-06-PLAN.md -- Enhanced settings + CLI wiring + integration

### Phase 4: Project Initialization
**Goal**: Users can bootstrap a new project or onboard an existing codebase through agent-powered analysis
**Depends on**: Phase 1, Phase 2
**Requirements**: WF-01, WF-02
**Success Criteria** (what must be TRUE):
  1. User runs `sunco new` with an idea and gets guided through interactive questions, parallel research runs, auto-generated requirements, and a roadmap -- all in one flow
  2. User runs `sunco scan` on an existing codebase and gets 7 analysis documents (stack, architecture, structure, conventions, tests, integrations, concerns) written to .sun/
**Plans:** 4 plans

Plans:
- [x] 04-01-PLAN.md -- askText() UI infrastructure, detectEcosystems export, pre-scan + planning-writer utilities
- [x] 04-02-PLAN.md -- sunco scan skill with 7 prompt templates and parallel agent dispatch
- [x] 04-03-PLAN.md -- sunco new skill with multi-step orchestration (idea -> questions -> research -> synthesis)
- [x] 04-04-PLAN.md -- CLI wiring, build config, integration verification

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
- [x] 05-01-PLAN.md -- Shared phase-reader utility + sunco discuss skill (multi-step conversation + holdout scenarios)
- [x] 05-02-PLAN.md -- sunco assume skill (approach preview + CONTEXT.md correction append)
- [x] 05-03-PLAN.md -- sunco research skill (parallel agent dispatch + synthesis into RESEARCH.md)
- [x] 05-04-PLAN.md -- sunco plan skill (plan-checker validation loop + BDD completion criteria)
- [x] 05-05-PLAN.md -- CLI wiring, barrel exports, tsup config, build verification

### Phase 6: Execution + Review
**Goal**: Users can execute plans with parallel agents in isolated worktrees and get independent cross-provider code review
**Depends on**: Phase 5
**Requirements**: WF-13, WF-14
**Success Criteria** (what must be TRUE):
  1. User runs `sunco execute` and tasks run in parallel via Git worktrees with atomic commits per task; each task is isolated and rollback-safe
  2. User runs `sunco review --codex --gemini` and gets independent reviews from multiple providers that are synthesized into a unified report
**Plans:** 4 plans

Plans:
- [x] 06-01-PLAN.md -- Shared infrastructure: PLAN.md parser + Git worktree manager + tests
- [x] 06-02-PLAN.md -- sunco execute skill (wave orchestration, worktree isolation, cherry-pick merge-back)
- [x] 06-03-PLAN.md -- sunco review skill (multi-provider cross-review, synthesis into REVIEWS.md)
- [ ] 06-04-PLAN.md -- CLI wiring, barrel exports, tsup config, build verification

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
**Plans**: TBD

### Phase 8: Shipping + Milestones
**Goal**: Users can ship PRs through quality gates, publish releases, and manage full milestone lifecycles
**Depends on**: Phase 7
**Requirements**: SHP-01, SHP-02, WF-03, WF-04, WF-05, WF-06, WF-07
**Success Criteria** (what must be TRUE):
  1. User runs `sunco ship` and gets a PR with 5-layer verification pre-check, automatic/manual gates, and clear pass/fail status
  2. User runs `sunco release` and gets version tagging, archive creation, and npm publish in one command
  3. User runs `sunco milestone new/audit/complete/summary/gaps` and can start milestones, verify achievement vs intent, archive completed work, generate onboarding reports, and create catch-up phases for gaps
**Plans**: TBD

### Phase 9: Composition Skills
**Goal**: Users can orchestrate entire workflows automatically, run lightweight tasks, and route natural language to the right skill
**Depends on**: Phase 5, Phase 6, Phase 7
**Requirements**: WF-15, WF-16, WF-17, WF-18
**Success Criteria** (what must be TRUE):
  1. User runs `sunco auto` and remaining phases execute autonomously (discuss, plan, execute, verify chain) -- stopping only at blockers or gray areas requiring human judgment
  2. User runs `sunco quick --full` for a lightweight task with optional discuss/research steps, or `sunco fast` for immediate execution skipping planning
  3. User types `sunco do "fix the login bug"` in natural language and the correct skill chain is identified and executed
**Plans**: TBD

### Phase 10: Debugging
**Goal**: Users can diagnose failures, analyze root causes, and perform post-mortem forensics on workflow breakdowns
**Depends on**: Phase 1
**Requirements**: DBG-01, DBG-02, DBG-03
**Success Criteria** (what must be TRUE):
  1. User runs `sunco debug` after a failure and gets automatic classification (context shortage / direction error / structural conflict), root cause analysis, and actionable fix suggestions
  2. User runs `sunco diagnose` for deterministic log analysis of build/test failures with structured output
  3. User runs `sunco forensics` and gets a full post-mortem of a workflow failure including git history analysis and .sun/ state reconstruction
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> ... -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Platform | 12/12 | Complete |  |
| 2. Harness Skills | 0/8 | Not started | - |
| 3. Standalone TS Skills | 0/6 | Not started | - |
| 4. Project Initialization | 4/4 | Complete |  |
| 5. Context + Planning | 0/5 | Not started | - |
| 6. Execution + Review | 0/4 | Not started | - |
| 7. Verification Pipeline | 0/? | Not started | - |
| 8. Shipping + Milestones | 0/? | Not started | - |
| 9. Composition Skills | 0/? | Not started | - |
| 10. Debugging | 0/? | Not started | - |
