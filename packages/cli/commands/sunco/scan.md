---
name: sunco:scan
description: Analyze an existing codebase and produce 7 structured documents in .sun/codebase/. Use before starting work on an existing project to build full context.
argument-hint: "[path] [--update] [--focus <area>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
---

<context>
**Arguments:**
- `[path]` — Root path to scan. Default: current directory.

**Flags:**
- `--update` — Update existing scan documents rather than regenerating from scratch.
- `--focus <area>` — Scan only one area: stack | architecture | conventions | security | debt | api | tests
</context>

<objective>
Analyze the full codebase and produce 7 structured documents for agent context. Run this before using any other sunco command on an existing project.

**Creates in `.sun/codebase/`:**
1. `tech-stack.md` — languages, frameworks, versions, dependencies
2. `architecture.md` — module structure, data flow, key patterns
3. `conventions.md` — naming, imports, code style, commit format
4. `api-contracts.md` — exported interfaces, CLI commands, API endpoints
5. `test-coverage.md` — test strategy, coverage gaps, testing patterns
6. `tech-debt.md` — TODO/FIXME/HACK comments, known issues, legacy code
7. `security-notes.md` — auth patterns, input validation, secrets handling
</objective>

<process>
## Step 1: Check existing scan

```bash
ls .sun/codebase/ 2>/dev/null
```

If documents exist and `--update` NOT in $ARGUMENTS: ask "Scan exists from [date]. Update it? [yes/no]"

## Step 2: Quick structural scan

```bash
# File counts by type
find . -name "*.ts" -not -path "*/node_modules/*" | wc -l
find . -name "*.test.ts" -not -path "*/node_modules/*" | wc -l

# Package structure
ls packages/ 2>/dev/null

# Dependencies
cat package.json | head -50
```

## Step 3: Parallel agent scan

Spawn parallel agents for each document (or just the focused one if --focus):

**Agent name:** `sunco-scanner` — description: `Scan: [document]`

**Agent 1 — Tech Stack:**
"Scan this codebase. Read package.json files in all packages. Document:
- Primary language and version
- Framework choices with versions
- Build tooling
- Test framework
- Notable dependencies and why they're there
Format: .sun/codebase/tech-stack.md"

**Agent 2 — Architecture:**
"Analyze the codebase structure. Read the top-level packages and key source files.
Document:
- Package/module structure with purpose of each
- Key architectural patterns in use
- Data flow between components
- Entry points and how the system starts
Format: .sun/codebase/architecture.md"

**Agent 3 — Conventions:**
"Read 10-15 source files across different packages. Document:
- File naming conventions
- Import patterns (ESM/CJS, paths)
- Code style patterns
- TypeScript usage patterns
- Commit message format (from recent git log)
Format: .sun/codebase/conventions.md"

**Agent 4 — API Contracts:**
"Find all exported interfaces, types, and functions. Find all CLI commands.
Document:
- Public API surface (functions, types, interfaces)
- CLI command structure
- Configuration schema
Format: .sun/codebase/api-contracts.md"

**Agent 5 — Tests:**
"Find all test files. Analyze:
- Test framework and patterns used
- Coverage by package (rough estimate)
- Mocking patterns
- Integration vs unit test balance
- Notable gaps (critical code paths without tests)
Format: .sun/codebase/test-coverage.md"

**Agent 6 — Tech Debt:**
"Search for TODO, FIXME, HACK, XXX, TEMP, WORKAROUND comments.
Also look for: deprecated patterns, large files, high complexity functions.
Document each with location and estimated effort.
Format: .sun/codebase/tech-debt.md"

**Agent 7 — Security:**
"Review for security patterns:
- Authentication and authorization
- Input validation
- Secrets/credentials handling (flag any hardcoded secrets)
- Network request patterns
- File system access patterns
Format: .sun/codebase/security-notes.md"

## Step 4: Create codebase index

Write `.sun/codebase/INDEX.md`:
```markdown
# Codebase Scan

## Generated
[timestamp]

## Project
[name from package.json]

## Quick Stats
- TypeScript files: [N]
- Test files: [N]
- Packages: [N]

## Documents
- [tech-stack.md](tech-stack.md)
- [architecture.md](architecture.md)
- [conventions.md](conventions.md)
- [api-contracts.md](api-contracts.md)
- [test-coverage.md](test-coverage.md)
- [tech-debt.md](tech-debt.md)
- [security-notes.md](security-notes.md)
```

## Step 5: Report

Show: "Codebase scan complete. 7 documents in .sun/codebase/"
List key findings (top 3 per category).
</process>
