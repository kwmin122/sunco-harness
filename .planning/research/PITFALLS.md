# Domain Pitfalls

**Domain:** CLI-based Agent Workspace OS / Harness Engineering Platform
**Researched:** 2026-03-27

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Building All 49 Skills Before Shipping

**What goes wrong:** Scope explosion. 49 skills is a massive surface area. Trying to build them all before anyone uses the tool means months of work with zero validation.
**Why it happens:** The skill catalog looks like a checklist to complete.
**Consequences:** Burnout. Features nobody wants get built. Core skills don't get enough polish.
**Prevention:** Phase 1 ships with ~8 skills (CLI Engine + Config + State + init + lint + health + status + next). Each subsequent phase adds a wave. Ship and validate between phases.
**Detection:** If you're building Phase 3 Wave 9 skills before Phase 1 is on npm, stop.

### Pitfall 2: ESLint Custom Rule Complexity Explosion

**What goes wrong:** Custom ESLint rules for architecture linting (dependency direction, layer violations) are surprisingly hard to get right. Edge cases in import resolution, re-exports, dynamic imports, barrel files, path aliases -- each is a rabbit hole.
**Why it happens:** AST traversal seems simple until you hit the real-world import graph.
**Consequences:** `sun lint` produces false positives, developers disable it, core differentiator is broken.
**Prevention:**
1. Start with eslint-plugin-boundaries as the base -- it handles 80% of import graph edge cases.
2. Build custom rules incrementally: start with direct imports only, add re-exports in v2, dynamic imports in v3.
3. Test every rule against real-world codebases (Next.js apps, Express APIs, monorepos).
4. Use @typescript-eslint/rule-tester from day one with comprehensive test fixtures.
**Detection:** If a lint rule has more than 3 reported false positives in testing, simplify it.

### Pitfall 3: Agent Router Abstraction That Leaks

**What goes wrong:** Building a provider abstraction that doesn't account for provider-specific features (Claude's XML thinking, OpenAI's function calling format, Ollama's context window limits). Then either the abstraction breaks or features are lowest-common-denominator.
**Why it happens:** "Provider-agnostic" is easy to say, hard to implement when providers have genuinely different capabilities.
**Consequences:** Either: (a) abstraction gets bypassed with direct SDK calls everywhere, or (b) all providers get dumbed down to the weakest.
**Prevention:** Use Vercel AI SDK as the primary abstraction -- it solves this problem professionally with 20M monthly downloads. SUN's Agent Router is a thin layer on top that adds permission scoping and logging, NOT a replacement for AI SDK's provider abstraction.
**Detection:** If you're writing provider-specific switch statements in Agent Router, you're reinventing AI SDK.

### Pitfall 4: TOML Config Merge Semantics

**What goes wrong:** Deep-merging TOML configs (global + project + local) has ambiguous semantics for arrays. Does local `lint.ignorePaths = ["dist"]` replace or extend global `lint.ignorePaths = ["node_modules"]`?
**Why it happens:** TOML (and most config formats) don't define merge semantics. Every tool invents its own.
**Consequences:** Users get unexpected behavior. Config debugging is nightmare. Support requests about "why isn't my setting applied?"
**Prevention:**
1. Document merge rules explicitly: objects merge recursively, arrays REPLACE (not append).
2. Provide explicit extend syntax: `lint.ignorePaths.extend = ["dist"]` for appending.
3. Add `sun settings --show-resolved` to display the final merged config with source annotations.
4. Validate merged config with Zod -- catch schema violations early with clear error messages.
**Detection:** If you can't explain the merge result for any given config combination in one sentence, the semantics are too complex.

### Pitfall 5: Git Worktree Cleanup Failures

**What goes wrong:** `sun execute` creates git worktrees for parallel agents. If the process crashes, worktrees are left orphaned. Over time, this corrupts the git state or fills disk.
**Why it happens:** Worktrees are filesystem state outside the normal git cleanup path. No GC for worktrees.
**Consequences:** `git worktree list` shows ghosts. New worktree creation fails. Disk fills up.
**Prevention:**
1. Always register worktrees in `.sun/worktrees.json` with creation time + PID.
2. On every `sun` invocation, check for stale worktrees (PID dead, age > 1h).
3. `sun execute` uses try/finally to clean up worktrees even on error.
4. `sun status` shows active worktrees.
5. Provide `sun execute --cleanup` to manually prune.
**Detection:** If `git worktree list` shows entries that no running process owns, cleanup is broken.

## Moderate Pitfalls

### Pitfall 6: Ink Rendering Performance with Large Outputs

**What goes wrong:** Ink re-renders the entire component tree on state changes. For skills that produce long output (lint results for 1000 files), this causes terminal flicker and slowdown.
**Prevention:**
1. Use Ink's `<Static>` component for output that doesn't change (already-rendered lint results).
2. Paginate large results: show first 20, "Press Enter for more".
3. For non-interactive output, bypass Ink entirely and use chalk + console.log.
4. Test with large outputs early -- don't discover this in production.

### Pitfall 7: smol-toml Round-Trip Fidelity

**What goes wrong:** Parsing TOML with smol-toml and then stringifying it back loses comments and formatting. Users edit config files by hand and expect their comments to survive.
**Prevention:**
1. When modifying config programmatically (`sun settings set`), use line-level text manipulation rather than parse-modify-stringify.
2. Only use stringify for generating NEW config files (during `sun init`).
3. Document that `sun settings set` preserves comments (and test this explicitly).

### Pitfall 8: Claude Code CLI Version Drift

