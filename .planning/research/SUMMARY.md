# Project Research Summary

**Project:** SUN -- Agent Workspace OS
**Domain:** CLI-based agentic coding harness / developer workspace platform
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

SUN is a terminal-native Agent Workspace OS for solo builders. The 2026 agentic coding landscape has converged on a clear pattern: spec-driven workflows, fresh context per task, deterministic guardrails wrapping agentic execution, and provider-agnostic agent routing. Tools like GSD, Codex, BMAD, and Superset each implement pieces of this pattern. SUN's thesis is to unify them into a single CLI with 49 skills spanning project initialization through verification and shipping, backed by a native macOS terminal app for multi-agent observation. The research confirms this is architecturally viable -- every core component maps to proven libraries and validated patterns.

The recommended approach is a kernel-plus-skills architecture: a thin CLI runtime (Commander.js, Config System, State Engine, Skill Loader, Agent Router, Proactive Recommender) that loads and dispatches skills at the edges. Skills are explicitly typed as deterministic (20 TypeScript, zero LLM cost), prompt-backed (25 agentic), or hybrid (4). This deterministic/agentic split -- inspired by Stripe Minions -- is SUN's most important architectural decision and its primary cost-saving mechanism. The Vercel AI SDK v6 handles provider abstraction so the Agent Router stays thin (~200 lines). SQLite WAL handles structured state; flat files (TOML, Markdown, JSON, BDD) handle human-readable artifacts.

The key risk is scope explosion. 49 skills across 5 phases is a massive surface area. The research unanimously recommends shipping Phase 1 with approximately 8 skills, validating, and expanding in waves. Secondary risks include ESLint custom rule complexity (start with eslint-plugin-boundaries, not from scratch), TOML config merge ambiguity (define array-replace semantics upfront), and git worktree orphan cleanup (register with PID tracking, stale detection on every invocation). The SUN Terminal (Phase 5) depends on libghostty which is pre-1.0 -- plan for API churn.

## Key Findings

### Recommended Stack

All HIGH confidence except eslint-plugin-boundaries (MEDIUM) and Agent Router specifics (MEDIUM). Full details in [STACK.md](./STACK.md).

| Choice | Version | Rationale |
|--------|---------|-----------|
| Node.js | 24.x LTS | Native `--strip-types` for .ts files, npm 11, maintained through Apr 2028 |
| TypeScript | 6.0.x | `strict=true` default, es2025 target. Bridge release before Go-native 7.0 |
| Commander.js | 14.0.3 | Zero deps, 35M weekly downloads, subcommand routing. SUN skills replace what oclif would add |
| tsup | 8.5.x | esbuild-powered CLI bundler. CJS+ESM dual output, shebang injection. Migrate to tsdown at 1.0 |
| smol-toml | 1.6.0 | TOML 1.1.0, zero deps, ESM-native, 2kb. No config framework needed -- 50 lines of deep-merge |
| Zod | 4.3.x | Config + API output validation. `z.infer<>` for type derivation. 106M weekly downloads |
| Vitest | 4.1.x | TS-native test runner. Instant watch, built-in mocking, v8 coverage |
| ESLint | 10.x | Flat config only. Custom rules via @typescript-eslint/utils for `sun lint` |
| Vercel AI SDK | 6.x | Provider-agnostic AI abstraction. 20M+ monthly downloads. Agent abstraction in v6 |
| Ink | 6.8.x | React for terminal. Interactive UX for `sun discuss`, `sun new`, `sun settings` |
| simple-git | 3.33.x | Git CLI wrapper with TS types. `git.raw()` for worktree commands |
| chokidar | 5.x | ESM-only, 17x less CPU than v3. File watching for `sun guard` |
| better-sqlite3 | latest | Synchronous SQLite with WAL mode for `.sun/state.db` |
| libghostty | latest | Terminal emulation + Metal GPU rendering for SUN Terminal (Phase 5) |

### Feature Priorities

Full details in [FEATURES.md](./FEATURES.md).

**Table stakes (10 items -- missing any one and builders leave):**

| ID | Feature | SUN Mapping |
|----|---------|-------------|
| TS1 | Spec-driven workflow (plan before execute) | `sun new`, `sun discuss`, `sun plan` |
| TS2 | Fresh context per task (context hygiene) | Agent Router + Skill System isolation |
| TS3 | Config hierarchy (global -> project -> directory) | TOML 3-layer merge |
| TS4 | Auto-lint after every agent change | `sun guard` + `sun lint` |
| TS5 | Atomic commits with rollback points | `sun execute` per-task commits |
| TS6 | Git worktree isolation for parallel agents | `sun execute` worktree management |
| TS7 | Multi-provider agent support | Agent Router (AI SDK primary) |
| TS8 | Session persistence and state management | State Engine (.sun/ + SQLite) |
| TS9 | Sandbox and permission scoping | Agent Router permission sets |
| TS10 | Skill/plugin extensibility | Skill Loader/Registry/API |

