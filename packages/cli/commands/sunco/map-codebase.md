---
name: sunco:map-codebase
description: Analyze codebase by spawning 4 parallel mapper agents — tech stack, architecture, conventions, and concerns. Produces .planning/codebase/ documents for agent context.
argument-hint: "[path] [--update]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
---

<context>
**Arguments:**
- `[path]` — Root path to analyze. Default: current directory.

**Flags:**
- `--update` — Update existing map documents rather than regenerating.
</context>

<objective>
Deep codebase mapping via 4 parallel agents. Each agent specializes in one dimension and produces a structured document. Results are stored in `.planning/codebase/` for use by planning and execution agents.

**Creates in `.planning/codebase/`:**
- `tech-stack.md` — language versions, framework choices, dependencies, build tooling
- `architecture.md` — module structure, data flow, patterns, entry points
- `conventions.md` — naming, import style, TypeScript usage, commit format
- `concerns.md` — tech debt, security issues, performance bottlenecks, breaking risks
</objective>

<process>
## Step 1: Check existing map

```bash
ls .planning/codebase/ 2>/dev/null
```

If exists and `--update` NOT in $ARGUMENTS: ask "Map exists. Update? [yes/no]"

## Step 2: Quick scan for context

```bash
# Structure overview
ls packages/ 2>/dev/null
cat package.json 2>/dev/null | head -30
git log --oneline -5
```

## Step 3: Spawn 4 parallel mapper agents

**Agent name:** `sunco-mapper` — description: `Map: [focus]`

**Agent 1 — Tech Stack mapper:**
"Map the tech stack of this codebase.

Read: package.json, all packages/*/package.json, tsconfig files, build config files.

Document:
1. Primary language + version + configuration
2. Runtime environment
3. CLI framework (name, version, why chosen based on package.json)
4. Build tooling (bundler, transpiler)
5. Test framework
6. Key runtime dependencies with purpose
7. Dev dependencies with purpose
8. Notable version choices or constraints

Format as: .planning/codebase/tech-stack.md"

**Agent 2 — Architecture mapper:**
"Map the architecture of this codebase.

Read: all package directories, index.ts files, key source files (read at least 10).

Document:
1. Package/module structure (list each package with purpose)
2. Key architectural patterns in use (describe specifically, not generically)
3. Data flow: how does information flow between packages?
4. Entry points: where does execution start?
5. Extension points: where can new functionality be added?
6. Dependency graph between packages

Format as: .planning/codebase/architecture.md"

**Agent 3 — Conventions mapper:**
"Map the coding conventions of this codebase.

Read: 15+ source files across different packages. Read CLAUDE.md if exists.

Document:
1. File naming patterns (with examples from actual files)
2. Import patterns (ESM/CJS, path conventions, extension usage)
3. TypeScript patterns (how strict? common type patterns? generics usage?)
4. Function/class naming conventions (camelCase? what prefix patterns?)
5. Error handling patterns (how are errors handled consistently?)
6. Async patterns (Promise vs async/await vs callbacks?)
7. Comment style
8. Commit message format (from git log)

For each: cite a specific example file.

Format as: .planning/codebase/conventions.md"

**Agent 4 — Concerns mapper:**
"Map the concerns and risks in this codebase.

Read: source files looking for issues. Run: git log --oneline -30.

Document:
1. Tech debt (TODO/FIXME/HACK comments — cite file:line)
2. Security concerns (hardcoded values, unvalidated input, dangerous patterns)
3. Missing test coverage (important code paths without tests)
4. Performance concerns (obvious bottlenecks, large loops, sync operations)
5. Breaking change risks (public APIs that look unstable, version mismatches)
6. Dependency risks (outdated packages, abandoned packages, license issues)

Format as: .planning/codebase/concerns.md"

## Step 4: Create index

Write `.planning/codebase/INDEX.md`:
```markdown
# Codebase Map

Generated: [timestamp]

## Quick Facts
- Language: [from tech-stack]
- Packages: [N]
- Architecture: [key pattern from architecture]

## Documents
- [tech-stack.md](tech-stack.md)
- [architecture.md](architecture.md)
- [conventions.md](conventions.md)
- [concerns.md](concerns.md)

## Top Concerns
[3 most important from concerns.md]
```

## Step 5: Report

Show: "Codebase mapped. 4 documents in .planning/codebase/"
List top 3 findings from concerns.md.
</process>
