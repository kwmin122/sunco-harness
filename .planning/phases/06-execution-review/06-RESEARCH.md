# Phase 6: Execution + Review - Research

**Researched:** 2026-03-28
**Domain:** Wave-based parallel agent execution with Git worktree isolation + Multi-provider cross-review
**Confidence:** HIGH

## Summary

Phase 6 introduces the two most operationally critical skills in SUNCO: `sunco execute` (WF-14) orchestrates multi-wave parallel agent execution with Git worktree isolation for safe parallel file operations, and `sunco review` (WF-13) dispatches multi-provider cross-review agents that produce a unified REVIEWS.md. Together they form the "do and check" pair that transforms plans into verified code.

The execute skill is the most complex skill in the entire SUNCO codebase. It reads PLAN.md files, groups plans by wave number, spawns parallel executor agents in isolated Git worktrees, collects atomic commits per task, and reports completion. The review skill is comparatively simpler -- it sends diffs to multiple AI providers independently (using the existing `crossVerify` API on AgentRouterApi) and synthesizes their findings into a structured report.

Both skills reuse heavily from existing infrastructure: `simple-git` (already installed), `AgentRouter.run()` / `crossVerify()`, `phase-reader.ts`, `captureGitState()`, `Promise.allSettled()` for parallel dispatch, and the established skill/prompt/test pattern from Phases 4-5. The primary new technical challenge is Git worktree management via `simple-git`'s `raw()` method, since simple-git has no dedicated worktree API methods.

**Primary recommendation:** Use `simpleGit().raw(['worktree', 'add', ...])` for all worktree operations. Parse PLAN.md frontmatter with the same manual YAML parsing approach used throughout the codebase (regex-based, no YAML library). Keep XML task parsing to simple regex extraction -- no XML parser library needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Multi-wave execution orchestrator: (1) Read PLAN.md files from phase directory, (2) Analyze dependencies and group into waves, (3) For each wave, spawn parallel executor agents in Git worktrees, (4) Collect results, verify commits, (5) Report completion.
- **D-02:** Git worktree isolation: each executor agent gets its own worktree via `simple-git`. Agents commit with --no-verify to avoid hook contention. Post-wave hook validation runs once after all agents complete.
- **D-03:** Atomic commits per task. Each task in a plan produces one commit. If a task fails, the worktree is discarded (rollback-safe).
- **D-04:** Agent dispatch uses role: 'execution' with write permissions scoped to plan's files_modified list. Each agent receives the PLAN.md and executes tasks sequentially within the plan.
- **D-05:** SUMMARY.md created per plan after execution. STATE.md and ROADMAP.md updated with progress.
- **D-06:** Checkpoint handling: plans with `autonomous: false` pause for user input. In auto mode, checkpoints are auto-approved.
- **D-07:** Wave safety: Wave N+1 only starts after all Wave N agents complete successfully. If any agent fails, user chooses: retry, skip, or abort.
- **D-08:** Multi-provider review dispatch: `sunco review` sends the diff to multiple AI providers independently. Each provider reviews in isolation, producing a structured review.
- **D-09:** Provider flags: `--codex` (OpenAI Codex), `--gemini` (Google Gemini), `--claude` (Anthropic Claude). Default: use available providers. At least 1 provider required.
- **D-10:** Each review agent uses role: 'verification' (read-only + test permissions). Agents receive the git diff and produce structured findings.
- **D-11:** Reviews synthesized into a unified REVIEWS.md: common findings highlighted, disagreements flagged, severity-weighted priority list.
- **D-12:** Review dimensions: SQL safety, trust boundary violations, conditional side effects, architectural patterns, test coverage, security, performance.
- **D-13:** `sunco review --phase N` reviews all plans in a phase. `sunco review` (no flag) reviews staged/unstaged changes.
- **D-14:** Both skills live in `packages/skills-workflow/src/` as execute.skill.ts and review.skill.ts.
- **D-15:** Reuse simple-git (already installed from Phase 3) for worktree creation/removal.
- **D-16:** Agent prompts in `packages/skills-workflow/src/prompts/` (execute.ts, review.ts, review-synthesize.ts).
- **D-17:** Execute skill reads PLAN.md XML format -- must parse `<tasks>`, `<task>`, `<action>`, `<verify>`, `<acceptance_criteria>` XML blocks.

