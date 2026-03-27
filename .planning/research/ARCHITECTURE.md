# Architecture Patterns

**Domain:** CLI-based Agent Workspace OS (SUN)
**Researched:** 2026-03-27

## Recommended Architecture

SUN is a layered, skill-based CLI runtime with a native terminal companion app. The architecture follows a **kernel + plugins** model: a thin core runtime (6 infrastructure modules) loads and dispatches skills at the edges, with all business logic living in skills -- never in the kernel.

```
+------------------------------------------------------------------+
|                    SUN Terminal (Swift/AppKit)                    |
|   Agent PTY View | Dashboard | Control | Recommender Widget      |
+---------------------------+--------------------------------------+
                            | Unix Domain Socket (JSON-RPC 2.0)
+---------------------------v--------------------------------------+
|                      SUN CLI Runtime (Node.js)                   |
|  +------------------------------------------------------------+ |
|  |  CLI Engine (Commander.js + static registration)            | |
|  +------------------------------------------------------------+ |
|  |  Config System        |  Skill Loader/Registry/API          | |
|  |  (TOML hierarchical)  |  (TS deterministic + Prompt agent)  | |
|  +------------------------------------------------------------+ |
|  |  State Engine          |  Agent Router                      | |
|  |  (SQLite WAL + .sun/)  |  (Provider abstraction + perms)    | |
|  +------------------------------------------------------------+ |
|  |  Proactive Recommender (rule engine + state mapping)        | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  +--------------------+  +-------------------+  +--------------+ |
|  | Harness Skills (5) |  | Workflow Skills    |  | Extension    | |
|  | init/lint/health/  |  | (40 skills)       |  | Skills (4)   | |
|  | agents/guard       |  | new/scan/plan/... |  | kr/paper/... | |
|  +--------------------+  +-------------------+  +--------------+ |
+------------------------------------------------------------------+
                            |
              +-------------v--------------+
              |  .sun/ Directory (State)   |
              |  state.db (SQLite WAL)     |
              |  rules/ tribal/ scenarios/ |
              |  planning/ sessions/       |
              +----------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Boundary Rule |
|-----------|---------------|-------------------|---------------|
| **CLI Engine** | Parse argv, route to skill, manage lifecycle | Skill Loader, Config System | Never contains business logic. Pure dispatch. |
| **Config System** | Load/merge TOML from 3 layers, expose typed config | CLI Engine, every skill via `ctx.config` | Read-only after initialization. Skills never write config. |
| **Skill Loader/Registry** | Discover, validate, load, and execute skills | CLI Engine (dispatch), State Engine (read/write), Agent Router (for prompt skills) | Single entry point: `registry.execute(skillId, ctx)`. Skills cannot directly call other skills -- they use `ctx.run(skillId)` which goes through the registry. |
| **State Engine** | Persist/restore all state, manage .sun/ directory | Skills (via `ctx.state`), Proactive Recommender | Only component that touches .sun/ filesystem and state.db. Skills access state exclusively through `ctx.state` API. |
| **Agent Router** | Abstract LLM providers, scope permissions, dispatch agent calls | Prompt skills (via `ctx.agent`), verification pipeline | Skills never instantiate providers directly. All agent access goes through `ctx.agent.run()`. |
| **Proactive Recommender** | Compute next best action after every skill execution | State Engine (reads), CLI Engine (appends to output) | Pure function: `(currentState, lastSkillResult) => Recommendation[]`. No side effects. |
| **SUN Terminal** | Visualize agent PTY streams, dashboard, control | CLI Runtime via Unix Domain Socket | Separate process. Can crash without affecting CLI. CLI works without Terminal. |

### Data Flow

**Typical skill execution (e.g., `sun lint`):**

```
1. User types: sun lint --fix
2. CLI Engine: parse argv -> resolve skill "lint" -> load config
3. Config System: merge global (~/.sun/config.toml)
                  + project (.sun/config.toml)
                  + directory (src/.sun.toml)
                  -> frozen ConfigObject
4. Skill Loader: find "lint" in registry
                 -> validate it's a TS skill (deterministic)
                 -> create SkillContext { config, state, agent, run, ui, log }
5. State Engine: load current rules from .sun/rules/
6. Lint Skill: execute deterministically, produce violations[]
7. State Engine: persist lint results to state.db
8. Proactive Recommender: (lint_results, state) -> "Run sun guard to promote 3 new anti-patterns"
9. CLI Engine: render lint output + recommendation
10. Terminal (if connected): receives state update via socket, refreshes dashboard
```

**Prompt skill execution (e.g., `sun plan`):**

```
1-4. Same as above
5. State Engine: load context (discuss results, requirements, scenarios)
6. Plan Skill: builds prompt with context
7. Agent Router: select provider (Claude Code CLI)
                 -> scope permissions (read .planning/, write .planning/phases/)
                 -> dispatch to provider subprocess
8. Provider: returns structured plan + BDD scenarios
9. Plan Skill: validate output structure, extract holdout scenarios
10. State Engine: persist plan to .sun/planning/
                  store holdout scenarios to .sun/scenarios/ (flagged: coding-agent-invisible)
11. Proactive Recommender: state -> "Ready for sun execute"
```

---

## 1. CLI Plugin/Skill Architecture

**Decision: Commander.js with static registration + lazy loading. NOT dynamic plugin loading. NOT oclif.**

**Confidence: HIGH** (based on Commander.js docs, oclif performance benchmarks, project constraints)

### Why Commander.js over oclif

| Criterion | Commander.js | oclif |
|-----------|-------------|-------|
| Startup time | ~18ms | ~85ms |
| Dependencies | 0 | ~30 |
| Plugin system | None (build our own) | Built-in |
| Learning curve | Minimal | Moderate |
| Fits SUN's model | Yes -- skills ARE the plugins | Overkill -- SUN skills are not npm packages |

oclif's plugin system assumes plugins are separate npm packages discovered at runtime. SUN's skills are internal components in a monorepo -- they don't need npm-level plugin discovery. Commander.js's zero-dependency, zero-overhead approach is the right fit. The 100ms oclif overhead per invocation matters for a CLI that should feel instant.

### Registration Pattern

Use **static registration with lazy loading** -- not dynamic filesystem scanning. Every skill registers itself in a manifest, but its code is loaded only when invoked.

```typescript
// packages/cli/src/skills/manifest.ts
// Static manifest -- compiled into the binary. No runtime discovery.
export const SKILL_MANIFEST: SkillEntry[] = [
  { id: 'lint',    command: 'lint',    type: 'deterministic', loader: () => import('@sun/skills-harness/lint') },
  { id: 'plan',    command: 'plan',    type: 'prompt',        loader: () => import('@sun/skills-workflow/plan') },
  { id: 'health',  command: 'health',  type: 'deterministic', loader: () => import('@sun/skills-harness/health') },
  // ... all 49 skills
];

