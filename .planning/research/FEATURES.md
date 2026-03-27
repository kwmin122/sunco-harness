# Feature Landscape: Agent Workspace OS / Harness Tools (2026)

**Domain:** Agent workspace OS, harness engineering CLI, agentic coding orchestration
**Researched:** 2026-03-27
**Mode:** Ecosystem
**Overall Confidence:** HIGH (multi-source verified across 10+ tools, official docs, Anthropic 2026 Agentic Coding Trends Report)

---

## Table Stakes

Features users expect. Missing = builders leave for GSD/Cursor/Superset immediately.

### TS1. Spec-Driven Workflow (Plan Before Execute)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | GSD, Spec Kit, BMAD all enforce specs before code. Builders in 2026 know unplanned agent coding = chaos. Anthropic report: only 0-20% of tasks can be fully delegated without specs. Spec Kit v0.1.4 supports all major agents (Copilot, Claude, Gemini, Cursor, Windsurf) |
| **Complexity** | Medium |
| **What competitors do** | GSD: `/gsd:new-project` generates PRD -> requirements -> roadmap in fresh subagent contexts. Spec Kit: `/speckit.analyze` performs read-only consistency checks (duplications, ambiguities, coverage gaps, contradictions). BMAD: PM+Architect agents create PRDs then Scrum Master decomposes into hyper-detailed stories |
| **SUN mapping** | `sun new`, `sun discuss`, `sun plan` |
| **Notes** | The spec is the contract between human intent and agent execution. Without it, verification is impossible because there is nothing to verify against. Intent review (D4) depends entirely on having captured intent before implementation |

### TS2. Fresh Context Per Task (Context Hygiene)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | GSD's killer insight and primary innovation: every subagent gets a fresh 200K-token context window with only the exact information needed. Main context stays at 30-40% usage. Context rot is the number one cause of agent degradation in long sessions |
| **Complexity** | High |
| **What competitors do** | GSD v2: standalone CLI on Pi SDK gives direct TypeScript control over context clearing, file injection at dispatch time, git branch management, cost tracking, stuck loop detection, crash recovery, and auto-advance through milestones -- all things v1 (markdown prompts only) could not do. Claude Code: subagents each get own context + tool allowlist + model choice. Codex: TOML-configured subagents with fresh contexts |
| **SUN mapping** | Agent Router + Skill System (ctx.run() chaining with context isolation) |
| **Notes** | GSD v1 was just markdown prompts that relied on the LLM doing the right thing. v2 moved to a real CLI specifically because context control requires programmatic access. SUN must have programmatic context control from day one -- this is not optional. Lazy-loading skills (names/descriptions at startup, full content on activation) is essential for context efficiency |

### TS3. Configuration Hierarchy (Global -> Project -> Directory)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Universal pattern across all 2026 tools. AGENTS.md is the cross-tool standard (February 2026). Claude Code reads from 5 scopes: enterprise -> user -> project -> directory -> subagent. Codex walks from project root to current directory. Copilot uses applyTo glob patterns in YAML frontmatter |
| **Complexity** | Medium |
| **What competitors do** | Claude Code: 5-scope JSON precedence, merge not replace, keys at multiple levels resolve to highest-priority scope. Codex: `~/.codex/config.toml` + AGENTS.md directory walk, closest file wins. Copilot: scoped instructions with glob patterns. All tools: short root config (~60-100 lines) acts as table of contents, deeper context in structured docs/ directory |
| **SUN mapping** | Config System (TOML: global ~/.sun/ -> project .sun/ -> directory src/.sun.toml) |
| **Notes** | Critical harness engineering insight: AGENTS.md should be 60-100 lines max. It is a table of contents, NOT the knowledge base. Deeper context lives in structured directories pointed to by the config. SUN's 60-line cap for agents.md is perfectly aligned with industry best practice. Skills in agent TOML should support scoped enabling/disabling per agent |

### TS4. Auto-Lint After Every Agent Change

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Aider pioneered this: automatic lint + test on every AI change with auto-fix. Factory.ai research: linters encode architecture boundaries directly into the code generation loop where LLM agents operate. Without it, agents silently erode architecture. Drift project proves deterministic architectural linting works for AI-accelerated repos |
| **Complexity** | Low-Medium |
| **What competitors do** | Aider: configurable lint + test commands in YAML, runs after every change, fixes problems automatically. Claude Code: built-in auto-fix for lint errors. Drift: deterministic static analyzer for pattern fragmentation, architecture violations, and structural hotspots -- no LLM infrastructure needed. go-arch-lint: checks import paths against YAML rules |
| **SUN mapping** | `sun guard` (auto-lint-after-change + watch mode), `sun lint` (architecture linter) |
| **Notes** | This is deterministic. Zero LLM cost. Stripe Minions pattern: lint/format = automated, implementation = agent. The distinction between "testing behavior vs testing execution" separates production harnesses from weekend prototypes |

### TS5. Atomic Commits with Rollback Points

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Every serious tool does this. Without atomic commits, a failed agent run pollutes 20 files with no rollback point. Observability requires granular commit history |
| **Complexity** | Low |
| **What competitors do** | GSD v2: one commit per task slice, auto-advance through milestone with 7 data-loss prevention fixes (hallucination guard, merge anchor verification, dirty tree detection). Aider: proper git commits for every change. Superset: each worktree has independent commit history |
| **SUN mapping** | `sun execute` (atomic commits per task) |
| **Notes** | Non-negotiable for trust. If you cannot git revert to the last known-good state, you cannot trust agent execution. GSD v2 learned this the hard way and added extensive data-loss prevention |