**Differentiators (11 items -- competitive advantage):**

| ID | Feature | Phase | Notes |
|----|---------|-------|-------|
| D1 | Scenario holdout testing (agent-invisible) | 3 | ML train/test split applied to software verification |
| D2 | 5-layer Swiss Cheese verification | 3 (incremental) | Build layer by layer across waves |
| D3 | Architecture linter with agent-readable errors | 2 | ESLint custom rules, structured error format |
| D4 | Intent reconstruction verification | 3+ | Hardest layer; start with BDD comparison |
| D5 | Proactive next-best-action recommender | 1 | Rule engine, deterministic, sub-millisecond |
| D6 | Health score with pattern drift tracking | 2 | Feeds recommender, creates urgency |
| D7 | Tribal knowledge store | 2-3 | Capture -> document -> enforce pipeline |
| D8 | Digital Twin Universe (API mocks) | 4+ | Start with OpenAPI spec mocks; full behavioral cloning is Phase 4+ |
| D9 | Dedicated Agent Terminal (macOS native) | 5 | libghostty + Swift/AppKit. Separate project |
| D10 | Deterministic/agentic skill type separation | 1 | Architectural decision baked in from day one |
| D11 | Korean developer-first experience | 4-5 | Zero competitors in Korean market |

**Anti-features (9 items -- explicitly do NOT build):**

- AF1: Web UI / SaaS dashboard -- terminal-native only
- AF2: Team collaboration / RBAC -- solo builder tool
- AF3: Self-hosted LLM / fine-tuning -- use providers via AI SDK
- AF4: DAG engines / visual flow builders -- simple `ctx.run()` chaining
- AF5: GSD code fork -- clean-room reimplementation of concepts only
- AF6: AI-generated config without human approval -- human-in-the-loop always
- AF7: Universal domain expansion packs -- developer workflow only
- AF8: Monolithic single-context agent -- fresh context per task
- AF9: Plugin marketplace (premature) -- local skills via git, marketplace after 500+ users

### Architecture Highlights

Full details in [ARCHITECTURE.md](./ARCHITECTURE.md).

The architecture is a layered kernel + skills model with 7 core components and 49 skills organized into 3 skill categories (Harness, Workflow, Extension) plus a separate native terminal app.

**Core components:**

| Component | Responsibility | Key Decision |
|-----------|---------------|--------------|
| CLI Engine | Parse argv, route to skill, manage lifecycle | Commander.js, static registration, lazy loading |
| Config System | Load/merge 3-layer TOML, expose frozen typed config | smol-toml + deep-merge + Zod validation |
| Skill Loader/Registry | Discover, validate, load, execute skills | Static manifest, `registry.execute(skillId, ctx)`, skills chain via `ctx.run()` |
| State Engine | Persist all state, manage .sun/ directory | SQLite WAL for structured data, flat files for human-readable artifacts |
| Agent Router | Abstract LLM providers, scope permissions, dispatch | AI SDK primary, Claude Code CLI as first provider subprocess |
| Proactive Recommender | Compute next-best-action after every skill | Rule engine with weighted scoring, deterministic, sub-ms |
| SUN Terminal | Visualize agent PTY, dashboard, agent control | Swift/AppKit + libghostty, Unix Domain Socket IPC (JSON-RPC 2.0) |

**Key architectural patterns:**

1. **Skill Context API** -- Every skill receives `SkillContext { config, state, agent, run, ui, log }`. Deterministic skills get a blocked agent proxy that throws on access.
2. **Permission-based isolation** -- Agent Router enforces read/write/execute/deny patterns per skill invocation. Holdout scenarios use 4-layer defense-in-depth.
3. **Sequential verification pipeline** -- 5 layers as middleware chain with Layer 1 (deterministic) as a hard gate before any agent tokens are spent.
4. **IPC via Unix Domain Socket** -- CLI creates socket at `~/.sun/sockets/sun-<hash>.sock`. Terminal connects when available. CLI works standalone.

### Critical Pitfalls

Top 5 from [PITFALLS.md](./PITFALLS.md):