// CLI Engine registers subcommands from manifest at startup (fast -- no actual loading)
for (const entry of SKILL_MANIFEST) {
  program
    .command(entry.command)
    .description(entry.description)
    .action(async (opts) => {
      const module = await entry.loader();  // Lazy load only when invoked
      const ctx = await createContext(entry, opts);
      await module.default.execute(ctx);
    });
}
```

**Why not dynamic loading?** SUN is a curated product with 49 skills, not an extensible platform. Dynamic loading adds complexity (filesystem scanning, validation, error handling for malformed plugins) with no benefit. If a future "community skills" feature is needed, it can be added as a separate registry layer without changing the core.

### Subcommand Nesting

Use Commander.js `.addCommand()` for nested subcommands (e.g., `sun milestone new`, `sun phase add`, `sun search:kr`). Commander.js natively supports this pattern with automatic inherited settings copying.

```typescript
// sun milestone new / sun milestone audit / sun milestone complete
const milestone = new Command('milestone');
milestone.addCommand(new Command('new').action(...));
milestone.addCommand(new Command('audit').action(...));
milestone.addCommand(new Command('complete').action(...));
program.addCommand(milestone);
```

---

## 2. Skill System Design: Unified API for TS + Prompt Skills

**Decision: Single `SkillContext` interface, two execution paths. Skills are TypeScript modules that MAY invoke agents, not prompt files.**

**Confidence: HIGH** (established pattern: Stripe Minions deterministic+agentic split)

### The Core Abstraction

Every skill -- whether deterministic TypeScript or agent-backed prompt -- implements the same interface and receives the same context object. The difference is in execution, not in API.

```typescript
// packages/core/src/skill.ts
interface Skill {
  id: string;
  type: 'deterministic' | 'prompt' | 'hybrid';
  meta: SkillMeta;           // description, category, permissions needed
  execute(ctx: SkillContext): Promise<SkillResult>;
}

interface SkillContext {
  config: Readonly<SunConfig>;              // Merged TOML config (frozen)
  state: StateAPI;                          // Read/write .sun/ state
  agent: AgentAPI;                          // Only usable by prompt/hybrid skills
  run: (skillId: string, opts?) => Promise<SkillResult>;  // Skill chaining via registry
  ui: UIAPI;                               // Interactive prompts, progress, output
  log: Logger;                              // Structured logging
  cwd: string;                             // Working directory
  flags: Record<string, unknown>;          // CLI flags
}

interface SkillResult {
  status: 'success' | 'failure' | 'partial';
  data: unknown;                           // Skill-specific output
  artifacts: Artifact[];                   // Files created/modified
  recommendation?: Recommendation;         // Proactive next action
}
```

### Two Execution Paths

**Deterministic skills (20 of 49):** Execute purely in Node.js. Never touch the Agent Router. Examples: `sun lint` reads files, applies rules, returns violations. `sun status` reads state.db, formats output. These are fast (sub-second), reproducible, and testable with standard unit tests.

**Prompt skills (25 of 49):** Build a structured prompt from context, dispatch through Agent Router, parse and validate the response. The skill itself is TypeScript that orchestrates the agent call -- it is NOT a raw prompt file.

```typescript
// Example: sun plan (prompt skill)
export default {
  id: 'plan',
  type: 'prompt' as const,
  meta: { permissions: ['read:.planning/', 'write:.planning/phases/'] },

  async execute(ctx: SkillContext) {
    // 1. Gather context (deterministic)
    const discuss = await ctx.state.get('discuss.result');
    const requirements = await ctx.state.get('requirements');

    // 2. Build prompt (deterministic)
    const prompt = buildPlanPrompt(discuss, requirements, ctx.config);

    // 3. Dispatch to agent (through Agent Router)
    const response = await ctx.agent.run({
      prompt,
      permissions: this.meta.permissions,
      expectedSchema: PlanOutputSchema,  // Zod schema for output validation
    });

    // 4. Validate + extract (deterministic)
    const plan = PlanOutputSchema.parse(response.content);
    await ctx.state.set('plan.current', plan);

    // 5. Extract holdout scenarios (deterministic, privileged)
    if (plan.holdoutScenarios?.length) {
      await ctx.state.setSecure('scenarios.holdout', plan.holdoutScenarios);
    }

    return { status: 'success', data: plan, artifacts: [...] };
  }
};
```

**Hybrid skills (4 of 49):** Run deterministic steps first, then conditionally invoke the agent. Example: `sun ship` runs deterministic checks (tests pass? lint clean? coverage threshold?), then uses an agent only for PR description generation.

### Why NOT Separate Prompt Files

Some systems (like Claude Code skills) use standalone `.md` prompt files that get expanded at runtime. SUN deliberately avoids this because:

1. **Prompt skills still need TypeScript orchestration** -- gathering context, validating output, persisting state. A raw prompt file cannot do this.
2. **Type safety** -- Zod schemas validate agent output at compile time.
3. **Testability** -- The TypeScript wrapper can be tested with mock agent responses.
4. **Deterministic envelope** -- Every prompt skill has deterministic pre/post processing that catches agent errors before they propagate.

### Runtime Type Guard

The Agent Router enforces type safety at runtime: if a deterministic skill attempts to call `ctx.agent.run()`, it throws an error. This prevents accidental LLM usage in skills that should be pure.

```typescript
function createContext(entry: SkillEntry, opts: unknown): SkillContext {
  return {
    // ...
    agent: entry.type === 'deterministic'
      ? createBlockedAgentProxy()  // Throws on any method call
      : createAgentAPI(router),
  };
}
```

---

## 3. State Management: .sun/ Directory + SQLite

**Decision: SQLite (WAL mode via better-sqlite3) for structured state, flat files for human-readable artifacts**

**Confidence: HIGH** (SQLite docs, better-sqlite3 benchmarks, AgentFS pattern)

### .sun/ Directory Structure

```
.sun/
  config.toml              # Project-level config (TOML, human-editable)
  state.db                 # SQLite WAL -- structured state (skills, sessions, health history)
  state.db-wal             # WAL file (auto-managed by SQLite)
  state.db-shm             # Shared memory (auto-managed by SQLite)
  rules/                   # Lint rules (JSON, human-readable, version-controlled)
    layer-boundaries.json
    dependency-directions.json
    custom/
  tribal/                  # Tribal knowledge (Markdown, human-readable)
    naming-conventions.md
    api-patterns.md
  scenarios/               # Holdout test scenarios (RESTRICTED ACCESS)
    holdout/               # Coding agents CANNOT read these
      scenario-001.bdd
      scenario-002.bdd
    visible/               # Visible to all agents
      scenario-003.bdd
  planning/                # Plans, phases, roadmaps (Markdown/YAML)
    ROADMAP.md
    phases/
      phase-01.md
    requirements/
  sessions/                # Session handoff files
    HANDOFF.json           # Current session state for resume
  cache/                   # Transient analysis cache (gitignored)
    lint-results.json
    health-snapshot.json