### TS6. Git Worktree Isolation for Parallel Agents

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Industry standard in 2026. Claude Code has `--worktree` (`-w`) flag built in. Superset's entire business model is multi-agent worktree orchestration (10+ parallel agents). Without it, parallel agents conflict on the same working directory |
| **Complexity** | Medium |
| **What competitors do** | Claude Code: `--worktree` flag + internal subagent worktrees for isolation. Superset: core innovation -- each agent in isolated worktree, shared git history, saves disk space. worktree-compose (workz): automatically gives every worktree its own isolated Docker Compose stack (ports, databases, caches). One task, one worktree, one agent |
| **SUN mapping** | `sun execute` (wave-based parallel + Git worktree isolation) |
| **Notes** | Worktrees isolate CODE but NOT runtime environment (shared ports, databases, services). workz/Docker Compose approach solves this with zero-config Docker isolation per worktree. SUN should plan for runtime isolation as a Phase 3+ enhancement |

### TS7. Multi-Provider Agent Support (Provider-Agnostic)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Vendor lock-in is unacceptable in 2026. The market has shifted toward orchestration layers. GSD supports Claude Code + Codex + Gemini CLI + OpenCode. Bifrost enables 20+ providers. GitHub Agent HQ runs Claude + Codex + Copilot simultaneously on the same task |
| **Complexity** | High |
| **What competitors do** | GSD: multi-agent across 4 providers. Superset: completely agent-agnostic, dispatches any CLI-based agent. OpenCode: 75+ LLM providers, switch mid-session while maintaining context. Bifrost: universal format conversion gateway. GitHub Agent HQ: official multi-agent command center |
| **SUN mapping** | Agent Router (provider-agnostic abstraction, Claude Code first) |
| **Notes** | Start with Claude Code (already validated by builder), but the abstraction layer MUST exist from day one. Adding providers later without abstraction = rewrite. The trend is orchestration layers, not single-vendor tools |

### TS8. Session Persistence and State Management

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Every new session is a blank slate without it. The 2026 consensus: sessions = working memory during a task, memory = long-term storage across tasks. Together they transform stateless LLMs into persistent agents. Anthropic report confirms developers use AI as "constant collaborator" requiring continuity |
| **Complexity** | Medium |
| **What competitors do** | GSD: .planning/ directory with structured Markdown + YAML frontmatter (human-readable, version-controlled). GSD v2: write-side discipline layer ensuring all state mutations flow through controlled tool calls. BMAD v6: step-file system for agent pause/save state. Claude Code: CLAUDE.md auto-memory + /compact for context compression |
| **SUN mapping** | State Engine (.sun/ directory: state, rules, health history, tribal, scenarios, planning), HANDOFF.json |
| **Notes** | Simple JSON or SQLite is sufficient for single-builder. For GSD v2, all state is Markdown+YAML files on disk -- readable by humans, agents, and git. SUN should follow this approach: human-readable state files that are also git-friendly |

### TS9. Sandbox and Permission Scoping

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Codex ships with OS-level sandbox enforcement as a first-class feature. Two-layer security: sandbox mode (what agents CAN do technically) + approval policy (WHEN agents must ask). Without sandboxing, agents can write anywhere, access network, leak secrets |
| **Complexity** | Medium-High |
| **What competitors do** | Codex: OS-level sandbox, no network by default, write limited to workspace, newline-delimited JSON events for programmatic verification. Claude Code: tool allow/deny lists per subagent, permission modes. Antigravity: sandboxed execution. All serious tools provide verifiable evidence of agent actions (citations, terminal logs, test outputs) |
| **SUN mapping** | Agent Router (permission scoping per agent), `sun verify` |
| **Notes** | The Anthropic 2026 report: developers maintain active oversight on 80-100% of delegated tasks. Better sandboxing directly enables more delegation because it builds trust. SUN's Agent Router must support tool allow/deny lists and write-scope restrictions per skill |

### TS10. Skill/Plugin Extensibility System

| Aspect | Detail |
|--------|--------|
| **Why Expected** | GSD has 50+ skill files. BMAD has expansion packs and BMad Builder. Claude Code has custom subagents + slash commands. Codex has `~/.codex/skills/*/SKILL.md`. Builders expect to extend any tool for their specific domain. A closed system gets abandoned |
| **Complexity** | High |
| **What competitors do** | GSD: skills as `<agent_skills>` XML blocks injected into agent prompts, lazy-load (names/descriptions at startup, full content only on activation). Codex: skills in `~/.codex/skills/*/SKILL.md` with TOML config. BMAD v6: Custom Language + Custom Agents + BMad Builder for visual/CLI assembly. Claude Code: subagents with own system prompt, tool set, model choice |
| **SUN mapping** | Skill Loader/Registry/API (TypeScript deterministic + Prompt agentic hybrid) |
| **Notes** | GSD skills modify both conversation context (instruction prompts) AND execution context (tool permissions, model choice). SUN's hybrid approach (TypeScript deterministic + Prompt agentic) goes further -- deterministic skills run without LLM cost. This is architecturally distinct from all competitors |

---

## Differentiators

Features that set SUN apart. Not universally expected, but create competitive advantage.

