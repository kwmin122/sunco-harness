# Phase 3: Standalone TS Skills - Research

**Researched:** 2026-03-28
**Domain:** Deterministic CLI skills -- session management, idea capture, phase control, settings, progress tracking
**Confidence:** HIGH

## Summary

Phase 3 builds 7 deterministic skills on top of Phase 1's Core Platform infrastructure. All 14 requirements (SES-01 through SES-05, IDX-01 through IDX-04, PHZ-01 through PHZ-03, SET-01, WF-08) are purely deterministic -- zero LLM cost, instant response. The foundational building blocks are fully in place: `defineSkill()` factory, `StateApi` (SQLite), `FileStoreApi` (flat files), `RecommenderEngine` (30 rules), `SkillUi` (Ink), and the CLI lifecycle with dual skill loading.

The primary complexity lies in three areas: (1) markdown parsing/rewriting for ROADMAP.md in the phase management skill, (2) enhancing the existing `settings.skill.ts` with interactive Ink tree-view UI, and (3) the HANDOFF.json session persistence mechanism. All other skills (status, note, todo, seed, backlog, next, context) are straightforward CRUD operations against StateApi and FileStoreApi.

**Primary recommendation:** Use the existing `packages/skills-workflow` package (currently empty) as the home for all Phase 3 skills. These are workflow/session skills, not harness skills. Each skill is a separate `*.skill.ts` file following the established pattern. Share utility functions (markdown parsing, HANDOFF generation) as module-internal helpers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `sunco status` reads .planning/ROADMAP.md + .planning/STATE.md to show: current phase, plan progress, what's done, what's next. Pure file parsing -- no database queries needed beyond StateApi.
- **D-02:** Visual progress uses Ink components: phase progress bar, plan checklist with checkmarks, "Next Best Action" recommendation at bottom.
- **D-03:** `sunco status` also serves as the entry point for `sunco progress` (WF-08) -- same skill, aliased command.
- **D-04:** Output: terminal table with phase list, colored status indicators (complete/in-progress/not-started), current position highlight.
- **D-05:** `sunco note "text"` writes to .sun/notes/ as timestamped markdown files. `--tribal` flag writes to .sun/tribal/ instead (integrates with guard skill's tribal loader from Phase 2).
- **D-06:** `sunco todo add "task"` / `sunco todo list` / `sunco todo done <id>` -- manages a todo list in .sun/ SQLite via StateApi. Simple CRUD. IDs are auto-incrementing integers.
- **D-07:** `sunco seed "idea" --trigger "when phase 5 starts"` -- stores ideas in .sun/ SQLite with a trigger condition string. Seeds surface automatically when condition matches (checked by recommender rules).
- **D-08:** `sunco backlog` -- lists items from .sun/ SQLite backlog table. `sunco backlog add "item"` / `sunco backlog promote <id>` moves to active roadmap.
- **D-09:** All 4 skills (note, todo, seed, backlog) are separate skill files but share the StateApi/FileStore backends.
- **D-10:** `sunco phase add "Name"` -- appends a new phase to ROADMAP.md with the next sequential number. Creates the phase directory.
- **D-11:** `sunco phase insert "Name" --after 3` -- inserts as decimal phase (e.g., 3.1). Does NOT renumber existing phases.
- **D-12:** `sunco phase remove <number>` -- removes a future (not started) phase from ROADMAP.md. Refuses to remove in-progress or completed phases. Renumbers subsequent phases to close the gap.
- **D-13:** All 3 operations parse and rewrite ROADMAP.md. Use regex-based parsing of the markdown structure (phase headers, checkboxes, progress table).
- **D-14:** Enhanced `sunco settings` (replacing the Phase 1 basic version). Interactive Ink UI with: tree-view of config hierarchy, inline editing with validation, layer indicator (global/project/directory).
- **D-15:** `sunco settings --key agent.timeout` for direct query (existing behavior preserved). New: `sunco settings --set agent.timeout=60000` for direct mutation.
- **D-16:** Config changes write to the appropriate layer's TOML file. Project-level by default, `--global` for ~/.sun/config.toml.
- **D-17:** `sunco pause` -- creates HANDOFF.json in .sun/ with: current phase, current plan, completed tasks, in-progress task, pending decisions, environment state (branch, uncommitted changes), timestamp.
- **D-18:** `sunco resume` -- reads HANDOFF.json, displays summary of where we left off, validates environment (correct branch, no conflicts), and recommends the next action.
- **D-19:** `sunco next` -- reads STATE.md + ROADMAP.md, determines the next logical skill to run based on current progress. Uses recommender engine (Phase 1 REC-*) for routing.
- **D-20:** `sunco context` -- displays current decisions, blockers, and next actions. Reads from STATE.md + current phase's CONTEXT.md + any pending todos.
- **D-21:** HANDOFF.json format is a flat JSON structure, not nested. Easy to read for both humans and agents.

### Claude's Discretion
- Ink component layout details for settings tree-view
- HANDOFF.json exact field names and structure
- Note file naming convention (timestamp format)
- Todo/seed/backlog SQLite table schemas
- Phase number validation and edge cases

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SES-01 | `sunco status` -- current state summary | Status skill reads ROADMAP.md + STATE.md, displays via Ink table with progress bars |
| SES-02 | `sunco next` -- state-based next skill routing | Leverages existing RecommenderEngine (30 rules); builds RecommendationState from STATE.md |
| SES-03 | `sunco resume` -- HANDOFF.json session restore | FileStoreApi reads HANDOFF.json from .sun/, validates env via simple-git |
| SES-04 | `sunco pause` -- session snapshot to HANDOFF.json | FileStoreApi writes HANDOFF.json; git state captured via simple-git |
| SES-05 | `sunco context` -- current decisions/blockers/next | Reads STATE.md + phase CONTEXT.md via fs, displays via ctx.ui.result |
| IDX-01 | `sunco note` -- frictionless notes + --tribal | FileStoreApi writes to .sun/notes/ (or .sun/tribal/); timestamped markdown |
| IDX-02 | `sunco todo` -- add/list/done task list | StateApi key-value CRUD with `todo.items` key (array of todo objects) |
| IDX-03 | `sunco seed` -- ideas with trigger conditions | StateApi stores seeds with trigger strings; recommender rules check triggers |
| IDX-04 | `sunco backlog` -- parking lot for ideas | StateApi CRUD with `backlog.items` key; promote moves to roadmap |
| PHZ-01 | `sunco phase add` -- append phase to roadmap | Regex-based ROADMAP.md parser + rewriter; creates phase directory |
| PHZ-02 | `sunco phase insert` -- decimal phase insertion | Decimal numbering (e.g., 3.1) without renumbering; ROADMAP.md rewrite |
| PHZ-03 | `sunco phase remove` -- remove future phase | Safety check (not started/completed); renumber subsequent; ROADMAP.md rewrite |
| SET-01 | `sunco settings` -- interactive config UI | Enhanced settings.skill.ts with Ink tree-view; smol-toml stringify for writes |
| WF-08 | `sunco progress` -- overall progress + routing | Alias to status skill (D-03); same implementation |
</phase_requirements>

## Standard Stack

### Core (Already Installed -- Phase 1 Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sunco/core | 0.0.1 | defineSkill, StateApi, FileStoreApi, RecommenderEngine, SkillUi | Phase 1 foundation -- all skills depend on it |
| smol-toml | 1.6.1 | TOML parse + stringify for settings writes | Already in @sunco/core and @sunco/skills-harness; `stringify()` used by init skill |
| ink | 6.8.0 | Interactive terminal UI for settings tree-view | Already in @sunco/core; established rendering patterns |
| react | 19.1.0 | JSX for Ink components | Ink dependency, already installed |
| chalk | 5.4.1 | Terminal colors for non-Ink output | Already in @sunco/core |
| simple-git | 3.33.x | Git state capture for HANDOFF.json (branch, uncommitted) | Listed in CLAUDE.md tech stack; needed for pause/resume |
| zod | 3.24.4 | Schema validation for HANDOFF.json and config writes | Already in @sunco/core |

### New Dependencies Needed

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simple-git | 3.33.0 | Git operations for pause/resume session | SES-03, SES-04 need branch name and uncommitted changes detection |

**Installation:**
```bash
cd packages/skills-workflow && npm install simple-git@3.33.0
```

**Version verification:** simple-git is already verified in CLAUDE.md tech stack. All other deps are already installed via @sunco/core.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| simple-git for branch detection | Raw `git` CLI via execa | simple-git has typed API, better error handling; execa is more manual |
| StateApi for todo/seed/backlog | Separate SQLite tables | StateApi key-value is sufficient for small CRUD; no schema migration needed |
| Regex for ROADMAP.md parsing | remark/unified markdown AST | Overkill -- ROADMAP.md has a fixed, simple format we control |

## Architecture Patterns

### Recommended Project Structure

```
packages/skills-workflow/
  src/
    index.ts                    # Barrel exports for all Phase 3 skills
    status.skill.ts             # SES-01 + WF-08 (sunco status / sunco progress)
    next.skill.ts               # SES-02 (sunco next)
    resume.skill.ts             # SES-03 (sunco resume)
    pause.skill.ts              # SES-04 (sunco pause)
    context.skill.ts            # SES-05 (sunco context)
    note.skill.ts               # IDX-01 (sunco note)
    todo.skill.ts               # IDX-02 (sunco todo)
    seed.skill.ts               # IDX-03 (sunco seed)
    backlog.skill.ts            # IDX-04 (sunco backlog)
    phase.skill.ts              # PHZ-01, PHZ-02, PHZ-03 (sunco phase)
    settings.skill.ts           # SET-01 (enhanced sunco settings)
    shared/
      roadmap-parser.ts         # Parse ROADMAP.md into structured data
      roadmap-writer.ts         # Rewrite ROADMAP.md from structured data
      state-reader.ts           # Parse STATE.md YAML frontmatter + content
      handoff.ts                # HANDOFF.json read/write + Zod schema
      git-state.ts              # Git branch/status capture via simple-git
    __tests__/
      roadmap-parser.test.ts
      roadmap-writer.test.ts
      state-reader.test.ts
      handoff.test.ts
      todo.test.ts
      seed.test.ts
      backlog.test.ts
      phase.test.ts
      settings-writer.test.ts
  vitest.config.ts
  tsup.config.ts
  tsconfig.json
  package.json
```

### Pattern 1: Skill File Convention

**What:** Every skill is a single file exporting a `default` defineSkill() result.
**When to use:** Every Phase 3 skill.
**Example:**
```typescript
// Source: Established in Phase 1/2 (settings.skill.ts, health.skill.ts, etc.)
import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'workflow.status',
  command: 'status',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Show current project status and progress',
  options: [
    { flags: '--json', description: 'Output as JSON' },
  ],
  async execute(ctx) {
    await ctx.ui.entry({ title: 'Status', description: 'Project overview' });
    // ... skill logic ...
    return { success: true, summary: 'Status displayed' };
  },
});
```

### Pattern 2: StateApi Key Namespace Convention

**What:** Skills use dot-namespaced keys to avoid collisions in the shared SQLite store.
**When to use:** All structured state storage (todo, seed, backlog, session).
**Example:**
```typescript
// Source: Established by health.skill.ts (ctx.state.set('health.lastResult', ...))
// and lint.skill.ts (ctx.state.set('lint.lastResult', ...))

// Todo items stored as array under a single key
await ctx.state.set('todo.items', [
  { id: 1, text: 'Fix the bug', done: false, createdAt: '2026-03-28T...' },
  { id: 2, text: 'Write tests', done: true, createdAt: '2026-03-28T...', doneAt: '...' },
]);

// Seed items with trigger conditions
await ctx.state.set('seed.items', [
  { id: 1, idea: 'Add caching layer', trigger: 'when phase 5 starts', createdAt: '...' },
]);

// Next auto-increment ID tracked separately
await ctx.state.set('todo.nextId', 3);
```

### Pattern 3: Filesystem Artifact via FileStoreApi

**What:** Human-readable artifacts written to .sun/ subdirectories as markdown files.
**When to use:** Notes and tribal knowledge (IDX-01).
**Example:**
```typescript
// Source: FileStore (packages/core/src/state/file-store.ts)
// FileStore.write() creates category directory if it doesn't exist

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `${timestamp}.md`;
const content = `# Note\n\n${text}\n\nCreated: ${new Date().toISOString()}\n`;

if (args.tribal) {
  await ctx.fileStore.write('tribal', filename, content);
} else {
  await ctx.fileStore.write('notes', filename, content);
}
```

### Pattern 4: ROADMAP.md Regex-Based Parsing

**What:** Parse the ROADMAP.md markdown into a structured array of phase objects.
**When to use:** Status skill (reading), phase skill (reading + writing).
**Example:**
```typescript
// The ROADMAP.md has a consistent format:
// - [ ] **Phase 3: Standalone TS Skills** - description
// - [x] **Phase 1: Core Platform** - description (completed)

interface ParsedPhase {
  number: number | string; // 3 or 3.1 for decimal
  name: string;
  description: string;
  completed: boolean;
  requirements: string[];
  plans: { name: string; completed: boolean }[];
}

// Phase list regex
const PHASE_LINE = /^- \[([ x])\] \*\*Phase (\d+(?:\.\d+)?): (.+?)\*\* - (.+)$/;

// Progress table regex
const PROGRESS_ROW = /^\| (\d+)\. .+? \| (\d+)\/(\d+|\?) \| (.+?) \|/;
```

### Pattern 5: Command Aliasing

**What:** A single skill registered under multiple command names.
**When to use:** `sunco status` aliased as `sunco progress` (D-03).
**Example:**
```typescript
// Register the same skill definition twice with different commands
// Option A: Two defineSkill() calls sharing the same execute function
const statusExecute = async (ctx: SkillContext): Promise<SkillResult> => {
  // ... shared implementation
};

export const statusSkill = defineSkill({
  id: 'workflow.status',
  command: 'status',
  // ...
  execute: statusExecute,
});

export const progressSkill = defineSkill({
  id: 'workflow.progress',
  command: 'progress',
  // ...
  execute: statusExecute,
});
```

### Pattern 6: TOML Config Write-Back

**What:** Write config changes to the appropriate TOML layer file.
**When to use:** Enhanced settings skill (SET-01, D-16).
**Example:**
```typescript
// Source: smol-toml stringify (already used in workspace-initializer.ts)
import { parse, stringify } from 'smol-toml';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function writeConfigKey(
  configPath: string,
  keyPath: string,
  value: unknown
): Promise<void> {
  // Read existing TOML (or start fresh)
  let existing: Record<string, unknown> = {};
  try {
    const content = await readFile(configPath, 'utf-8');
    existing = parse(content) as Record<string, unknown>;
  } catch { /* file doesn't exist yet */ }

  // Set nested key
  const parts = keyPath.split('.');
  let target: Record<string, unknown> = existing;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in target) || typeof target[part] !== 'object') {
      target[part] = {};
    }
    target = target[part] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]!] = value;

  // Write back
  await writeFile(configPath, `# SUNCO Configuration\n${stringify(existing)}\n`, 'utf-8');
}
```

### Anti-Patterns to Avoid

- **Direct fs.readFile for .sun/ artifacts:** Use FileStoreApi -- it handles path traversal prevention and directory creation.
- **Custom SQLite tables:** The StateApi key-value store is sufficient for Phase 3 CRUD. Custom tables would require schema migration and break the abstraction.
- **Full markdown AST parser for ROADMAP.md:** We control the ROADMAP format. Regex is simpler, faster, and has no dependencies. A full AST parser (remark/unified) adds 15+ transitive dependencies for a problem that's solvable with 100 lines of regex.
- **Blocking I/O in skill execute:** All file operations must be async (the StateApi is async-wrapped even though better-sqlite3 is sync underneath).
- **Mutating ctx.config directly:** Config is frozen. Settings writes go to TOML files; the config is re-read on next CLI invocation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOML serialization | Custom TOML writer | `smol-toml` `stringify()` | TOML spec is complex (datetime, inline tables, multiline strings); smol-toml handles all edge cases |
| Git branch/status detection | Raw `git` CLI parsing | `simple-git` | Typed API, cross-platform, handles git not installed |
| Interactive terminal UI | Raw ANSI escape codes | Ink via `ctx.ui.ask()` + `ctx.ui.result()` | Established pattern, handles non-TTY fallback |
| Config validation | Manual type checks | Zod schema parse | Already established via `SunConfigSchema` |
| Skill definition | Manual object creation | `defineSkill()` factory | Validates via Zod, freezes, ensures consistency |

**Key insight:** Phase 3 skills are thin wrappers over existing infrastructure. The real work is in the parsing/formatting logic, not in building new frameworks. Every storage, rendering, and validation need is already solved by Phase 1.

## Common Pitfalls

### Pitfall 1: ROADMAP.md Parsing Fragility
**What goes wrong:** Regex-based markdown parsing breaks when the format deviates slightly (extra whitespace, different checkbox style, etc.).
**Why it happens:** ROADMAP.md is written by both humans and automation, leading to format drift.
**How to avoid:** (1) Define a strict canonical format and always rewrite the entire section when modifying. (2) Write comprehensive parser tests covering edge cases: empty phases, decimal numbers, missing plans section, trailing whitespace. (3) Use `.trim()` on all captured groups.
**Warning signs:** Parser returns `undefined` or empty array when the file clearly has content.

### Pitfall 2: StateApi Key Collision
**What goes wrong:** Two skills use the same key prefix, overwriting each other's data.
**Why it happens:** No enforcement of key namespaces -- it's convention only.
**How to avoid:** Use strict prefixes: `todo.*`, `seed.*`, `backlog.*`, `session.*`, `phase.*`. Document the convention in each skill file header. Never use generic keys like `items` or `data`.
**Warning signs:** Data disappears between skill invocations.

### Pitfall 3: Auto-Increment ID Gaps
**What goes wrong:** Todo/seed/backlog IDs skip numbers or collide after deletions.
**Why it happens:** Using array index as ID, then items get deleted or reordered.
**How to avoid:** Track a separate `nextId` counter in StateApi (e.g., `todo.nextId`). IDs are never reused. Deletion removes the item but doesn't affect the counter.
**Warning signs:** `sunco todo done 3` fails because ID 3 was renumbered.

### Pitfall 4: Settings Write Race Condition
**What goes wrong:** Two concurrent `sunco settings --set` commands corrupt the TOML file.
**Why it happens:** Read-modify-write cycle without locking.
**How to avoid:** This is unlikely in practice (single-user CLI), but use atomic write via a temp file + rename pattern. The SQLite WAL mode already handles state writes safely.
**Warning signs:** Malformed TOML file after a crash during write.

### Pitfall 5: HANDOFF.json Stale After Branch Switch
**What goes wrong:** `sunco resume` loads a HANDOFF.json that was created on a different branch, leading to confusion.
**Why it happens:** HANDOFF.json lives in .sun/ which is not branch-specific.
**How to avoid:** (1) Store the branch name in HANDOFF.json (D-17 specifies this). (2) On resume, validate the current branch matches. (3) If mismatch, warn the user and ask whether to proceed or discard.
**Warning signs:** Resume shows tasks from a completely different feature branch.

### Pitfall 6: Phase Renumbering Cascade
**What goes wrong:** `sunco phase remove 3` renumbers phases 4-10 to 3-9, but existing phase directories and STATE.md references still use old numbers.
**Why it happens:** Phase numbers are used as directory names and in STATE.md references.
**How to avoid:** (1) Renumber in ROADMAP.md AND rename directories. (2) Update STATE.md phase reference if the current phase was affected. (3) The D-11 decision to use decimals for inserts avoids this problem for additions.
**Warning signs:** `sunco status` shows "Phase 3" but the directory is `04-something/`.

### Pitfall 7: FileStore 'notes' Category Not Pre-Created
**What goes wrong:** First `sunco note` call fails because .sun/notes/ doesn't exist.
**Why it happens:** The `initSunDirectory()` function only creates predefined directories (rules, tribal, scenarios, planning, logs). `notes` is not in the list.
**How to avoid:** FileStore.write() already calls `mkdir(dir, { recursive: true })` before writing. No issue -- the directory is created on first write. However, FileStore.list('notes') returns `[]` if the directory doesn't exist (ENOENT catch). This is correct behavior.
**Warning signs:** None -- this is already handled correctly by FileStore.

## Code Examples

### HANDOFF.json Schema (Claude's Discretion)

```typescript
// Recommended flat structure per D-21
import { z } from 'zod';