```

### Why SQLite + Flat Files (Hybrid Approach)

| Data Type | Storage | Reason |
|-----------|---------|--------|
| Skill execution history | SQLite | Queryable, concurrent-safe, ACID transactions |
| Health score timeline | SQLite | Time-series queries, aggregation functions |
| Session state | SQLite | Atomic read/write, no corruption risk |
| Agent conversation logs | SQLite | Structured, searchable |
| Lint rules | JSON files | Human-readable, git-diffable, manually editable |
| Tribal knowledge | Markdown files | Authored by humans, readable in any editor |
| Planning docs | Markdown files | Human-authored, git-diffable |
| Holdout scenarios | BDD files | Readable by verification agents, human-authored |
| Config | TOML files | Human-editable, standard format |

### SQLite Configuration

Use `better-sqlite3` -- the fastest SQLite library for Node.js, synchronous API that avoids event loop complexity.

```typescript
import Database from 'better-sqlite3';

function openStateDB(sunDir: string): Database.Database {
  const db = new Database(path.join(sunDir, 'state.db'));
  db.pragma('journal_mode = WAL');       // Concurrent reads while writing
  db.pragma('busy_timeout = 5000');      // Wait 5s for lock instead of failing
  db.pragma('synchronous = NORMAL');     // Good balance of speed vs safety
  db.pragma('foreign_keys = ON');        // Referential integrity
  return db;
}
```

### File Locking for Parallel Agents

SQLite WAL mode handles concurrent access from multiple processes (e.g., parallel `sun execute` agents in different worktrees):

- **Unlimited concurrent readers** -- multiple agents can query state simultaneously
- **Single writer at a time** -- writes are serialized by SQLite's internal locking
- **busy_timeout = 5000** -- if a write is blocked, wait up to 5 seconds before failing
- **No external lock files needed** -- SQLite's internal locking is sufficient
- **WAL mode** allows readers to not block writers and writers to not block readers

For flat files (.sun/rules/, .sun/tribal/), use **optimistic locking with content hashing**:

```typescript
async function safeWriteFile(filePath: string, content: string, expectedHash: string) {
  const currentHash = await hashFile(filePath);
  if (currentHash !== expectedHash) {
    throw new ConflictError(`File ${filePath} was modified by another process`);
  }
  await fs.writeFile(filePath, content, { flag: 'w' });
}
```

### What Gets Gitignored vs Version-Controlled

```gitignore
# .sun/.gitignore
state.db
state.db-wal
state.db-shm
cache/
sessions/
```

Rules, tribal knowledge, planning docs, and scenarios ARE version-controlled. State database and caches are NOT.

---

## 4. Agent Router Design

**Decision: Provider abstraction layer with permission scoping via allowlists. Claude Code CLI as first provider, invoked as subprocess.**

**Confidence: MEDIUM** (pattern validated by Claude Code/Codex permission models, specific SUN implementation is original)

### Provider Abstraction Layer

```typescript
// packages/core/src/agent/router.ts
interface AgentProvider {
  id: string;                              // 'claude-code' | 'codex' | 'gemini-cli'
  name: string;
  capabilities: ProviderCapabilities;
  execute(request: AgentRequest): Promise<AgentResponse>;
  isAvailable(): Promise<boolean>;         // Check if CLI tool is installed
}

interface AgentRequest {
  prompt: string;
  permissions: PermissionSet;
  expectedSchema?: ZodSchema;              // For structured output validation
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface PermissionSet {
  read: string[];                          // Glob patterns: ['src/**', '.planning/**']
  write: string[];                         // Glob patterns: ['src/**']
  execute: string[];                       // Allowed commands: ['npm test', 'npx vitest']
  deny: string[];                          // Explicit denials: ['.sun/scenarios/holdout/**']
}
```

### Permission Scoping Strategy

Three permission levels, enforced by the router before dispatching to providers:

| Level | Read | Write | Execute | Use Case |
|-------|------|-------|---------|----------|
| **read-only** | Project files | None | None | `sun review`, `sun agents` analysis |
| **write-scoped** | Project files | Specified dirs only | Test commands | `sun execute`, `sun plan` |
| **verification** | Project + .sun/scenarios/ | .sun/verify-results/ | Test + lint commands | `sun verify` only |

Permission enforcement follows the priority: **deny > allow**. If a path matches a deny pattern, it is blocked even if an allow pattern also matches.

```typescript
class AgentRouter {
  async dispatch(request: AgentRequest, provider?: string): Promise<AgentResponse> {
    // 1. Select provider (explicit or best available)
    const agent = provider
      ? this.providers.get(provider)
      : await this.selectBestProvider(request);

    // 2. Enforce permissions -- translate to provider-specific flags
    const scopedRequest = this.enforcePermissions(request);

    // 3. Dispatch to provider subprocess
    const response = await agent.execute(scopedRequest);

    // 4. Validate output schema if provided
    if (request.expectedSchema) {
      return this.validateResponse(response, request.expectedSchema);
    }
    return response;
  }
}
```

### Cross-Validation Pattern

For `sun review --codex --gemini`, the router dispatches the same prompt to multiple providers and a coordinator agent merges findings:

```typescript
async crossValidate(request: AgentRequest, providers: string[]): Promise<CrossValidationResult> {
  // Parallel dispatch to all providers
  const results = await Promise.allSettled(
    providers.map(p => this.dispatch(request, p))
  );

  // Agreements get high confidence, conflicts get flagged for human review
  return this.mergeFindings(results);
}
```

### Claude Code CLI Integration (First Provider)

Claude Code CLI is invoked as a subprocess. SUN translates PermissionSet into Claude Code's `--allowedTools` and `--disallowedTools` flags.

```typescript
class ClaudeCodeProvider implements AgentProvider {
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const args = [
      '--print',                    // Non-interactive mode
      '--allowedTools', this.buildAllowedTools(request.permissions),
      '--output-format', 'json',    // Structured output
    ];

