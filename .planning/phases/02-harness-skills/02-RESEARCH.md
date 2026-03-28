# Phase 2: Harness Skills - Research

**Researched:** 2026-03-28
**Domain:** Deterministic code analysis skills -- init detection, linting, health scoring, agent doc analysis, file watching
**Confidence:** HIGH

## Summary

Phase 2 builds 5 deterministic harness skills (`sunco init`, `sunco lint`, `sunco health`, `sunco agents`, `sunco guard`) on top of the Phase 1 core platform. These skills are the zero-LLM-cost backbone: they analyze codebases, enforce architecture boundaries, track health trends, and guard against anti-pattern spread. All 5 skills use `defineSkill({ kind: 'deterministic' })` and interact exclusively through `SkillContext` (config, state, fileStore, ui).

The primary technical challenge is the ESLint programmatic integration: `sunco lint` dynamically generates eslint-plugin-boundaries configurations from init-detected layers, then runs ESLint via its Node.js API (the `ESLint` class) -- not the CLI. A secondary challenge is the typescript-eslint peer dependency conflict with TypeScript 6.0.2 (the current stable typescript-eslint 8.57.2 declares `typescript: <6.0.0`), which requires npm `overrides` as a workaround until official TS 6 support lands.

The remaining 3 skills (health, agents, guard) are pure TypeScript with no heavy external dependencies: health uses the existing SQLite WAL database for trend snapshots, agents does static text analysis of markdown files, and guard uses chokidar 5 for file watching with debounced incremental linting.

**Primary recommendation:** Build skills in dependency order -- init first (other skills depend on its output), then lint (guard depends on lint), then health and agents (independent), finally guard (depends on lint + chokidar). Use ESLint's programmatic `ESLint` class with `overrideConfigFile: true` to bypass filesystem config and inject dynamically generated boundaries config.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Convention file scanning for ecosystem detection -- look for package.json (Node.js), tsconfig.json (TypeScript), Cargo.toml (Rust), go.mod (Go), pyproject.toml/requirements.txt (Python), build.gradle (Java/Kotlin), etc. 15+ ecosystem markers.
- **D-02:** Layer detection via directory name heuristics + import graph sampling. Common layer patterns: types -> config -> service/domain -> handler/controller -> ui/view. Map detected layers to dependency direction rules.
- **D-03:** Convention extraction from AST-free analysis: naming patterns (camelCase vs snake_case via regex), import style (relative vs alias), export patterns (named vs default), file organization (co-located tests vs __tests__/).
- **D-04:** .sun/ initialization creates: rules/ (auto-generated lint rules), tribal/ (empty, for user knowledge), scenarios/ (empty, for holdout tests), planning/ (empty). Plus config.toml with detected stack and layer map.
- **D-05:** Project type presets via `sunco init` -- auto-select preset matching detected stack. Presets define which harness skills are active by default.
- **D-06:** Hybrid approach -- eslint-plugin-boundaries for layer enforcement (dependency direction rules), plus custom sunco-specific rules for patterns unique to SUN (e.g., skill structure validation).
- **D-07:** Init-detected layers map to eslint-plugin-boundaries element types. Example: `{ type: 'ui', pattern: 'src/ui/**' }` with rule `{ from: 'ui', disallow: ['database', 'infra'] }`.
- **D-08:** Error messages are structured for both humans and agents: `{ rule: string, file: string, line: number, violation: string, fix_instruction: string, severity: 'error'|'warning' }`. CLI renders human-readable format; `--json` outputs raw JSON for agent consumption. "Linter teaches while blocking."
- **D-09:** `--fix` auto-corrects what's deterministically fixable (import reordering, simple dependency direction violations). Complex fixes emit fix instructions only.
- **D-10:** Lint rules stored in .sun/rules/ as JSON. Each rule has: id, source (init-generated | guard-promoted | user-defined), created date, pattern, and ESLint config snippet.
- **D-11:** Weighted composite score 0-100: document freshness (30%), anti-pattern spread trends (40%), convention adherence (30%).
- **D-12:** Document freshness = code-to-doc sync detection. Compare file modification dates, check cross-references still resolve, detect README sections that reference moved/renamed code.
- **D-13:** Anti-pattern tracking = count occurrences over time. Store snapshots in .sun/ SQLite. Report trend: "any type went from 3 files to 12 files in 2 weeks." Severity increases with spread rate.
- **D-14:** Convention adherence = measure consistency with init-detected conventions. Deviations from dominant naming/import/export patterns reduce score.
- **D-15:** Report output: terminal table with scores per category + overall, plus trend arrows (improving/degrading/stable). `--json` for machine consumption.
- **D-16:** Static text analysis of CLAUDE.md/agents.md/AGENTS.md. Metrics: total line count (warn >60), section count, instruction density (instructions per section), contradiction detection (conflicting rules), staleness indicators.
- **D-17:** Efficiency score 0-100 based on: brevity (shorter is better, per ETH Zurich research), clarity (measurable instructions vs vague guidance), coverage (key areas addressed: conventions, constraints, architecture), contradiction-free.
- **D-18:** Analysis + suggestions only. Never auto-generate or auto-modify agent docs. The user decides what to change. "Analyze, don't act."
- **D-19:** Suggestions are specific and actionable: "Line 45-52: contradicts line 12. Choose one." Not "Consider improving clarity."
- **D-20:** chokidar file watcher (per tech stack decision in CLAUDE.md). Watch .ts/.tsx/.js/.jsx files by default, configurable via .sun/config.toml.
- **D-21:** Anti-pattern to lint rule promotion is suggest-only. Guard detects a recurring pattern, proposes a lint rule, user confirms before it's added to .sun/rules/.
- **D-22:** Auto-lint-after-change: when a file changes, run relevant lint rules on that file only (incremental, not full project). Show results inline.
- **D-23:** Guard mode = `sunco guard` for single-run scan, `sunco guard --watch` for continuous mode. Both share the same analysis engine.
- **D-24:** Tribal knowledge integration: .sun/tribal/ files can define patterns to watch for. Guard loads these alongside lint rules. Tribal rules are softer (warnings), lint rules are harder (errors).