### D1. Scenario Holdout Testing (Agent-Invisible Verification)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | ML's cardinal sin = training on test data. StrongDM applied this to software: scenarios stored OUTSIDE the codebase, invisible to code-generating agents. No other individual-builder tool offers this |
| **Complexity** | High |
| **How it works in practice (StrongDM)** | Scenarios are end-to-end "user stories" stored in holdout sets. Coding agents never see them. Evaluation uses LLM-as-Judge with a "satisfaction" metric -- probabilistic, not binary pass/fail. The question is "did the software do what the user needed?" not "does this function return the right value?" StrongDM runs thousands of scenarios per hour. The approach imitates aggressive testing by an external QA team (expensive but effective) |
| **How SUN differentiates** | .sun/scenarios/ directory -- filesystem-level isolation from coding agents. `sun verify` uses SEPARATE evaluator agents (no shared context with implementation agents). `sun discuss` generates holdout scenarios during spec phase BEFORE any code exists. Scenario format: natural language user stories, not code-level tests |
| **Dependencies** | Requires: Agent Router for evaluator isolation, spec-driven workflow (TS1), `sun discuss` for scenario generation |
| **Notes** | This is genuinely novel in the developer-tool space. StrongDM does it for their internal factory with a dedicated team; SUN brings it to every individual builder. Start simple: text-based scenarios evaluated by a separate agent. Add satisfaction scoring later |

### D2. 5-Layer Swiss Cheese Verification Model

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | No single tool combines all five layers: (1) Multi-Agent cross-review, (2) Deterministic lint/test, (3) BDD acceptance criteria, (4) Permission Scoping, (5) Adversarial verification. Swiss cheese model means no single point of failure -- each layer catches what others miss |
| **Complexity** | Very High (build incrementally) |
| **What exists individually** | Layer 1 (Multi-Agent): Qodo specialist-agent panel (Correctness, Security, Performance, Observability, Requirements, Standards agents + Judge consolidator that filters to high-confidence findings only). Layer 2 (Deterministic): Aider auto-lint, Drift architecture checks. Layer 3 (BDD): Spec Kit consistency analysis, GSD plan-checker. Layer 4 (Separation): Nightwire VerificationAgent in completely separate LLM context with zero shared memory. Layer 5 (Adversarial): Anthropic three-agent architecture with calibrated Evaluator using few-shot grading |
| **How SUN differentiates** | Five distinct layers, each addressing a different failure mode. Layer composition is the innovation. The Nyquist principle provides theoretical basis: verification frequency must be >= 2x production frequency. Build incrementally: Layer 2 (deterministic) first, then Layer 3 (BDD), then 1, 4, 5 |
| **Dependencies** | Requires: Scenario Holdout (D1), Architecture Linter (TS4), Agent Router (TS7), BDD scenarios from `sun plan` |
| **Notes** | Anthropic's key insight for the Evaluator: "Separating the work of generation from evaluation proved crucial; tuning a dedicated evaluator to be skeptical is more tractable than making a generator self-critical." The evaluator was calibrated with few-shot examples with detailed score breakdowns to prevent score drift |

### D3. Architecture Linter with Agent-Readable Error Messages

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Existing linters (ESLint, Drift) produce human-readable errors. Agents need structured, actionable error messages. SUN's linter is designed for agents as the PRIMARY consumer with human readability as secondary |
| **Complexity** | Medium-High |
| **What exists** | Drift: detects architectural erosion (pattern fragmentation, architecture violations, structural hotspots) in AI-accelerated repos -- deterministic, no LLM needed. go-arch-lint: checks import paths against YAML-defined architecture rules. Packmind: auto-detects coding rules from team patterns. Factory.ai: linters encode architecture boundaries into agent code generation loop |
| **How SUN differentiates** | `sun lint`: dependency direction violation checks, layer boundary enforcement, 100% deterministic, --fix mode. Error messages structured for agent consumption: machine-parseable JSON + human-readable summary. Error format includes: violated_rule, violating_file, expected_behavior, suggested_fix. `sun guard`: watches for new anti-patterns and auto-promotes them to lint rules over time |
| **Dependencies** | Requires: `sun init` to generate initial rules from codebase analysis |
| **Notes** | The agent-readable error message format is an underappreciated differentiator. If your lint error says "import violation in line 42" an agent will try random fixes. If it says "module X in layer 3 imports module Y in layer 1; layer 3 may only import from layer 2 or layer 3; remove the import and use the interface from layer 2 instead" the agent fixes it correctly on the first attempt |

### D4. Intent Reconstruction Verification

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Review the INTENT, not the DIFF. Traditional code review checks "does the code work?" Intent reconstruction checks "does the code achieve what was originally intended?" -- a fundamentally different question. Salesforce Prizm originated this concept |
| **Complexity** | Very High |
| **What exists** | Augment Intent: verifier agent checks results against living spec, flags inconsistencies/bugs/missing pieces. Because verifier reads the same spec that guided implementation, it validates against what was actually planned rather than applying generic heuristics. Nightwire: VerificationAgent spawns completely separate LLM context with NO shared conversation history to review git diff against original spec. Three human gates: spec approval, task decomposition review, final diff review |
| **How SUN differentiates** | `sun verify` reconstructs original intent from .planning/ specs and .sun/scenarios/, then evaluates implementation against intent. The spec is created BEFORE implementation (via `sun discuss`), creating a clean temporal separation between intent capture and verification |
| **Dependencies** | Requires: spec-driven workflow (TS1) and `sun discuss` to capture intent before any code exists |
| **Notes** | The principle "No agent should verify its own work" is universal across all serious verification tools. Intent reconstruction is the hardest verification layer. Start simple: compare BDD acceptance criteria vs actual test results. Progress to semantic intent matching in later phases |