### Claude's Discretion
- Git worktree naming convention and cleanup strategy
- Executor agent prompt structure for task execution
- Review synthesis algorithm (how to merge multiple reviews)
- Diff size limits for review agents
- Error recovery strategy for partial worktree failures

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WF-13 | `sunco review` -- multi-agent cross-review with --codex --gemini flags | crossVerify API exists on AgentRouterApi, review dimensions defined in D-12, synthesis pattern from research.skill.ts reusable |
| WF-14 | `sunco execute` -- wave-based parallel execution + atomic commits + Git worktree isolation | simple-git raw() for worktree ops, PLAN.md parsing patterns established, Promise.allSettled for parallel dispatch |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| simple-git | 3.33.0 | Git worktree creation/removal, diff generation, commit operations | Already a dependency in skills-workflow. Use `raw()` for worktree commands (no dedicated worktree API in simple-git). |
| @sunco/core | workspace | AgentRouter, PermissionSet, AgentResult, defineSkill | Foundation for all skills. crossVerify() already supports multi-provider dispatch. |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk | 5.6.2 | Colored terminal output | For review severity highlighting, worktree status display |

### No New Dependencies Required

Both skills can be built entirely with existing dependencies. No XML parser library needed -- PLAN.md uses simple XML-like blocks parseable with regex. No YAML library needed -- frontmatter parsing uses the same regex approach as existing skills (STATE.md parsing in state-reader.ts, ROADMAP.md parsing in roadmap-parser.ts).

## Architecture Patterns

### Recommended File Structure
```
packages/skills-workflow/src/
  execute.skill.ts           # WF-14: wave-based parallel execution
  review.skill.ts            # WF-13: multi-provider cross-review
  prompts/
    execute.ts               # Executor agent prompt builder
    review.ts                # Review agent prompt builder
    review-synthesize.ts     # Review synthesis prompt builder
  shared/
    plan-parser.ts           # PLAN.md frontmatter + XML task parser
    worktree-manager.ts      # Git worktree lifecycle (add/remove/list)
  __tests__/
    execute.test.ts
    review.test.ts
    plan-parser.test.ts
    worktree-manager.test.ts
```

### Pattern 1: PLAN.md Parser (shared/plan-parser.ts)

**What:** Parse PLAN.md YAML frontmatter and XML task blocks into typed structures.
**When to use:** execute.skill.ts reads PLAN.md files, extracts wave/depends_on for grouping, extracts task actions for agent dispatch.
**Why shared:** Plan parsing logic is pure and testable independently. Extracting it avoids a 200+ line monolith in execute.skill.ts.

```typescript
// Minimal YAML frontmatter parsing (same approach as state-reader.ts)
export interface PlanFrontmatter {
  phase: string;
  plan: number;
  type: 'execute' | 'tdd';
  wave: number;
  depends_on: number[];
  files_modified: string[];
  autonomous: boolean;
  requirements: string[];
}

export interface PlanTask {
  name: string;
  files: string[];
  action: string;
  verify: string;      // automated verification command
  done: string[];      // completion criteria
}

export interface ParsedPlan {
  frontmatter: PlanFrontmatter;
  objective: string;
  context: string;
  tasks: PlanTask[];
  raw: string;         // full PLAN.md content for agent prompt
}

export function parsePlanMd(content: string): ParsedPlan;
export function groupPlansByWave(plans: ParsedPlan[]): Map<number, ParsedPlan[]>;
```