### Claude's Discretion
- Internal data structures for health snapshots (researcher/planner decide schema)
- ESLint config generation format details
- File watcher debounce timing and incremental analysis strategy
- Convention extraction regex patterns and thresholds

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HRN-01 | `sunco init` -- tech stack detection (15+ ecosystems) | Convention file scanning with fs.access checks; ecosystem marker map pattern |
| HRN-02 | `sunco init` -- directory structure -> layer pattern detection | Directory heuristics + selective import graph sampling (regex-based, no AST) |
| HRN-03 | `sunco init` -- convention extraction from code | Regex-based analysis: naming patterns, import styles, export patterns |
| HRN-04 | `sunco init` -- .sun/ workspace init + rule generation + presets | FileStore API for rules/, config.toml generation via smol-toml stringify |
| HRN-05 | `sunco lint` -- ESLint rule auto-generation from detected layers | eslint-plugin-boundaries 6.0.1 element types + boundaries/dependencies rule |
| HRN-06 | `sunco lint` -- dependency direction violation detection | ESLint programmatic API (ESLint class) with overrideConfig injection |
| HRN-07 | `sunco lint` -- agent-readable error messages ("linter teaches") | Custom ESLint message formatter; structured output with fix_instruction field |
| HRN-08 | `sunco lint` -- 100% deterministic + --fix auto-correction | ESLint fix mode via `new ESLint({ fix: true })`; verifyAndFix for Linter class |
| HRN-09 | `sunco health` -- document freshness detection | fs.stat mtime comparison, cross-reference resolution via regex link scanning |
| HRN-10 | `sunco health` -- anti-pattern spread tracking with trends | SQLite snapshots in existing StateApi (key: `health.snapshot.<date>`) |
| HRN-11 | `sunco health` -- score-based report (0-100) | Weighted composite: freshness 30%, anti-patterns 40%, conventions 30% |
| HRN-12 | `sunco agents` -- CLAUDE.md/agents.md analysis + efficiency score | Static text parsing: line count, section detection, instruction density metrics |
| HRN-13 | `sunco agents` -- analysis + suggestions only, no auto-generation | Read-only analysis; output via ctx.ui.result with structured suggestions |
| HRN-14 | `sunco guard` -- anti-pattern detection -> lint rule promotion | Pattern frequency tracking in SQLite; suggest-only promotion workflow |
| HRN-15 | `sunco guard` -- auto-lint-after-change (incremental) | Single-file ESLint lintText() for incremental linting on file change |
| HRN-16 | `sunco guard --watch` -- real-time file watching | chokidar 5.0.0 ESM-only watcher with debounce via awaitWriteFinish |
</phase_requirements>

## Standard Stack

### Core (Phase 2 additions to skills-harness package)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| eslint | 10.1.0 | Programmatic linting engine | v10 is current stable, flat config only, removed legacy eslintrc. Used via Node.js API (`new ESLint()`), not CLI. |
| eslint-plugin-boundaries | 6.0.1 | Architecture layer enforcement | Defines element types from directory patterns, enforces dependency direction via `boundaries/dependencies` rule. 6.0.1 is latest stable, supports ESLint >=6. |
| typescript-eslint | 8.57.2 | TypeScript parser + typed rules | Required for ESLint to understand .ts/.tsx files. Typed linting with full type-checker access. |
| chokidar | 5.0.0 | File watching for guard --watch | ESM-only, Node.js v20+ minimum, 17x less CPU/RAM than v3. Used only in guard skill. |
| smol-toml | 1.6.1 | TOML stringify for config.toml generation | Already in @sunco/core. Used by init skill to write .sun/config.toml with detected stack info. |

### Supporting (already in @sunco/core, reused)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3 | 12.8.0 | Health snapshots + pattern tracking | Already available via ctx.state (StateApi). Health/guard store trend data here. |
| glob | 13.0.6 | File pattern matching | Already in core. Used by init for ecosystem scanning, by lint for file discovery. |
| zod | 3.24.4 | Schema validation | Already in core. Used for validating rule definitions, health report schemas. |
| chalk | 5.4.1 | Color output in non-Ink contexts | Already in core. Used for structured error message formatting. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint programmatic API | Spawning `eslint` CLI via execa | CLI spawn has 200-500ms overhead per invocation. Programmatic API is same-process, faster for incremental linting in guard --watch. |
| eslint-plugin-boundaries | Custom import analysis | 10x more code to write, years of edge cases already handled by the plugin (re-exports, barrel files, type imports). |
| chokidar 5 | Node.js fs.watch | fs.watch lacks recursive watching on Linux, inconsistent event normalization. chokidar exists to solve these problems. |
| SQLite for health trends | JSON files in .sun/ | JSON files work but lack query capability. SQLite is already initialized by Phase 1 StateApi -- zero additional dependency. |