### D5. Proactive Next Best Action Recommender

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | After every skill execution, SUN recommends the optimal next step based on current state. CRM-style "Next Best Action" applied to developer workflows. By 2026, 85% of executives believe employees will rely on AI agent recommendations for real-time decisions (industry report). No coding tool does this systematically |
| **Complexity** | Medium |
| **What exists** | GSD v2: auto-advance through milestone slices (autopilot, not recommendations). Antigravity: generates task list artifacts (passive review, not proactive). Cursor: Tab predictions for code (not workflow). CRM tools (Salesforce, HubSpot): NBA engines for sales workflows (conceptual inspiration) |
| **How SUN differentiates** | Every skill execution ends with state-aware recommendation. Not just "run tests next" but "run tests -- your health score dropped because file X drifted from spec Y, and `sun lint` found 2 new architecture violations since your last run." Context-rich, actionable, specific |
| **Dependencies** | Requires: State Engine (TS8) for current state, `sun health` (D6) for health-aware recommendations |
| **Notes** | Start with deterministic state -> recommendation mapping table. Enhance with heuristics based on health score, time-since-last-action, recent errors. The key constraint is consistency -- EVERY skill must end with a recommendation. No exceptions |

### D6. Health Score with Pattern Drift Tracking

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Continuous monitoring of codebase health: document-code sync, anti-pattern spread rate, architectural drift trends. Not a one-time check but a living score with historical tracking |
| **Complexity** | Medium-High |
| **What exists** | Drift: detects architectural erosion but provides point-in-time snapshots only. Qodo: recommendation agent references past PRs and recurring patterns. SonarQube: traditional code quality metrics. No tool combines document sync + pattern tracking + trend visualization + agent-context health |
| **How SUN differentiates** | `sun health`: document hygiene (code-doc sync detection) + pattern health (anti-pattern spread tracking) + score-based report with historical trend. Feeds into Proactive Recommender (D5). `sun guard` watches health and auto-promotes degrading patterns to lint rules |
| **Dependencies** | Requires: `sun init` for baseline, `sun lint` for pattern detection |
| **Notes** | Health score creates urgency and gamification. "Your project health is 73/100, down from 81 last week. Main issue: 3 files drifted from spec" is actionable. Pure metrics without narrative are ignored. The score must be visible in every `sun status` output |

### D7. Tribal Knowledge Store (Implicit -> Explicit Pipeline)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Captures undocumented project knowledge and progressively codifies it into enforceable lint rules and tests. Gartner predicts organizations will abandon 60% of AI projects from insufficient AI-ready data -- tribal knowledge capture is the fix. The pipeline: capture (frictionless) -> document (searchable) -> enforce (automated) |
| **Complexity** | Medium |
| **What exists** | Qodo: learns from past PRs and review patterns. BMAD: preserves organizational knowledge across sessions. Claude Code: auto-memory in CLAUDE.md. Industry research: companies that manage tribal knowledge save 20% in onboarding costs, see 25% increase in engagement. No tool has an explicit tribal -> lint/test promotion pipeline |
| **How SUN differentiates** | .sun/tribal/ directory for knowledge capture. `sun note --tribal` for frictionless one-command capture. `sun guard` monitors tribal entries and suggests promotion to lint rules or test cases. Progressive codification pipeline: soft (documented note) -> medium (AGENTS.md instruction) -> hard (lint rule / automated test) |
| **Dependencies** | Requires: Linter (D3) and test framework for promotion targets |
| **Notes** | Make capture frictionless (one command, no context switch) and promotion systematic (automated suggestions with human confirmation). The key insight: tribal knowledge is the bridge between "this is how we do things" and "the machine enforces how we do things" |

### D8. Digital Twin Universe (External API Behavioral Clones)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Auto-generate mock servers that behaviorally clone external APIs. Test at volumes exceeding production rate limits, test failure modes impossible against live services, run thousands of scenarios per hour with zero cost |
| **Complexity** | Very High |
| **How StrongDM does it** | Full Digital Twin Universe replicating Okta, Jira, Slack, Google Docs/Drive/Sheets APIs including edge cases and observable behaviors. Runs locally with no rate limits, no production risk. Validates at volumes and rates far exceeding production limits. Tests failure modes that would be dangerous or impossible against live services. Dedicated team built this over months |
| **How SUN differentiates** | `sun test-gen` auto-generates Digital Twin mock servers. Phase 1: generate from OpenAPI specs (simple mocks). Phase 2: record real API responses and replay them (behavioral clones). Phase 3: inject failure modes and edge cases |
| **Dependencies** | Requires: OpenAPI spec parsing, mock server generation framework, scenario holdout integration |
| **Notes** | This is the most ambitious differentiator. For MVP, simple mock generation from OpenAPI specs is sufficient and already valuable. Full behavioral cloning (StrongDM-level) is Phase 4+ work. Start small, expand based on real usage patterns |

