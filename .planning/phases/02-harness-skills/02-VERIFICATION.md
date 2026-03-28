---
phase: 02-harness-skills
verified: 2026-03-28T17:50:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run sunco init on a real TypeScript project and verify .sun/ workspace is created"
    expected: ".sun/config.toml contains detected ecosystems, layers, conventions; .sun/rules/arch-layers.json exists"
    why_human: "Requires a real project directory with TypeScript files to confirm end-to-end flow"
  - test: "Run sunco lint on a project with known boundary violations"
    expected: "Agent-readable error messages with fix_instruction field explaining WHY the violation is wrong"
    why_human: "Message quality requires human assessment of clarity and usefulness"
  - test: "Run sunco health and verify score is 0-100 with trend arrows"
    expected: "Terminal table with Document Freshness, Anti-patterns, Conventions categories and overall score"
    why_human: "Visual formatting and score accuracy require manual inspection"
  - test: "Run sunco agents on this project's CLAUDE.md"
    expected: "Efficiency score, line count warning (>60), suggestions with line numbers"
    why_human: "Suggestion quality requires human evaluation"
  - test: "Run sunco guard --watch and modify a file"
    expected: "Real-time violation and anti-pattern detection on file change"
    why_human: "Real-time behavior requires interactive testing"
---

# Phase 2: Harness Skills Verification Report