### Installation

```bash
# In packages/skills-harness/
npm install eslint@10.1.0 eslint-plugin-boundaries@6.0.1 typescript-eslint@8.57.2 chokidar@5.0.0
```

### Version Verification

| Package | Verified Version | Registry Date |
|---------|-----------------|---------------|
| eslint | 10.1.0 | 2026 (latest) |
| eslint-plugin-boundaries | 6.0.1 | 2026 (latest) |
| typescript-eslint | 8.57.2 | 2026 (latest stable) |
| chokidar | 5.0.0 | Nov 2025 (latest) |

## Architecture Patterns

### Recommended Project Structure

```
packages/skills-harness/src/
  init.skill.ts              # sunco init entry point
  init/
    ecosystem-detector.ts     # D-01: file marker scanning
    layer-detector.ts         # D-02: directory heuristics + import sampling
    convention-extractor.ts   # D-03: naming/import/export pattern analysis
    workspace-initializer.ts  # D-04: .sun/ setup + config.toml + rules
    presets.ts                # D-05: project type presets
    types.ts                  # shared types for init subsystem
  lint.skill.ts              # sunco lint entry point
  lint/
    config-generator.ts       # D-07: layers -> eslint-plugin-boundaries config
    runner.ts                 # ESLint programmatic execution
    formatter.ts              # D-08: structured error messages for humans + agents
    fixer.ts                  # D-09: --fix auto-correction logic
    rule-store.ts             # D-10: .sun/rules/ JSON management
    types.ts                  # lint result types
  health.skill.ts            # sunco health entry point
  health/
    freshness-checker.ts      # D-12: code-to-doc sync detection
    pattern-tracker.ts        # D-13: anti-pattern spread tracking
    convention-scorer.ts      # D-14: convention adherence measurement
    reporter.ts               # D-15: score computation + terminal table
    types.ts                  # health snapshot types
  agents.skill.ts            # sunco agents entry point
  agents/
    doc-analyzer.ts           # D-16: CLAUDE.md/agents.md text analysis
    efficiency-scorer.ts      # D-17: 0-100 efficiency score
    suggestion-engine.ts      # D-19: actionable suggestions generator
    types.ts                  # agent doc analysis types
  guard.skill.ts             # sunco guard entry point
  guard/
    analyzer.ts               # shared analysis engine (single-run + watch)
    watcher.ts                # D-20: chokidar file watcher setup
    promoter.ts               # D-21: anti-pattern -> lint rule promotion
    incremental-linter.ts     # D-22: single-file lint on change
    tribal-loader.ts          # D-24: .sun/tribal/ pattern loading
    types.ts                  # guard types
  settings.skill.ts          # (existing from Phase 1)
  sample-prompt.skill.ts     # (existing from Phase 1)
  index.ts                   # barrel export all skills
```

### Pattern 1: Skill Definition Pattern (established in Phase 1)

**What:** Every skill is created via `defineSkill()` with deterministic kind
**When to use:** All 5 harness skills

```typescript
// Source: packages/core/src/skill/define.ts (Phase 1 established pattern)
import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'harness.init',
  command: 'init',
  kind: 'deterministic',  // zero LLM cost
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  description: 'Initialize project harness',
  options: [
    { flags: '--preset <name>', description: 'Force a specific preset' },
    { flags: '--force', description: 'Overwrite existing .sun/ config' },
  ],
  async execute(ctx) {
    // All work through ctx: ctx.config, ctx.state, ctx.fileStore, ctx.ui
    await ctx.ui.entry({ title: 'Init', description: 'Analyzing project...' });
    // ...
    return { success: true, summary: 'Project initialized', data: { /* structured */ } };
  },
});
```

### Pattern 2: ESLint Programmatic Execution

**What:** Run ESLint in-process with dynamically generated config
**When to use:** `sunco lint` and guard incremental linting

```typescript
// Source: ESLint Node.js API docs (https://eslint.org/docs/latest/integrate/nodejs-api)
import { ESLint } from 'eslint';
import boundaries from 'eslint-plugin-boundaries';

async function runLint(files: string[], layerConfig: BoundariesConfig) {
  const eslint = new ESLint({
    overrideConfigFile: true,   // skip filesystem config search
    overrideConfig: {
      plugins: { boundaries },
      settings: {
        'boundaries/elements': layerConfig.elements,
      },
      rules: {
        'boundaries/dependencies': [2, {
          default: 'disallow',
          rules: layerConfig.dependencyRules,
        }],
      },
    },
    fix: false,  // or true for --fix mode
  });

  const results = await eslint.lintFiles(files);
  return results;
}
```

### Pattern 3: Health Snapshot Storage

