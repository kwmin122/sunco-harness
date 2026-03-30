---
phase: 14-context-optimization
plan: 02
subsystem: workflow
tags: [code-graph, dependency-analysis, blast-radius, regex, typescript, python, go]

requires:
  - phase: 01-core-platform
    provides: defineSkill, FileStore, ctx.ui, ctx.state, skill registration patterns
  - phase: 03-standalone-ts-skills
    provides: barrel export/tsup/CLI registration patterns
  - phase: 10-debugging
    provides: workflow skill patterns (query.skill.ts reference for deterministic skills)

provides:
  - CodeGraph class with pure regex import parsing for TS/JS/Python/Go
  - Blast radius BFS analysis returning directDeps + transitiveDeps
  - .sun/graph.json persistent caching with builtAt timestamp
  - sunco graph CLI command with --blast, --stats, --rebuild flags
  - 28-test suite covering all parser/resolver/BFS code paths

affects:
  - context optimization (future plans that need relevance-based file selection)
  - agent cost reduction (knowing which files are affected limits what goes into prompts)

tech-stack:
  added: []
  patterns:
    - "CodeGraph.fromJSON/toJSON for in-memory graph persistence without external DB"
    - "BFS with visited Set for cycle-safe blast radius traversal"
    - ".js-to-.ts import resolution for TypeScript ESM projects"
    - "static scanFiles() utility co-located in CodeGraph for skill consumption"

key-files:
  created:
    - packages/skills-workflow/src/shared/code-graph.ts
    - packages/skills-workflow/src/__tests__/code-graph.test.ts
    - packages/skills-workflow/src/graph.skill.ts
  modified:
    - packages/skills-workflow/src/index.ts
    - packages/skills-workflow/tsup.config.ts
    - packages/cli/src/cli.ts

key-decisions:
  - "JSON persistence via writeFile to .sun/graph.json (not ctx.state) — graph is large, flat file is simpler"
  - "BFS separates direct (depth=1) from transitive (depth>=2) deps at collection time, not post-hoc"
  - "resolveImport strips .js -> tries .ts first for TypeScript ESM projects (common pattern in this codebase)"
  - "Dynamic import('simple-git') in detectGitChangedFiles for graceful degradation when git not available"
  - "simple-git named import { simpleGit } consistent with existing codebase pattern (not default import)"
  - "CodeGraph.scanFiles() as static method co-located in code-graph.ts (skill consumes it without re-implementing)"

patterns-established:
  - "Regex-only import parsing: TS/JS (ES6 + require + dynamic), Python (from/import), Go (single/block)"
  - "Graph build = file scan + content parse + edge resolution in one async build() call"
  - "Blast radius test pattern: build graph from in-memory nodes/edges via fromJSON, run blastRadius, assert"

requirements-completed: [CTX-01]

duration: 12min
completed: 2026-03-29
---

# Phase 14 Plan 02: Code Knowledge Graph Summary

**Zero-dependency code dependency graph with BFS blast radius — pure regex import parsing for TS/JS/Python/Go, persisted to .sun/graph.json, wired as `sunco graph` CLI command**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-29T17:30:00Z
- **Completed:** 2026-03-29T17:42:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- CodeGraph class with regex-based import parser covering TypeScript, JavaScript, Python, and Go
- BFS blast radius algorithm separating direct (depth=1) from transitive (depth>=2) dependents with cycle safety
- 28-test suite covering all major code paths (parseImports x 11, resolveImport x 5, blastRadius x 6, serialization x 2, stats x 1, parseExports x 3)
- `sunco graph` skill registered with --blast, --stats, --rebuild flags
- Graph persistence to .sun/graph.json with builtAt timestamp for cache invalidation

## Task Commits

1. **Task 1: CodeGraph — import parser + blast radius** - `d8aca92` (feat)
2. **Task 2: sunco graph skill + CLI registration** - `af946d8` (feat)

## Files Created/Modified

- `packages/skills-workflow/src/shared/code-graph.ts` - CodeGraph class: parseImports, resolveImport, blastRadius, toJSON/fromJSON, scanFiles
- `packages/skills-workflow/src/__tests__/code-graph.test.ts` - 28 tests, all in-memory (no filesystem I/O)
- `packages/skills-workflow/src/graph.skill.ts` - `sunco graph` deterministic skill with cache + blast + stats modes
- `packages/skills-workflow/src/index.ts` - Added graphSkill export
- `packages/skills-workflow/tsup.config.ts` - Added graph.skill.ts build entry
- `packages/cli/src/cli.ts` - Imported and registered graphSkill in preloadedSkills

## Decisions Made

- JSON persistence to .sun/graph.json via direct writeFile (not ctx.state) — graph data can be large, flat file with JSON.stringify is simpler and more inspectable
- BFS separates direct vs transitive deps at collection time rather than in a post-processing pass
- resolveImport strips `.js` and retries `.ts` first, matching this codebase's ESM TypeScript import style
- Dynamic import for simple-git in detectGitChangedFiles so the skill degrades gracefully when git is unavailable
- Used `{ simpleGit }` named import consistent with the rest of the codebase (not `{ default: simpleGit }` which caused a TypeScript DTS error)
- CodeGraph.scanFiles() is a static method on the class rather than a standalone utility, keeping the graph module self-contained

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed simple-git dynamic import pattern**
- **Found during:** Task 2 (graph.skill.ts build)
- **Issue:** Used `{ default: simpleGit }` in dynamic import — simple-git exports a named `simpleGit` function, not a default export. TypeScript DTS build emitted error: "Type 'typeof import(simple-git)' has no call signatures."
- **Fix:** Changed to `const { simpleGit } = await import('simple-git')` matching the pattern used in verify.skill.ts, review.skill.ts, and all other skills in this codebase
- **Files modified:** packages/skills-workflow/src/graph.skill.ts
- **Verification:** `npx turbo build` succeeded after fix
- **Committed in:** af946d8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Single import pattern correction, no scope change.

## Issues Encountered

None beyond the auto-fixed simple-git import.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CodeGraph is ready for use by any future context-optimization skill (e.g., a skill that uses blast radius to select only relevant files before agent dispatch)
- The `sunco graph --blast <files>` command can be called from CLI immediately to see blast radius of any changed file
- Graph is cached in .sun/graph.json and reused across calls; use --rebuild to refresh

---
*Phase: 14-context-optimization*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: packages/skills-workflow/src/shared/code-graph.ts
- FOUND: packages/skills-workflow/src/__tests__/code-graph.test.ts
- FOUND: packages/skills-workflow/src/graph.skill.ts
- FOUND: .planning/phases/14-context-optimization/14-02-SUMMARY.md
- FOUND: d8aca92 (Task 1 commit)
- FOUND: af946d8 (Task 2 commit)
