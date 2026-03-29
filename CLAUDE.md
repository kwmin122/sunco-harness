<!-- GSD:project-start source:PROJECT.md -->
## Project

**SUNCO**

SUNCO is an independent workspace OS for agent-era builders. In an era where AI agents write code, the builder's job is not writing code — it's setting up the field so agents make fewer mistakes. SUN is that field. A standalone CLI runtime with a skill-based architecture, harness engineering at its core, a 6-stage review pipeline with 5-layer Swiss cheese verification, and a dedicated terminal for real-time agent observation. The first workspace OS for Korean developers. Zero competitors.

**Core Value:** **에이전트가 실수를 덜 하게 판을 깔아주는 OS** — 하네스 엔지니어링이 핵심이다. 린터가 가르치면서 막고, 코드가 아니라 의도를 검증하고, 모든 것을 스킬로 구성한다. 각 스킬이 완성품이며, 퀄리티와 디테일이 생명줄이다.

### Constraints

- **Tech Stack**: TypeScript (Node.js), Commander.js, TOML, tsup, Vitest — 확정
- **Distribution**: npm (npx sunco / npm install -g sunco) — `sun`/`sun-cli`는 npm에서 이미 사용 중, `sunco` 확인 완료
- **First Agent Provider**: Claude Code CLI 우선, Provider-agnostic 추상화 레이어 위에
- **Terminal**: Swift/AppKit (macOS) — smux R&D 코드 재활용
- **Clean Room**: GSD 코드 복사 금지. 개념만 참고하여 처음부터 작성
- **Skill-Only**: 모든 기능은 스킬. 하드코딩된 명령어 금지
- **Deterministic First**: 린터/테스트로 강제할 수 있는 건 LLM 사용 안 함
- **Quality**: 각 스킬은 완성품. 하나 작성하는 데 모든 역량/스킬/서치 투입
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Runtime & Language
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 24.x LTS | Runtime | Native TypeScript strip-types (stable, no build step for dev), npm 11, maintenance until Apr 2028. Node 22 LTS is also acceptable (EOL Apr 2027) but 24 is the better default for new projects in 2026. | HIGH |
| TypeScript | 6.0.x | Type system | Just released (Mar 23 2026). strict=true by default, es2025 target, Temporal types. Last JS-based TS release before Go-native 7.0. Bridge release with --stableTypeOrdering flag for future migration. | HIGH |
## CLI Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Commander.js | 14.0.3 | CLI engine, subcommands, option parsing | 35M+ weekly downloads, zero dependencies, excellent TS types, proven at scale. Supports subcommands natively which maps to SUN's skill routing (`sun lint`, `sun health`, etc.). Simple enough to wrap with a skill-based architecture on top. | HIGH |
### Alternatives Considered
| Alternative | Why Not |
|-------------|---------|
| **oclif** (Salesforce) | Built-in plugin system is attractive but too opinionated -- SUN has its own skill system. oclif's plugin model would conflict with SUN's Skill Loader/Registry. Heavier dependency tree. |
| **Clipanion** (Yarn) | Class-based FSM approach is elegant but niche ecosystem (~150K weekly downloads vs Commander's 35M). Less community knowledge. |
| **citty** (UnJS) | Modern and TypeScript-first but only v0.2.1 -- too young for a core dependency. 16M downloads mostly from Nuxt ecosystem transitive deps. |
| **Yargs** | More middleware power but messier API. Commander's simpler model is better when you're building your own skill routing layer on top. |
## Bundler
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsup | 8.5.x | Bundle TS to JS for npm distribution | Proven, stable, esbuild-powered. Zero-config for library/CLI bundling. Generates CJS+ESM dual output, handles shebang injection for CLI bins. 2200+ dependents in npm. | HIGH |
### Alternatives Considered
| Alternative | Why Not |
|-------------|---------|
| **tsdown** (Rolldown) | Promising Rust-based successor to tsup (v0.14.x). Migration path from tsup exists. But still pre-1.0 -- not stable enough for a core build tool. Revisit at 1.0. |
| **esbuild** (direct) | tsup wraps esbuild with CLI-friendly defaults (DTS generation, multiple formats). Using esbuild directly means reimplementing what tsup gives for free. |
| **Vite library mode** | Overkill for a CLI tool -- designed for web apps. |
| **zshy** | Too new and niche. |
## Config System (TOML)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| smol-toml | 1.6.0 | TOML parsing + serialization | TOML 1.1.0 compliant (latest spec). Zero dependencies, ESM-native, works in Node/Bun/Deno. Handles parse + stringify (round-trip). Most downloaded TOML parser on npm. Exposes TomlError with precise line/column for good DX. 2kb gzipped. | HIGH |
### Alternatives Considered
| Alternative | Why Not |
|-------------|---------|
| **js-toml** | Good TOML 1.0.0 compliance, trusted by MS/AWS. But smol-toml supports newer TOML 1.1.0 and has higher npm downloads. |
| **@iarna/toml** | Established but older, less active maintenance. |
| **toml** (BinaryMuse) | Last published 7 years ago. Dead. |
### Hierarchical Override Pattern
## Validation
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zod | 4.3.x | Schema validation, config validation, API response validation | TypeScript-first, 106M weekly downloads, 2kb core. z.infer<> for automatic type derivation. Used by Anthropic SDK for structured outputs. v4 has prettifyError for user-friendly messages. | HIGH |
## Testing
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | 4.1.x | Unit + integration tests | Vite-powered, instant watch mode, native coverage (v8), built-in mocking. 1687 dependents. TypeScript-native -- no separate ts-jest config. The standard test runner for 2026 TS projects. | HIGH |
## Linting & Architecture Enforcement
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ESLint | 10.x | Linting engine | v10 released Feb 2026. Flat config is the only format (eslintrc fully removed). defineConfig() with auto-flattening. | HIGH |
| typescript-eslint | latest | TS parser + rules | Typed linting with full type-checker access. Custom rule authoring via @typescript-eslint/utils + @typescript-eslint/rule-tester. | HIGH |
| eslint-plugin-boundaries | latest | Architecture layer enforcement | Enforces import direction rules between defined element types. Perfect foundation for `sun lint` -- define layers (domain/service/infra) and enforce dependency direction. Can be extended with custom rules. | MEDIUM |
### Custom Rule Authoring Stack
## AI Provider SDKs (Agent Router)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vercel AI SDK | 6.x (`ai` package) | Provider-agnostic AI abstraction layer | 20M+ monthly downloads. Unified API for OpenAI, Anthropic, Google, Ollama, and 20+ providers. Agent abstraction in v6 (define agent once, use everywhere). Streaming, tool calling, structured outputs all unified. THE standard for provider-agnostic AI in TypeScript 2026. | HIGH |
| @anthropic-ai/sdk | 0.80.x | Direct Anthropic API (Claude Code fallback) | For cases where AI SDK doesn't support Claude-specific features. Structured JSON output via Zod. Keep as optional direct dependency. | HIGH |
| ollama (ollama-js) | latest | Local model support | Official Ollama JS client. TypeScript types included. Streaming via AsyncGenerator. For local model routing in Agent Router. | MEDIUM |
### Architecture Decision: AI SDK as Primary, Direct SDKs as Escape Hatches
### Claude Code CLI Integration
## File Watching
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| chokidar | 5.x | File watching for `sun guard`/`sun watch` | ESM-only in v5 (Nov 2025). 17x less CPU/RAM than v3. Reliable cross-platform (Linux/macOS/Windows). The ecosystem standard -- 42M weekly downloads. | HIGH |
### Alternatives Considered
| Alternative | Why Not |
|-------------|---------|
| **@parcel/watcher** | Good alternative (used by Tailwind, Nx, VSCode). Native binary deps can cause install issues. chokidar is pure JS with fsevents optional. |
| **Node.js fs.watch** | Recursive watching only works on macOS/Windows, not Linux. Event normalization is inconsistent. chokidar exists precisely because fs.watch is unreliable. |
| **node-watch** | Simpler but less battle-tested than chokidar. |
## Git Operations
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| simple-git | 3.33.x | Git operations (commit, branch, diff, log) | Lightweight wrapper around git CLI. Full TypeScript types. Worktree config scope support. 14 days since last publish -- actively maintained. Covers 90% of git operations SUN needs. | HIGH |
### Git Worktree Strategy
## Terminal UI (Node.js side)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Ink | 6.8.x | Interactive CLI rendering | React for terminal. Component-based UI, Flexbox via Yoga, 2.6M weekly downloads. Used by Gatsby, Parcel, Yarn 2. Perfect for SUN's interactive UX requirement (options with (Recommended) tags, progress displays). | HIGH |
| ink-spinner | latest | Loading indicators | Spinner component for Ink. |  |
| ink-select-input | latest | Selection prompts | Multi-option selection for interactive UX pattern. |  |
| ink-text-input | latest | Text input | For user input in discuss/plan flows. |  |
| chalk | 5.x | Color output for non-Ink contexts | For simple colored output in non-interactive skill output. | HIGH |
| cli-progress | latest | Progress bars | For long-running deterministic operations. | MEDIUM |
### Terminal UI Strategy
## SUN Terminal (macOS Native App -- Separate Project)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Swift 6.x | latest | macOS native app language | Required for AppKit/SwiftUI integration. Swift 6 concurrency model. | HIGH |
| AppKit | macOS 15+ | Window management, NSView | Native macOS UI framework. Split pane, window management. | HIGH |
| libghostty | latest | Terminal emulation + PTY + Metal rendering | C library that owns emulation, Metal GPU rendering, PTY management, and shell integration. The host app provides NSView surface + forwards input. Kytos (2026) and OpenOwl prove the embedding pattern works. Dramatically less code than SwiftTerm approach. | HIGH |
### SwiftTerm vs libghostty Decision
| Criterion | SwiftTerm | libghostty |
|-----------|-----------|------------|
| Emulation quality | Good VT100/xterm | Best-in-class (Ghostty level) |
| GPU rendering | None (CPU) | Metal (GPU accelerated) |
| PTY management | Manual forkpty | Built-in |
| Shell integration | Manual | Built-in scripts |
| Code to write | High (full emulation layer) | Low (NSView surface + event forwarding) |
| Korean IME | Manual handling | Ghostty's input handling |
| Maturity | Established but stalled | Active development, growing ecosystem |
## Supporting Libraries
| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| execa | 9.x | Better child_process | When spawning Claude Code CLI or other external processes. Promise-based, streaming, better error handling than raw spawn. | HIGH |
| ora | 8.x | Standalone spinners | For non-Ink contexts where a simple spinner suffices. | MEDIUM |
| glob | 11.x | File globbing | For `sun init` project scanning, file pattern matching in lint rules. | HIGH |
| picomatch | 4.x | Fast glob matching | For hot-path pattern matching in file watchers. | MEDIUM |
| deep-merge-ts | latest | Deep object merge | For config hierarchy merging. Or write custom ~30 lines. | LOW |
| strip-ansi | 7.x | Remove ANSI codes | For clean log output when writing to files. | LOW |
## Full Installation Commands
# Core runtime (ensure Node 24 LTS)
# Core dependencies
# AI Provider SDKs
# Ink UI components
# Dev dependencies
## Version Pinning Strategy
## What NOT to Use
| Technology | Why Not |
|------------|---------|
| **Blessed / neo-blessed** | Unmaintained since 2017. Use Ink instead. |
| **isomorphic-git** | Pure JS git -- no worktree support, slower than git CLI wrapper. Use simple-git. |
| **cosmiconfig / c12** | Multi-format config search is wasted on TOML-only config. 50 lines of custom code is simpler. |
| **oclif** | Plugin system conflicts with SUN's Skill System. |
| **Jest** | Slower, heavier, worse TypeScript DX than Vitest in 2026. |
| **Webpack / Rollup** | Overkill for CLI bundling. tsup wraps esbuild with the right defaults. |
| **toml (npm package)** | 7 years unmaintained. Use smol-toml. |
| **inquirer.js** | Interactive prompts library, but Ink does this better with React components. |
| **SwiftTerm** (for SUN Terminal) | More code to write, no GPU rendering. Use libghostty. |
| **tsdown** (for now) | Pre-1.0 (v0.14.x). Revisit when stable. |
## Sources
- [Commander.js npm](https://www.npmjs.com/package/commander) -- v14.0.3 (v15 ESM-only prerelease)
- [tsup GitHub](https://github.com/egoist/tsup) -- v8.5.1
- [tsdown docs](https://tsdown.dev/guide/) -- v0.14.x, Rolldown-powered
- [smol-toml npm](https://www.npmjs.com/package/smol-toml) -- v1.6.0, TOML 1.1.0
- [Ink GitHub](https://github.com/vadimdemedes/ink) -- v6.8.0
- [chokidar GitHub](https://github.com/paulmillr/chokidar) -- v5.0
- [simple-git npm](https://www.npmjs.com/package/simple-git) -- v3.33.0
- [Vercel AI SDK](https://ai-sdk.dev/) -- v6.0.140
- [Anthropic TS SDK](https://github.com/anthropics/anthropic-sdk-typescript) -- v0.80.0
- [ESLint v10 release](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)
- [typescript-eslint](https://typescript-eslint.io/) -- flat config + custom rules
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
- [Vitest npm](https://www.npmjs.com/package/vitest) -- v4.1.2
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.6
- [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Node.js 24 LTS](https://www.pkgpulse.com/blog/nodejs-22-vs-nodejs-24-2026)
- [libghostty announcement](https://mitchellh.com/writing/libghostty-is-coming)
- [Kytos terminal (libghostty embedding)](https://jwintz.gitlabpages.inria.fr/jwintz/blog/2026-03-14-kytos-terminal-on-ghostty/)
- [SwiftTerm GitHub](https://github.com/migueldeicaza/SwiftTerm)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

### File Naming
- Skill implementations: `*.skill.ts` with `export default defineSkill({...})`
- Test files: `*.test.ts` in `__tests__/` directories
- Shared utilities: `shared/` directory per package (e.g. `shared/phase-reader.ts`)
- Prompt builders: `prompts/` directory (e.g. `prompts/debug-analyze.ts`)
- Type contracts: `shared/*-types.ts` for cross-skill interfaces (e.g. `shared/debug-types.ts`)

### Skill Patterns
- Two kinds: `kind: 'deterministic'` (zero LLM cost) and `kind: 'prompt'` (agent-powered)
- Every skill follows: entry → progress → gather → process → state.set → ui.result → return
- Cross-skill invocation: `await ctx.run('workflow.diagnose')` via skill ID
- State persistence: `ctx.state.set('skillName.lastResult', data)` for recommender integration
- Graceful degradation: unstructured agent output returns `success: true` with `warnings[]`
- Partial failure: `success: true` with `warnings[]` when at least 1 subtask succeeds
- Agent output parsing: extract last JSON code block from `\`\`\`json ... \`\`\`` with raw JSON fallback
- Permissions: `PermissionSet` with role, readPaths, writePaths, allowTests, allowNetwork, allowGitWrite

### Import Patterns
- ESM-only (`.js` extension in imports even for `.ts` files)
- Dynamic imports for optional deps: `await import('execa')`, `await import('ai')`
- CJS interop: `createRequire` for CJS-only packages (e.g. picomatch)
- Barrel exports: `index.ts` per package with explicit re-exports

### Testing
- Vitest with in-source test colocation
- Parser functions exported for unit testability (e.g. `export function parseDebugOutput()`)
- Mock pattern: `vi.hoisted()` for mock variables in `vi.mock()` factories
- State/config tests: in-memory adapters, no filesystem mocking
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

### Monorepo Structure (Turborepo + npm workspaces)
```
packages/
  core/          -- CLI engine, config (TOML), state (SQLite WAL + flat files),
                    skill system (defineSkill, scanner, resolver, registry),
                    agent router (provider-agnostic), proactive recommender,
                    UI foundation (primitives, components, adapters)
  skills-harness/ -- Deterministic backbone skills (zero LLM cost):
                    init, lint, health, agents, guard, settings, sample-prompt
  skills-workflow/ -- All workflow skills (33 skills):
                    Session: status, progress, next, context, pause, resume
                    Ideas: note, todo, seed, backlog
                    Management: phase, settings (enhanced)
                    Bootstrap: new, scan
                    Planning: discuss, assume, research, plan
                    Execution: execute, review
                    Verification: verify, validate, test-gen
                    Shipping: ship, release, milestone
                    Composition: auto, quick, fast, do
                    Debugging: debug, diagnose, forensics
  skills-extension/ -- Extension point for user-defined skills
  cli/           -- CLI entry point, Commander.js registration, preloaded skills
```

### Key Architecture Patterns
- **Skill-Only**: All functionality delivered as skills via `defineSkill()`. No hardcoded commands
- **Deterministic First**: Lint/test/health are deterministic. LLM only where judgment needed
- **Agent Router**: Provider-agnostic abstraction over Claude/OpenAI/Google/Ollama via Vercel AI SDK
- **Proactive Recommender**: 100+ rules engine suggesting next-best-action after every skill
- **Config Hierarchy**: Global (~/.sun/config.toml) → Project (.sun/config.toml) → Directory
- **State Engine**: SQLite WAL for structured data + FileStore for .sun/ flat files
- **UI Contract**: SkillUi (skill intent API) + UiAdapter (Ink/console/silent renderers)
- **6-Stage Review Pipeline**: idea → discuss → plan → execute → verify → ship
- **5-Layer Swiss Cheese**: multi-agent → guardrails → BDD → permissions → adversarial
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