**What:** Store periodic health scores in SQLite for trend tracking
**When to use:** `sunco health` for anti-pattern trend analysis (D-13)

```typescript
// Uses existing StateApi from Phase 1
async function storeHealthSnapshot(state: StateApi, snapshot: HealthSnapshot) {
  const key = `health.snapshot.${snapshot.date}`;
  await state.set(key, snapshot);
}

async function getRecentSnapshots(state: StateApi, days: number): Promise<HealthSnapshot[]> {
  const keys = await state.list('health.snapshot.');
  // Filter by date, sort, return recent
  const cutoff = Date.now() - (days * 86400000);
  const snapshots: HealthSnapshot[] = [];
  for (const key of keys) {
    const snap = await state.get<HealthSnapshot>(key);
    if (snap && new Date(snap.date).getTime() >= cutoff) {
      snapshots.push(snap);
    }
  }
  return snapshots.sort((a, b) => a.date.localeCompare(b.date));
}
```

### Pattern 4: Chokidar File Watch with Debounce

**What:** Watch files for changes with stability threshold
**When to use:** `sunco guard --watch` (D-20, D-22)

```typescript
// Source: chokidar README (https://github.com/paulmillr/chokidar)
import chokidar from 'chokidar';

function createWatcher(cwd: string, patterns: string[], ignored: string[]) {
  const watcher = chokidar.watch(patterns, {
    cwd,
    persistent: true,
    ignoreInitial: true,  // don't emit on startup scan
    awaitWriteFinish: {
      stabilityThreshold: 300,  // ms file size must be constant
      pollInterval: 100,
    },
    ignored: [
      '**/node_modules/**',
      '**/.sun/**',
      '**/.git/**',
      ...ignored,
    ],
  });

  watcher.on('change', async (path) => {
    // Run incremental lint on changed file only
    await lintSingleFile(path);
  });

  watcher.on('error', (error) => {
    console.error('[guard] Watcher error:', error);
  });

  return watcher;
}
```

### Pattern 5: Lint Rule JSON Storage

**What:** Store lint rules as JSON in .sun/rules/ via FileStore
**When to use:** `sunco init` generates rules, `sunco lint` reads them, `sunco guard` proposes new ones (D-10)

```typescript
// Uses FileStoreApi from Phase 1
interface SunLintRule {
  id: string;
  source: 'init-generated' | 'guard-promoted' | 'user-defined';
  createdAt: string;  // ISO 8601
  pattern: string;    // what this rule enforces
  eslintConfig: {
    // ESLint flat config snippet
    settings?: Record<string, unknown>;
    rules?: Record<string, unknown>;
  };
}

// Write rule
await ctx.fileStore.write('rules', 'arch-layers.json', JSON.stringify(rule, null, 2));

// Read all rules
const ruleFiles = await ctx.fileStore.list('rules');
const rules: SunLintRule[] = [];
for (const file of ruleFiles) {
  if (file.endsWith('.json')) {
    const content = await ctx.fileStore.read('rules', file);
    if (content) rules.push(JSON.parse(content));
  }
}
```

### Anti-Patterns to Avoid

- **Spawning ESLint CLI:** Do NOT use `execa('eslint', [...])`. Use the programmatic `ESLint` class for same-process execution. CLI spawn adds 200-500ms latency per call, critical for guard --watch incremental linting.
- **Full AST parsing for convention extraction:** D-03 explicitly says "AST-free analysis." Use regex-based scanning for naming patterns and import styles. AST parsing (e.g., ts-morph, TypeScript compiler API) is overkill and slow for this use case.
- **Storing health data as flat files:** Use SQLite (already available via StateApi) for health snapshots. Flat files lack query capability for trend analysis.
- **Polling file watcher:** Never use `usePolling: true` in chokidar unless on a network filesystem. It burns CPU. Use native fs.watch events (chokidar default).
- **Generating user's eslint.config.js:** `sunco lint` does NOT write to the user's ESLint config. It runs ESLint programmatically with `overrideConfigFile: true`. The user's own ESLint config (if any) is separate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Architecture boundary enforcement | Custom import parser + rule engine | eslint-plugin-boundaries | Handles re-exports, barrel files, dynamic imports, type imports, circular dependencies. Years of edge cases. |
| TypeScript file parsing for lint | Custom regex-based JS/TS parser | ESLint + typescript-eslint parser | Correct AST parsing is extremely complex. typescript-eslint handles all TS syntax. |
| Cross-platform file watching | Custom fs.watch wrapper | chokidar 5 | fs.watch is inconsistent across platforms (no recursive on Linux). chokidar normalizes all of this. |
| TOML serialization | JSON.stringify + manual TOML formatting | smol-toml stringify | TOML serialization has edge cases (multiline strings, dates, inline tables). smol-toml handles all of them. |
| SQLite key-value store | Custom file-based storage | Phase 1 StateApi (better-sqlite3) | Already built, WAL mode, prepared statements, concurrent-safe. Zero new code. |
| Glob pattern matching | Custom recursive readdir | glob (already in core) | Already installed, handles dotfiles, symlinks, ignore patterns correctly. |