| # | Pitfall | Prevention |
|---|---------|------------|
| 1 | **Scope explosion (49 skills)** | Ship Phase 1 with ~8 skills. Validate between phases. If you are building Wave 9 before Phase 1 is on npm, stop. |
| 2 | **ESLint custom rule complexity** | Start with eslint-plugin-boundaries for 80% coverage. Add custom rules incrementally. Test against real codebases. Limit: 3 false positives = simplify. |
| 3 | **Agent Router abstraction leak** | Let Vercel AI SDK handle provider differences. SUN's router is a thin wrapper adding permissions and logging. If writing provider switch statements, you are reinventing AI SDK. |
| 4 | **TOML config merge ambiguity** | Define upfront: objects merge recursively, arrays REPLACE (not append). Provide explicit `extend` syntax. Build `sun settings --show-resolved` early. |
| 5 | **Git worktree orphan cleanup** | Register worktrees in `.sun/worktrees.json` with PID + timestamp. Check for stale worktrees on every invocation. try/finally in `sun execute`. |

Additional moderate pitfalls: Ink rendering performance with large outputs (use `<Static>`, paginate), smol-toml comment loss on round-trip (use text manipulation for edits, stringify only for new files), Claude Code CLI version drift (adapter pattern + version detection), skill loading latency (lazy load, <100ms target, benchmark in CI), Zod schema versioning (use `.default()` everywhere, `z.passthrough()`, version field in config).

## Implications for Roadmap

### Phase 1: Core Platform

**Rationale:** Every skill depends on the 6 infrastructure modules. Nothing works without the kernel. The skill type system (deterministic vs prompt) must be baked in from day one -- retrofitting is a rewrite.

**Delivers:** Working CLI with ~8 foundational skills (`sun init`, `sun lint`, `sun health`, `sun status`, `sun next`, `sun guard`, `sun agents`, `sun settings`). Config hierarchy, state persistence, skill loading, and the Proactive Recommender.

**Addresses:** TS3 (config), TS4 (auto-lint), TS8 (session/state), TS10 (skill system), D5 (recommender), D10 (skill type separation)

**Avoids:** Pitfall #4 (config merge -- define semantics in spec), Pitfall #9 (skill loading -- lazy load from day one)

### Phase 2: Harness Skills

**Rationale:** Harness skills (`sun init`, `sun lint`, `sun health`, `sun guard`) form a chain dependency. `init` generates rules that `lint` checks; `lint` feeds `guard`; `health` feeds the recommender. This is SUN's deterministic backbone and its cheapest differentiator (zero LLM cost).

**Delivers:** Architecture linter with agent-readable errors (D3), health score with drift tracking (D6), auto-lint guard mode, tribal knowledge capture (D7 start).

**Addresses:** D3 (arch linter), D6 (health score), D7 (tribal knowledge pipeline start)

**Avoids:** Pitfall #2 (ESLint complexity -- start with eslint-plugin-boundaries, expand incrementally)

### Phase 3: Workflow Skills (10 Waves)

**Rationale:** Workflow skills are the agentic core -- everything that involves LLM calls. They depend on both the Core Platform (Agent Router) and Harness Skills (lint rules for verification). The 10-wave structure respects dependency chains: state-only skills first, then planning chain, then execution, then verification, then composition.

**Delivers:** Full agentic workflow: `sun new` through `sun auto`. Scenario holdout testing (D1). Swiss Cheese verification layers 1-5 built incrementally. Multi-provider review. Git worktree execution.

**Addresses:** TS1 (spec-driven), TS2 (context hygiene), TS5 (atomic commits), TS6 (worktrees), TS7 (multi-provider), TS9 (sandboxing), D1 (holdout), D2 (Swiss Cheese), D4 (intent verification)

**Avoids:** Pitfall #1 (scope -- ship waves, validate between), Pitfall #3 (router leak -- AI SDK does the heavy lifting), Pitfall #5 (worktree cleanup -- PID tracking from day one), Pitfall #14 (cost tracking -- build into Agent Router from start)

### Phase 4: Extension Skills

**Rationale:** Korean search APIs and domain-specific skills require the core platform to be stable. These are market differentiators, not core functionality.

**Delivers:** `sun search:kr` (Naver/Kakao/regulatory), `sun search:paper` (DBpia/RISS/KCI + arXiv), `sun search:patent` (KIPRIS + USPTO), `sun design`.

**Addresses:** D8 (digital twin start -- OpenAPI mocks), D11 (Korean developer experience)

**Avoids:** Pitfall about Korean API rate limits (implement backoff from day one)

### Phase 5: SUN Terminal

**Rationale:** The native terminal is the observability differentiator but requires a solid CLI experience first. It is a separate Swift/AppKit project communicating via Unix Domain Socket.

**Delivers:** Multi-agent PTY observation, health dashboard, agent control (pause/resume/intervene), Next Best Action widget, Korean IME support.

**Addresses:** D9 (dedicated terminal), D11 (Korean IME)

