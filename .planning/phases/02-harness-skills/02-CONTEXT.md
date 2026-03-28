# Phase 2: Harness Skills - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-selected (all gray areas, recommended defaults)

<domain>
## Phase Boundary

5 deterministic harness skills that analyze, lint, and guard codebases with zero LLM cost. These are the core differentiator: "harness engineering" that makes agents make fewer mistakes. Skills: `sunco init`, `sunco lint`, `sunco health`, `sunco agents`, `sunco guard`.

16 requirements: HRN-01 through HRN-16

</domain>

<decisions>
## Implementation Decisions

### Init Detection Strategy (HRN-01 through HRN-04)
- **D-01:** Convention file scanning for ecosystem detection — look for package.json (Node.js), tsconfig.json (TypeScript), Cargo.toml (Rust), go.mod (Go), pyproject.toml/requirements.txt (Python), build.gradle (Java/Kotlin), etc. 15+ ecosystem markers.
- **D-02:** Layer detection via directory name heuristics + import graph sampling. Common layer patterns: types -> config -> service/domain -> handler/controller -> ui/view. Map detected layers to dependency direction rules.
- **D-03:** Convention extraction from AST-free analysis: naming patterns (camelCase vs snake_case via regex), import style (relative vs alias), export patterns (named vs default), file organization (co-located tests vs __tests__/).
- **D-04:** .sun/ initialization creates: rules/ (auto-generated lint rules), tribal/ (empty, for user knowledge), scenarios/ (empty, for holdout tests), planning/ (empty). Plus config.toml with detected stack and layer map.
- **D-05:** Project type presets via `sunco init` — auto-select preset matching detected stack. Presets define which harness skills are active by default.

### Lint Architecture (HRN-05 through HRN-08)
- **D-06:** Hybrid approach — eslint-plugin-boundaries for layer enforcement (dependency direction rules), plus custom sunco-specific rules for patterns unique to SUN (e.g., skill structure validation).
- **D-07:** Init-detected layers map to eslint-plugin-boundaries element types. Example: `{ type: 'ui', pattern: 'src/ui/**' }` with rule `{ from: 'ui', disallow: ['database', 'infra'] }`.
- **D-08:** Error messages are structured for both humans and agents: `{ rule: string, file: string, line: number, violation: string, fix_instruction: string, severity: 'error'|'warning' }`. CLI renders human-readable format; `--json` outputs raw JSON for agent consumption. "Linter teaches while blocking."
- **D-09:** `--fix` auto-corrects what's deterministically fixable (import reordering, simple dependency direction violations). Complex fixes emit fix instructions only.
- **D-10:** Lint rules stored in .sun/rules/ as JSON. Each rule has: id, source (init-generated | guard-promoted | user-defined), created date, pattern, and ESLint config snippet.

### Health Scoring (HRN-09 through HRN-11)
- **D-11:** Weighted composite score 0-100: document freshness (30%), anti-pattern spread trends (40%), convention adherence (30%).
- **D-12:** Document freshness = code-to-doc sync detection. Compare file modification dates, check cross-references still resolve, detect README sections that reference moved/renamed code.
- **D-13:** Anti-pattern tracking = count occurrences over time. Store snapshots in .sun/ SQLite. Report trend: "any type went from 3 files to 12 files in 2 weeks." Severity increases with spread rate.
- **D-14:** Convention adherence = measure consistency with init-detected conventions. Deviations from dominant naming/import/export patterns reduce score.
- **D-15:** Report output: terminal table with scores per category + overall, plus trend arrows (improving/degrading/stable). `--json` for machine consumption.

### Agent Doc Analysis (HRN-12, HRN-13)
- **D-16:** Static text analysis of CLAUDE.md/agents.md/AGENTS.md. Metrics: total line count (warn >60), section count, instruction density (instructions per section), contradiction detection (conflicting rules), staleness indicators.
- **D-17:** Efficiency score 0-100 based on: brevity (shorter is better, per ETH Zurich research), clarity (measurable instructions vs vague guidance), coverage (key areas addressed: conventions, constraints, architecture), contradiction-free.
- **D-18:** Analysis + suggestions only. Never auto-generate or auto-modify agent docs. The user decides what to change. "Analyze, don't act."
- **D-19:** Suggestions are specific and actionable: "Line 45-52: contradicts line 12. Choose one." Not "Consider improving clarity."

### Guard Watch Mode (HRN-14 through HRN-16)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Core Platform (dependency)
- `packages/core/src/skill/types.ts` -- SkillDefinition interface, SkillKind, SkillContext
- `packages/core/src/skill/define.ts` -- defineSkill() factory
- `packages/core/src/state/api.ts` -- StateEngine API (state.get/set/delete)
- `packages/core/src/state/file-store.ts` -- FileStore for .sun/ artifacts
- `packages/core/src/state/directory.ts` -- .sun/ directory initialization
- `packages/core/src/config/types.ts` -- SunConfig type
- `packages/core/src/config/loader.ts` -- loadConfig() for TOML hierarchy
- `packages/core/src/ui/adapters/SkillUi.ts` -- UI adapter interface for skill output

### Tech Stack (from CLAUDE.md)
- `CLAUDE.md` -- Technology stack decisions (ESLint 10, typescript-eslint, eslint-plugin-boundaries, chokidar 5, Vitest 4)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `defineSkill()` factory in `packages/core/src/skill/define.ts` -- all 5 harness skills use this
- `StateEngine` (SQLite + FileStore) in `packages/core/src/state/` -- health snapshots go in SQLite, rules in FileStore
- `SkillContext.config` -- TOML config already available for reading project settings
- `SkillContext.ui` -- InkUiAdapter for terminal output (tables, progress bars, results)
- `SkillContext.run()` -- inter-skill calls (e.g., guard can call lint internally)

### Established Patterns
- Skills are defined via `defineSkill({ id, command, kind, stage, category, routing, options, execute })` in `packages/skills-harness/src/`
- Deterministic skills use `kind: 'deterministic'` -- no agent access, zero LLM cost
- Config read via `ctx.config`, state via `ctx.state`, UI via `ctx.ui`
- Build: tsup bundles to ESM, Vitest for tests

### Integration Points
- New skills go in `packages/skills-harness/src/` as `*.skill.ts` files
- Scanner auto-discovers via glob pattern `packages/skills-*/src/*.skill.ts`
- CLI registers discovered skills as Commander.js subcommands
- .sun/ directory already initialized by Phase 1 state engine

</code_context>

<specifics>
## Specific Ideas

- "Linter teaches while blocking" -- error messages should explain WHY a dependency direction is wrong, not just flag it
- ETH Zurich research shows shorter CLAUDE.md files are more effective -- agents skill should reflect this
- eslint-plugin-boundaries is the chosen tool for layer enforcement (per CLAUDE.md tech stack)
- chokidar 5.x for file watching (per CLAUDE.md tech stack)
- Health snapshots should use the existing SQLite WAL database for trend tracking

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-harness-skills*
*Context gathered: 2026-03-28 via auto mode*