**Key insight:** Phase 2 should maximize reuse of Phase 1 infrastructure (StateApi, FileStoreApi, SkillUi, defineSkill). The only new heavy dependencies are ESLint ecosystem (for lint skill) and chokidar (for guard --watch). Everything else is pure TypeScript logic operating on the existing state engine.

## Common Pitfalls

### Pitfall 1: typescript-eslint Peer Dependency Conflict with TS 6.0

**What goes wrong:** `npm install typescript-eslint@8.57.2` fails because it declares `peerDependencies: { typescript: ">=4.8.4 <6.0.0" }`, but the project uses TypeScript 6.0.2.
**Why it happens:** typescript-eslint has not yet released a version supporting TypeScript 6.0. PR #12124 is pending.
**How to avoid:** Use npm `overrides` in the root `package.json`:
```json
{
  "overrides": {
    "typescript-eslint": {
      "typescript": "$typescript"
    }
  }
}
```
Or install with `--legacy-peer-deps`. The actual runtime compatibility appears to work (per community reports); the peer dep constraint is just lagging behind.
**Warning signs:** `npm ERR! ERESOLVE unable to resolve dependency tree` during install.

### Pitfall 2: ESLint Programmatic API Config Shape Mismatch

**What goes wrong:** Passing incorrect config shape to `new ESLint({ overrideConfig })` -- using eslintrc format instead of flat config format.
**Why it happens:** ESLint 10 only supports flat config. Legacy eslintrc format (with `extends`, `env`, `parserOptions`) is completely removed.
**How to avoid:** Use flat config format exclusively:
```typescript
// CORRECT (flat config)
overrideConfig: {
  languageOptions: { parser: tseslintParser },
  plugins: { boundaries },
  rules: { 'boundaries/dependencies': [2, { ... }] },
}

// WRONG (eslintrc format -- will fail in ESLint 10)
overrideConfig: {
  extends: ['plugin:boundaries/recommended'],
  parserOptions: { ecmaVersion: 2022 },
}
```
**Warning signs:** Runtime errors about `extends` not being recognized, or `parserOptions` being invalid.

### Pitfall 3: eslint-plugin-boundaries Element Pattern Matching

**What goes wrong:** Boundary elements don't match files because patterns are relative to project root, not src/.
**Why it happens:** eslint-plugin-boundaries matches file paths against patterns. If `pattern: "components/*"` but files are at `src/components/`, nothing matches.
**How to avoid:** Always use patterns relative to the working directory: `pattern: "src/components/*"` or use the `basePattern` setting. Test with a small subset before generating full config.
**Warning signs:** No boundary violations detected on a project that clearly has them -- means patterns aren't matching.

### Pitfall 4: Guard Watch Mode Process Lifecycle

**What goes wrong:** `sunco guard --watch` doesn't exit cleanly, leaves orphan processes, or doesn't respond to SIGINT.
**Why it happens:** chokidar watcher keeps the Node.js event loop alive. If not properly closed on signal, the process hangs.
**How to avoid:** Register signal handlers and close the watcher:
```typescript
const watcher = chokidar.watch(/* ... */);
const cleanup = async () => { await watcher.close(); process.exit(0); };
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
// Also respect ctx.signal (AbortSignal from SkillContext)
ctx.signal.addEventListener('abort', () => watcher.close());
```
**Warning signs:** Process stays alive after Ctrl+C, or zombie Node processes in `ps aux`.

### Pitfall 5: Health Snapshot SQLite Key Collision

**What goes wrong:** Multiple `sunco health` runs in the same second overwrite each other's snapshots.
**Why it happens:** Using date-only keys like `health.snapshot.2026-03-28`.
**How to avoid:** Include time precision in keys: `health.snapshot.2026-03-28T14:30:00.000Z` or use a monotonic counter. The StateApi's `list('health.snapshot.')` prefix query handles this cleanly.
**Warning signs:** Health trend chart shows fewer data points than expected.

### Pitfall 6: Convention Extraction False Positives

**What goes wrong:** Init detects wrong conventions because it sampled generated files, test fixtures, or vendor code.
**Why it happens:** Regex-based convention extraction doesn't distinguish user code from generated/vendored code.
**How to avoid:** Exclude common non-user directories from sampling: `node_modules/`, `dist/`, `build/`, `.next/`, `vendor/`, `__fixtures__/`, `__mocks__/`. Use a configurable ignore list. Sample only from `src/` or the detected source root.
**Warning signs:** Detected naming convention is `PascalCase` when the project clearly uses `camelCase` (because generated code was sampled).

## Code Examples

### Ecosystem Detection Map (D-01)