**What goes wrong:** SUN depends on Claude Code CLI being installed. But Claude Code updates frequently, and its CLI interface (flags, output format) may change between versions.
**Why it happens:** Claude Code CLI is not a stable API -- it's a user-facing tool.
**Prevention:**
1. Detect Claude Code CLI version at startup. Warn on untested versions.
2. Parse Claude Code output defensively (never assume exact format).
3. Wrap Claude Code interaction in an adapter that can be updated independently.
4. Have a fallback path: if Claude Code CLI is unavailable, fall back to direct API via AI SDK.

### Pitfall 9: Skill Loading Performance

**What goes wrong:** Loading 49 skill modules at startup adds latency. User types `sun status` and waits 500ms for all skills to initialize.
**Prevention:**
1. Lazy-load skills: only load the skill that's actually invoked.
2. Register skill metadata (name, description, type) statically in a manifest.
3. `sun` startup should be <100ms for any single skill invocation.
4. Benchmark startup time in CI.

### Pitfall 10: Zod Schema Versioning

**What goes wrong:** Config schema changes between SUN versions. User upgrades SUN, and their existing `.sun/config.toml` fails Zod validation.
**Prevention:**
1. All Zod schemas use `.default()` for every field -- missing fields get defaults, never fail.
2. Use `z.passthrough()` on top-level objects to ignore unrecognized fields.
3. Add a `version` field to config: `sun_version = "1"`. Migration scripts between versions.
4. `sun init --upgrade` to migrate config to new schema.

## Minor Pitfalls

### Pitfall 11: ESM vs CJS Compatibility

**What goes wrong:** Commander.js 14.x supports both ESM/CJS. But chokidar 5.x and chalk 5.x are ESM-only. Mixing can cause import errors.
**Prevention:** SUN is ESM-only (`"type": "module"` in package.json). All dependencies are ESM-compatible. tsup handles CJS output for consumers if needed.

### Pitfall 12: File System Case Sensitivity

**What goes wrong:** macOS (default) is case-insensitive. Linux is case-sensitive. Config file paths, skill names, and rule IDs must handle this.
**Prevention:** Normalize all internal identifiers to lowercase. Use `path.resolve()` for all file paths.

### Pitfall 13: Terminal Width Assumptions

**What goes wrong:** Ink layouts assume minimum terminal width. On narrow terminals (80 cols), complex layouts break.
**Prevention:** Check `process.stdout.columns` and adapt layout. Test at 80, 120, and 200 columns.

### Pitfall 14: Agent Cost Tracking Blindness

**What goes wrong:** Users run `sun auto` which chains discuss -> plan -> execute -> verify, each calling AI APIs. Total cost is invisible until the API bill arrives.
**Prevention:**
1. Track token usage per skill invocation in `.sun/usage.json`.
2. Show running cost estimate in real-time during agent skills.
3. `sun status` includes session cost summary.
4. Optional cost limit in config: `agent.maxCostPerSession = 5.00` (USD).

### Pitfall 15: Prompt Injection via User Input

**What goes wrong:** `sun discuss` takes user input and feeds it to the AI. Malicious input could manipulate agent behavior.
**Prevention:** For SUN (single-user tool), this is low risk -- the user is the attacker and the victim. But still: separate user input from system prompts in agent calls. Use AI SDK's system/user message distinction.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Core Platform | Config merge semantics (#4) | Define rules in spec before coding. Add `--show-resolved` early. |
| Phase 1: Core Platform | Skill loading performance (#9) | Lazy loading from day one. Benchmark in CI. |
| Phase 2: Harness Skills | ESLint custom rule complexity (#2) | Start with eslint-plugin-boundaries. Incremental rule complexity. |
| Phase 2: Harness Skills | `sun init` scope creep | Auto-detection is infinite scope. Start with: package.json + tsconfig + directory structure. Nothing else. |
| Phase 3: Workflow Skills | Agent Router leaking (#3) | Let AI SDK handle providers. Agent Router = thin wrapper. |
| Phase 3: Workflow Skills | Git worktree cleanup (#5) | Try/finally + stale detection + manual cleanup command. |
| Phase 3: Workflow Skills | Agent cost tracking (#14) | Build token tracking into Agent Router from the start. Not retrofittable. |
| Phase 4: Extension Skills | Korean API rate limits | Korean search APIs (KIPRIS, RISS) have strict rate limits. Implement backoff from day one. |
| Phase 5: SUN Terminal | libghostty API stability | libghostty is pre-1.0. Pin version, prepare for API changes. |
| Phase 5: SUN Terminal | Korean IME edge cases | Test with Korean input from the start. libghostty's input handling should help. |

## Sources

- [ESLint custom rule tutorial](https://eslint.org/docs/latest/extend/custom-rule-tutorial)
- [eslint-plugin-boundaries edge cases](https://github.com/javierbrea/eslint-plugin-boundaries)
- [Git worktree documentation](https://git-scm.com/docs/git-worktree) -- no GC for worktrees
- [Ink Static component](https://github.com/vadimdemedes/ink) -- performance optimization
- [smol-toml limitations](https://github.com/squirrelchat/smol-toml) -- no comment preservation
- [Vercel AI SDK provider abstraction](https://ai-sdk.dev/) -- why not to build your own
- [chokidar v5 ESM migration](https://dev.to/43081j/migrating-from-chokidar-3x-to-4x-5ab5)
- [Node.js 24 type stripping](https://nodejs.org/en/learn/typescript/run-natively) -- erasable syntax only