export const HandoffSchema = z.object({
  version: z.literal(1),
  timestamp: z.string(),
  // Phase context
  currentPhase: z.number().nullable(),
  currentPhaseName: z.string().nullable(),
  currentPlan: z.string().nullable(),
  // Task tracking
  completedTasks: z.array(z.string()),
  inProgressTask: z.string().nullable(),
  // Decisions and blockers
  pendingDecisions: z.array(z.string()),
  blockers: z.array(z.string()),
  // Environment state
  branch: z.string(),
  uncommittedChanges: z.boolean(),
  uncommittedFiles: z.array(z.string()),
  // Session info
  lastSkillId: z.string().nullable(),
  lastSkillResult: z.enum(['success', 'failure']).nullable(),
});

export type Handoff = z.infer<typeof HandoffSchema>;
```

### Todo Item Schema (Claude's Discretion)

```typescript
import { z } from 'zod';

export const TodoItemSchema = z.object({
  id: z.number(),
  text: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
  doneAt: z.string().nullable(),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;

// Stored as: ctx.state.set('todo.items', items)
// Next ID:   ctx.state.set('todo.nextId', nextId)
```

### Seed Item Schema (Claude's Discretion)

```typescript
import { z } from 'zod';

export const SeedItemSchema = z.object({
  id: z.number(),
  idea: z.string(),
  trigger: z.string(),
  createdAt: z.string(),
  surfaced: z.boolean().default(false),
  surfacedAt: z.string().nullable().default(null),
});

export type SeedItem = z.infer<typeof SeedItemSchema>;

// Stored as: ctx.state.set('seed.items', items)
// Next ID:   ctx.state.set('seed.nextId', nextId)
```

### Note File Naming Convention (Claude's Discretion)

```typescript
// ISO 8601 timestamp with colons/dots replaced for filesystem safety
// Example: 2026-03-28T14-32-05-123Z.md
function noteFilename(tribal: boolean): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${ts}.md`;
}
```

### CLI Registration (Dual Loading)

```typescript
// packages/cli/src/cli.ts -- Phase 3 skills added to preloadedSkills
import {
  statusSkill,
  progressSkill,
  nextSkill,
  resumeSkill,
  pauseSkill,
  contextSkill,
  noteSkill,
  todoSkill,
  seedSkill,
  backlogSkill,
  phaseSkill,
} from '@sunco/skills-workflow';
// Enhanced settings replaces the harness version
import { settingsSkill } from '@sunco/skills-workflow';

const preloadedSkills = [
  // Phase 2 harness skills...
  // Phase 3 workflow skills
  statusSkill,
  progressSkill,
  nextSkill,
  resumeSkill,
  pauseSkill,
  contextSkill,
  noteSkill,
  todoSkill,
  seedSkill,
  backlogSkill,
  phaseSkill,
  settingsSkill, // Enhanced version replaces harness settings
];
```

### Settings Skill: TOML Write-Back Pattern

```typescript
// D-16: Write to appropriate layer's TOML file
import { parse, stringify } from 'smol-toml';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

async function setConfigValue(
  configPath: string,
  keyPath: string,
  rawValue: string,
): Promise<void> {
  // Parse value type (number, boolean, string)
  const value = parseValueType(rawValue);

  // Read existing TOML
  let existing: Record<string, unknown> = {};
  try {
    const content = await readFile(configPath, 'utf-8');
    existing = parse(content) as Record<string, unknown>;
  } catch {
    // File doesn't exist -- create it
    await mkdir(dirname(configPath), { recursive: true });
  }

  // Navigate and set nested key
  setNestedKey(existing, keyPath, value);

  // Write back with smol-toml stringify
  const tomlContent = stringify(existing);
  await writeFile(configPath, `# SUNCO Configuration\n${tomlContent}\n`, 'utf-8');
}

function parseValueType(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return num;
  return raw;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON config files | TOML config with smol-toml | Phase 1 (established) | All config read/write uses TOML |
| Custom SQL tables per feature | Generic key-value StateApi | Phase 1 (established) | All structured state goes through StateApi.get/set |
| Manual CLI wiring | defineSkill() + auto-discovery | Phase 1 (established) | Skills are just *.skill.ts files with defineSkill() |

**Deprecated/outdated:**
- The Phase 1 `settings.skill.ts` in `skills-harness` will be superseded by the enhanced version in `skills-workflow`. The old one should be removed from harness exports and CLI preloads.

## Open Questions

1. **Settings skill ownership: harness vs workflow**
   - What we know: The existing `settings.skill.ts` lives in `packages/skills-harness`. D-14 says to "enhance" it.
   - What's unclear: Should the enhanced version stay in skills-harness or move to skills-workflow?
   - Recommendation: Move to skills-workflow. The settings skill is a workflow/utility skill, not a harness skill. Remove the old one from skills-harness exports and CLI preloads. The skill ID stays `core.settings` for compatibility.

2. **Phase subcommand routing**
   - What we know: `sunco phase add`, `sunco phase insert`, `sunco phase remove` are three subcommands under one parent.
   - What's unclear: Commander.js supports subcommands natively, but the current skill system maps one skill = one command.
   - Recommendation: Register `phase` as the command with `add <name>`, `insert <name>`, `remove <number>` as positional argument patterns. Use `ctx.args` to determine the subcommand. Alternative: use options (`--add`, `--insert`, `--remove`) but positional subcommands are cleaner UX.

3. **Recommender rule additions for Phase 3 skills**
   - What we know: The recommender has 30 rules. Phase 3 adds ~7 new skills that need routing rules.
   - What's unclear: How many new rules are needed and where they go.
   - Recommendation: Add 5-8 new rules in a `phase3-rules.ts` file, imported into the combined RECOMMENDATION_RULES array. Rules for: after-status, after-pause, after-resume, after-note, after-todo, after-phase, seed-trigger-match.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All skills | (assumed) | 22+ | -- |
| npm | Package install | (assumed) | 10+ | -- |
| git | pause/resume (branch detection) | (assumed) | 2.x | simple-git throws clear error |
| simple-git | SES-03, SES-04 | Needs install | 3.33.0 | -- |

**Missing dependencies with no fallback:**
- `simple-git` must be added to `packages/skills-workflow/package.json`

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 |
| Config file | `packages/skills-workflow/vitest.config.ts` (needs creation -- Wave 0) |
| Quick run command | `cd packages/skills-workflow && npx vitest run` |
| Full suite command | `npx turbo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SES-01 | Status displays phase/plan progress from ROADMAP.md | unit | `cd packages/skills-workflow && npx vitest run src/shared/__tests__/roadmap-parser.test.ts -x` | Wave 0 |
| SES-02 | Next routes to correct skill based on state | unit | `cd packages/skills-workflow && npx vitest run src/shared/__tests__/state-reader.test.ts -x` | Wave 0 |
| SES-03 | Resume reads and validates HANDOFF.json | unit | `cd packages/skills-workflow && npx vitest run src/shared/__tests__/handoff.test.ts -x` | Wave 0 |
| SES-04 | Pause captures git state and writes HANDOFF.json | unit | `cd packages/skills-workflow && npx vitest run src/shared/__tests__/handoff.test.ts -x` | Wave 0 |
| SES-05 | Context aggregates decisions/blockers/next | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/context.test.ts -x` | Wave 0 |
| IDX-01 | Note writes timestamped .md to notes/ or tribal/ | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/note.test.ts -x` | Wave 0 |
| IDX-02 | Todo CRUD (add/list/done) with auto-increment IDs | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/todo.test.ts -x` | Wave 0 |
| IDX-03 | Seed stores ideas with trigger conditions | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/seed.test.ts -x` | Wave 0 |
| IDX-04 | Backlog CRUD with promote to roadmap | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/backlog.test.ts -x` | Wave 0 |
| PHZ-01 | Phase add appends to ROADMAP.md + creates dir | unit | `cd packages/skills-workflow && npx vitest run src/shared/__tests__/roadmap-writer.test.ts -x` | Wave 0 |
| PHZ-02 | Phase insert uses decimal numbering | unit | `cd packages/skills-workflow && npx vitest run src/shared/__tests__/roadmap-writer.test.ts -x` | Wave 0 |
| PHZ-03 | Phase remove validates + renumbers + rewrites | unit | `cd packages/skills-workflow && npx vitest run src/shared/__tests__/roadmap-writer.test.ts -x` | Wave 0 |
| SET-01 | Settings read/write TOML with layer awareness | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/settings-writer.test.ts -x` | Wave 0 |
| WF-08 | Progress alias to status | unit | Same as SES-01 tests | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/skills-workflow && npx vitest run`
- **Per wave merge:** `npx turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/skills-workflow/vitest.config.ts` -- test framework config (copy from skills-harness)
- [ ] `packages/skills-workflow/tsconfig.json` -- update with proper paths and types
- [ ] `packages/skills-workflow/tsup.config.ts` -- multi-entry build config for all skills
- [ ] `packages/skills-workflow/package.json` -- add simple-git, vitest, chalk dependencies
- [ ] `packages/skills-workflow/src/shared/__tests__/roadmap-parser.test.ts` -- covers SES-01, PHZ-01~03
- [ ] `packages/skills-workflow/src/shared/__tests__/roadmap-writer.test.ts` -- covers PHZ-01~03
- [ ] `packages/skills-workflow/src/shared/__tests__/state-reader.test.ts` -- covers SES-02
- [ ] `packages/skills-workflow/src/shared/__tests__/handoff.test.ts` -- covers SES-03, SES-04
- [ ] `packages/skills-workflow/src/__tests__/todo.test.ts` -- covers IDX-02
- [ ] `packages/skills-workflow/src/__tests__/seed.test.ts` -- covers IDX-03
- [ ] `packages/skills-workflow/src/__tests__/backlog.test.ts` -- covers IDX-04

## Sources

### Primary (HIGH confidence)
- `packages/core/src/skill/types.ts` -- SkillDefinition, SkillContext, SkillResult interfaces
- `packages/core/src/skill/define.ts` -- defineSkill() factory with Zod validation
- `packages/core/src/state/types.ts` -- StateApi, FileStoreApi interfaces
- `packages/core/src/state/file-store.ts` -- FileStore implementation (path traversal, mkdir)
- `packages/core/src/state/database.ts` -- StateDatabase implementation (key-value, JSON serialized)
- `packages/core/src/recommend/engine.ts` -- RecommenderEngine with 30 rules
- `packages/core/src/recommend/rules.ts` -- Existing recommendation rules (7 categories)
- `packages/core/src/ui/adapters/SkillUi.ts` -- SkillUi interface (entry/ask/progress/result)
- `packages/core/src/ui/adapters/InkUiAdapter.ts` -- Ink rendering patterns
- `packages/core/src/config/loader.ts` -- loadConfig() three-layer hierarchy
- `packages/core/src/cli/lifecycle.ts` -- Boot sequence and skill registration
- `packages/skills-harness/src/settings.skill.ts` -- Current settings skill to enhance
- `packages/skills-harness/src/health.skill.ts` -- Reference pattern for complex deterministic skills
- `packages/skills-harness/src/init/workspace-initializer.ts` -- smol-toml stringify usage
- `.planning/ROADMAP.md` -- Actual markdown format to parse
- `.planning/STATE.md` -- Actual YAML frontmatter + markdown state format

### Secondary (MEDIUM confidence)
- `packages/skills-workflow/` -- Empty package structure waiting for Phase 3 skills
- CLAUDE.md tech stack -- simple-git 3.33.x specified, smol-toml 1.6.0

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven in Phase 1/2, except simple-git (verified in CLAUDE.md)
- Architecture: HIGH -- follows exact patterns established by 9 existing skills across two packages
- Pitfalls: HIGH -- identified from actual codebase analysis (ROADMAP.md format, StateApi conventions, FileStore behavior)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- Phase 1/2 patterns are locked)