    const result = await execa('claude', args, {
      input: request.prompt,
      timeout: request.timeout ?? 120_000,
      cwd: this.cwd,
    });

    return this.parseResponse(result.stdout);
  }
}
```

### Adding Future Providers

New providers implement the `AgentProvider` interface. The router auto-discovers available providers by checking if their CLI binary exists. No code changes needed in skills -- they all go through `ctx.agent.run()`.

---

## 5. Hierarchical TOML Config

**Decision: 3-layer deep merge with last-writer-wins for scalars and array replacement (not concatenation). Zod validation after merge.**

**Confidence: HIGH** (TOML spec, Hugo/Morphir merge patterns, TypeScript deepmerge libraries)

### Three Config Layers

```
Layer 1 (lowest priority): ~/.sun/config.toml          (Global -- user preferences)
Layer 2 (medium priority): <project>/.sun/config.toml  (Project -- version-controlled)
Layer 3 (highest priority): <dir>/.sun.toml             (Directory overrides)
```

### Merge Strategy

| Type | Strategy | Rationale |
|------|----------|-----------|
| Scalar (string, number, bool) | Last layer wins | Directory config overrides project, project overrides global |
| Object/Table | Deep recursive merge | Preserve keys from parent layers while allowing overrides |
| Array | **Replace entirely** (not concatenate) | Predictable behavior. Avoids surprising array growth across layers. |

```toml
# ~/.sun/config.toml (Global)
[agent]
provider = "claude-code"
timeout = 120000

[lint.rules]
enabled = ["layer-boundaries", "dependency-direction"]

# <project>/.sun/config.toml (Project -- overrides global)
[agent]
timeout = 180000             # Override: longer timeout for this project

[lint.rules]
enabled = ["layer-boundaries", "dependency-direction", "naming-convention"]  # Replaces array

# src/api/.sun.toml (Directory -- overrides project for this subtree)
[lint.rules]
enabled = ["layer-boundaries", "api-contract"]  # Different rules for API layer only
```

### Implementation

```typescript
import { parse as parseTOML } from 'smol-toml';  // Lightweight TOML parser
import { deepmerge } from 'deepmerge-ts';
import { z } from 'zod';

function loadConfig(cwd: string): SunConfig {
  const layers = [
    loadTOML(path.join(os.homedir(), '.sun', 'config.toml')),    // Global
    loadTOML(findProjectRoot(cwd, '.sun', 'config.toml')),       // Project
    loadTOML(findNearestFile(cwd, '.sun.toml')),                 // Directory
  ].filter(Boolean);

  const merged = layers.reduce(
    (acc, layer) => deepmerge(acc, layer, {
      mergeArrays: false,  // Arrays: replace, don't concatenate
    }),
    DEFAULT_CONFIG
  );

  return Object.freeze(SunConfigSchema.parse(merged));  // Validate + freeze
}
```

### Config Schema Enforcement

All config is validated with Zod at load time. Invalid config fails fast with clear, actionable error messages (pointing to the exact TOML file and line). The merged config is frozen (`Object.freeze`) -- skills cannot mutate it at runtime.

---

## 6. Swiss Cheese Verification Pipeline

**Decision: 5 layers as sequential middleware chain with early termination. Layer 1 (deterministic) is a gate.**

**Confidence: MEDIUM** (Swiss Cheese Model paper at ICSA 2025, application to coding agents is novel)

### The 5 Layers

```
Input: Code changes (diff) + original intent (from sun discuss/plan)
  |
  v
+-- Layer 1: DETERMINISTIC CHECKS -------------------------+
|  sun lint (architecture rules), sun validate (tests pass) |
|  100% automated. No LLM. Fast (<5s). Catches ~60%.       |
|  GATE: If this fails, pipeline stops. No agent $ wasted.  |
+----------------------------------------------------------+
  |
  v
+-- Layer 2: BDD SCENARIO HOLDOUT -------------------------+
|  Run holdout scenarios against the code.                  |
|  Coding agent never saw these scenarios.                  |
|  Like ML train/test split applied to software.            |
|  Catches: overfitting to visible requirements.            |
+----------------------------------------------------------+
  |
  v
+-- Layer 3: MULTI-AGENT EXPERT REVIEW --------------------+
|  4 specialist agents + 1 coordinator:                     |
|  Security | Performance | Architecture | Correctness      |
|  Each reviews independently, coordinator merges.          |
|  Different agents = different blind spots covered.        |
+----------------------------------------------------------+
  |
  v
+-- Layer 4: ADVERSARIAL VERIFICATION ---------------------+
|  An agent explicitly tries to break the code.             |
|  Prompt: "Find ways this implementation fails."           |
|  Catches: happy-path-only implementations, edge cases.    |
+----------------------------------------------------------+
  |
  v
+-- Layer 5: INTENT RECONSTRUCTION ------------------------+
|  Agent reconstructs original intent from ONLY the diff    |
|  (without seeing the requirements).                       |
|  Compare reconstructed intent vs actual intent.           |
|  Catches: "code works but does the wrong thing."          |
+----------------------------------------------------------+
  |
  v
