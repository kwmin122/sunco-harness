---
description: Technology stack decisions, version requirements, alternatives considered, and what NOT to use
globs:
  - "packages/**"
  - "package.json"
  - "tsup.config.ts"
  - "tsconfig.json"
---

## Runtime & Language
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 24.x LTS | Runtime | Native TypeScript strip-types (stable, no build step for dev), npm 11, maintenance until Apr 2028. Node 22 LTS is also acceptable (EOL Apr 2027) but 24 is the better default for new projects in 2026. | HIGH |
| TypeScript | 6.0.x | Type system | Just released (Mar 23 2026). strict=true by default, es2025 target, Temporal types. Last JS-based TS release before Go-native 7.0. Bridge release with --stableTypeOrdering flag for future migration. | HIGH |

## CLI Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Commander.js | 14.0.3 | CLI engine, subcommands, option parsing | 35M+ weekly downloads, zero dependencies, excellent TS types, proven at scale. | HIGH |

## Bundler
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsup | 8.5.x | Bundle TS to JS for npm distribution | Proven, stable, esbuild-powered. Zero-config for library/CLI bundling. | HIGH |

## Key Dependencies
| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| smol-toml | 1.6.0 | TOML parsing + serialization (1.1.0 compliant) | HIGH |
| Zod | 4.3.x | Schema/config/API validation | HIGH |
| Vitest | 4.1.x | Unit + integration tests | HIGH |
| ESLint | 10.x | Linting engine (flat config only) | HIGH |
| Vercel AI SDK | 6.x | Provider-agnostic AI abstraction | HIGH |
| Ink | 6.8.x | Interactive CLI rendering (React for terminal) | HIGH |
| chokidar | 5.x | File watching for guard/watch | HIGH |
| simple-git | 3.33.x | Git operations wrapper | HIGH |
| execa | 9.x | Better child_process | HIGH |

## What NOT to Use
| Technology | Why Not |
|------------|---------|
| Blessed / neo-blessed | Unmaintained since 2017. Use Ink. |
| isomorphic-git | No worktree support. Use simple-git. |
| cosmiconfig / c12 | Overkill for TOML-only config. |
| oclif | Plugin system conflicts with Skill System. |
| Jest | Slower than Vitest in 2026. |
| Webpack / Rollup | Overkill for CLI. Use tsup. |
| toml (npm) | 7 years unmaintained. Use smol-toml. |
| inquirer.js | Ink does this better. |
| SwiftTerm | No GPU rendering. Use libghostty for terminal. |
| tsdown | Pre-1.0. Revisit when stable. |