### D9. Dedicated Agent Terminal (Real-Time Visualization)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Native macOS terminal app showing multiple agents working simultaneously with real-time progress, health dashboard, agent control (pause/resume/intervene), and Korean IME support. Not a web wrapper but a native app with PTY-level observation |
| **Complexity** | Very High (separate Swift/AppKit project) |
| **What exists** | Superset: multi-agent terminal with worktree management and built-in diff editor. AgentOps: time-travel debugging with waterfall visualization (web). Arize AI: real-time dashboards and agent workflow visualization (web). LangSmith Studio: interactive graph visualization + Fetch CLI for terminal debugging. All web-based or Electron; none are native terminal apps |
| **How SUN differentiates** | Swift/AppKit native (smux R&D: HOST_MANAGED PTY, forkpty, split pane). Multi-agent PTY observation (see multiple agents working simultaneously). Dashboard view: health + progress + context + Next Best Action. Agent control: pause, intervene, hand off. Korean IME: complete Korean input support |
| **Dependencies** | Requires: smux R&D code (PTY management), Core Platform CLI working solidly |
| **Notes** | Phase 5 work. The CLI experience must be excellent before investing in the terminal app. But the terminal IS the long-term observability differentiator. "If you can't see it, you won't trust it." Superset proves the multi-agent terminal concept has market demand |

### D10. Deterministic + Agentic Skill Type Separation

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Explicit type system: TypeScript skills (deterministic, zero LLM cost, fast, reliable, testable) vs Prompt skills (agentic, creative, LLM-powered). Stripe Minions pattern elevated to a first-class architectural decision |
| **Complexity** | Medium |
| **What exists** | Stripe Minions: lint/format = automated, implementation = agent (conceptual pattern). GSD: all skills are prompt templates (no deterministic skills at all). BMAD: all agents use LLM (no deterministic layer). No tool explicitly separates deterministic from agentic at the skill-type level with different execution paths |
| **How SUN differentiates** | 20 TypeScript skills + 25 Prompt skills + 4 Hybrid. Clear contract: if a machine can enforce it without judgment, it is a TypeScript skill (runs instantly, no API cost). If it requires creativity or judgment, it is a Prompt skill. Hybrid skills use deterministic preprocessing + agentic core + deterministic postprocessing |
| **Dependencies** | Baked into Skill System architecture from Phase 1 |
| **Notes** | This is an architectural decision, not a feature to ship separately. It saves real money (20 skills at zero LLM cost) and increases reliability (deterministic = same input always produces same output). The skill catalog (49 skills) with explicit type assignments is already designed |

### D11. Korean Developer-First Experience

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Korean IME support in terminal, Korean search sources (KIPRIS, DBpia, RISS, KCI, Naver), Korean market/regulatory understanding. Zero competitors in Korean developer workspace OS market |
| **Complexity** | Medium (language support) to High (Korean search APIs) |
| **What exists** | No agent workspace tool provides Korean-first experience. All tools are English-only. Korean developers use English tools with friction in search, documentation, and input |
| **How SUN differentiates** | `sun search:kr` (Naver/Kakao/startup/regulatory search), `sun search:paper` (DBpia/RISS/KCI alongside arXiv/Scholar), `sun search:patent` (KIPRIS alongside USPTO/Google Patents). SUN Terminal with Korean IME via Swift/AppKit. Korean developer community as first-mover advantage |
| **Dependencies** | Requires: Extension Skills framework (Phase 4), SUN Terminal for IME (Phase 5) |
| **Notes** | "The first workspace OS for Korean developers. Zero competitors." Market size: 400K+ Korean professional developers. First-mover advantage in a market with zero competition is strategically valuable even if the market is smaller than global |

---

## Anti-Features

Features to explicitly NOT build. Building these would waste time, bloat scope, or actively harm the product.

### AF1. Web UI / SaaS Dashboard

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| Breaks terminal-native philosophy. Adds deployment complexity (server, auth, hosting). Splits attention between two interfaces. Every SaaS dashboard for devtools eventually becomes the thing nobody opens. The observability problem is solved by the native terminal, not a browser tab | SUN Terminal (native Swift/AppKit app). Rich CLI output with Ink. TUI dashboards if needed before Terminal ships |

### AF2. Team Collaboration Features (RBAC, Multi-User, Shared Workspaces)

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| SUN is for 1-person builders. Team features = enterprise complexity (permissions, syncing, conflict resolution, audit trails). BMAD went enterprise-first and the scope shows -- Scale Adaptive Framework, Custom Language, Builder tooling. SUN's edge is radical simplicity for solo builders | Git-based sharing (config in repo). Team features only after solo experience is perfected and product-market-fit is proven |

### AF3. Self-Hosted LLM / Model Fine-Tuning

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| Massive infrastructure cost, maintenance burden. Frontier models improve faster than any fine-tune can keep up. Provider-agnostic means USING the best available model, not BEING a model provider | Provider-agnostic Agent Router. Support Ollama/local models as one provider option among many. Never host, train, or fine-tune |

### AF4. Over-Engineered Control Flow (DAG Engines, Visual Flow Builders)

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| Harness engineering principle from multiple sources: "Build rippable harnesses -- over-engineering breaks when models improve." "If you over-engineer the control flow, the next model update will break your system." LangChain's rigid chain abstractions became a liability when models got more capable. The more powerful the model, the simpler the control flow should be | Simple sequential skill chaining via ctx.run(). Linear phase pipeline (GSD v2 pattern). State machine for routing recommendations. No workflow DAGs, no visual editors, no Airflow-style orchestration |

### AF5. GSD Code Copy / Fork

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| Legal risk. Architectural debt (GSD v1 is Claude Code markdown prompts, v2 is Pi SDK-coupled). GSD's design decisions serve its context (multi-provider skill pack), not SUN's context (independent workspace OS). SUN's TypeScript deterministic skills are a fundamentally different architecture that GSD does not have | Clean room reimplementation. Study concepts (context engineering, skill injection, auto-advance, data-loss prevention). Implement from scratch with SUN's hybrid skill architecture |

