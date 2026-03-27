# Technology Stack

**Project:** SUN - Agent Workspace OS
**Researched:** 2026-03-27

## Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 24.x LTS | Runtime | Native TypeScript strip-types (stable, no build step for dev), npm 11, maintenance until Apr 2028. Node 22 LTS is also acceptable (EOL Apr 2027) but 24 is the better default for new projects in 2026. | HIGH |
| TypeScript | 6.0.x | Type system | Just released (Mar 23 2026). strict=true by default, es2025 target, Temporal types. Last JS-based TS release before Go-native 7.0. Bridge release with --stableTypeOrdering flag for future migration. | HIGH |

**Key decision: Node 24 + TS 6.0.** Node 24's native `--strip-types` means you can run `.ts` files directly during development without a build step. For distribution (npm publish), you still need a bundler to produce `.js` output. TS 6.0 is stable and the right version for a greenfield 2026 project.

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

**Commander stays.** It does one thing well (parse commands + options) and gets out of the way. SUN's skill system replaces what oclif/yargs would add.

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

**tsup stays.** When tsdown hits 1.0, migration is documented and straightforward. For now tsup is the safe, proven choice.

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

SUN's config hierarchy: `~/.sun/config.toml` (global) -> `.sun/config.toml` (project) -> `src/.sun.toml` (directory).

Implementation approach:
```typescript
import { parse } from 'smol-toml';

// Load and deep-merge in order: global -> project -> directory
// Use a simple deep-merge utility (structuredClone + recursive assign)
// No need for a config library -- TOML parse + manual merge is ~50 lines
```

**No config framework needed.** cosmiconfig/c12/etc. add complexity for a pattern that's ~50 lines of deep-merge logic. SUN's config is TOML-only (not JSON/YAML/JS), so the "search multiple formats" feature of config frameworks is wasted.

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

For SUN's architecture linter (`sun lint`), custom ESLint rules are the right approach:

```
@typescript-eslint/utils     -- RuleCreator, AST types
@typescript-eslint/rule-tester -- Test custom rules
eslint-plugin-boundaries     -- Reference implementation for layer enforcement
AST Explorer (astexplorer.net) -- Develop rules interactively
```

**Pattern:** SUN generates ESLint flat config + custom rules during `sun init`. Rules are deterministic (no LLM). Agent-friendly error messages are embedded in rule metadata.

## AI Provider SDKs (Agent Router)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vercel AI SDK | 6.x (`ai` package) | Provider-agnostic AI abstraction layer | 20M+ monthly downloads. Unified API for OpenAI, Anthropic, Google, Ollama, and 20+ providers. Agent abstraction in v6 (define agent once, use everywhere). Streaming, tool calling, structured outputs all unified. THE standard for provider-agnostic AI in TypeScript 2026. | HIGH |
| @anthropic-ai/sdk | 0.80.x | Direct Anthropic API (Claude Code fallback) | For cases where AI SDK doesn't support Claude-specific features. Structured JSON output via Zod. Keep as optional direct dependency. | HIGH |
| ollama (ollama-js) | latest | Local model support | Official Ollama JS client. TypeScript types included. Streaming via AsyncGenerator. For local model routing in Agent Router. | MEDIUM |

### Architecture Decision: AI SDK as Primary, Direct SDKs as Escape Hatches

```
Agent Router
  |
  +-- Vercel AI SDK (primary) -- handles 95% of cases
  |     +-- @ai-sdk/anthropic (Claude)
  |     +-- @ai-sdk/openai (GPT/Codex)
  |     +-- ai-sdk-ollama (local models)
  |
  +-- @anthropic-ai/sdk (direct) -- Claude Code CLI integration
  +-- Claude Code CLI (child_process) -- for execute/review skills
```

**Why Vercel AI SDK over rolling your own:** The AI SDK's unified interface means SUN's Agent Router is a thin wrapper (~200 lines) rather than a thick abstraction. Provider switching is a config change, not a code change. AI SDK 6's Agent abstraction maps directly to SUN's expert agent pattern (Security, Performance, Architecture, Correctness agents).

### Claude Code CLI Integration

Claude Code CLI is used via `child_process.spawn()` for skills that delegate to an external coding agent (`sun execute`, `sun review`). This is NOT through the AI SDK -- it's a separate process with PTY management.

```typescript
import { spawn } from 'node:child_process';
// Claude Code CLI invoked as external process
// PTY wrapping for SUN Terminal observation
```

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

simple-git provides basic worktree config support but NOT full `git worktree add/remove/list` commands natively. For worktree management (`sun execute` parallel agent isolation):

```typescript
import simpleGit from 'simple-git';

const git = simpleGit();

// Use git.raw() for worktree commands not in simple-git's API
await git.raw(['worktree', 'add', '../sun-worktree-agent-1', 'feature-branch']);
await git.raw(['worktree', 'remove', '../sun-worktree-agent-1']);
await git.raw(['worktree', 'list', '--porcelain']);
```

**Do NOT use isomorphic-git** -- it's a pure JS git reimplementation that doesn't support worktrees at all. simple-git wraps the real git binary, so `git.raw()` gives access to everything.

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

Two modes of output in SUN:
1. **Interactive mode (Ink):** For skills that need user input -- `sun discuss`, `sun new`, `sun settings`. React components with selection, text input, spinners.
2. **Static mode (chalk + console):** For skills that produce reports -- `sun lint`, `sun health`, `sun status`. Plain formatted output.

**Do NOT use Blessed** -- unmaintained since 2017. Neo-blessed/reblessed are forks with minimal activity. Ink is the clear winner for Node.js terminal UI in 2026.

**Do NOT use terminal-kit** -- lower-level than needed, and Ink's component model is a better fit for SUN's interactive UX pattern.

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

**Use libghostty.** The smux R&D experience with forkpty/PTY management is valuable context, but libghostty eliminates the need to build the emulation layer. The host app becomes thin: provide NSView, forward input events, consume terminal output. Focus engineering effort on the dashboard/agent-control UI instead of terminal emulation.

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

```bash
# Core runtime (ensure Node 24 LTS)
nvm install 24
nvm use 24

# Core dependencies
npm install commander smol-toml zod chalk ink react simple-git chokidar execa glob

# AI Provider SDKs
npm install ai @ai-sdk/anthropic @ai-sdk/openai ollama

# Ink UI components
npm install ink-spinner ink-select-input ink-text-input

# Dev dependencies
npm install -D typescript@6 tsup vitest eslint @typescript-eslint/utils @typescript-eslint/parser @typescript-eslint/rule-tester eslint-plugin-boundaries @types/node @types/react
```

## Version Pinning Strategy

Pin major versions in package.json. Use `^` for minor/patch:

```json
{
  "engines": { "node": ">=24.0.0" },
  "dependencies": {
    "commander": "^14.0.3",
    "smol-toml": "^1.6.0",
    "zod": "^4.3.6",
    "ink": "^6.8.0",
    "react": "^19.0.0",
    "ai": "^6.0.0",
    "simple-git": "^3.33.0",
    "chokidar": "^5.0.0",
    "chalk": "^5.0.0",
    "execa": "^9.0.0"
  }
}
```

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