Frontmatter extraction: split on `---` delimiters, parse key-value pairs with regex. Array values (files_modified, depends_on, requirements) detected by `- item` pattern on subsequent lines. This matches the established pattern in `state-reader.ts` and `roadmap-parser.ts`.

XML block extraction: use regex `/<(\w+)>([\s\S]*?)<\/\1>/g` to extract named blocks. The `<tasks>` block contains multiple `<task>` sub-blocks. The `<verify><automated>` nesting is two levels deep.

### Pattern 2: Worktree Manager (shared/worktree-manager.ts)

**What:** Encapsulate Git worktree lifecycle operations.
**When to use:** execute.skill.ts creates worktrees per plan, cleans up after completion/failure.
**Why shared:** Isolates git worktree complexity from orchestration logic. Testable with mock git.

```typescript
import { simpleGit, type SimpleGit } from 'simple-git';

export interface WorktreeInfo {
  path: string;
  branch: string;
  planId: string;
}

export class WorktreeManager {
  private git: SimpleGit;
  private basePath: string;
  private worktrees: WorktreeInfo[] = [];

  constructor(cwd: string) {
    this.git = simpleGit(cwd);
    this.basePath = join(cwd, '.sun', 'worktrees');
  }

  /** Create a worktree for a plan execution */
  async create(planId: string, baseBranch: string): Promise<WorktreeInfo> {
    const branchName = `sunco/exec/${planId}-${Date.now()}`;
    const worktreePath = join(this.basePath, planId);

    // Create worktree with new branch from base
    await this.git.raw([
      'worktree', 'add', '-b', branchName, worktreePath, baseBranch,
    ]);

    const info = { path: worktreePath, branch: branchName, planId };
    this.worktrees.push(info);
    return info;
  }

  /** Remove a worktree and its branch */
  async remove(planId: string): Promise<void> {
    const wt = this.worktrees.find(w => w.planId === planId);
    if (!wt) return;

    await this.git.raw(['worktree', 'remove', '--force', wt.path]);
    await this.git.raw(['branch', '-D', wt.branch]);
    this.worktrees = this.worktrees.filter(w => w.planId !== planId);
  }

  /** Remove all managed worktrees (cleanup) */
  async removeAll(): Promise<void> {
    for (const wt of [...this.worktrees]) {
      try {
        await this.remove(wt.planId);
      } catch {
        // Best-effort cleanup
      }
    }
    await this.git.raw(['worktree', 'prune']);
  }

  /** List all worktrees */
  async list(): Promise<string> {
    return this.git.raw(['worktree', 'list']);
  }
}
```

**Naming convention recommendation:** `sunco/exec/{planId}-{timestamp}` for branches, `.sun/worktrees/{planId}` for worktree paths. The `.sun/worktrees/` directory keeps worktrees within the project's managed area. Using the timestamp prevents branch name collisions on retry.

**Cleanup strategy recommendation:** Always cleanup in a `finally` block. On success, cherry-pick commits to the main branch and remove worktree+branch. On failure, remove worktree+branch (rollback-safe per D-03). Run `git worktree prune` after all removals.

### Pattern 3: Wave-Based Orchestration (execute.skill.ts)

**What:** The core execution loop that groups plans by wave and dispatches agents.
**When to use:** The main execute flow.

