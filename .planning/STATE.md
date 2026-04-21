---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: SUNCO Workflow Router
status: executing
stopped_at: ""
last_updated: "2026-04-21T00:00:00.000Z"
last_activity: 2026-04-21
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 0
  completed_plans: 0
  percent: 71
previous_milestone:
  label: v1.4
  name: Impeccable Fusion
  status: SHIPPED
  npm_version: 0.12.0
  git_tag: v0.12.0
  release_commit: 94041a2
  shipped_at: 2026-04-20
  completed_phases: 17
  total_phases: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** 에이전트가 실수를 덜 하게 판을 깔아주는 OS -- 하네스 엔지니어링이 핵심
**Current focus:** v1.5 SUNCO Workflow Router — Phase 55 LANDED as 2-commit unit (A `3500d77` + B `97af2c3`) on 2026-04-21; Phase 56 release-router hardening in-flight as pre-planned 2-commit unit over Phase 55 endpoint (`97af2c3`): `workflows/release.md` (NEW; 10 sub-stage approval-envelope decomposition per DESIGN §11 30a) + smoke Section 32. Mid-milestone gate PASS-WITH-CONDITIONS absorbed upstream (C1 dogfood chain wiring + C2 doc drift → v1.5 maintenance backlog). Gate 56 v1 cleared convergent GREEN-CONDITIONAL (Reviewer Claude + Codex; 2 absorb-before-build wording conditions: AB1 artifact-gate scope boundary + AB2 CHANGELOG class-by-purpose policy). Design source: `.planning/router/DESIGN-v1.md` (captured 2026-04-20 at `30e2041`; immutability extended through Phase 56 per Gate 56 L15).

## Current Position

Milestone: v1.5 SUNCO Workflow Router (executing)
Current phase: Phase 56 (Release-Router Hardening) in-flight as pre-planned 2-commit unit over Phase 55 endpoint (`97af2c3`): Commit A (`docs(router): scaffold Phase 56 release-router context and workflow stub`) — 56-CONTEXT scaffold + STATE prose update + smoke Section 32 header + `workflows/release.md` skeleton (top clean-room notice + 10 sub-stage name-only list). Commit B (`feat(router): populate Phase 56 release sub-stage approval envelopes and smoke coverage`) — `workflows/release.md` populated with 10 `approval_envelope` blocks per Gate 56 L2 + AB1 artifact-gate scope line + AB2 CHANGELOG class-by-purpose policy sentence + PRE_FLIGHT workspace consistency + COMPOUND_HOOK post-VERIFY_REGISTRY wiring + TAG_PUSH failure clause + smoke Section 32 populated + STATE frontmatter bump. Gate 56 v1 cleared convergent GREEN-CONDITIONAL (Reviewer Claude + Codex; 2 absorb-before-build wording conditions on AB1 artifact-gate scope + AB2 CHANGELOG class-by-purpose; 10 accumulated strict-side union fixtures across Phases 53-56; formalization candidate at v1.5-closure meta-retrospective).
Status: Push status is determined authoritatively by `git rev-parse origin/main HEAD` — not by narrative prose. Phase 55 is on origin when `origin/main == 97af2c3`. Phase 56 local commits are on origin only when `origin/main == HEAD`. Rollback anchors preserved: `sunco-pre-55-landed @ 97af2c3` (Phase 56 pre-first-mutation anchor; 5th iteration of per-phase-landed anchor pattern), `sunco-pre-54-landed @ 8e22c9d`, `sunco-pre-53-landed @ 72a391a`, `sunco-pre-52b-landed @ 4b1e093`, `sunco-pre-dogfood @ 3ac0ee9`.
Design source: `.planning/router/DESIGN-v1.md` (locked at commit `30e2041`; immutability extends through Phase 56 per Gate 56 L15)
Last activity: 2026-04-21

Progress (v1.5): [███████░░░] 71% (5/7 total phases delivered by committed local state; `git rev-parse origin/main HEAD` authoritative for what is on origin; Commit A mid-phase — frontmatter unchanged at Commit A per L17).
Delivered by commit: 52a, 52b, 53, 54, 55
Pending committed: 56 (in-flight; Phase 56 release-router hardening, 2-commit unit Commit A + Commit B)
Deferred: 57 (`/sunco:auto` integration; frozen until Phase 56 LANDED + explicit gate)

