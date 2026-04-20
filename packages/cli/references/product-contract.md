# SUNCO Product Contract — Source of Truth

This file is the SINGLE source of truth for all product-level claims.
Every document, workflow, command, template, and README MUST agree with this file.
`sunco:proceed-gate` validates all claims against this contract before ship/release/update.

## Identity

- **Package name**: `popcoru` (npm)
- **CLI bin names**: `popcoru`, `sunco` (both work via package.json bin aliases)
- **Install command**: `npx popcoru` (or `npx sunco`)
- **Slash command prefix**: `/sunco:*`
- **Version file**: `~/<runtime>/sunco/VERSION`

## Verification Model

- **Name**: 7-Layer Swiss Cheese Verification
- **Layer count**: 7 (seven)
- **Layers**:
  1. Multi-Agent Generation — multiple AI agents produce independent verification
  2. Deterministic Guardrails — lint, type check, build — zero LLM cost
  3. BDD Acceptance Criteria — behavioral tests from plan acceptance criteria
  4. Permission Scoping — verify agents operated within declared permissions
  5. Adversarial Verification — red-team agent challenges implementation
  6. Cross-Model Verification — second model/provider reviews for blind spots
  7. Human Eval Gate — human sign-off on verification results

## Review Pipeline

- **Name**: 6-Stage Review Pipeline
- **Stages**: idea → discuss → plan → execute → verify → ship

## Runtime Contract

Each supported runtime installs SUNCO into:
```
$HOME/.<runtime>/
  commands/sunco/        # slash commands (Claude) or skills/sunco-*/ (Codex)
  sunco/
    bin/                 # cli.js, chunks, sunco-tools.cjs, package.json
    agents/              # agent prompt .md files
    workflows/           # workflow .md files
    references/          # reference docs
    templates/           # template files
    VERSION              # installed version string
  hooks/                 # hook scripts (.cjs)
```

### Supported Runtimes

| Runtime      | Dir             | Commands Format        | Config Registration | Status |
|-------------|-----------------|----------------------|-------------------|--------|
| Claude Code | `.claude`       | commands/sunco/*.md  | settings.json (hooks + statusLine) | Full support |
| Codex CLI   | `.codex`        | skills/sunco-*/SKILL.md | auto-discovery (skills/ dir) | Full support |
| Cursor      | `.cursor`       | skills-cursor/sunco-*/SKILL.md | Cursor auto-discovery of skills-cursor/ | Full support (SKILL.md format) |
| Antigravity | `.antigravity`  | commands/sunco/*.md  | Manual — pending Antigravity spec | Partial (asset install only) |

### Path Resolution

Source files use `$HOME/.claude/` as canonical default. The installer replaces
`.claude/` with `.<runtime>/` for non-Claude runtimes at copy time.

## State/Config Contract

| Purpose | Path | Format |
|---------|------|--------|
| Project state | `.planning/STATE.md` | Markdown |
| Project config | `.planning/config.json` | JSON |
| Harness config | `.sun/config.toml` | TOML |
| Global config | `~/.sun/config.toml` | TOML |
| Global state | `~/.sun/` | Various |

**Prohibited paths** (do NOT use):
- `.sun/STATE.md` — use `.planning/STATE.md`
- `~/.sunco/` — use `~/.sun/`
- `$(npm root -g)/sunco/` — use `$HOME/.<runtime>/sunco/`

## Hook Contract

| Hook | Event | Purpose |
|------|-------|---------|
| sunco-check-update.cjs | SessionStart | Version update check |
| sunco-statusline.cjs | StatusLine | Terminal status display |
| sunco-context-monitor.cjs | PostToolUse | Context window usage warning |
| sunco-prompt-guard.cjs | PreToolUse (Write/Edit) | Prompt injection detection |
| sunco-mode-router.cjs | UserPromptSubmit | SUNCO Mode auto-routing interceptor |

All copied hooks MUST be registered. Unregistered hooks MUST NOT be shipped.

## Command Count

- **Total commands**: 89 (77 original + 4 gates + Superpowers brainstorming wrapper + writing-skills meta-skill + orchestrate + advisor + 2 backend dispatchers from Phase 37/M1.3 + router from Phase 52b/M6 + compound from Phase 54/M6)
- Commands listed in: `packages/cli/commands/sunco/`

## Gate Contract

| Gate | When | Purpose |
|------|------|---------|
| plan-gate | Before plan proceeds | Product contract compliance |
| artifact-gate | After implementation | Release artifact validation |
| proceed-gate | After verify, before ship/release | Final go/no-go |
| dogfood-gate | Any time | SUNCO self-application check |

## Standalone Runtime Dependencies

The CLI binary bundles most deps. These remain external (dynamic import + graceful degradation):

| Dep | Why External | Graceful Degradation |
|-----|-------------|---------------------|
| better-sqlite3 | Native module | FileStore flat-file fallback |
| ink/react | Large UI framework | SilentUiAdapter (console output) |
| ai/@ai-sdk/anthropic | AI SDK | ClaudeCliProvider (shell exec) |
| eslint ecosystem | Large CJS | lint/guard skills fail with clear message |

**Bundled** (self-contained, no install needed): execa, simple-git, chokidar, smol-toml, zod, commander, chalk.

When running via Claude Code slash commands, external deps are NOT needed — workflows use sunco-tools.cjs (fully self-contained CJS).

## Memory Strategy Contract

- Root CLAUDE.md: ≤60 lines (thin root)
- Detailed rules: `.claude/rules/*.md` with frontmatter
- Nested CLAUDE.md: allowed in subdirectories for package-specific rules
- `sunco agents` scans: CLAUDE.md, .claude/rules/, nested CLAUDE.md, .cursorrules