Output: VerificationReport { layers[], overallPass, blockers[], warnings[] }
```

### Architectural Implementation

Each layer is a middleware function with the same signature. The pipeline runner chains them sequentially:

```typescript
type VerificationLayer = (
  input: VerificationInput,
  ctx: SkillContext,
) => Promise<LayerResult>;

interface LayerResult {
  layer: string;
  pass: boolean;
  findings: Finding[];
  confidence: number;        // 0.0-1.0
  blockers: Finding[];       // Must-fix before proceeding
  warnings: Finding[];       // Should-fix, non-blocking
}

async function runVerification(
  input: VerificationInput,
  ctx: SkillContext
): Promise<VerificationReport> {
  const layers: VerificationLayer[] = [
    deterministicChecks,       // Layer 1
    bddScenarioHoldout,        // Layer 2
    multiAgentExpertReview,    // Layer 3
    adversarialVerification,   // Layer 4
    intentReconstruction,      // Layer 5
  ];

  const results: LayerResult[] = [];
  for (const layer of layers) {
    const result = await layer(input, ctx);
    results.push(result);

    // GATE: Layer 1 failure = stop. Don't waste agent tokens.
    if (result.layer === 'deterministic' && !result.pass) {
      return buildReport(results, 'fail-fast');
    }
  }

  return buildReport(results, 'complete');
}
```

### Key Design Decisions

1. **Sequential, not parallel.** Layer 1 (deterministic) is fast and catches obvious issues. No point running expensive agent layers if lint fails. Layers 3-5 could theoretically run in parallel with each other, but sequential allows findings from earlier layers to inform later ones.

2. **Each layer is independent.** A Layer 3 failure does not invalidate Layer 2 results. The final report aggregates all findings.

3. **Layer 1 is a hard gate.** If deterministic checks fail, the pipeline stops entirely. This prevents wasting agent tokens on code that doesn't even compile or lint.

4. **Confidence scoring.** Each layer reports its confidence. A Layer 5 intent mismatch with 0.9 confidence is a blocker; with 0.4 confidence, it is a warning flagged for human review.

5. **Layers 2-5 use the Agent Router with verification-level permissions** that grant access to `.sun/scenarios/holdout/` (which coding agents cannot see).

---

## 7. Scenario Holdout: Access Control

**Decision: Permission-based isolation via Agent Router + Git Worktree exclusion + State Engine API guards. NOT OS-level sandboxing.**

**Confidence: MEDIUM** (concept from StrongDM, macOS seatbelt is deprecated, runtime enforcement is more practical)

### The Problem

Coding agents (during `sun execute`) must NOT read `.sun/scenarios/holdout/`. Verification agents (during `sun verify`) MUST read them. This is analogous to ML train/test split -- the "training" agent must not see the "test" data.

### Why NOT OS-Level Sandboxing

macOS seatbelt/sandbox-exec is deprecated by Apple. Docker containers are overkill for a CLI tool. bubblewrap is Linux-only. OS-level sandboxing is fragile and platform-specific. Instead, SUN uses multiple runtime enforcement layers.

### Defense in Depth (4 Mechanisms)

| Layer | Mechanism | What It Catches |
|-------|-----------|-----------------|
| 1. Agent Router permissions | Deny patterns in PermissionSet | Direct agent file read requests |
| 2. Git Worktree exclusion | Holdout files absent from worktree | Agent using shell commands to read files |
| 3. State Engine API guard | Runtime permission check | Skill code accessing holdout via state API |
| 4. Audit log | Log all access attempts | Post-hoc detection of bypass attempts |

```typescript
// Layer 1: When sun execute dispatches a coding agent
const executePermissions: PermissionSet = {
  read: ['src/**', '.planning/**', '.sun/rules/**', '.sun/tribal/**'],
  write: ['src/**', '.planning/phases/**'],
  execute: ['npm test', 'npx vitest'],
  deny: ['.sun/scenarios/**'],  // EXPLICIT DENY
};

// Layer 1: When sun verify dispatches a verification agent
const verifyPermissions: PermissionSet = {
  read: ['src/**', '.planning/**', '.sun/scenarios/**'],  // CAN read holdout
  write: ['.sun/verify-results/**'],
  execute: ['npm test', 'npx vitest', 'npx playwright test'],
  deny: [],
};

// Layer 2: Git Worktree setup excludes holdout directory
async function createWorktree(branch: string): Promise<string> {
  const worktreePath = await git.worktree.add(branch);
  // Remove holdout scenarios from worktree -- agent cannot access them even via shell
  await fs.rm(path.join(worktreePath, '.sun/scenarios/holdout'), { recursive: true });
  return worktreePath;
}

// Layer 3: State Engine guards secure data
class StateEngine {
  async getSecure(key: string, callerPermissions: PermissionSet): Promise<unknown> {
    if (key.startsWith('scenarios.holdout')) {
      if (callerPermissions.deny.some(p => minimatch('.sun/scenarios/**', p))) {
        throw new PermissionError('Holdout scenarios are not accessible in this context');
      }
    }
    return this.db.get(key);
  }
}
```

---

## 8. Proactive Recommender

**Decision: Rule engine with weighted scoring. NOT a state machine (too rigid for 49 skills). NOT LLM-based (too slow for a "next action" hint).**

**Confidence: HIGH** (rules engine pattern is well-established, complexity matches the problem)

### Why Rule Engine

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Simple mapping (`lastSkill -> nextSkill`) | Trivial to implement | Cannot consider state context. "After lint" could mean many things. | Too rigid for 49 skills |
| State machine (XState) | Formal, exhaustively testable | 49 skills with many valid sequences = combinatorial explosion. Workflow is not linear. | Over-engineered |
| Rule engine | Considers state + last result + context. Extensible. Deterministic. | Slightly more complex than mapping. | Right complexity level |
| LLM-based | Maximum context awareness | Slow (1-3s per recommendation), expensive, non-deterministic | Overkill for a UI hint |

### Implementation

```typescript
interface RecommendationRule {
  id: string;
  priority: number;                         // Higher = evaluated first
  condition: (state: SunState, lastResult: SkillResult) => boolean;
  recommendation: Recommendation;
}

interface Recommendation {
  skillId: string;
  command: string;                          // Full command to display: "sun lint --fix"
  reason: string;                           // Human-readable explanation
  confidence: 'high' | 'medium' | 'low';
  urgent: boolean;                          // Show as warning vs suggestion
}