```typescript
// Pseudocode for the wave orchestration loop
const plans = await loadAndParsePlans(phaseDir, paddedPhase);
const waves = groupPlansByWave(plans);
const sortedWaveNums = [...waves.keys()].sort((a, b) => a - b);
const wtManager = new WorktreeManager(ctx.cwd);

try {
  const currentBranch = (await captureGitState(ctx.cwd)).branch;

  for (const waveNum of sortedWaveNums) {
    const wavePlans = waves.get(waveNum)!;

    // Create worktrees for all plans in this wave
    const worktreeInfos = await Promise.all(
      wavePlans.map(plan => wtManager.create(
        `${paddedPhase}-${String(plan.frontmatter.plan).padStart(2, '0')}`,
        currentBranch,
      ))
    );

    // Dispatch agents in parallel (Promise.allSettled)
    const results = await Promise.allSettled(
      wavePlans.map((plan, i) => executeOnePlan(ctx, plan, worktreeInfos[i]!))
    );

    // Evaluate results: all must succeed for wave to pass
    const failed = results.filter(r => r.status === 'rejected' ||
      (r.status === 'fulfilled' && !r.value.success));

    if (failed.length > 0) {
      // D-07: user chooses retry, skip, or abort
      const choice = await ctx.ui.ask({ ... });
      if (choice === 'abort') break;
    }

    // Cherry-pick successful commits back to main branch
    // Remove completed worktrees
  }
} finally {
  await wtManager.removeAll(); // Always cleanup
}
```

### Pattern 4: Review Dispatch (review.skill.ts)

**What:** Multi-provider review using existing crossVerify or individual run calls.
**When to use:** The review flow.

The review skill has two modes:
1. `sunco review --phase N` -- reviews all plan diffs in a phase
2. `sunco review` -- reviews current staged/unstaged changes

Both modes generate a diff (via `simple-git`), send it to review agents, then synthesize.

```typescript
// Use crossVerify for multi-provider dispatch
const reviewResults = await ctx.agent.crossVerify({
  role: 'verification',
  prompt: buildReviewPrompt({ diff, dimensions: REVIEW_DIMENSIONS }),
  permissions: VERIFICATION_PERMISSIONS,
  timeout: 180_000,
}, providerIds);  // optional: specific providers from --codex/--gemini/--claude flags

// Synthesize with a separate agent call
const synthesis = await ctx.agent.run({
  role: 'planning',
  prompt: buildReviewSynthesizePrompt({ reviews: reviewResults, diff }),
  permissions: PLANNING_PERMISSIONS,
  timeout: 120_000,
});
```

**Key insight:** The `crossVerify` method on `AgentRouterApi` already handles Promise.allSettled dispatch to multiple providers and returns `AgentResult[]`. This is exactly what review needs. No new infrastructure needed for multi-provider dispatch.

However, `crossVerify` dispatches the same request to ALL registered providers (or specific `providerIds`). For `--codex`/`--gemini`/`--claude` flags, we need to map flag names to provider IDs. This mapping should be in the skill, not the router.

### Pattern 5: Established Skill Pattern

All skills in SUNCO follow this exact structure:
1. `defineSkill({ id, command, kind, stage, category, routing, options?, execute })`
2. Execute flow: entry -> provider check -> phase resolution -> core logic -> result
3. Tests: metadata check, no-provider failure, missing prerequisites, happy path, error paths
4. Prompts in `prompts/` directory, shared utils in `shared/` directory

### Anti-Patterns to Avoid
- **Full XML parser for PLAN.md:** The XML blocks are simple and well-structured. A full DOM parser (xmldom, fast-xml-parser) adds a dependency for something regex handles in 20 lines. The project already uses regex for YAML frontmatter, markdown headings, and structured text extraction.
- **YAML parser for frontmatter:** The project established a regex-based frontmatter parsing convention. Adding `js-yaml` would introduce an inconsistency and a new dependency.
- **Shared worktrees (no isolation):** Each agent MUST get its own worktree. Never have two agents writing to the same working directory.
- **Worktree cleanup in success path only:** Always use `try/finally` for worktree cleanup. Leaked worktrees consume disk space and lock branches.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-provider dispatch | Custom Promise.all with provider selection | `ctx.agent.crossVerify(request, providerIds?)` | Already implemented in AgentRouter, handles allSettled + usage tracking |
| Git diff generation | Manual git command execution | `simpleGit(cwd).diff()` or `.diff(['--cached'])` | simple-git wraps this cleanly with typed output |
| Phase directory resolution | Manual path construction | `resolvePhaseDir(cwd, phaseNumber)` from shared/phase-reader.ts | Already handles padding, scanning, error cases |
| Worktree git operations | Direct child_process spawn | `simpleGit(cwd).raw(['worktree', ...])` | Consistent with all other git operations in the project |
| Progress tracking | Custom counters | `ctx.ui.progress({ title, total })` | Established UI pattern used by scan, research, plan skills |