### AF6. AI-Generated Config / Rules Without Human Approval

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| "No agent should verify its own work" (Nightwire principle). Auto-generated rules that are auto-enforced = circular trust with no human in the loop. The harness engineering literature explicitly warns: "A single markdown file of rules is a brittle solution. It will rapidly decay, becoming obsolete as the system evolves." Auto-generating that brittle file is worse | `sun init` generates SUGGESTIONS that humans approve before activation. `sun agents` ANALYZES and RECOMMENDS but does not auto-generate. `sun guard` SUGGESTS promotions from tribal -> lint, human confirms. Human-in-the-loop for all constraint creation |

### AF7. Universal Domain Expansion Packs

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| BMAD offers expansion packs for Creative Writing, Business Strategy, Health, Education. This dilutes focus from the core competency. SUN is a developer workspace OS, not a universal agentic framework. Trying to serve every domain = serving none well | Extensible skill system that ALLOWS community-created domain skills. SUN itself ships developer workflow skills only. The plugin system enables expansion without SUN bearing the maintenance burden |

### AF8. Monolithic Single-Context Agent

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| GSD's foundational lesson: context rot kills agents. "No accumulated garbage, just the exact information needed for its specific task." A 200K-token context stuffed with implementation details from 3 hours ago cannot do high-level planning. GSD v1's biggest limitation was lack of context control. V2 was built specifically to solve this | Fresh context per task via Agent Router. Thin orchestrator pattern. Skill injection with lazy-loading (names only at startup, full content on activation). All persistent state in .sun/ files on disk, never held in LLM context |

### AF9. Plugin Marketplace / Registry (Premature)

| Why Avoid | What to Do Instead |
|-----------|-------------------|
| Building a marketplace before the core product has traction = building distribution infrastructure for a product nobody uses yet. Focus on making the built-in skills excellent before enabling third-party skills | Skills are local TypeScript/Prompt files. Community sharing via git repositories. Consider a registry only after 500+ active users and clear demand |

---

## Feature Dependencies (Detailed)

```
Legend: A -> B means "B requires A to work"

=== PHASE 1: Core Platform ===
CLI Engine -> ALL SKILLS (everything is a skill)
Config System -> Skill Loader (skills need config context)
Skill Loader -> Skill Registry -> Skill API (chain)
State Engine -> Session Management (TS8)
State Engine -> Proactive Recommender (D5)
Agent Router -> Multi-Provider support (TS7)
Agent Router -> Permission Scoping (TS9)
Agent Router -> Context Isolation (TS2)

=== PHASE 2: Harness Skills (chain dependency) ===
sun init -> sun lint  (init generates rules that lint checks against)
sun init -> sun health (init establishes baseline metrics)
sun lint -> sun guard  (guard wraps lint with auto-run + watch + promotion)
sun health -> Proactive Recommender (health score feeds recommendations)

=== PHASE 3: Workflow Skills ===
  Wave 1 (independent, no agent needed):
    sun status, sun next, sun progress, sun note, sun todo, sun seed,
    sun backlog, sun settings, sun pause, sun resume, sun context
    -- All use State Engine only

  Wave 2 (phase management):
    sun phase add/insert/remove
    -- Uses State Engine + roadmap state

  Wave 3 (initialization, needs Agent Router):
    sun new, sun scan
    -- Requires: Agent Router, Config System

  Wave 4 (planning chain):
    sun discuss -> sun assume -> sun research -> sun plan
    -- Each stage feeds the next
    -- sun discuss generates holdout scenarios for D1

  Wave 5 (execution + review):
    sun execute (requires: sun plan output)
    sun review --codex --gemini (requires: Agent Router multi-provider)

  Wave 6 (verification, builds D2 incrementally):
    sun verify Layer 2: deterministic lint/test (requires: sun lint)
    sun verify Layer 3: BDD acceptance (requires: sun plan BDD output)
    sun validate: test coverage audit
    sun test-gen: generates tests + basic mocks

  Wave 7 (shipping):
    sun ship (requires: sun verify pass)
    sun release (requires: sun ship)

  Wave 8 (milestone):
    sun milestone new/audit/complete/summary/gaps
    -- Requires: multiple skills from Waves 3-7

  Wave 9 (composition):
    sun auto (chains: discuss -> plan -> execute -> verify)
    sun quick, sun fast, sun do (requires: all base skills)

  Wave 10 (debugging):
    sun debug, sun diagnose, sun forensics
    -- Uses State Engine + Agent Router

=== PHASE 4: Extension Skills ===
Extension Skill framework -> sun search:kr, search:paper, search:patent
Extension Skill framework -> sun design
-- Requires: Core Platform + Agent Router

=== PHASE 5: SUN Terminal ===
Core Platform CLI fully working -> SUN Terminal
smux R&D code -> PTY management
State Engine -> Dashboard data source
Proactive Recommender -> Next Best Action widget

=== VERIFICATION PIPELINE (D2) Build Order ===
Layer 2 (Deterministic) -- Phase 2 with sun lint
Layer 3 (BDD) -- Phase 3 Wave 6 with sun plan output
Layer 1 (Multi-Agent) -- Phase 3 Wave 5 with sun review
Layer 4 (Intent Reconstruction) -- Phase 3 Wave 6+ with mature specs
Layer 5 (Adversarial) -- Phase 3 Wave 9 with sun auto

=== TRIBAL KNOWLEDGE PIPELINE (D7) ===
sun note --tribal -> .sun/tribal/ -> sun guard (monitors) ->
  suggestion to human -> human approves ->
  promoted to sun lint rule OR test case
```