const rules: RecommendationRule[] = [
  {
    id: 'lint-failures-need-fix',
    priority: 100,
    condition: (s, r) => r.data?.violations?.length > 0 && !r.data?.allFixed,
    recommendation: {
      skillId: 'lint', command: 'sun lint --fix',
      reason: 'Lint violations found. Auto-fix available.',
      confidence: 'high', urgent: true,
    },
  },
  {
    id: 'post-discuss-plan',
    priority: 80,
    condition: (s) => s.has('discuss.result') && !s.has('plan.current'),
    recommendation: {
      skillId: 'plan', command: 'sun plan',
      reason: 'Discussion captured. Create execution plan with BDD scenarios.',
      confidence: 'high', urgent: false,
    },
  },
  {
    id: 'stale-health-check',
    priority: 30,
    condition: (s) => daysSince(s.get('health.lastRun')) > 3,
    recommendation: {
      skillId: 'health', command: 'sun health',
      reason: 'Health check not run in 3+ days.',
      confidence: 'medium', urgent: false,
    },
  },
  // ... rules for all meaningful skill transitions
];

function recommend(state: SunState, lastResult: SkillResult): Recommendation[] {
  return rules
    .filter(r => r.condition(state, lastResult))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);  // Top 3 recommendations shown to user
}
```

### Key Properties

- **Deterministic** -- Same state + same last result = same recommendation. Always.
- **Sub-millisecond** -- No LLM call. Pure function evaluation.
- **Extensible** -- New rules added without modifying existing ones. Each rule is independent.
- **Testable** -- Each rule condition is a pure function, trivially unit-testable.
- **Grows organically** -- Start with ~20 rules for core transitions, expand as skills are built.

---

## 9. IPC: CLI (Node.js) <-> Terminal (Swift/AppKit)

**Decision: Unix Domain Socket with JSON-RPC 2.0 bidirectional protocol**

**Confidence: HIGH** (Node.js net module docs, json-ipc-lib reference, ProcBridge Swift pattern)

### Why Unix Domain Socket

| Option | Latency | Bidirectional | Complexity | Verdict |
|--------|---------|---------------|------------|---------|
| Unix Domain Socket | <1ms | Yes | Low | Best fit |
| TCP Socket | 1-5ms | Yes | Low | Unnecessary overhead, port conflicts |
| stdout/stdin JSON | <1ms | No (unidirectional) | Minimal | Terminal cannot push commands to CLI |
| Named Pipe | <1ms | Limited | Low | Equivalent to UDS on macOS |
| Shared Memory | <0.1ms | Via signaling | High | Overkill for this data volume |

**Unix Domain Socket wins** because: SUN targets macOS first (Swift/AppKit terminal), latency is near-zero, bidirectional communication is native, and Node.js has built-in support via the `node:net` module.

### Protocol: JSON-RPC 2.0

Chosen over custom protocols because:
- Standardized request/response/notification format
- Both Node.js and Swift have mature implementations
- Supports bidirectional notifications without polling
- Simple framing: newline-delimited JSON

### Message Types

| Direction | Method | Payload | Purpose |
|-----------|--------|---------|---------|
| CLI -> Terminal | `state.updated` | `{ key, value }` | State changed -- refresh dashboard |
| CLI -> Terminal | `agent.output` | `{ agentId, chunk }` | Agent PTY output stream |
| CLI -> Terminal | `skill.started` | `{ skillId, args }` | Skill execution began |
| CLI -> Terminal | `skill.completed` | `{ skillId, result }` | Skill execution finished |
| CLI -> Terminal | `recommendation` | `{ recommendations[] }` | Next best action suggestions |
| Terminal -> CLI | `agent.pause` | `{ agentId }` | User paused an agent |
| Terminal -> CLI | `agent.resume` | `{ agentId }` | User resumed an agent |
| Terminal -> CLI | `agent.abort` | `{ agentId }` | User aborted an agent |
| Terminal -> CLI | `skill.invoke` | `{ skillId, args }` | User triggered skill from dashboard |

### Connection Lifecycle

```
1. CLI starts -> creates socket at ~/.sun/sockets/sun-<project-hash>.sock
2. Terminal launches -> discovers socket via project path hashing -> connects
3. If Terminal is not running -> CLI works normally (socket operations are silent no-ops)
4. If CLI exits -> socket file is cleaned up. Terminal shows "disconnected" state.
5. Terminal can reconnect when CLI restarts.
6. Multiple terminals can connect to the same CLI (broadcast events).
```

### Node.js Server Side

```typescript
import { createServer } from 'node:net';

class IPCServer {
  private server = createServer();
  private clients: Set<net.Socket> = new Set();

  start(socketPath: string) {
    this.server.listen(socketPath);
    this.server.on('connection', (socket) => {
      this.clients.add(socket);
      socket.on('data', (data) => this.handleMessage(socket, data));
      socket.on('close', () => this.clients.delete(socket));
    });
  }