**Key insight:** The biggest risk in this phase is not the individual pieces but the orchestration complexity of execute. Keep the worktree manager as a thin wrapper around simple-git raw calls, and keep the plan parser as pure functions. The skill itself orchestrates these pieces.

## Common Pitfalls

### Pitfall 1: Worktree Branch Lock Contention
**What goes wrong:** Git enforces one worktree per branch. If two worktrees try to use the same branch name, `git worktree add` fails.
**Why it happens:** Sequential retries or duplicate plan IDs can create naming collisions.
**How to avoid:** Include a timestamp or random suffix in branch names: `sunco/exec/{planId}-{Date.now()}`. Use detached HEAD as Codex does if branch naming proves problematic.
**Warning signs:** `fatal: '{branch}' is already checked out at '{path}'` error from git.

### Pitfall 2: Untracked File Absence in Worktrees
**What goes wrong:** Git worktrees only check out tracked files. `node_modules/`, `.env`, `dist/` do not exist in new worktrees.
**Why it happens:** These are in `.gitignore` and are never committed.
**How to avoid:** After creating a worktree, either (a) run `npm install` if the agent needs to execute tests, or (b) symlink `node_modules` from the main worktree. For SUN's use case where agents just write code and commit, this may not be needed -- agents use the Claude Code CLI which reads files and writes changes, not running builds.
**Warning signs:** Build/test failures in worktree agents about missing modules.

### Pitfall 3: simple-git raw() Error Handling
**What goes wrong:** `git.raw()` throws on non-zero exit codes. The error message is in the thrown error's `.message` property, not in a structured result.
**Why it happens:** simple-git's raw method is a thin wrapper around `git` CLI execution.
**How to avoid:** Wrap all `raw()` calls in try/catch. Parse the error message for actionable info (e.g., "already checked out at" for branch conflicts). The WorktreeManager should catch and translate git errors into domain-specific errors.
**Warning signs:** Unhandled promise rejections during worktree creation.

### Pitfall 4: Disk Space Accumulation from Worktrees
**What goes wrong:** Each worktree checks out the entire working tree. With a 500MB repo, 5 parallel worktrees = 2.5GB temporary disk usage.
**Why it happens:** Worktrees share the .git object store but each gets a full working copy.
**How to avoid:** (1) Always clean up worktrees in `finally` blocks, (2) Run `git worktree prune` after cleanup, (3) Consider limiting max parallel agents (e.g., 3-5 concurrent).
**Warning signs:** Disk space warnings, slow worktree creation.

### Pitfall 5: Cherry-Pick Conflicts on Merge Back
**What goes wrong:** After successful execution in a worktree, cherry-picking commits back to the main branch can fail if two plans modified overlapping files.
**Why it happens:** The wave system should prevent this (same-wave plans are independent), but if plans have incorrect `files_modified` declarations, actual changes may overlap.
**How to avoid:** (1) Trust the wave system -- same-wave plans SHOULD NOT modify the same files, (2) Use `git cherry-pick --no-commit` + `git commit` to have more control, (3) If a cherry-pick fails, flag it for user resolution rather than auto-resolving.
**Warning signs:** Merge conflicts during cherry-pick operations.

### Pitfall 6: Review Diff Size Exceeding Context Window
**What goes wrong:** A full phase diff can be thousands of lines, exceeding the AI provider's context window.
**Why it happens:** Phase reviews aggregate all plan diffs.
**How to avoid:** (1) For `--phase` mode, review each plan's diff separately rather than a monolithic diff, (2) Truncate diffs beyond a configurable limit (e.g., 10,000 lines) with a "truncated" warning, (3) For individual changes, cap at staged+unstaged diff size.
**Warning signs:** Agent timeouts, empty or truncated review output.

