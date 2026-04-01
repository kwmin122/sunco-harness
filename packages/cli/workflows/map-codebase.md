# Map Codebase Workflow

Parallel codebase analysis using 4 focused agents. Each agent investigates a different dimension of the codebase and writes structured output. Results are aggregated into a unified codebase map. Used by `/sunco:map-codebase`.

---

## Overview

Four parallel agents, each focused on a specific lens:

| Agent | Focus | Output file |
|-------|-------|-------------|
| 1 | Tech stack and dependencies | `.planning/codebase/tech-stack.md` |
| 2 | Architecture and structure | `.planning/codebase/architecture.md` |
| 3 | Conventions and patterns | `.planning/codebase/conventions.md` |
| 4 | Concerns and risks | `.planning/codebase/concerns.md` |

Aggregated output: `.planning/codebase/CODEBASE-MAP.md`

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--focus <area>` | `FOCUS_FILTER` | unset (run all 4) |
| `--depth <N>` | `DEPTH` | `3` |
| `--update` | `UPDATE_MODE` | false |
| `--no-aggregate` | `NO_AGGREGATE` | false |

Valid focus areas: `tech-stack`, `architecture`, `conventions`, `concerns`.

If `--focus` is set: run only the specified agent, skip aggregation unless `CODEBASE-MAP.md` exists.

If `--update`: re-run all agents even if `.planning/codebase/` already has files. Default behavior skips agents whose output file already exists and is younger than 24 hours.

---

## Step 2: Initialize

### Create output directory

```bash
mkdir -p .planning/codebase/
```

### Detect project root

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

### Gather minimal context for agents

```bash
# Package structure
ls -la "${PROJECT_ROOT}/packages/" 2>/dev/null || ls -la "${PROJECT_ROOT}/src/" 2>/dev/null

# Package.json at root
cat "${PROJECT_ROOT}/package.json" 2>/dev/null | head -60

# TypeScript config
cat "${PROJECT_ROOT}/tsconfig.json" 2>/dev/null

# Known config files
ls "${PROJECT_ROOT}/"*.toml "${PROJECT_ROOT}/"*.config.ts "${PROJECT_ROOT}/"*.config.js 2>/dev/null