  broadcast(method: string, params: unknown) {
    const message = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    for (const client of this.clients) {
      client.write(message);
    }
  }
}
```

### Swift Client Side (Terminal)

The Terminal app connects using Foundation's `NWConnection` or a raw POSIX socket, parsing newline-delimited JSON-RPC messages. The smux R&D codebase already has PTY management; SUN Terminal adds the IPC layer on top.

### Critical Design Rule

**CLI must work fully without Terminal.** IPC is fire-and-forget. If no Terminal is connected, broadcast operations are silent no-ops. No feature should depend on Terminal being present.

---

## 10. Monorepo Structure

**Decision: pnpm workspaces + Turborepo for caching + TypeScript project references. Biome for linting/formatting (not ESLint).**

**Confidence: HIGH** (2026 TypeScript monorepo best practices consensus)

### Directory Layout

```
sun/
  package.json                          # Root workspace config
  pnpm-workspace.yaml                  # pnpm workspace definition
  turbo.json                           # Turborepo pipeline + caching config
  tsconfig.base.json                   # Shared TypeScript config
  vitest.workspace.ts                  # Shared test config
  biome.json                           # Linting/formatting (Biome, not ESLint)

  packages/
    core/                              # @sun/core -- shared types, interfaces, utils
      package.json
      tsconfig.json                    # References: none (leaf dependency)
      src/
        skill.ts                       # Skill, SkillContext, SkillResult interfaces
        config.ts                      # Config types, loader, merge logic
        state.ts                       # StateEngine, StateAPI
        agent.ts                       # AgentProvider, AgentRouter, PermissionSet
        recommender.ts                 # Rule engine types, Recommendation
        ipc.ts                         # JSON-RPC types, socket helpers
        index.ts                       # Public API barrel export

    cli/                               # @sun/cli -- the `sun` binary
      package.json                     # bin: { "sun": "./dist/cli.js" }
      tsconfig.json                    # References: core, all skills packages
      src/
        cli.ts                         # Entry point: Commander.js setup
        manifest.ts                    # Static skill registry
        context.ts                     # SkillContext factory
        ipc-server.ts                  # Unix Domain Socket server for Terminal
        index.ts

    skills-harness/                    # @sun/skills-harness -- 5 deterministic skills
      package.json
      tsconfig.json                    # References: core
      src/
        init/
          index.ts
          detector.ts                  # Stack detection logic
          analyzer.ts                  # Structure analysis
        lint/
          index.ts
          rules/                       # Built-in rule implementations
            layer-boundaries.ts
            dependency-direction.ts
        health/
        agents/
        guard/

    skills-workflow/                   # @sun/skills-workflow -- 40 workflow skills
      package.json
      tsconfig.json                    # References: core
      src/
        new/
        scan/
        discuss/
        plan/
        execute/
        verify/
        ... (one directory per skill)

    skills-extension/                  # @sun/skills-extension -- 4 extension skills
      package.json
      tsconfig.json                    # References: core
      src/
        search-kr/
        search-paper/
        search-patent/
        design/

  apps/
    terminal/                          # SUN Terminal (Swift/AppKit, separate build)
      Package.swift                    # Swift Package Manager
      Sources/
        SunTerminal/
          App.swift
          IPC/
            SocketClient.swift         # Unix Domain Socket client
            JSONRPCProtocol.swift      # JSON-RPC 2.0 parsing
          Views/
            AgentPTYView.swift
            DashboardView.swift
            RecommenderWidget.swift
          PTY/
            PTYManager.swift           # forkpty, HOST_MANAGED (from smux R&D)
          IME/
            KoreanIMEHandler.swift
```

### Package Dependency Graph

```
@sun/core  (0 internal deps -- leaf package, builds first)
    ^
    |
    +--- @sun/skills-harness   (depends on: core)
    |
    +--- @sun/skills-workflow  (depends on: core)
    |
    +--- @sun/skills-extension (depends on: core)
    |
    +--- @sun/cli              (depends on: core + all 3 skills packages)

apps/terminal  (0 npm deps -- Swift Package Manager, IPC only)
```

### Why This Split

| Package | Rationale |
|---------|-----------|
| `core` | Shared types and infrastructure. Changes here rebuild everything. Keep it small and stable. |
| `cli` | Entry point and wiring only. Imports skills, sets up Commander.js, manages lifecycle. |
| `skills-harness` | Deterministic skills. Zero agent dependencies. Can be tested without mocking agents. Independent test suite. |
| `skills-workflow` | Agent-dependent skills. Larger package, but skills are independent of each other. |
| `skills-extension` | Optional/future capabilities. Could be split into separate npm packages later. |
| `terminal` | Separate language (Swift), separate build system (SPM), communicates only via IPC. |

### Build Tool Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  # Note: apps/terminal is NOT in pnpm workspace -- it uses Swift Package Manager
```

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

```json
// packages/cli/package.json (example)
{
  "name": "@sun/cli",
  "version": "0.1.0",
  "bin": { "sun": "./dist/cli.js" },
  "scripts": {
    "build": "tsup src/cli.ts --format esm --dts",
    "test": "vitest run",
    "dev": "tsup src/cli.ts --format esm --watch"
  },
  "dependencies": {
    "@sun/core": "workspace:*",
    "@sun/skills-harness": "workspace:*",
    "@sun/skills-workflow": "workspace:*",
    "@sun/skills-extension": "workspace:*",
    "commander": "^13.0.0",
    "better-sqlite3": "^11.0.0",
    "smol-toml": "^1.3.0",
    "zod": "^3.24.0",
    "execa": "^9.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^3.0.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: God Context Object
**What:** Putting every possible API into SkillContext (database access, HTTP client, file watcher, git, etc.)
**Why bad:** Skills become coupled to everything. Testing requires mocking the entire world.
**Instead:** SkillContext has exactly 7 properties: `config`, `state`, `agent`, `run`, `ui`, `log`, `flags`. Nothing else. Skills that need HTTP or git can import those libraries themselves.

### Anti-Pattern 2: Skills Calling Skills Directly
**What:** `import { lint } from '@sun/skills-harness/lint'; lint.execute(ctx);`
**Why bad:** Bypasses the registry, breaks middleware (logging, recommendations), creates hidden coupling.
**Instead:** Always use `ctx.run('lint', opts)` which goes through the registry.

### Anti-Pattern 3: Thick Agent Router
**What:** Agent Router handles prompt building, output parsing, retries, caching, and conversation management.
**Why bad:** Single Responsibility violation. Impossible to test individual concerns.
**Instead:** Agent Router does exactly four things: provider selection, permission enforcement, dispatch, response validation. Prompt building lives in each skill. Retries are a configurable middleware wrapper.

### Anti-Pattern 4: Shared Mutable State
**What:** Skills writing directly to `.sun/` files or mutating shared objects.
**Why bad:** Race conditions with parallel agents. No audit trail. Corruption risk.
**Instead:** All state access through `ctx.state` API which uses SQLite transactions internally.

### Anti-Pattern 5: Terminal-Dependent Features
**What:** CLI features that require Terminal to be connected.
**Why bad:** CLI must be fully functional standalone. Terminal is optional enhancement.
**Instead:** IPC notifications are fire-and-forget. If Terminal is not connected, operations silently no-op.

### Anti-Pattern 6: LLM for Deterministic Tasks
**What:** Using AI to check import directions, count line lengths, validate JSON schemas.
**Why bad:** Expensive, slow, non-deterministic. A lint rule is free, instant, and 100% reliable.
**Instead:** If a check can be expressed as an AST visitor or pattern match, it is a lint rule, not a prompt.

---

## Scalability Considerations

| Concern | 1 Agent | 5 Parallel Agents | 10+ Agents |
|---------|---------|-------------------|------------|
| State DB writes | Single writer, trivial | SQLite WAL handles serialized writes with 5s timeout | Consider per-worktree state.db, merge on completion |
| IPC Socket | Single Terminal connection | Multiple connections (broadcast) | Socket server handles N connections natively |
| Config loading | 3-file merge on startup | Cached after first load, shared read-only | No scaling issue -- config is immutable |
| Agent Router | Sequential dispatch | Parallel dispatch to same/different providers | Rate limiting per provider (API limits) |
| Git Worktrees | N/A | One worktree per agent, merge sequentially | Git overhead grows. Consider batching merges. |
| CLI startup | ~20ms (Commander.js) | N/A (one CLI process) | N/A |

---

## Suggested Build Order (Dependency-Based)

```
Phase 1 (Foundation -- no internal dependencies):
  1.1 @sun/core: types, interfaces, Zod schemas
  1.2 Config System: TOML loader + 3-layer merge + validation
  1.3 State Engine: SQLite setup + .sun/ directory management
  1.4 Skill interface + SkillContext factory
  1.5 CLI Engine skeleton: Commander.js + manifest + lazy loading