**Phase Goal:** Users can analyze, lint, and guard any codebase with deterministic harness skills -- the zero-LLM-cost backbone that makes agents make fewer mistakes
**Verified:** 2026-03-28T17:50:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User runs `sunco init` on a TypeScript/Python/Go project and gets .sun/ workspace with auto-detected stack, layer structure, conventions, and generated rules | VERIFIED | `init.skill.ts` orchestrates 3 parallel detectors -> `initializeWorkspace()` writes config.toml + arch-layers.json to .sun/. 19 ecosystem markers covering 15 ecosystems. 7 layer patterns. Convention extractor samples 50 files for naming/import/export/test patterns. Preset auto-selection from detected ecosystems (6+ presets). Tests: 6 ecosystem, 6 layer, 7 preset, 3 workspace-initializer tests pass. |
| 2 | User runs `sunco lint` and sees architecture violations (dependency direction, layer breaches) with agent-readable error messages that explain what to fix and why, plus --fix auto-corrects | VERIFIED | `lint.skill.ts` reads init.result from state, loads rules from .sun/rules/, generates eslint-plugin-boundaries flat config, runs ESLint programmatically. `formatter.ts` generates `fix_instruction` with layer names and allowed imports (e.g., "File X is in layer Y. It imports from layer Z, which violates..."). `fixer.ts` delegates to runner with `fix=true`. Runner test confirms boundary violation detection (580ms test). 5 runner, 3 formatter, 3 fixer, 4 rule-store tests pass. |
| 3 | User runs `sunco health` and gets a numerical score report showing document staleness, anti-pattern spread trends, and pattern drift over time | VERIFIED | `health.skill.ts` runs freshness-checker + pattern-tracker + convention-scorer in parallel. Weighted composite: freshness 30% + patterns 40% + conventions 30%. Pattern tracker stores snapshots in SQLite state with ISO timestamps. Trend computation compares current vs previous snapshot. Reporter outputs terminal table with category scores and trend arrows. 4 freshness, 5 pattern-tracker, 9 reporter tests pass. |
| 4 | User runs `sunco agents` on a repo with CLAUDE.md and gets an efficiency score, 60-line limit check, and improvement suggestions (no auto-generation) | VERIFIED | `agents.skill.ts` auto-detects CLAUDE.md/agents.md/AGENTS.md, reads content (never writes), computes efficiency score (brevity 30% + clarity 25% + coverage 25% + contradiction-free 20%). Contradiction detection via directive extraction + subject similarity. Suggestions include exact line numbers for contradictions. `lineCountWarning: totalLines > 60` flag. 7 efficiency-scorer, 3 doc-analyzer, 3 suggestion-engine tests pass. |
| 5 | User runs `sunco guard` in watch mode and sees real-time lint-on-change with anti-pattern-to-linter-rule promotion suggestions | VERIFIED | `guard.skill.ts` supports two modes: single-run (analyzeProject) and --watch (chokidar). Watcher uses `chokidar.watch()` with awaitWriteFinish 300ms debounce. On file change: analyzeFile runs incremental lint + anti-pattern scan + tribal pattern matching. Promoter tracks pattern frequency in state, suggests promotion when threshold (default: 3) exceeded. Maps anti-patterns to ESLint rules. Clean shutdown via AbortSignal. 3 analyzer, 2 promoter, 4 watcher, 3 incremental-linter tests pass. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/skills-harness/src/init.skill.ts` | sunco init skill entry point | VERIFIED | 87 lines, orchestrates 3 detectors in parallel, calls initializeWorkspace, stores result in state |
| `packages/skills-harness/src/init/ecosystem-detector.ts` | 15+ ecosystem detection | VERIFIED | 97 lines, scans ECOSYSTEM_MARKERS (19 markers, 15 ecosystems), parallel file existence checks |
| `packages/skills-harness/src/init/layer-detector.ts` | Directory-based layer detection | VERIFIED | 108 lines, scans SOURCE_ROOTS, matches against COMMON_LAYER_PATTERNS, builds canImportFrom rules |
| `packages/skills-harness/src/init/convention-extractor.ts` | AST-free convention extraction | VERIFIED | 404 lines, regex-based naming/import/export/test detection, samples up to 50 files |
| `packages/skills-harness/src/init/presets.ts` | Project type presets | VERIFIED | 6+ presets (typescript-node, nodejs, rust, go, python, generic), resolvePreset with ecosystem matching |
| `packages/skills-harness/src/init/workspace-initializer.ts` | .sun/ workspace creation | VERIFIED | 179 lines, writes config.toml (TOML serialized), arch-layers.json, creates tribal/scenarios/planning dirs |
| `packages/skills-harness/src/lint.skill.ts` | sunco lint skill entry point | VERIFIED | 129 lines, reads state, loads rules, generates boundaries config, runs ESLint, formats output |
| `packages/skills-harness/src/lint/config-generator.ts` | Layer -> eslint-plugin-boundaries config | VERIFIED | 90 lines, generates BoundariesConfig + full ESLint flat config array |
| `packages/skills-harness/src/lint/runner.ts` | Programmatic ESLint execution | VERIFIED | 161 lines, creates ESLint instance with typescript-eslint parser, boundaries plugin, error handling |
| `packages/skills-harness/src/lint/formatter.ts` | Agent-readable error messages | VERIFIED | 226 lines, fix_instruction with layer-aware context, terminal + JSON output formats |
| `packages/skills-harness/src/lint/fixer.ts` | --fix auto-correction | VERIFIED | 43 lines, delegates to runner with fix=true, ESLint.outputFixes applied |
| `packages/skills-harness/src/lint/rule-store.ts` | .sun/rules/ JSON management | VERIFIED | loadRules/saveRule via FileStoreApi, 4 tests pass |
| `packages/skills-harness/src/health.skill.ts` | sunco health skill entry point | VERIFIED | 178 lines, parallel checks, snapshot storage, trend computation, terminal table |
| `packages/skills-harness/src/health/freshness-checker.ts` | Document staleness detection | VERIFIED | 293 lines, mtime comparison, broken reference detection, score computation |
| `packages/skills-harness/src/health/pattern-tracker.ts` | Anti-pattern tracking with SQLite | VERIFIED | 263 lines, scans 6 anti-patterns, stores snapshots in state, trend computation |
| `packages/skills-harness/src/health/reporter.ts` | Weighted composite score + report | VERIFIED | 212 lines, weights (30/40/30), penalty multipliers, terminal table with trend arrows |
| `packages/skills-harness/src/health/convention-scorer.ts` | Convention adherence scoring | VERIFIED | Exists and used by health.skill.ts |
| `packages/skills-harness/src/agents.skill.ts` | sunco agents skill entry point | VERIFIED | 138 lines, auto-detects CLAUDE.md/agents.md, read-only analysis, never modifies files |
| `packages/skills-harness/src/agents/doc-analyzer.ts` | Static text analysis | VERIFIED | 267 lines, section parsing, instruction detection, contradiction detection with subject similarity |
| `packages/skills-harness/src/agents/efficiency-scorer.ts` | 0-100 efficiency score | VERIFIED | 111 lines, 4-component scoring (brevity 30%, clarity 25%, coverage 25%, contradiction-free 20%) |
| `packages/skills-harness/src/agents/suggestion-engine.ts` | Actionable suggestions | VERIFIED | 84 lines, brevity/contradiction/coverage/structure suggestions with line numbers |
| `packages/skills-harness/src/guard.skill.ts` | sunco guard skill entry point | VERIFIED | 160 lines, single-run and --watch modes, AbortSignal cleanup |
| `packages/skills-harness/src/guard/analyzer.ts` | Shared analysis engine | VERIFIED | 267 lines, analyzeFile + analyzeProject, combines lint + anti-patterns + tribal |
| `packages/skills-harness/src/guard/watcher.ts` | chokidar file watcher | VERIFIED | 81 lines, chokidar.watch() with debounce, change/add/unlink handlers, stopWatcher cleanup |
| `packages/skills-harness/src/guard/promoter.ts` | Anti-pattern promotion suggestions | VERIFIED | 133 lines, frequency tracking in state, 5 pattern-to-ESLint mappings, threshold-based suggestions |
| `packages/skills-harness/src/guard/incremental-linter.ts` | Single-file ESLint lintText | VERIFIED | Used by analyzer.ts, 3 tests pass |
| `packages/skills-harness/src/guard/tribal-loader.ts` | Tribal knowledge patterns | VERIFIED | Loads from .sun/tribal/ via FileStoreApi |
| `packages/skills-harness/src/index.ts` | Barrel export of all 7 skills | VERIFIED | 55 lines, exports settingsSkill, samplePromptSkill, initSkill, lintSkill, healthSkill, agentsSkill, guardSkill + type re-exports |
| `packages/skills-harness/dist/index.js` | Built output for npm | VERIFIED | Build succeeds (FULL TURBO cached), dist/ contains .js + .d.ts for all skills |
| `packages/cli/src/cli.ts` | CLI wiring of all 7 skills | VERIFIED | Imports all 7 skills from @sunco/skills-harness, registers in preloadedSkills array |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| init.skill.ts | ecosystem-detector.ts | `import { detectEcosystems }` | WIRED | Called in Promise.all with detectLayers, extractConventions |
| init.skill.ts | workspace-initializer.ts | `import { initializeWorkspace }` | WIRED | Called with initResult + fileStore + force |
| lint.skill.ts | lint/runner.ts | `import { runLint }` | WIRED | Called with files + boundariesConfig + cwd |
| lint.skill.ts | lint/formatter.ts | `import { formatViolations, formatForTerminal, formatForJson }` | WIRED | Used for output enrichment |
| lint.skill.ts | core state | `ctx.state.get('init.result')` | WIRED | Reads InitResult from state engine |
| health.skill.ts | health/reporter.ts | `import { computeHealthScore }` | WIRED | Called with freshness + patternScore + conventionScore |
| health/pattern-tracker.ts | core state | `state.set('health.snapshot.*')` | WIRED | Stores snapshot with ISO timestamp key |
| agents.skill.ts | agents/doc-analyzer.ts | `import { analyzeAgentDoc }` | WIRED | Called for each found agent doc |
| agents/suggestion-engine.ts | agents/types.ts | `import { AgentDocSuggestion }` | WIRED | Produces AgentDocSuggestion[] from metrics |
| guard/watcher.ts | chokidar | `import { watch } from 'chokidar'` | WIRED | Creates chokidar.watch() with debounce config |
| guard/incremental-linter.ts | ESLint | Uses ESLint class | WIRED | lintText for single-file incremental lint |
| index.ts | all 7 skill files | `export { default as *Skill }` | WIRED | All 7 skills re-exported from barrel |
| cli.ts | @sunco/skills-harness | `import { settingsSkill, ... }` | WIRED | All 7 skills imported and registered in preloadedSkills array |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| init.skill.ts | ecosystems/layers/conventions | detectEcosystems/detectLayers/extractConventions | Yes -- scans filesystem markers, directories, file contents | FLOWING |
| lint.skill.ts | initResult | ctx.state.get('init.result') | Yes -- reads from SQLite state (set by init skill) | FLOWING |
| health.skill.ts | freshness/patterns/conventionResult | checkFreshness/trackPatterns/scoreConventions | Yes -- scans filesystem mtimes, regex-scans source files | FLOWING |
| agents.skill.ts | docs/metrics | analyzeAgentDoc -> readFile | Yes -- reads actual CLAUDE.md file contents | FLOWING |
| guard.skill.ts | initResult | ctx.state.get('init.result') | Yes -- reads from SQLite state | FLOWING |
| guard/watcher.ts | events | chokidar.watch() file system events | Yes -- real-time OS filesystem events | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds | `npx turbo build` | 5/5 packages successful (FULL TURBO) | PASS |
| All tests pass | `npx vitest run --project=@sunco/skills-harness` | 21 test files, 136 tests passed (4.26s) | PASS |
| CLI shows all 7 skills | `node packages/cli/dist/cli.js --help` | agents, guard, health, init, lint, sample-prompt, settings visible | PASS |
| Boundary violation detection | runner.test.ts "detects dependency direction violation" | 580ms, confirms ESLint with boundaries plugin catches UI->infra import | PASS |
| Pattern tracking with trends | pattern-tracker.test.ts | Counts any-type occurrences, stores snapshots, computes increasing/stable trends | PASS |
| Agent doc analysis | efficiency-scorer.test.ts | Returns 100 for optimal 30-line doc; returns <50 for 200-line doc with contradictions | PASS |
| Chokidar watcher lifecycle | watcher.test.ts | Creates watcher with correct options, fires callbacks, stopWatcher closes cleanly | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| HRN-01 | 02-01, 02-08 | sunco init -- 15+ ecosystem detection | SATISFIED | 19 markers, 15 unique ecosystems in ECOSYSTEM_MARKERS |
| HRN-02 | 02-01, 02-08 | sunco init -- directory -> layer pattern detection | SATISFIED | COMMON_LAYER_PATTERNS with 7 layers, dependency direction rules |
| HRN-03 | 02-01, 02-08 | sunco init -- convention extraction | SATISFIED | Naming/import/export/test detection via regex sampling |
| HRN-04 | 02-02, 02-08 | sunco init -- .sun/ workspace + rules + presets | SATISFIED | workspace-initializer.ts writes config.toml + arch-layers.json + scaffold |
| HRN-05 | 02-02, 02-03 | sunco lint -- init layers -> ESLint boundaries rules | SATISFIED | config-generator.ts converts DetectedLayer[] to BoundariesConfig |
| HRN-06 | 02-03, 02-08 | sunco lint -- dependency direction violation checking | SATISFIED | runner.ts executes ESLint with boundaries/dependencies rule, default: disallow |
| HRN-07 | 02-04, 02-08 | sunco lint -- agent-readable fix instructions | SATISFIED | formatter.ts generates fix_instruction with layer names and allowed imports |
| HRN-08 | 02-04, 02-08 | sunco lint -- 100% deterministic + --fix | SATISFIED | kind: 'deterministic', fixer.ts runs ESLint with fix=true |
| HRN-09 | 02-05, 02-08 | sunco health -- document freshness | SATISFIED | freshness-checker.ts compares doc/code mtimes + broken references |
| HRN-10 | 02-05, 02-08 | sunco health -- anti-pattern tracking + trends | SATISFIED | pattern-tracker.ts with 6 anti-patterns, SQLite snapshots, trend computation |
| HRN-11 | 02-05, 02-08 | sunco health -- score-based report | SATISFIED | reporter.ts weighted composite 0-100, terminal table with trend arrows |
| HRN-12 | 02-06, 02-08 | sunco agents -- doc analysis + efficiency score + 60-line check | SATISFIED | doc-analyzer.ts extracts metrics, efficiency-scorer.ts computes 0-100, lineCountWarning at >60 |
| HRN-13 | 02-06, 02-08 | sunco agents -- analyze only, no auto-generation | SATISFIED | Never writes files, uses only readFile + access. Comment: "Per D-18: Read-only" |
| HRN-14 | 02-07, 02-08 | sunco guard -- anti-pattern -> lint rule promotion | SATISFIED | promoter.ts tracks frequency, suggests promotion at threshold, maps to ESLint rules |
| HRN-15 | 02-07, 02-08 | sunco guard -- auto-lint on change | SATISFIED | incremental-linter.ts runs ESLint lintText on single files in watch callback |
| HRN-16 | 02-07, 02-08 | sunco guard -- watch mode with chokidar | SATISFIED | watcher.ts uses chokidar.watch() with awaitWriteFinish debounce, persistent: true |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No blocker or warning anti-patterns found. TODO/FIXME matches are in regex pattern definitions (anti-pattern detectors themselves) and test fixtures, not actual placeholder code. return null/return [] matches are legitimate sentinel values for not-found/empty-input cases. |

### Human Verification Required

### 1. End-to-End sunco init on Real Project

**Test:** Run `sunco init` on a TypeScript project with src/services/, src/ui/, src/types/ directories
**Expected:** .sun/config.toml created with detected ecosystems and layers; .sun/rules/arch-layers.json generated with correct boundary rules
**Why human:** Requires a real project directory structure to confirm filesystem integration works end-to-end

### 2. Lint Message Quality Assessment

**Test:** Run `sunco lint` on a project with known layer violations (e.g., UI importing directly from infra)
**Expected:** Error messages include specific layer names, allowed imports, and actionable fix instructions
**Why human:** Message clarity and usefulness for both humans and agents requires qualitative judgment

### 3. Health Report Visual Inspection

**Test:** Run `sunco health` on this repository
**Expected:** Terminal table with category scores, trend arrows, and overall 0-100 score
**Why human:** Terminal formatting and score meaningfulness require visual confirmation

### 4. Agent Doc Suggestion Quality

**Test:** Run `sunco agents` on this project's CLAUDE.md (which is >60 lines)
**Expected:** Line count warning, efficiency score, specific suggestions with line numbers for any contradictions
**Why human:** Suggestion specificity and actionability require human evaluation

### 5. Guard Watch Mode Interactive Test

**Test:** Run `sunco guard --watch`, then modify a .ts file to add `console.log` or `: any`
**Expected:** Real-time detection of the anti-pattern, printed inline. Ctrl+C stops cleanly.
**Why human:** Real-time behavior and clean shutdown require interactive testing

### Gaps Summary

No gaps found. All 5 observable truths are verified. All 16 requirements (HRN-01 through HRN-16) are satisfied with implementation evidence. All artifacts exist, are substantive (no stubs), are wired (imported and used), and have data flowing through them. Build passes. All 136 tests pass. CLI registers all 7 skills. No blocker anti-patterns detected.

The only items requiring attention are the 5 human verification tests listed above, which cover end-to-end runtime behavior that cannot be confirmed programmatically without starting the CLI against a real project.

---

_Verified: 2026-03-28T17:50:00Z_
_Verifier: Claude (gsd-verifier)_