**Avoids:** Pitfall about libghostty API stability (pin version, prepare for changes), Korean IME edge cases (test from the start)

### Phase Ordering Rationale

- **Dependency chain is strict:** CLI Engine -> Config -> State -> Skills -> Agent Router -> everything else. No shortcuts.
- **Deterministic before agentic:** Phase 2 (zero LLM cost, high reliability) validates the skill framework before Phase 3 adds agent complexity.
- **Verification builds incrementally:** Layer 2 (deterministic) in Phase 2, Layer 3 (BDD) in Phase 3 Wave 6, Layers 1/4/5 (agent-based) in later Phase 3 waves. This avoids the "build all verification at once" trap.
- **Korean market is a Phase 4+ play:** First prove the core tool works for any developer, then specialize.
- **Terminal is last:** "If you can't see it, you won't trust it" -- but trust requires a working CLI first.

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 3 (Workflow Skills):** Agent Router permission model needs concrete specification per skill. Cross-validation protocol (multi-provider review) has no established pattern to copy -- original design required.
- **Phase 3 Wave 6 (Verification):** Swiss Cheese layer implementation is novel. The ICSA 2025 paper provides theory but no reference implementation for coding agents.
- **Phase 5 (SUN Terminal):** libghostty embedding API is documented by Kytos/OpenOwl examples but may change before 1.0.

**Phases with standard patterns (skip deep research):**

- **Phase 1 (Core Platform):** Commander.js CLI, TOML config, SQLite state, Zod validation -- all well-documented, established patterns.
- **Phase 2 (Harness Skills):** eslint-plugin-boundaries + custom rules are well-documented. Health scoring is straightforward metric aggregation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every library chosen has 1M+ weekly downloads (except libghostty). Versions verified against npm/GitHub as of 2026-03-27. |
| Features | HIGH | Cross-referenced against 10+ competitor tools, Anthropic 2026 Agentic Coding Trends Report, and StrongDM factory patterns. |
| Architecture | HIGH (core), MEDIUM (Agent Router, verification pipeline) | Kernel + skills is proven. Agent Router permission model and Swiss Cheese verification are original designs without direct precedent. |
| Pitfalls | HIGH | Pitfalls sourced from documented failure modes in GSD, Aider, eslint-plugin-boundaries, git worktree docs, and smol-toml limitations. |

**Overall confidence:** HIGH -- with the caveat that the verification pipeline (D2) and scenario holdout (D1) are genuinely novel and will need iterative refinement during implementation.

### Gaps to Address

- **Agent Router permission enforcement specifics:** How exactly are Claude Code CLI `--allowedTools` / `--disallowedTools` flags mapped from SUN's PermissionSet? Needs API-level research during Phase 3 planning.
- **SQLite concurrency under parallel worktrees:** WAL mode supports concurrent reads, but multiple `sun execute` agents writing to the same `state.db` needs stress testing.
- **libghostty C API stability:** No SemVer guarantee. Pin and test.
- **Cost tracking accuracy:** AI SDK exposes token counts per call, but mapping tokens to dollars requires provider-specific pricing tables that change. Build adapter for price lookup.
- **Holdout scenario format:** BDD is the proposed format, but the exact schema for LLM-as-Judge evaluation needs definition during Phase 3 planning.

## Sources

Aggregated from all research files. See individual files for complete source lists.

### Primary (HIGH confidence)
- [Commander.js npm](https://www.npmjs.com/package/commander) -- v14.0.3
- [Vercel AI SDK](https://ai-sdk.dev/) -- v6.0.140
- [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Node.js 24 LTS](https://www.pkgpulse.com/blog/nodejs-22-vs-nodejs-24-2026)
- [ESLint v10 release](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.6
- [Ink GitHub](https://github.com/vadimdemedes/ink) -- v6.8.0
- [SQLite WAL documentation](https://www.sqlite.org/wal.html)

### Secondary (MEDIUM confidence)
- [libghostty announcement](https://mitchellh.com/writing/libghostty-is-coming) + [Kytos embedding](https://jwintz.gitlabpages.inria.fr/jwintz/blog/2026-03-14-kytos-terminal-on-ghostty/)
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
- [GSD v2 CLI architecture](https://github.com/gsd-framework) (concepts, not code)
- Anthropic 2026 Agentic Coding Trends Report
- StrongDM factory patterns (Digital Twin Universe, scenario holdout)

### Tertiary (LOW confidence)
- Swiss Cheese Model for Coding Agents (ICSA 2025 paper) -- theoretical basis, no reference implementation
- CRM Next Best Action patterns (Salesforce, HubSpot) -- conceptual inspiration for Proactive Recommender

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