```typescript
// Source: Design from D-01 decision
interface EcosystemMarker {
  file: string;          // filename to check for
  ecosystem: string;     // detected ecosystem name
  confidence: 'high' | 'medium';
}

const ECOSYSTEM_MARKERS: EcosystemMarker[] = [
  // JavaScript/TypeScript ecosystem
  { file: 'package.json', ecosystem: 'nodejs', confidence: 'high' },
  { file: 'tsconfig.json', ecosystem: 'typescript', confidence: 'high' },
  { file: 'deno.json', ecosystem: 'deno', confidence: 'high' },
  { file: 'bun.lockb', ecosystem: 'bun', confidence: 'high' },

  // Rust
  { file: 'Cargo.toml', ecosystem: 'rust', confidence: 'high' },

  // Go
  { file: 'go.mod', ecosystem: 'go', confidence: 'high' },

  // Python
  { file: 'pyproject.toml', ecosystem: 'python', confidence: 'high' },
  { file: 'requirements.txt', ecosystem: 'python', confidence: 'medium' },
  { file: 'setup.py', ecosystem: 'python', confidence: 'medium' },
  { file: 'Pipfile', ecosystem: 'python', confidence: 'medium' },

  // Java/Kotlin
  { file: 'build.gradle', ecosystem: 'java', confidence: 'high' },
  { file: 'build.gradle.kts', ecosystem: 'kotlin', confidence: 'high' },
  { file: 'pom.xml', ecosystem: 'java', confidence: 'high' },

  // Ruby
  { file: 'Gemfile', ecosystem: 'ruby', confidence: 'high' },

  // PHP
  { file: 'composer.json', ecosystem: 'php', confidence: 'high' },

  // Swift
  { file: 'Package.swift', ecosystem: 'swift', confidence: 'high' },

  // .NET
  { file: '*.csproj', ecosystem: 'dotnet', confidence: 'high' },
  { file: '*.sln', ecosystem: 'dotnet', confidence: 'high' },

  // Flutter/Dart
  { file: 'pubspec.yaml', ecosystem: 'dart', confidence: 'high' },
];
```

### Layer Detection Heuristics (D-02)

```typescript
// Source: Design from D-02 decision
interface LayerPattern {
  /** Layer name used in dependency rules */
  name: string;
  /** Directory name patterns (case-insensitive) */
  dirPatterns: string[];
  /** Allowed dependency directions (this layer can import from these) */
  canImportFrom: string[];
}

const COMMON_LAYER_PATTERNS: LayerPattern[] = [
  {
    name: 'types',
    dirPatterns: ['types', 'interfaces', 'models', 'entities', 'schemas'],
    canImportFrom: [],  // types should not import from other layers
  },
  {
    name: 'config',
    dirPatterns: ['config', 'configuration', 'constants', 'env'],
    canImportFrom: ['types'],
  },
  {
    name: 'utils',
    dirPatterns: ['utils', 'helpers', 'lib', 'shared', 'common'],
    canImportFrom: ['types', 'config'],
  },
  {
    name: 'domain',
    dirPatterns: ['domain', 'services', 'service', 'core', 'business', 'use-cases'],
    canImportFrom: ['types', 'config', 'utils'],
  },
  {
    name: 'handler',
    dirPatterns: ['handlers', 'controllers', 'api', 'routes', 'endpoints', 'resolvers'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
  {
    name: 'ui',
    dirPatterns: ['ui', 'views', 'pages', 'screens', 'components'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
  {
    name: 'infra',
    dirPatterns: ['infra', 'infrastructure', 'database', 'db', 'repositories', 'adapters'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
];
```

### ESLint Config Generation from Detected Layers (D-07)

```typescript
// Source: eslint-plugin-boundaries docs (https://www.jsboundaries.dev/docs/rules/dependencies/)
import type { Linter } from 'eslint';
import boundaries from 'eslint-plugin-boundaries';

interface DetectedLayer {
  name: string;
  pattern: string;        // e.g., 'src/services/*'
  canImportFrom: string[];
}

function generateEslintConfig(layers: DetectedLayer[]): Linter.Config[] {
  const elements = layers.map((layer) => ({
    type: layer.name,
    pattern: layer.pattern,
  }));

  const dependencyRules = layers.map((layer) => ({
    from: { type: layer.name },
    allow: {
      to: layer.canImportFrom.map((dep) => ({ type: dep })),
    },
  }));

  return [{
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
    },
    rules: {
      'boundaries/dependencies': [2, {
        default: 'disallow',
        rules: dependencyRules,
      }],
    },
  }];
}
```

### Structured Error Message Format (D-08)

```typescript
// Source: Design from D-08 decision
interface SunLintViolation {
  rule: string;             // e.g., 'boundaries/dependencies'
  file: string;             // relative file path
  line: number;             // 1-based line number
  column: number;           // 1-based column number
  violation: string;        // human-readable description
  fix_instruction: string;  // agent-readable fix instruction
  severity: 'error' | 'warning';
}

// Transform ESLint LintMessage to SunLintViolation
function formatViolation(
  file: string,
  msg: { ruleId: string | null; line: number; column: number; message: string; severity: number },
  layerMap: Map<string, DetectedLayer>,
): SunLintViolation {
  return {
    rule: msg.ruleId ?? 'parse-error',
    file,
    line: msg.line,
    column: msg.column,
    violation: msg.message,
    fix_instruction: generateFixInstruction(msg, layerMap),
    severity: msg.severity === 2 ? 'error' : 'warning',
  };
}
```

### Agent Doc Analysis Metrics (D-16, D-17)