**Note on frontmatter vs origin**: `progress.completed_phases: 5` and `progress.percent: 71` above count phases whose full commit set exists locally. Origin state is verified by git, not by prose — `git rev-parse origin/main HEAD` is the single source of truth for what has pushed. Commit A mid-phase preserves Phase 55 snapshot values; Commit B bumps to 6/7 (86%) per L17 bookkeeping. SDI-2 counter remains at **2** (Phase 56 pre-planned 2-commit split is NOT SDI-2 per Gate 52b B4 + Phase 53/54/55 precedent).

## v1.4 retrospective

v1.4 Impeccable Fusion **SHIPPED 2026-04-20** as `popcoru@0.12.0` (git tag `v0.12.0`, release commit `94041a2`). 17/17 phases, all 5 milestones CLOSED. Rollback anchor `sunco-pre-dogfood` branch preserved at `3ac0ee9`. See CHANGELOG.md `## [0.12.0]` and memory `project_sunco_harness_v1_4.md` for full trail. v1.4 produced 8 learnings (L1 Freshness / L2 Evidence>Authority / L3 SDI vs spec-rule / L4 Push boundary / L5 External-signal additive fix / L6 Release artifact gate / L7 Scratch consolidation / L8 SemVer vs milestone label) absorbed into v1.5 router design §12.