---

## How Existing Tools Handle Key Capabilities (Cross-Reference Matrix)

### GSD: 50+ Markdown Skill Files and Context Engineering

GSD's architecture is the most relevant reference for SUN. Key implementation details:

1. **Skill File Structure**: Frontmatter (metadata) + prompt body with XML sections (`<role>`, `<philosophy>`, `<output_formats>` with exact templates). Claude models were trained to recognize XML tags as structural boundaries -- this is why GSD uses XML, not arbitrary markdown formatting

2. **Skill Injection Mechanism**: Skills are injected as `<agent_skills>` blocks in agent prompts. When a skill executes, two separate user messages are injected: first with skill metadata (visible to user as status indicator, isMeta: false), second with full skill prompt (hidden from UI, isMeta: true)

3. **Context Efficiency**: At startup, agents load only skill names and descriptions. Full skill content loads only when activated for relevant tasks. This prevents 50+ full skill prompts from consuming the context window

4. **State Persistence**: All state in .planning/ directory using structured Markdown with YAML frontmatter. Human-readable, version-controlled, accessible by both agents and humans

5. **GSD v1 vs v2**: v1 was markdown prompts installed into ~/.claude/commands/ -- relied entirely on LLM reading prompts and doing the right thing. Worked but had hard limits: no context control, context accumulation over long sessions. v2 moved to standalone CLI on Pi SDK for direct TypeScript access to context clearing, file injection, git management, cost tracking, stuck loop detection, crash recovery, and auto-advance

6. **Data-Loss Prevention (v2)**: 7 specific fixes -- hallucination guard, merge anchor verification, dirty tree detection. Pipeline decomposition (auto-loop rewritten as linear phase pipeline). Sliding-window stuck detection with fewer false positives

**SUN's position**: SUN can build on these concepts while adding what GSD lacks -- deterministic TypeScript skills (GSD has only prompt skills), hybrid skill types, architecture linting, health tracking, and the tribal knowledge pipeline. Clean room implementation, not a fork.

### StrongDM: Scenario Holdout and Digital Twin in Practice

1. **Scenario Holdout Implementation**: Scenarios = end-to-end user stories stored OUTSIDE the codebase. The analogy: in ML, you never train on your test set because it corrupts evaluation. StrongDM applies the same principle: coding agents never see evaluation scenarios. Scenarios are natural language descriptions of what a user should be able to do, not code-level test assertions

2. **Evaluation Method**: LLM-as-Judge evaluates satisfaction (not pass/fail). "Of all observed trajectories through all scenarios, what fraction likely satisfy the user?" This is probabilistic evaluation. The question is behavioral ("did the software do what the user needed?") not functional ("does this function return correct value?")

3. **Digital Twin Universe**: Full behavioral clones of Okta, Jira, Slack, Google Docs/Drive/Sheets. Replicates APIs, edge cases, observable behaviors. Runs locally. Enables: testing at volumes exceeding production rate limits, testing failure modes dangerous against live services, thousands of scenarios per hour. This was built by a dedicated team over months

4. **Factory Architecture**: Non-interactive development. Specs + scenarios drive agents that write code, run harnesses, converge without human review. Three engineers built the team with charter: no human writes code, no human reviews code. They shipped production security software for enterprises this way

**SUN's position**: Adopt scenario holdout (store in .sun/scenarios/) and LLM-as-Judge evaluation. Start Digital Twin with simple OpenAPI mock generation, not StrongDM-level behavioral cloning (that requires a dedicated team).

### Anthropic's Evaluator Pattern in Practice

1. **Core Architecture**: Three-agent system: Planner (creates task decomposition), Generator (implements in sprints), Evaluator (tests with Playwright, grades against criteria). Generator and Evaluator are SEPARATE -- the evaluator cannot access the generator's internal reasoning

2. **Why Separation Matters**: "Separating the work of generation from evaluation proved crucial; tuning a dedicated evaluator to be skeptical is more tractable than making a generator self-critical." Self-evaluation has strong approval bias -- agents confidently praise their own mediocre output

3. **Evaluator Calibration**: The evaluator uses few-shot examples with detailed score breakdowns. Grading criteria translate subjective principles into concrete gradable terms: Design Quality, Originality, Craft (technical execution), Functionality. Calibration prevents score drift across iterations

4. **Harness Design Evolution**: Anthropic went from multi-agent (many specialized agents) to fewer, more capable agents. The simplification lesson: "A dangerous misconception is that more powerful models permit looser architectural discipline. Greater agent autonomy demands a more constrained, not more relaxed, operational environment"

**SUN's position**: Apply evaluator separation at every verification point. `sun verify` must NEVER use the same agent context that implemented the code. Calibrate evaluators with graded examples. Start with BDD criteria grading, advance to subjective quality grading later.

---

## MVP Recommendation

### Phase 1-2: Must Ship (Core + Harness)

| Priority | Feature | Type | Rationale |
|----------|---------|------|-----------|
| 1 | CLI Engine + Config System + Skill System | TS | Without this infrastructure, nothing works |
| 2 | State Engine | TS | Without persistence, every session is a fresh start |
| 3 | Agent Router (Claude Code first) | TS | Enables all agentic skills |
| 4 | Proactive Recommender (basic) | TS | Deterministic state -> recommendation mapping |
| 5 | `sun init` | TS | Entry point; first experience defines adoption |
| 6 | `sun lint` | TS | Core harness value; deterministic, zero LLM cost |
| 7 | `sun health` | TS | Visible feedback = trust = continued use |
| 8 | `sun agents` | TS | Analysis tool for existing agent configs |
| 9 | `sun guard` | TS | Auto-lint-after-change, the always-on quality gate |