```typescript
// Source: Design from D-16, D-17 decisions
interface AgentDocMetrics {
  filePath: string;
  totalLines: number;
  sectionCount: number;
  instructionDensity: number;  // instructions per section
  hasConventions: boolean;
  hasConstraints: boolean;
  hasArchitecture: boolean;
  contradictions: Contradiction[];
  efficiencyScore: number;     // 0-100
}

interface Contradiction {
  lineA: number;
  lineB: number;
  textA: string;
  textB: string;
  reason: string;
}

// Brevity scoring (ETH Zurich insight: shorter is better)
function brevityScore(lineCount: number): number {
  if (lineCount <= 30) return 100;
  if (lineCount <= 60) return 80;
  if (lineCount <= 100) return 50;
  if (lineCount <= 200) return 25;
  return 10;  // severely penalize very long files
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| eslintrc format | Flat config only | ESLint 10 (Feb 2026) | `extends`, `env`, `parserOptions` removed. Use `languageOptions`, direct plugin imports. |
| chokidar 3/4 (CJS) | chokidar 5 (ESM-only) | Nov 2025 | ESM import only, Node.js 20+ minimum, ~50% less disk space. API unchanged. |
| typescript-eslint config helper | Direct flat config | 2025-2026 | `tseslint.config()` helper still works but raw flat config arrays are standard. |
| eslint-plugin-boundaries element-types rule | boundaries/dependencies rule | v5+ | `element-types` renamed/migrated to `dependencies` with enhanced selector API. |

**Deprecated/outdated:**
- eslintrc format (`.eslintrc.js`, `.eslintrc.json`): Completely removed in ESLint 10. Flat config only.
- `FlatESLint` class: Removed in ESLint 10. Use `ESLint` class (it IS the flat config class now).
- `LegacyESLint` class: Removed in ESLint 10.
- chokidar CommonJS imports: chokidar 5 is ESM-only. `require('chokidar')` will fail.

## Open Questions

1. **typescript-eslint TS 6.0 compatibility at runtime**
   - What we know: Peer dep says `<6.0.0`, PR #12124 is pending, community reports it works at runtime.
   - What's unclear: Whether any typescript-eslint rules produce incorrect results with TS 6.0 AST changes (JSX `</` token split, deprecated import assertions).
   - Recommendation: Install with `overrides`, run the full test suite on generated lint configs, and document any rule-specific issues. If typed linting breaks, fall back to syntactic-only rules (no type-checker) as a degraded mode.

2. **eslint-plugin-boundaries with ESLint 10 flat config**
   - What we know: Plugin declares `peerDependencies: { eslint: ">=6.0.0" }` and its v6.0.1 uses the modern plugin format.
   - What's unclear: Whether its internal config resolution works correctly with ESLint 10's fully flat pipeline when used programmatically via `overrideConfig`.
   - Recommendation: Write a small integration test early (Wave 0 or Wave 1) that creates an `ESLint` instance with boundaries plugin and verifies a known violation is detected.

3. **Health snapshot storage scale**
   - What we know: StateApi stores JSON-serialized values keyed by string. Works fine for small data.
   - What's unclear: How many snapshots before the `list('health.snapshot.')` prefix query becomes slow. SQLite LIKE queries on text keys are O(n).
   - Recommendation: For v1, accept O(n) scan. If it becomes slow (>1000 snapshots), add a dedicated `health_snapshots` table with indexed date column in a future phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All skills | Yes | v22.16.0 | -- |
| npm | Package install | Yes | 10.9.2 | -- |
| TypeScript | Build/types | Yes | 6.0.2 | -- |
| SQLite (better-sqlite3) | Health snapshots | Yes | 12.8.0 (in core) | -- |
| ESLint | Lint skill | Not installed | -- | Install as dependency |
| eslint-plugin-boundaries | Lint skill | Not installed | -- | Install as dependency |
| typescript-eslint | Lint skill | Not installed | -- | Install as dependency |
| chokidar | Guard --watch | Not installed (only 4.0.3 as tsup transitive) | -- | Install v5 as direct dependency |

**Missing dependencies with no fallback:**
- eslint, eslint-plugin-boundaries, typescript-eslint -- must be installed before lint skill can work

**Missing dependencies with fallback:**
- None -- all dependencies have clear install paths

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 (installed in @sunco/core devDependencies) |
| Config file | `packages/skills-harness/vitest.config.ts` (needs creation -- Wave 0) |
| Quick run command | `npx vitest run --project skills-harness` |
| Full suite command | `npx turbo test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HRN-01 | Detect 15+ ecosystems from marker files | unit | `vitest run src/init/__tests__/ecosystem-detector.test.ts` | Wave 0 |
| HRN-02 | Detect layer patterns from directory names | unit | `vitest run src/init/__tests__/layer-detector.test.ts` | Wave 0 |
| HRN-03 | Extract naming/import conventions via regex | unit | `vitest run src/init/__tests__/convention-extractor.test.ts` | Wave 0 |
| HRN-04 | Initialize .sun/ with generated rules + config.toml | integration | `vitest run src/init/__tests__/workspace-initializer.test.ts` | Wave 0 |
| HRN-05 | Generate ESLint boundaries config from layers | unit | `vitest run src/lint/__tests__/config-generator.test.ts` | Wave 0 |
| HRN-06 | Detect dependency direction violations | integration | `vitest run src/lint/__tests__/runner.test.ts` | Wave 0 |
| HRN-07 | Structured error messages with fix_instruction | unit | `vitest run src/lint/__tests__/formatter.test.ts` | Wave 0 |
| HRN-08 | --fix auto-corrects deterministic violations | integration | `vitest run src/lint/__tests__/fixer.test.ts` | Wave 0 |
| HRN-09 | Document freshness detection | unit | `vitest run src/health/__tests__/freshness-checker.test.ts` | Wave 0 |
| HRN-10 | Anti-pattern spread tracking with trends | integration | `vitest run src/health/__tests__/pattern-tracker.test.ts` | Wave 0 |
| HRN-11 | Weighted composite score 0-100 | unit | `vitest run src/health/__tests__/reporter.test.ts` | Wave 0 |
| HRN-12 | Agent doc analysis + efficiency score | unit | `vitest run src/agents/__tests__/doc-analyzer.test.ts` | Wave 0 |
| HRN-13 | Suggestions only, no auto-generation | unit | `vitest run src/agents/__tests__/suggestion-engine.test.ts` | Wave 0 |
| HRN-14 | Anti-pattern -> lint rule promotion (suggest-only) | unit | `vitest run src/guard/__tests__/promoter.test.ts` | Wave 0 |
| HRN-15 | Incremental single-file lint after change | integration | `vitest run src/guard/__tests__/incremental-linter.test.ts` | Wave 0 |
| HRN-16 | File watching with chokidar | integration | `vitest run src/guard/__tests__/watcher.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --project skills-harness`
- **Per wave merge:** `npx turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/skills-harness/vitest.config.ts` -- test framework config (copy pattern from `packages/core/vitest.config.ts`)
- [ ] Add `vitest` to `packages/skills-harness/devDependencies`
- [ ] `packages/skills-harness/src/init/__tests__/` directory structure
- [ ] `packages/skills-harness/src/lint/__tests__/` directory structure
- [ ] `packages/skills-harness/src/health/__tests__/` directory structure
- [ ] `packages/skills-harness/src/agents/__tests__/` directory structure
- [ ] `packages/skills-harness/src/guard/__tests__/` directory structure
- [ ] Shared test fixtures: mock project directory structure for init detection tests