### Pitfall 7: Permission Escalation in Execute Role
**What goes wrong:** The `execution` role allows `writePaths: ['src/**', 'packages/**', 'tests/**']`. If a plan's `files_modified` includes paths outside these patterns, the permission harness will throw `PermissionDeniedError`.
**Why it happens:** Plan files might list paths like `.planning/**` or config files.
**How to avoid:** The execute skill should scope `writePaths` to the intersection of the role defaults and the plan's `files_modified` list. Review that all `files_modified` entries fall within the execution role's allowed write paths. If a plan needs to write to `.planning/`, that task should use role `planning` instead.
**Warning signs:** `PermissionDeniedError` from the permission harness during agent dispatch.

## Code Examples

### simple-git raw() for Worktree Operations

```typescript
// Source: verified against simple-git 3.33.0 API + git 2.50.1 docs
import { simpleGit } from 'simple-git';

const git = simpleGit(cwd);

// Create worktree with new branch from HEAD
await git.raw(['worktree', 'add', '-b', branchName, worktreePath]);

// Create worktree from specific base branch
await git.raw(['worktree', 'add', '-b', branchName, worktreePath, baseBranch]);

// List worktrees (returns newline-separated list)
const list = await git.raw(['worktree', 'list']);

// Remove worktree (force removes even if dirty)
await git.raw(['worktree', 'remove', '--force', worktreePath]);

// Prune stale worktree references
await git.raw(['worktree', 'prune']);

// Delete the branch after worktree removal
await git.raw(['branch', '-D', branchName]);
```

### Commit in Worktree with --no-verify

```typescript
// Source: D-02 (agents commit with --no-verify to avoid hook contention)
const worktreeGit = simpleGit(worktreePath);

// Stage specific files
await worktreeGit.add(filePaths);

// Commit with --no-verify (per D-02)
await worktreeGit.commit(
  `feat(phase-${paddedPhase}): ${taskName}`,
  { '--no-verify': null },
);
```

### Cherry-Pick from Worktree Branch Back to Main

```typescript
// After worktree agent completes, cherry-pick its commits
const mainGit = simpleGit(mainCwd);
const worktreeGit = simpleGit(worktreePath);

// Get commit hashes from worktree (new commits only)
const log = await worktreeGit.log({ from: baseBranch, to: 'HEAD' });
for (const commit of log.all) {
  await mainGit.raw(['cherry-pick', commit.hash]);
}
```

### PLAN.md Frontmatter Parsing (regex-based)

```typescript
// Source: matches existing parsing patterns (state-reader.ts, roadmap-parser.ts)

function parseFrontmatter(content: string): PlanFrontmatter {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error('No frontmatter found');

  const fm = fmMatch[1];
  const get = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m?.[1]?.trim() ?? '';
  };

  // Parse array values (- item format)
  const getArray = (key: string): string[] => {
    const section = fm.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm'));
    if (!section) {
      // Check for inline empty array: key: []
      const inline = fm.match(new RegExp(`^${key}:\\s*\\[\\]`, 'm'));
      return inline ? [] : [];
    }
    return section[1]
      .split('\n')
      .map(line => line.replace(/^\s*-\s+/, '').trim())
      .filter(Boolean);
  };

  return {
    phase: get('phase'),
    plan: parseInt(get('plan'), 10),
    type: get('type') as 'execute' | 'tdd',
    wave: parseInt(get('wave'), 10) || 1,
    depends_on: getArray('depends_on').map(Number),
    files_modified: getArray('files_modified'),
    autonomous: get('autonomous') === 'true',
    requirements: getArray('requirements'),
  };
}
```

### XML Task Block Extraction