# Git info
git log --oneline -10
git branch --show-current
```

Collect this metadata as `INITIAL_CONTEXT` — passed to each agent in its prompt.

### Check for existing maps (staleness check)

```bash
for focus in tech-stack architecture conventions concerns; do
  FILE=".planning/codebase/${focus}.md"
  if [[ -f "$FILE" && "${UPDATE_MODE}" != "true" ]]; then
    AGE=$(( $(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE") ))
    if [[ $AGE -lt 86400 ]]; then
      echo "Skipping ${focus} — output exists and is less than 24h old. Use --update to re-run."
      SKIP_${focus//-/_}=true
    fi
  fi
done
```

---

## Step 3: Spawn 4 Parallel Agents

Spawn all agents simultaneously. Each agent is autonomous — reads code directly, writes its own output file, returns a brief summary.

### Agent 1 — Tech Stack Mapper

**Focus:** What technologies are actually used (not just listed in package.json).

```
You are sunco-codebase-mapper analyzing the tech stack of this project.

Context from the orchestrator:
{INITIAL_CONTEXT}

Your job:
Analyze the actual technology use — not just what is declared, but what is actively
used in source code. Check for discrepancies between declared and actual usage.

Investigate:
1. Runtime and language versions (check .nvmrc, .node-version, engines field, tsconfig target)
2. All production dependencies from package.json files in packages/
3. All dev dependencies and build tooling
4. Which dependencies are actually imported in source code (cross-reference with grep)
5. Dependencies declared but never imported (dead weight)
6. Unlisted dependencies that appear in imports (missing declarations)
7. Version constraints — are any pinned, semver-ranged, or floating?
8. Dual package structure: CJS + ESM? Single format?
9. Build pipeline: what transforms what to what?

Write your findings to .planning/codebase/tech-stack.md using this structure:

# Tech Stack

Generated: {ISO timestamp}

## Runtime
- Node.js: {version or constraint}
- TypeScript: {version}
- Package manager: {npm/pnpm/yarn} {version}

## Production Dependencies

| Package | Declared Version | Actual Usage | Notes |
|---------|-----------------|--------------|-------|
| {name} | {version} | {used in N files} | {any note} |

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| {name} | {what it does} |

## Dead Dependencies (declared but not imported)
- {package}: appears in package.json but never imported in source

## Undeclared Dependencies (imported but not in package.json)
- {package}: imported in {file} but not declared

## Build Pipeline
{describe: source → transform → output, which tools, which config}

## Version Concerns
{Any floating versions, known breaking changes upcoming, major version mismatches}
```

### Agent 2 — Architecture Mapper

**Focus:** How the code is organized and how parts relate to each other.

```
You are sunco-codebase-mapper analyzing the architecture of this project.

Context from the orchestrator:
{INITIAL_CONTEXT}

Your job:
Map the structural architecture — package layout, module hierarchy, dependency
direction, and the main data flows through the system.

Investigate:
1. Top-level directory structure (packages/, apps/, libs/)
2. Each package: purpose, public API (index.ts exports), internal structure
3. Inter-package dependencies (what imports what)
4. Dependency direction: does infra import from domain? Are there circular imports?
5. Entry points: CLI entry, library entry, test entry
6. State: where is state stored, how does it flow?
7. Plugin/skill/extension system: how are extensions registered?
8. Config loading: where does config come from, how is it resolved?
9. Key interfaces and contracts (TypeScript interfaces that cross package boundaries)

Write your findings to .planning/codebase/architecture.md using this structure:

# Architecture

Generated: {ISO timestamp}

## Package Overview

| Package | Purpose | Public API size | Key exports |
|---------|---------|----------------|-------------|
| {name} | {purpose} | {N exports} | {main exports} |

## Dependency Graph

{ASCII diagram or table showing which package imports from which}

Example:
cli → core, skills-harness, skills-workflow
skills-workflow → core
skills-harness → core
core → (no internal deps)

## Dependency Direction Violations
{Any upward deps that violate the intended layering}
- {package A} imports from {package B} (should be the reverse)

## Data Flow

{How data flows from entry to output:}
1. CLI invocation (Commander.js parses args)
2. Skill resolved by registry
3. Skill executed with context
4. State updated
5. Output rendered

## Key Interfaces

{TypeScript interfaces that cross package boundaries:}
- `SkillDefinition` — defined in core, consumed by cli and skills-*
- `SkillContext` — passed to every skill handler

## Config Loading Chain
{How config is resolved: env → global → project → dir}

## Extension Points
{Where the codebase is designed to be extended by third parties}
```

### Agent 3 — Conventions Mapper

**Focus:** Implicit and explicit patterns that exist in the code.

```
You are sunco-codebase-mapper analyzing the conventions and patterns of this project.

Context from the orchestrator:
{INITIAL_CONTEXT}

Your job:
Identify the coding conventions — both documented and discovered through reading the code.
These are the rules that new contributors or AI agents need to follow to fit in.

Investigate:
1. File naming conventions (camelCase, kebab-case, feature.type.ts, etc.)
2. Import style (relative, absolute, barrel, .js extension in TS, etc.)
3. Export patterns (named, default, barrel index.ts, etc.)
4. TypeScript patterns (interfaces vs types, generics style, strict settings)
5. Error handling style (try/catch, Result types, throws, error codes)
6. Async patterns (async/await, Promise chains, generators, streams)
7. Test structure (describe/it, test file location, naming, fixtures)
8. Commit message format (conventional commits? custom?)
9. Comment style (JSDoc, inline, block, TODO format)
10. Configuration pattern (TOML, JSON, env vars, which for what)
11. Any linting rules that encode conventions (read .eslintrc or eslint.config.*)

Write your findings to .planning/codebase/conventions.md using this structure:

# Conventions

Generated: {ISO timestamp}

## File Naming

| Pattern | Example | Used for |
|---------|---------|---------|
| {pattern} | {example} | {what type of file} |

## Import Style
{Describe the import conventions with examples from actual code}

## Export Pattern
{Describe export conventions with examples}

## TypeScript Style
{Key TS patterns observed}

## Error Handling
{How errors are represented and propagated}

## Testing Conventions
{Test file location, naming, structure, patterns}

## Commit Format
{Observed or declared commit message format}

## Linting Rules (key constraints)
{Rules that encode significant architectural or style choices}

## Anti-Patterns (things found in old code that should not be replicated)
{Any deprecated patterns observed — what to do instead}
```

### Agent 4 — Concerns Mapper

**Focus:** Risks, gaps, technical debt, and concerns.

```
You are sunco-codebase-mapper identifying concerns and risks in this codebase.

Context from the orchestrator:
{INITIAL_CONTEXT}

Your job:
Identify technical risks, quality concerns, and improvement opportunities. Be specific
and evidence-based — cite files and line numbers where possible.

Investigate:
1. Type safety: use of `any`, `@ts-ignore`, `as unknown as X` bypasses
2. Error handling gaps: unhandled promises, missing try/catch around I/O
3. Test coverage: files with no corresponding test file, complex functions untested
4. Circular dependencies: mutual imports between modules
5. Performance hotspots: synchronous I/O in hot paths, N+1 patterns, large payloads
6. Security surface: exec/spawn with user input, path traversal risks, env var leakage
7. Outdated patterns: deprecated APIs, unmaintained dependencies
8. Missing documentation: exported APIs with no JSDoc, complex functions undocumented
9. Configuration risk: hardcoded values that should be configurable
10. Dead code: unreachable branches, exported symbols never imported externally

Write your findings to .planning/codebase/concerns.md using this structure:

# Concerns

Generated: {ISO timestamp}

## High Priority

| Concern | Location | Impact | Effort to fix |
|---------|----------|--------|---------------|
| {description} | {file:line} | {what breaks} | {S/M/L} |

## Medium Priority

| Concern | Location | Impact | Effort to fix |
|---------|----------|--------|---------------|
| {description} | {file:line} | {what breaks} | {S/M/L} |

## Low Priority / Future

| Concern | Location | Notes |
|---------|----------|-------|
| {description} | {file:line} | {why it matters eventually} |

## Positive Observations
{Things that are notably well-done — for calibration}

## Recommendations
{Top 3 actionable improvements, in priority order}
1. {action} — fixes {concern}, estimated effort {S/M/L}
2. ...
3. ...
```

---

## Step 4: Wait for All Agents

Wait for all spawned agents to complete. Each agent writes its output file directly.

### Spot-check outputs

After agents complete:

```bash
for focus in tech-stack architecture conventions concerns; do
  FILE=".planning/codebase/${focus}.md"
  if [[ -f "$FILE" ]]; then
    LINES=$(wc -l < "$FILE")
    echo "${focus}: ${LINES} lines — OK"
  else
    echo "${focus}: MISSING — agent may have failed"
  fi
done
```

If any file is missing: report which agent failed. Do not proceed to aggregation for that focus area. Report which sections of the CODEBASE-MAP.md will be incomplete.

---

## Step 5: Aggregate Results

Unless `--no-aggregate` was set, build the unified CODEBASE-MAP.md.

Read all 4 output files. Extract the key information from each.

### Write CODEBASE-MAP.md

```markdown
# Codebase Map

Project: {project_name}
Generated: {ISO timestamp}
Agents run: {N}/4

---

## Executive Summary

{2-3 paragraph overview synthesized from all 4 agents:
- What kind of codebase this is
- Its primary architectural pattern
- Top 1-2 concerns worth knowing immediately
- Overall quality assessment}

---

## Tech Stack

{Condensed from tech-stack.md — runtime, key deps, build pipeline}

Full details: `.planning/codebase/tech-stack.md`

---

## Architecture

{Condensed from architecture.md — package overview, dependency graph, key interfaces}

Full details: `.planning/codebase/architecture.md`

---

## Conventions

{Condensed from conventions.md — top conventions an agent must follow}

Full details: `.planning/codebase/conventions.md`

---

## Concerns

{Top concerns from concerns.md — high priority only}

Full details: `.planning/codebase/concerns.md`

---

## Quick Reference

| Question | Answer |
|----------|--------|
| Entry point | {file} |
| Config file | {file} |
| State location | {path} |
| Test runner | {command} |
| Build command | {command} |
| Lint command | {command} |
| Add a skill | {how} |
```

Commit the output:

```bash
git add .planning/codebase/
git commit -m "docs(codebase): update codebase map — 4 agents"
```

---

## Step 6: Report

```
Codebase map complete.

  Output: .planning/codebase/CODEBASE-MAP.md
  Agents: 4/4 completed

  Top findings:
  - Tech: {1 line from tech-stack agent summary}
  - Architecture: {1 line from architecture agent summary}
  - Conventions: {1 line from conventions agent summary}
  - Concerns: {top concern from concerns agent}

Read the full map: .planning/codebase/CODEBASE-MAP.md
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Agent fails to write output | Report missing file, skip aggregation for that section |
| No packages/ or src/ directory | Agents receive root as scan target |
| No git repository | Skip git-based sections in architecture and conventions |
| All 4 agents fail | Report systemic failure, suggest running with `--focus tech-stack` to debug |

---

## Route

After mapping:
- If high-priority concerns found: "Run `/sunco:health` for a structured health score."
- If mapping was requested before a phase: "Use the codebase map as context for `/sunco:discuss {N}`."
- If uncovered dependencies found: "Run `/sunco:quick 'add {package} to package.json'` to fix missing declarations."