### Phase 3 Early: Ship Next (Core Workflow)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 10 | Session skills (status/next/progress/note/todo) | Quick wins, pure TypeScript |
| 11 | `sun new` / `sun discuss` / `sun plan` | Spec-driven workflow chain |
| 12 | `sun execute` | With atomic commits; worktrees can wait |
| 13 | `sun verify` (Layers 2+3 only) | Deterministic lint + BDD criteria |

### Defer to Phase 3 Late / Phase 4

| Feature | Reason to Defer |
|---------|-----------------|
| Scenario Holdout (D1) | Add after basic verify works, as Layer 4+5 |
| Multi-Agent Cross-Review | After single-agent workflow is solid |
| Intent Reconstruction (D4) | Hardest verification layer; needs mature spec system |
| `sun auto` | Needs all component skills working first |
| Extension Skills (search:kr, paper, patent) | Core must be complete first |

### Defer to Phase 5

| Feature | Reason to Defer |
|---------|-----------------|
| Digital Twin (D8) | Very ambitious; start with simple mock gen in test-gen |
| SUN Terminal (D9) | CLI must be excellent first; terminal adds observation |

**Phase ordering rationale**: Build trust with deterministic, reliable, zero-cost features first (lint, health, guard). These prove the "harness engineering" value proposition without any LLM dependency. Add agentic features (discuss, plan, execute, verify) once the harness foundation is proven. Ship the terminal last because observability of a broken workflow is less valuable than a working workflow with basic CLI output.

---

## Sources

### Primary (HIGH confidence -- official docs, maintainer accounts)
- [GSD get-shit-done GitHub (23K stars)](https://github.com/gsd-build/get-shit-done)
- [GSD v2 GitHub (Pi SDK standalone CLI)](https://github.com/gsd-build/gsd-2)
- [StrongDM Software Factory (official blog)](https://www.strongdm.com/blog/the-strongdm-software-factory-building-software-with-ai)
- [StrongDM Factory Analysis (Simon Willison)](https://simonwillison.net/2026/Feb/7/software-factory/)
- [Anthropic Harness Design for Long-Running Apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic 2026 Agentic Coding Trends Report](https://resources.anthropic.com/2026-agentic-coding-trends-report)
- [Anthropic Evaluator-Optimizer Cookbook](https://github.com/anthropics/anthropic-cookbook/blob/main/patterns/agents/evaluator_optimizer.ipynb)
- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Codex CLI Features (OpenAI)](https://developers.openai.com/codex/cli/features)
- [Codex Security (OpenAI)](https://developers.openai.com/codex/security)
- [Claude Code Subagents (Anthropic)](https://code.claude.com/docs/en/sub-agents)
- [Codex AGENTS.md (OpenAI)](https://developers.openai.com/codex/guides/agents-md)
- [BMAD Method GitHub](https://github.com/bmad-code-org/BMAD-METHOD)
- [Superset CLI GitHub](https://github.com/superset-sh/superset)
- [Cursor Features](https://cursor.com/features)
- [Google Antigravity Docs](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [OpenAI Harness Engineering](https://openai.com/index/harness-engineering/)
- [Aider Documentation](https://aider.chat/docs/)

### Secondary (MEDIUM confidence -- verified analysis, technical blogs)
- [GSD Deep Dive (codecentric)](https://www.codecentric.de/en/knowledge-hub/blog/the-anatomy-of-claude-code-workflows-turning-slash-commands-into-an-ai-development-system)
- [GSD Medium (Agent Native)](https://agentnativedev.medium.com/get-sh-t-done-meta-prompting-and-spec-driven-development-for-claude-code-and-codex-d1cde082e103)
- [Harness Engineering Complete Guide (NxCode)](https://www.nxcode.io/resources/news/harness-engineering-complete-guide-ai-agent-codex-2026)
- [Harness Engineering: Third Evolution (Epsilla)](https://www.epsilla.com/blogs/harness-engineering-evolution-prompt-context-autonomous-agents)
- [Factory.ai: Linters Directing Agents](https://factory.ai/news/using-linters-to-direct-agents)
- [Qodo 2.0 Agentic Code Review](https://www.qodo.ai/blog/introducing-qodo-2-0-agentic-code-review/)
- [Drift Architectural Linter](https://github.com/sauremilk/drift)
- [AGENTS.md Cross-Tool Guide (DeployHQ)](https://www.deployhq.com/blog/ai-coding-config-files-guide)
- [Augment Intent vs Claude Code](https://www.augmentcode.com/tools/intent-vs-claude-code)
- [Nightwire Verification Pattern](https://github.com/NousResearch/hermes-agent/issues/406)
- [Dark Factory Architecture](https://signals.aktagon.com/articles/2026/03/dark-factory-architecture-how-level-4-actually-works/)
- [Agent Config Files Guide (ProductBuilder)](https://www.productbuilder.net/learn/agent-config-files)
- [Phil Schmid: Agent Harness 2026](https://www.philschmid.de/agent-harness-2026)
- [SDD vs GSD vs Spec Kit (Medium)](https://medium.com/@richardhightower/agentic-coding-gsd-vs-spec-kit-vs-openspec-vs-taskmaster-ai-where-sdd-tools-diverge-0414dcb97e46)