## Project Constraints (from CLAUDE.md)

- **Tech Stack:** TypeScript (Node.js), Commander.js, TOML, tsup, Vitest -- confirmed
- **Distribution:** npm (npx sunco / npm install -g sunco) -- `sunco` package name
- **Clean Room:** GSD code copy prohibited. Concepts only, build from scratch.
- **Skill-Only:** All features are skills. No hardcoded commands.
- **Deterministic First:** Linter/tests enforce what's enforceable -- no LLM for deterministic work.
- **Quality:** Each skill is a finished product. Full effort per skill.
- **ESLint:** v10.x with flat config (CLAUDE.md tech stack)
- **typescript-eslint:** Latest with full type-checker access (CLAUDE.md tech stack)
- **eslint-plugin-boundaries:** For architecture layer enforcement (CLAUDE.md tech stack)
- **chokidar:** 5.x ESM-only for file watching (CLAUDE.md tech stack)
- **Vitest:** 4.1.x for testing (CLAUDE.md -- note: 3.1.2 is actually installed; verify and reconcile)
- **Zod:** 3.24.4 (installed, not 4.x as CLAUDE.md lists -- Phase 1 decision)
- **Node.js:** 22.16.0 running (CLAUDE.md says 24.x LTS preferred, 22 acceptable)

## Sources

### Primary (HIGH confidence)
- Phase 1 codebase: `packages/core/src/skill/types.ts`, `packages/core/src/state/types.ts`, `packages/core/src/state/api.ts`, `packages/core/src/state/database.ts`, `packages/core/src/state/file-store.ts`, `packages/core/src/config/types.ts` -- established interfaces and patterns
- [ESLint Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api) -- ESLint class, Linter class, lintFiles, lintText, overrideConfig
- [eslint-plugin-boundaries](https://www.jsboundaries.dev/docs/rules/dependencies/) -- element types, boundaries/dependencies rule, capture groups
- [chokidar README](https://github.com/paulmillr/chokidar) -- v5 API, watch options, events, awaitWriteFinish
- npm registry version checks: eslint@10.1.0, eslint-plugin-boundaries@6.0.1, typescript-eslint@8.57.2, chokidar@5.0.0

### Secondary (MEDIUM confidence)
- [typescript-eslint TS 6 issue #12123](https://github.com/typescript-eslint/typescript-eslint/issues/12123) -- TS 6 support status, PR #12124 pending
- [ESLint v10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) -- flat config only, removed APIs
- Community reports on typescript-eslint + TS 6.0 runtime compatibility

### Tertiary (LOW confidence)
- ETH Zurich research on shorter agent instruction files -- referenced in user decisions but specific paper not found via web search. The principle (shorter is better for agent docs) is accepted as a user decision.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via npm registry, versions confirmed, peer deps documented
- Architecture: HIGH -- patterns derived from Phase 1 codebase analysis + official library documentation
- Pitfalls: HIGH -- typescript-eslint TS 6 conflict verified firsthand via npm view; ESLint 10 flat config changes verified via official migration docs

**Research date:** 2026-03-28
**Valid until:** 2026-04-15 (typescript-eslint TS 6 support may land sooner, changing pitfall #1)