Historical note: Previous milestones archived in-place — v1.2 Light Harness (complete, Phase 17–21), v1.3 Consolidation & Pivot Absorption (closed, Phase 22–34 + candidates), v1.4 Impeccable Fusion (SHIPPED, Phase 35–51). See ROADMAP.md for full trajectory.

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-core-platform P01 | 6min | 1 tasks | 27 files |
| Phase 01 P01b | 6min | 2 tasks | 12 files |
| Phase 01 P02 | 4min | 7 tasks | 9 files |
| Phase 01 P03 | 5min | 6 tasks | 10 files |
| Phase 01 P04 | 6min | 2 tasks | 17 files |
| Phase 01-core-platform P05 | 5min | 1 tasks | 12 files |
| Phase 01 P06 | 7min | 7 tasks | 12 files |
| Phase 01-core-platform P07 | 10min | 2 tasks | 14 files |
| Phase 01 P09 | 4min | 2 tasks | 5 files |
| Phase 01-core-platform P08 | 5min | 2 tasks | 8 files |
| Phase 01-core-platform P10 | 4min | 3 tasks | 14 files |
| Phase 01-core-platform P11 | 2min | 2 tasks | 2 files |
| Phase 02-harness-skills P01 | 7min | 2 tasks | 13 files |
| Phase 02-harness-skills P02 | 5min | 2 tasks | 6 files |
| Phase 02 P06 | 5min | 2 tasks | 9 files |
| Phase 02 P05 | 6min | 2 tasks | 10 files |
| Phase 02-harness-skills P03 | 11min | 2 tasks | 7 files |
| Phase 02-harness-skills PP04 | 5min | 2 tasks | 6 files |
| Phase 02-harness-skills P07 | 6min | 2 tasks | 12 files |
| Phase 02-harness-skills P08 | 4min | 2 tasks | 6 files |
| Phase 03-standalone-ts-skills P01 | 7min | 2 tasks | 18 files |
| Phase 03 P04 | 3min | 1 tasks | 5 files |
| Phase 03 P05 | 4min | 1 tasks | 4 files |
| Phase 03-standalone-ts-skills P02 | 5min | 2 tasks | 7 files |
| Phase 03 P03 | 9min | 2 tasks | 9 files |
| Phase 03 P06 | 5min | 2 tasks | 10 files |
| Phase 04 P01 | 4min | 2 tasks | 12 files |
| Phase 04 P02 | 3min | 2 tasks | 9 files |
| Phase 04 P03 | 4min | 2 tasks | 5 files |
| Phase 04 P04 | 2min | 2 tasks | 5 files |
| Phase 05 P02 | 3min | 2 tasks | 4 files |
| Phase 05 P03 | 4min | 2 tasks | 4 files |
| Phase 05 P04 | 5min | 2 tasks | 6 files |
| Phase 05 P01 | 6min | 2 tasks | 7 files |
| Phase 05 P05 | 3min | 2 tasks | 6 files |
| Phase 06 P01 | 4min | 2 tasks | 4 files |
| Phase 06 P02 | 3min | 2 tasks | 3 files |
| Phase 06 P03 | 4min | 2 tasks | 4 files |
| Phase 06 P04 | 2min | 2 tasks | 4 files |
| Phase 07-verification-pipeline P01 | 5min | 2 tasks | 13 files |
| Phase 07 P03 | 4min | 2 tasks | 4 files |
| Phase 07 P02 | 5min | 2 tasks | 3 files |
| Phase 07 P04 | 3min | 2 tasks | 5 files |
| Phase 08 P01 | 5min | 2 tasks | 10 files |
| Phase 08 P03 | 4min | 1 tasks | 2 files |
| Phase 08 P02 | 5min | 2 tasks | 4 files |
| Phase 08-shipping-milestones P04 | 5min | 2 tasks | 5 files |
| Phase 09 P02 | 2min | 2 tasks | 3 files |
| Phase 09 P01 | 4min | 2 tasks | 3 files |
| Phase 09-composition-skills P03 | 2min | 2 tasks | 5 files |
| Phase 10-debugging P01 | 4min | 2 tasks | 5 files |
| Phase 10-debugging P02 | 3min | 2 tasks | 3 files |
| Phase 10-debugging P03 | 3min | 2 tasks | 6 files |
| Phase 11 P01 | 2min | 1 tasks | 4 files |
| Phase 12-operational-resilience P01 | 12min | 3 tasks | 6 files |
| Phase 12 P02 | 20 | 3 tasks | 5 files |
| Phase 14 P01 | 15 | 3 tasks | 5 files |
| Phase 14 P02 | 12 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 10 phases derived from requirement dependency chain (Core -> Harness -> TS Skills -> Agent Init -> Context+Plan -> Execute -> Verify -> Ship -> Compose -> Debug)
- [Roadmap]: UX-01~03 placed in Phase 1 because interactive UX pattern is foundational to all skills
- [Roadmap]: Verification pipeline (15 reqs) grouped as single Phase 7 -- Swiss cheese layers must be delivered together
- [Phase 01-core-platform]: TypeScript 6.0.2 with esnext target + node22 tsup target (esbuild es2025 incompatibility)
- [Phase 01-core-platform]: npm workspace * refs (not workspace:*), glob@13.0.6 (not 11.x), ignoreDeprecations:6.0 for tsup DTS
- [Phase 01]: Used Zod 3.24.4 (installed) instead of Zod 4.x -- API compatible for schema definitions
- [Phase 01]: Two-layer UI contract: SkillUi (skill intent API) + UiAdapter (renderer pattern API) per D-38
- [Phase 01]: Zod 3.24.4 ZodError.issues for error formatting (not v4 prettifyError)
- [Phase 01]: loadConfig homeDir option for testability without mocking os.homedir()
- [Phase 01]: findProjectRoot checks .sun/ first, package.json as fallback
- [Phase 01]: Async wrapper over sync better-sqlite3 for future migration to async drivers
- [Phase 01]: Prepared statements for all SQL operations (performance + safety)
- [Phase 01]: FileStore path traversal guard via resolve/relative boundary check
- [Phase 01]: Used Omit<InkBoxProps> pattern for theme token type compatibility with Ink
- [Phase 01]: InkUiAdapter uses console.log scaffold -- full Ink rendering deferred to Plan 07
- [Phase 01-core-platform]: Zod z.function().refine() for execute validation; Object.freeze() for SkillDefinition immutability; Proxy-based blocked agent for deterministic skills
- [Phase 01]: picomatch via createRequire (CJS module in ESM project with verbatimModuleSyntax)
- [Phase 01]: Dynamic imports for ai/@ai-sdk/anthropic to avoid Zod 3.24 vs 3.25 peer dep conflict
- [Phase 01]: ClaudeSdkProvider.isAvailable() checks both ANTHROPIC_API_KEY and package availability
- [Phase 01-core-platform]: SkillResult UI component exported as SkillResultPattern to avoid namespace clash with SkillResult type
- [Phase 01-core-platform]: InkUiAdapter uses dynamic imports and TTY detection for pattern rendering with console.log fallback
- [Phase 01]: Priority enum (high/medium/low) with sort-order map for recommendation sorting
- [Phase 01]: Engine exclusively controls isDefault flag -- rules never set it
- [Phase 01-core-platform]: Levenshtein distance inline (~15 lines) for unknown command suggestions
- [Phase 01-core-platform]: createNoopRecommender() for graceful recommender degradation via dynamic import fallback
- [Phase 01-core-platform]: Shebang managed by tsup banner config, not in source file
- [Phase 01-core-platform]: Dual skill loading: direct imports for bundling + scanner for runtime extensibility, preloaded takes priority
- [Phase 01-core-platform]: CLI externals: ink/react/ai-sdk external, workspace packages bundled via noExternal for npm distribution
- [Phase 01-core-platform]: Parallel provider availability checks via Promise.all for minimal boot latency
- [Phase 01-core-platform]: Conditional provider registration: only available providers passed to createAgentRouter
- [Phase 02-harness-skills]: legacy-peer-deps in .npmrc for typescript-eslint TS 6.0 peer dep conflict
- [Phase 02-harness-skills]: Init detection modules as pure async functions with {cwd} opts for isolation
- [Phase 02-harness-skills]: Completeness-weighted preset scoring: matchCount * 1000 + completeness_ratio * 100 prevents partial match overshadowing exact match
- [Phase 02-harness-skills]: smol-toml as direct skills-harness dep for TOML config generation via stringify
- [Phase 02]: Directive extraction uses positive/negative verb pairs with word-overlap similarity for contradiction detection
- [Phase 02]: 4-component weighted efficiency scoring: brevity 30%, clarity 25%, coverage 25%, contradiction-free 20% per ETH Zurich insight
- [Phase 02]: Related code mtime includes sibling directories for freshness detection
- [Phase 02]: Health trend threshold at 10% change; pattern penalties: any-type*2, eslint-disable*3, console-log*1
- [Phase 02-harness-skills]: eslint-plugin-boundaries requires mode:'folder' element matching (glob patterns fail silently)
- [Phase 02-harness-skills]: Boundaries rule format: { from: { type }, allow: { to: { type: string[] } } } not array-based
- [Phase 02-harness-skills]: boundaries/include setting required for TS file filtering in lint engine
- [Phase 02-harness-skills]: chalk@5 added as direct dependency for terminal color output in formatter
- [Phase 02-harness-skills]: Violations enriched through formatter pipeline: runner outputs basic violations, formatter adds layer-aware fix_instruction
- [Phase 02-harness-skills]: lint.skill.ts stores lint.lastResult in state for recommender integration
- [Phase 02-harness-skills]: Promotion is suggest-only per D-21: guard generates pre-built SunLintRule JSON but never auto-writes to .sun/rules/
- [Phase 02-harness-skills]: ESLint lintText() for incremental single-file linting in guard watch mode hot path
- [Phase 02-harness-skills]: chokidar 5.0.0 with awaitWriteFinish stabilityThreshold=300ms for watch mode debounce
- [Phase 02-harness-skills]: types:[node] in skills-harness tsconfig.json for DTS build with multi-entry tsup
- [Phase 02-harness-skills]: eslint/eslint-plugin-boundaries/typescript-eslint/chokidar added as CLI externals to prevent CJS require() crash in ESM bundle
- [Phase 03-standalone-ts-skills]: Regex-based ROADMAP.md parsing with separate phase list, detail sections, and progress table extractors
- [Phase 03-standalone-ts-skills]: Manual YAML frontmatter parsing (simple key:value with one-level nesting) to avoid adding YAML library dep
- [Phase 03-standalone-ts-skills]: Decimal phase numbers stored as string type while integer phases stored as number
- [Phase 03-standalone-ts-skills]: HandoffSchema uses z.literal(1) for version field to enforce schema versioning
- [Phase 03]: Pause reads STATE.md via readFile + parseStateMd rather than StateApi for simplicity
- [Phase 03]: Resume returns Handoff object in result.data for downstream skill chaining
- [Phase 03]: SkillResult.warnings array used for branch mismatch communication in resume skill
- [Phase 03]: Subcommand routing via ctx.args._ positional array for phase skill multi-operation pattern
- [Phase 03-standalone-ts-skills]: Shared executeStatus function for status/progress alias pattern
- [Phase 03-standalone-ts-skills]: Section extraction from STATE.md markdown body using regex heading detection
- [Phase 03-standalone-ts-skills]: Phase directory scanning via readdir + padded phase number for CONTEXT.md lookup
- [Phase 03]: Positional args via ctx.args._ for subcommand routing in CRUD skills
- [Phase 03]: Auto-increment ID with namespace.nextId counter pattern for all CRUD skills
- [Phase 03]: Enhanced settings in skills-workflow replaces harness version (same id core.settings)
- [Phase 03]: Helper functions exported with _ prefix for testability (_parseValueType, _setNestedKey)
- [Phase 03]: smol-toml parse+stringify for round-trip TOML write-back safety
- [Phase 04]: ink-text-input@6.0.0 for Ink-compatible askText rendering
- [Phase 04]: askText source 'default' (InkUiAdapter non-TTY) vs 'noninteractive' (SilentUiAdapter) to distinguish adapter context
- [Phase 04]: Pre-scan file tree capped at 500 entries with maxDepth 4 for token cost control
- [Phase 04]: Planning writer uses node:fs/promises directly (FileStore is .sun/-scoped only)
- [Phase 04]: Read-only research permissions for all scan agents (readPaths: ['**'], writePaths: [])
- [Phase 04]: Partial failure returns success=true with warnings when at least 1 doc succeeds
- [Phase 04]: Barrel index.ts only exports existing prompts (scan-*.ts deferred to plan 04-02)
- [Phase 04]: Conditional questions use answer-based predicates for adaptive 5-8 question range
- [Phase 04]: DOCUMENT_SEPARATOR fallback writes entire output as PROJECT.md when parsing fails
- [Phase 04]: Extended prompts barrel to include all 7 scan prompt builders (deferred from plan 04-02/03)
- [Phase 05]: Inline phase-reader helpers for assume skill; correction insertion before Claude's Discretion heading; auto-increment D-{N} numbering
- [Phase 05]: Separate research-domain.ts and research-synthesize.ts from Phase 4 prompts/research.ts (Pitfall 4)
- [Phase 05]: Topic auto-derivation via planning agent with 5-topic cap; synthesis fallback writes raw results
- [Phase 05]: Plan-checker validation loop with MAX_ITERATIONS=3 and separate verification agent (D-13, D-16)
- [Phase 05]: Phase-reader created as blocking dep for plan skill (originally in 05-01)
- [Phase 05]: Commander.js flags format for skill options (flags: '-p, --phase <number>' not name/alias/type)
- [Phase 05]: Text fallback mode when agent output lacks parseable JSON gray areas -- askText instead of ask
- [Phase 05]: Partial failure pattern: scenario gen failure still writes CONTEXT.md with warnings
- [Phase 05]: research-skill subpath (not ./research) to avoid confusion with existing research.ts prompt file
- [Phase 06]: Regex-based PLAN.md parsing (no XML/YAML library) consistent with state-reader.ts and roadmap-parser.ts
- [Phase 06]: WorktreeManager uses simple-git raw() with timestamped branch names and best-effort cleanup
- [Phase 06]: directExec routing for execute skill (manages its own agent calls)
- [Phase 06]: Agent summary parsed from last JSON code block in outputText via regex
- [Phase 06]: crossVerify for multi-provider dispatch instead of manual Promise.allSettled (reuse existing AgentRouterApi)
- [Phase 06]: Provider flag to family mapping in skill layer: claude->claude, codex->openai, gemini->google per D-09
- [Phase 07-verification-pipeline]: verify-types.ts as single shared contract for all verification skills
- [Phase 07-verification-pipeline]: Istanbul json-summary as coverage input format (Vitest compatible)
- [Phase 07-verification-pipeline]: Coordinator PASS/WARN/FAIL verdict rules: any critical or 3+ high=FAIL, any high or 5+ medium=WARN
- [Phase 07]: Promisified execFile for vitest spawn with 120s timeout
- [Phase 07]: Coverage snapshot stored via ctx.state.set for delta tracking (D-15)
- [Phase 07]: Code block extraction regex for agent output parsing with filename comment detection
- [Phase 07]: Digital Twin mock server written to .sun/mocks/ directory
- [Phase 07]: Promise.allSettled for Layer 1 expert dispatch (NOT crossVerify -- different prompts per expert)
- [Phase 07]: Sequential 5-layer execution with try/catch isolation per layer (Swiss cheese model)
- [Phase 07]: strict flag overrides verdict to FAIL on humanRequired findings for CI enforcement
- [Phase 07]: 11 genuinely new rules added (not 15) -- 4 planned rules already existed in workflowTransitionRules
- [Phase 07]: Verdict-aware helpers (lastVerdict, coverageBelow, coverageAtOrAbove) cast lastResult.data safely
- [Phase 08]: vi.hoisted() for mock variable access in vi.mock factory (Vitest hoisting)
- [Phase 08]: No semver library -- split/increment for bumpVersion (zero-dep policy)
- [Phase 08]: Copy-based archive with per-artifact try/catch for missing file resilience
- [Phase 08]: Requirement ID prefix grouping for logical gap-phase generation in buildGapPhases
- [Phase 08]: Audit score < 70% blocks completion unless --force flag (D-09 threshold enforcement)
- [Phase 08]: Agent-powered subcommands (new, audit, summary) vs deterministic (complete, gaps) per D-14
- [Phase 08]: Ship skill kind=prompt (needs agent for verify), release skill kind=deterministic (pure pipeline)
- [Phase 08]: Dynamic import('execa') for graceful gh CLI fallback in ship/release skills
- [Phase 08-shipping-milestones]: Fixed milestone.skill.ts PermissionSet and AgentRequest type compliance (missing role field and incomplete permission objects)
- [Phase 08-shipping-milestones]: Renumbered milestone rules category from 21-24 to 21-29 to accommodate 5 new shipping rules
- [Phase 08-shipping-milestones]: Used hasProjectState for lastMilestoneAction to differentiate milestone complete vs gaps transitions
- [Phase 09]: quick skill try/catch + warnings for optional discuss/research failures (partial failure OK)
- [Phase 09]: fast skill wider writePaths (**) vs quick (scoped) for ad-hoc tasks; 3-min timeout vs 5-min
- [Phase 09]: Pipeline steps as typed array with skip-check callbacks for orchestrating multi-skill workflows
- [Phase 09]: NL routing with read-only agent dispatch and quick fallback when no skill matches
- [Phase 09-composition-skills]: compositionRules placed between verificationPipelineRules and fallbackRules for specificity ordering
- [Phase 09-composition-skills]: Low-priority suggest-quick-idle and suggest-do-generic rules for fresh sessions
- [Phase 10-debugging]: Three-type failure classification: context_shortage, direction_error, structural_conflict
- [Phase 10-debugging]: Diagnose skill as fully deterministic (kind: deterministic) with zero LLM cost
- [Phase 10-debugging]: Exported parseDebugOutput for testability; last JSON code block extraction for multi-attempt agent outputs
- [Phase 10-debugging]: Forensics report written to .sun/forensics/ as markdown for persistence; cross-skill invocation via ctx.run for context gathering
- [Phase 10-debugging]: debuggingRules placed between compositionRules and fallbackRules for specificity ordering
- [Phase 10-debugging]: Fixed forensics.skill.ts readonly array DTS error via spread operator before .reverse()
- [Phase 11]: Auto-research runs when RESEARCH.md missing (unless --skip-research); explicit --research flag always reruns
- [Phase 11]: plan-checker dimension count updated from 6 to 7 (deep_work_rules as dimension 7)
- [Phase 12-01]: AutoLock stores history in the same lock file (single source of truth) rather than a separate file
- [Phase 12-01]: StuckDetector is stateless (pure function on history array) — state lives in AutoLock
- [Phase 12-01]: BudgetGuard uses null ceilingUsd to represent no-ceiling (not 0 or Infinity) for clarity
- [Phase 12-01]: StuckDetector.analyze() returns consecutiveFailures even when not stuck so callers can monitor progress
- [Phase 12]: Budget ceiling and timeout config read from ctx.state (not ctx.config) — SunConfig has no budget_ceiling field
- [Phase 12]: Promise.race timeout resolves (not rejects) to SkillResult to avoid unhandled rejection
- [Phase 13-01]: Headless uses lifecycle.boot normally then builds per-invocation SilentUiAdapter context to reuse all booted services without a second boot cycle
- [Phase 13-01]: Exit code semantics: 0=success, 2=blocked (result.data.blocked=true), 1=error
- [Phase 14]: health --deep uses inline prompt building to avoid cross-package dep; canonical buildHealthDeepPrompt in skills-workflow
- [Phase 14]: acceptance_criteria auto-link via regex on raw PLAN.md text; GREPPABLE/EXPORTABLE patterns for deterministic checks
- [Phase 14]: JSON persistence to .sun/graph.json via writeFile (not ctx.state) — graph is large, flat file is more inspectable
- [Phase 14]: CodeGraph.fromJSON/toJSON for in-memory graph serialization; BFS separates direct vs transitive deps at collection time
- [Phase 14]: resolveImport strips .js->tries .ts for TypeScript ESM; dynamic import('simple-git') for graceful degradation

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 has 32 requirements -- largest phase. Plan decomposition will need careful scoping (expect 7-10 plans).
- Research flagged: Agent Router permission model needs concrete spec per skill during Phase 1 planning.
- Research flagged: SQLite concurrency under parallel worktrees needs stress testing.