```typescript
// Simple regex extraction for well-structured XML blocks
function extractTasks(content: string): PlanTask[] {
  // Remove frontmatter
  const body = content.replace(/^---[\s\S]*?---/, '').trim();

  // Extract all <task> blocks
  const taskRegex = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks: PlanTask[] = [];
  let match: RegExpExecArray | null;

  while ((match = taskRegex.exec(body)) !== null) {
    const block = match[1];
    const extract = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m?.[1]?.trim() ?? '';
    };

    const name = extract('name');
    const filesStr = extract('files');
    const action = extract('action');
    const automated = block.match(/<automated>([\s\S]*?)<\/automated>/)?.[1]?.trim() ?? '';
    const doneStr = extract('done');

    tasks.push({
      name,
      files: filesStr.split('\n').map(f => f.trim()).filter(Boolean),
      action,
      verify: automated,
      done: doneStr.split('\n').map(d => d.replace(/^-\s*/, '').trim()).filter(Boolean),
    });
  }

  return tasks;
}
```

### Review Diff Generation

```typescript
// Source: simple-git API for diff operations
const git = simpleGit(cwd);

// Mode 1: staged + unstaged changes (sunco review with no flags)
const stagedDiff = await git.diff(['--cached']);
const unstagedDiff = await git.diff();
const combinedDiff = [stagedDiff, unstagedDiff].filter(Boolean).join('\n');

// Mode 2: phase diff (sunco review --phase N)
// Get diff between current branch and the commit before phase started
// This requires knowing the base commit -- use git log to find it
const phaseDiff = await git.diff([`${baseCommit}..HEAD`]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential agent execution | Git worktree parallel isolation | 2025-2026 | 2-3x wall-clock reduction for independent tasks |
| Single-provider review | Multi-provider cross-review | 2025 (Claude/Codex/Gemini ecosystem) | Adversarial verification catches blind spots |
| Full XML parser for structured blocks | Regex extraction for simple XML | Established in SUN codebase | Zero dependency, 20 lines vs 50KB library |
| YAML library for frontmatter | Regex-based key/value extraction | Established in SUN codebase | Consistent with state-reader.ts, roadmap-parser.ts |

## Open Questions

1. **Cherry-pick vs. merge strategy for integrating worktree commits**
   - What we know: Cherry-pick is cleaner (linear history), merge preserves branch context
   - What's unclear: Whether cherry-pick conflicts are likely with well-separated wave plans
   - Recommendation: Start with cherry-pick (cleaner for atomic commits per D-03). Fall back to user resolution if conflicts detected.

2. **Node_modules in worktrees for test execution**
   - What we know: Worktrees don't include gitignored files. `npm install` in each worktree is expensive (~10-30s).
   - What's unclear: Whether executor agents need to run tests in their worktrees
   - Recommendation: Skip npm install in worktrees for v1. Agents write code and commit. Post-wave validation runs tests once in the main worktree after cherry-pick.

3. **Provider ID mapping for review flags**
   - What we know: `crossVerify` accepts `providerIds?: string[]`. Flag names (--codex, --gemini, --claude) need to map to registered provider IDs.
   - What's unclear: Exact provider ID format (depends on what providers are registered at runtime)
   - Recommendation: Use `listProviders()` to get available IDs, then match against flag-to-family mapping (`codex -> openai`, `gemini -> google`, `claude -> claude`). Match by family prefix.

4. **Diff size limits for review agents**
   - What we know: Context windows vary by provider (100K-200K tokens). Large diffs overwhelm models.
   - What's unclear: Exact optimal diff size limit
   - Recommendation: Cap at 50,000 characters (~12K tokens) per review request. For larger diffs, split by file and review in batches. Include a `--no-limit` flag for power users.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git (with worktree) | Worktree isolation | Yes | 2.50.1 | No fallback (hard requirement) |
| simple-git | Git operations wrapper | Yes | 3.33.0 (installed) | No fallback (already used) |
| Node.js | Runtime | Yes | v22.16.0 | No fallback |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 |
| Config file | packages/skills-workflow (inherits from workspace root) |
| Quick run command | `cd packages/skills-workflow && npx vitest run src/__tests__/execute.test.ts -x` |
| Full suite command | `cd packages/skills-workflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WF-14 | Execute reads PLAN.md files and groups by wave | unit | `npx vitest run src/__tests__/plan-parser.test.ts -x` | Wave 0 |
| WF-14 | Worktree creation/removal lifecycle | unit | `npx vitest run src/__tests__/worktree-manager.test.ts -x` | Wave 0 |
| WF-14 | Wave orchestration dispatches agents in parallel | unit | `npx vitest run src/__tests__/execute.test.ts -x` | Wave 0 |
| WF-14 | Failed agent triggers user choice (retry/skip/abort) | unit | `npx vitest run src/__tests__/execute.test.ts -x` | Wave 0 |
| WF-14 | Atomic commits per task, rollback on failure | unit | `npx vitest run src/__tests__/execute.test.ts -x` | Wave 0 |
| WF-13 | Review dispatches to multiple providers | unit | `npx vitest run src/__tests__/review.test.ts -x` | Wave 0 |
| WF-13 | Reviews synthesized into REVIEWS.md | unit | `npx vitest run src/__tests__/review.test.ts -x` | Wave 0 |
| WF-13 | `--phase N` mode vs default staged changes mode | unit | `npx vitest run src/__tests__/review.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/skills-workflow && npx vitest run -x`
- **Per wave merge:** `cd packages/skills-workflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/skills-workflow/src/__tests__/execute.test.ts` -- covers WF-14
- [ ] `packages/skills-workflow/src/__tests__/review.test.ts` -- covers WF-13
- [ ] `packages/skills-workflow/src/__tests__/plan-parser.test.ts` -- covers plan parsing
- [ ] `packages/skills-workflow/src/__tests__/worktree-manager.test.ts` -- covers worktree lifecycle

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/core/src/agent/router.ts` -- AgentRouter.run() and crossVerify() implementation
- Codebase inspection: `packages/core/src/agent/types.ts` -- AgentRequest, AgentResult, PermissionSet, AgentRole types
- Codebase inspection: `packages/core/src/agent/permission.ts` -- ROLE_PERMISSIONS defaults and enforcePermissions()
- Codebase inspection: `packages/skills-workflow/src/plan.skill.ts` -- plan-checker validation loop pattern
- Codebase inspection: `packages/skills-workflow/src/scan.skill.ts` -- parallel agent dispatch pattern (Promise.allSettled)
- Codebase inspection: `packages/skills-workflow/src/shared/` -- phase-reader, git-state, planning-writer patterns
- Codebase inspection: `packages/skills-workflow/src/__tests__/plan.test.ts` -- mock context factory, test patterns
- Runtime verification: simple-git 3.33.0 has no worktree methods; `raw()` confirmed available
- Runtime verification: git 2.50.1 with worktree support confirmed
- [Git worktree documentation](https://git-scm.com/docs/git-worktree) -- official git worktree commands

### Secondary (MEDIUM confidence)
- [Codex App Worktrees guide](https://www.verdent.ai/guides/codex-app-worktrees-explained) -- detached HEAD, cleanup patterns, ~0.8s creation benchmarks
- [Git Worktrees for parallel AI agents (Medium)](https://medium.com/@mabd.dev/git-worktrees-the-secret-weapon-for-running-multiple-ai-coding-agents-in-parallel-e9046451eb96) -- agent workflow patterns
- [Git worktrees for parallel AI coding agents (Upsun)](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/) -- isolation best practices

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified in codebase
- Architecture: HIGH - patterns directly derived from existing skills (plan, scan, research)
- Pitfalls: HIGH - worktree pitfalls verified against official git docs + community experiences
- Plan parser: HIGH - regex approach matches established codebase convention
- Review crossVerify: HIGH - API verified by reading router.ts implementation

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- no dependency changes expected)