Phase 2 (Skill Runtime -- depends on Phase 1):
  2.1 Skill Loader/Registry: lazy loading from manifest, ctx.run() chaining
  2.2 Proactive Recommender: rule engine with initial ~10 rules
  2.3 UI API: interactive prompts (inquirer/prompts), progress bars, output formatting

Phase 3 (First Skills -- depends on Phase 2, validates entire pipeline):
  3.1 sun init    (first skill end-to-end: validates loader, context, state, output)
  3.2 sun lint    (validates deterministic skill pattern + rules engine)
  3.3 sun status  (validates state reading + recommender output)
  3.4 sun health  (validates analysis pipeline + score persistence)

Phase 4 (Agent Layer -- depends on Phase 2, parallel with Phase 3):
  4.1 Agent Router: provider abstraction + permission scoping
  4.2 Claude Code provider adapter: subprocess invocation
  4.3 Permission enforcement tests
  4.4 sun plan    (first prompt skill -- validates full agent pipeline)

Phase 5 (Verification -- depends on Phase 3 + 4):
  5.1 Verification pipeline framework: 5-layer middleware chain
  5.2 sun verify  (full pipeline)
  5.3 Scenario holdout access control (all 4 enforcement layers)

Phase 6 (Terminal -- can start after Phase 1 IPC types are defined):
  6.1 IPC server in CLI (Unix Domain Socket + JSON-RPC 2.0)
  6.2 Swift terminal app skeleton (socket client + message parsing)
  6.3 Agent PTY forwarding (reuse smux R&D)
  6.4 Dashboard view
```

**Critical path:** Phase 1 -> Phase 2 -> Phase 3 (first working skill). Everything else can proceed in parallel after Phase 2.

**Terminal (Phase 6) can start after Phase 1** because it only depends on the IPC type definitions from `@sun/core`. The Swift app development is independent of skill implementation.

---

## Sources

- [Commander.js GitHub - subcommands, addCommand(), nested commands](https://github.com/tj/commander.js/)
- [CLI Framework Comparison: Commander vs Yargs vs Oclif - performance benchmarks](https://www.grizzlypeaksoftware.com/library/cli-framework-comparison-commander-vs-yargs-vs-oclif-utxlf9v9)
- [Crafting Robust Node.js CLIs with oclif and Commander.js](https://leapcell.io/blog/crafting-robust-node-js-clis-with-oclif-and-commander-js)
- [Plugin Based Architecture in Node.js](https://www.n-school.com/plugin-based-architecture-in-node-js/)
- [TypeScript Plugin Architecture with Definitions](https://github.com/gr2m/javascript-plugin-architecture-with-typescript-definitions)
- [Claude Agent Skills: First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Swiss Cheese Model for AI Safety - ICSA 2025 paper](https://arxiv.org/abs/2408.02205)
- [better-sqlite3 Performance and WAL Mode](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md)
- [SQLite File Locking and Concurrency v3](https://sqlite.org/lockingv3.html)
- [AgentFS: SQLite-backed Agent State as POSIX Filesystem](https://turso.tech/blog/agentfs-fuse)
- [Claude Code Sandboxing Architecture](https://code.claude.com/docs/en/sandboxing)
- [OpenAI Codex Agent Approvals and Security](https://developers.openai.com/codex/agent-approvals-security)
- [macOS Seatbelt/sandbox-exec Guide](https://igorstechnoclub.com/sandbox-exec/)
- [json-ipc-lib: JSON-RPC 2.0 over Unix Domain Socket](https://github.com/PlayNetwork/json-ipc-lib)
- [ProcBridge: Cross-language IPC (Node.js + Swift)](https://github.com/gongzhang/procbridge)
- [Node.js Net Module - IPC with Unix Domain Sockets](https://nodejs.org/api/net.html)
- [TypeScript Monorepo Best Practices 2026 Edition](https://hsb.horse/en/blog/typescript-monorepo-best-practice-2026/)
- [Mastering pnpm Workspaces Complete Guide](https://blog.glen-thomas.com/software%20engineering/2025/10/02/mastering-pnpm-workspaces-complete-guide-to-monorepo-management.html)
- [Monorepo Tools 2026: Turborepo vs Nx vs Lerna vs pnpm](https://viadreams.cc/en/blog/monorepo-tools-2026/)
- [TOML Merge Rules - Morphir specification](https://morphir.finos.org/docs/spec/morphir-toml/morphir-toml-merge-rules/)
- [Rules Engine Design Pattern - DevIQ](https://deviq.com/design-patterns/rules-engine-pattern/)
- [Claude Code Subagents - Permission Scoping](https://code.claude.com/docs/en/sub-agents)
- [Anthropic Engineering: Claude Code Sandboxing Deep Dive](https://www.anthropic.com/engineering/claude-code-sandboxing)
