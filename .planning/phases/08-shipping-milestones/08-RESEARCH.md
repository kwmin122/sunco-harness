# Phase 8: Shipping + Milestones - Research

**Researched:** 2026-03-28
**Domain:** CLI skill implementation (ship, release, milestone lifecycle), git operations, npm publishing, PR creation
**Confidence:** HIGH

## Summary

Phase 8 implements 3 skill files covering 7 requirements: `ship.skill.ts` (SHP-01), `release.skill.ts` (SHP-02), and `milestone.skill.ts` (WF-03 through WF-07). All skills live in `packages/skills-workflow/src/` and follow the established `defineSkill()` pattern with Commander.js options and `SkillContext` API.

The ship skill is a hybrid that first calls `ctx.run('workflow.verify')` as a pre-check, then creates a PR via `execa` calling `gh pr create` (GitHub CLI). The release skill is purely deterministic -- it bumps versions in package.json files, generates CHANGELOG.md entries, creates a git tag, and optionally runs `npm publish`. The milestone skill uses Commander.js positional arg routing (identical to `phase.skill.ts`) for 5 subcommands: `new`, `audit`, `complete`, `summary`, `gaps`.

**Primary recommendation:** Structure as 4 plans -- (1) shared infrastructure + prompt builders, (2) ship + release skills, (3) milestone skill with 5 subcommands, (4) CLI wiring + barrel exports + recommender rules + build verification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Ship flow: (1) Run sunco verify as pre-check, (2) Create git branch if needed, (3) Push to remote, (4) Create PR via `gh` CLI or simple-git, (5) Report pass/fail with link.
- **D-02:** Verification pre-check calls ctx.run('workflow.verify') internally. If verify returns FAIL, ship blocks with clear error showing which layers failed.
- **D-03:** PR creation uses `execa` to call `gh pr create` (GitHub CLI). Fallback: show git push command for manual PR creation.
- **D-04:** PR body auto-generated from: phase context, plan summaries, verification results, changelog since last tag.
- **D-05:** Release flow: (1) Bump version in package.json files, (2) Generate/update CHANGELOG.md, (3) Create git tag, (4) Run `npm publish` (or dry-run with `--dry-run`).
- **D-06:** Version bump: semver-based (--major/--minor/--patch flags, default patch). Updates root + all workspace package.json files.
- **D-07:** Deterministic skill (kind: 'deterministic') -- no agent needed. Pure git + npm operations.
- **D-08:** `milestone new` (WF-03): Interactive setup for next milestone. Prompts for name/goal, creates PROJECT.md milestone section, runs abbreviated new-project flow (questions -> roadmap).
- **D-09:** `milestone audit` (WF-04): Agent-powered audit comparing milestone intent (from PROJECT.md) against actual delivery (from VERIFICATION.md files). Produces audit report with achievement score.
- **D-10:** `milestone complete` (WF-05): Archives completed milestone: moves .planning/ to .planning/archive/{milestone}/, creates git tag, updates PROJECT.md status.
- **D-11:** `milestone summary` (WF-06): Agent-powered comprehensive report: work done, decisions made, lessons learned, metrics. For team onboarding and stakeholder review.
- **D-12:** `milestone gaps` (WF-07): Reads audit report, identifies unmet requirements, auto-generates catch-up phases in ROADMAP.md.
- **D-13:** Milestone subcommands use Commander.js positional args: `sunco milestone new`, `sunco milestone audit`, etc.
- **D-14:** `milestone new` and `milestone summary` are kind: 'prompt' (agent-powered). Others are kind: 'deterministic'.
- **D-15:** All skills in `packages/skills-workflow/src/` -- ship.skill.ts, release.skill.ts, milestone.skill.ts.
- **D-16:** Reuse simple-git for branch/tag/push operations. Reuse execa for gh/npm CLI calls.
- **D-17:** Milestone data stored in PROJECT.md (milestone sections) and STATE.md (current milestone).

### Claude's Discretion
- PR body template formatting
- CHANGELOG generation format
- Milestone audit scoring algorithm
- Summary report structure
- Gap-to-phase mapping heuristics

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHP-01 | `sunco ship` -- PR creation + 5-layer filter pass check + auto/manual gates | D-01 through D-04; ctx.run('workflow.verify') for pre-check; execa+gh for PR; simple-git for branch/push |
| SHP-02 | `sunco release` -- version tagging + archive + npm publish | D-05 through D-07; semver bump logic; simple-git addTag/push; execa for npm publish |
| WF-03 | `sunco milestone new` -- next milestone start (questions->research->requirements->roadmap) | D-08; prompt skill; abbreviated new-project flow; writePlanningArtifact for docs |
| WF-04 | `sunco milestone audit` -- milestone achievement verification (intent vs actual) | D-09; agent-powered; reads PROJECT.md + VERIFICATION.md; scoring algorithm |
| WF-05 | `sunco milestone complete` -- archive + tag + next prep | D-10; deterministic; fs move to archive dir; simple-git tag; STATE.md update |
| WF-06 | `sunco milestone summary` -- comprehensive report for onboarding/review | D-11; prompt skill; agent reads all artifacts and synthesizes report |
| WF-07 | `sunco milestone gaps` -- audit gap -> catch-up phase generation | D-12; deterministic; reads audit report; uses addPhase from roadmap-writer |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| simple-git | 3.33.0 | Git operations: branch, tag, push, log, diff | Already a direct dep in skills-workflow. Covers addTag, addAnnotatedTag, push, pushTags, checkoutBranch, branch |
| execa | 9.6.1 | Spawn gh CLI and npm publish subprocess | Already a direct dep in @sunco/core. Used by ClaudeCliProvider. Dynamic import pattern established |
| @sunco/core | * | defineSkill, SkillContext, SkillResult | Workspace dep |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk | 5.6.2 | Colored terminal output | Already in skills-workflow deps. For colored ship/release status messages |
| glob | 13.0.6 | File globbing | Already in skills-workflow deps. For finding workspace package.json files |

### New Dependencies Required
None. All necessary libraries are already in the dependency tree. Semver bump logic (increment major/minor/patch) is trivially implementable in ~20 lines without importing the `semver` package, given that we only need `inc()` functionality for clean version strings (not range parsing).

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/skills-workflow/src/
  ship.skill.ts              # SHP-01: PR creation with verify pre-check
  release.skill.ts           # SHP-02: Version bump + tag + publish
  milestone.skill.ts         # WF-03~07: 5 subcommands via positional args
  shared/
    changelog-writer.ts      # CHANGELOG.md generation logic
    version-bumper.ts        # Semver bump + workspace package.json update
    milestone-helpers.ts     # Archive, audit parsing, gap analysis helpers
  prompts/
    milestone-audit.ts       # Prompt builder for audit agent
    milestone-summary.ts     # Prompt builder for summary agent
    milestone-new.ts         # Prompt builder for abbreviated new flow
    ship-pr-body.ts          # PR body template builder
  __tests__/
    ship.test.ts
    release.test.ts
    milestone.test.ts
    version-bumper.test.ts
    changelog-writer.test.ts
```

### Pattern 1: Subcommand Routing via Positional Args
**What:** Commander.js positional args for `sunco milestone <subcommand>`
**When to use:** When a single skill needs multiple operations (established in phase.skill.ts)
**Example:**
```typescript
// Source: packages/skills-workflow/src/phase.skill.ts (existing pattern)
export default defineSkill({
  id: 'workflow.milestone',
  command: 'milestone',
  kind: 'prompt',  // D-14: new and summary are agent-powered
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Manage milestone lifecycle: new, audit, complete, summary, gaps',

  async execute(ctx) {
    const positionalArgs = (ctx.args._ as string[] | undefined) ?? [];
    const subcommand = positionalArgs[0];

    switch (subcommand) {
      case 'new': return handleNew(ctx, positionalArgs);
      case 'audit': return handleAudit(ctx);
      case 'complete': return handleComplete(ctx);
      case 'summary': return handleSummary(ctx);
      case 'gaps': return handleGaps(ctx);
      default: /* show usage */
    }
  },
});
```

### Pattern 2: Verification Pre-Check via ctx.run()
**What:** Ship skill calls verify before creating PR
**When to use:** Ship flow step 1 (D-01, D-02)
**Example:**
```typescript
// Invoke verify skill internally
const verifyResult = await ctx.run('workflow.verify');
if (!verifyResult.success) {
  // Block ship with clear error
  const report = verifyResult.data as VerifyReport;
  const failedLayers = report.layers.filter(l => !l.passed);
  return {
    success: false,
    summary: `Ship blocked: verification failed (${failedLayers.length} layer(s))`,
    data: { verifyResult },
  };
}
```

### Pattern 3: External CLI Fallback (gh CLI)
**What:** Try gh CLI first, fall back to showing manual commands
**When to use:** PR creation (D-03)
**Example:**
```typescript
// Dynamic import execa (same pattern as ClaudeCliProvider)
const { execa } = await import('execa');

// Check if gh is available
try {
  await execa('gh', ['--version']);
} catch {
  // Fallback: show git push command for manual PR
  return {
    success: true,
    summary: 'Branch pushed. Create PR manually.',
    data: { manual: true, pushUrl: `git push -u origin ${branchName}` },
    warnings: ['GitHub CLI (gh) not installed. Create PR manually.'],
  };
}

// gh is available -- create PR
const prResult = await execa('gh', [
  'pr', 'create',
  '--title', prTitle,
  '--body', prBody,
]);
```

### Pattern 4: Deterministic Version Bump
**What:** Parse version string, increment component, write back
**When to use:** Release skill (D-06)
**Example:**
```typescript
// Simple semver bump without external library
function bumpVersion(
  version: string,
  type: 'major' | 'minor' | 'patch',
): string {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
  }
}
```

### Pattern 5: Workspace Package.json Bulk Update
**What:** Find all package.json files in monorepo and update versions
**When to use:** Release skill (D-06) -- updates root + all workspace packages
**Example:**
```typescript
import { glob } from 'glob';

async function updateAllVersions(cwd: string, newVersion: string): Promise<string[]> {
  const pkgFiles = await glob('**/package.json', {
    cwd,
    ignore: ['**/node_modules/**'],
  });

  const updated: string[] = [];
  for (const file of pkgFiles) {
    const fullPath = join(cwd, file);
    const pkg = JSON.parse(await readFile(fullPath, 'utf-8'));
    if (pkg.version) {
      pkg.version = newVersion;
      await writeFile(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      updated.push(file);
    }
  }
  return updated;
}
```

### Pattern 6: Milestone Archive
**What:** Move .planning/ to .planning/archive/{milestone}/
**When to use:** milestone complete (D-10)
**Example:**
```typescript
import { rename, mkdir, cp } from 'node:fs/promises';

async function archiveMilestone(cwd: string, milestoneName: string): Promise<string> {
  const archiveDir = join(cwd, '.planning', 'archive', milestoneName);
  await mkdir(archiveDir, { recursive: true });

  // Copy phases, STATE.md, ROADMAP.md, etc. to archive
  // Keep .planning/ structure intact for next milestone
  const itemsToArchive = ['phases', 'STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md'];
  for (const item of itemsToArchive) {
    const src = join(cwd, '.planning', item);
    const dest = join(archiveDir, item);
    await cp(src, dest, { recursive: true });
  }
  return archiveDir;
}
```

### Anti-Patterns to Avoid
- **Blocking on missing gh CLI:** Never fail the entire ship flow because gh is missing. Always provide a manual fallback with the git push URL (D-03).
- **Sync file operations in release:** All file reads/writes must be async (node:fs/promises). Never use fs.readFileSync in skill code.
- **Hardcoded version in multiple places:** Use the glob-based workspace update pattern to ensure all package.json files stay in sync.
- **Agent calls in deterministic skills:** Release and milestone complete/gaps are deterministic. They must NOT call ctx.agent.run(). Only milestone new and summary use agents (D-14).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git tag creation | Custom git subprocess calls | `simple-git` addAnnotatedTag + pushTags | Already a dep, handles edge cases (tag naming, remote detection) |
| Git branch/push | Manual git CLI invocation | `simple-git` checkoutLocalBranch + push | Type-safe, error handling built in |
| GitHub PR creation | HTTP API calls to GitHub REST API | `execa` + `gh pr create` | gh CLI handles auth, repo detection, and output formatting |
| npm publish | Manual HTTP calls to npm registry | `execa` + `npm publish` | npm CLI handles auth tokens, 2FA, registry resolution |
| Git log since tag | Custom log parsing | `simple-git` log with `from..to` range | Built-in log filtering and parsing |
| File globbing for package.json | Manual directory traversal | `glob` package (already in deps) | Handles ignore patterns, symlinks |

**Key insight:** Ship and release are orchestration skills -- they compose existing CLIs (gh, npm, git) rather than reimplementing their functionality. The value is in the orchestration flow and error handling, not in the git/npm operations themselves.

## Common Pitfalls

### Pitfall 1: gh CLI Authentication State
**What goes wrong:** `gh pr create` fails because the user hasn't authenticated gh CLI or the token has expired.
**Why it happens:** gh CLI requires `gh auth login` before use. This is a runtime dependency outside SUNCO's control.
**How to avoid:** Check `gh auth status` before attempting PR creation. If not authenticated, show clear instructions and fall back to manual git push command.
**Warning signs:** `execa` throws with stderr containing "authentication" or "not logged in".

### Pitfall 2: Dirty Working Tree During Release
**What goes wrong:** `npm publish` includes untracked/modified files, or `git tag` fails because of staged changes.
**Why it happens:** User runs `sunco release` with uncommitted work.
**How to avoid:** Check `git status` at the start of release flow. Warn if working tree is dirty. Require `--force` flag to proceed with dirty tree.
**Warning signs:** `simpleGit.status()` returns `files.length > 0`.

### Pitfall 3: execa Dynamic Import in ESM Context
**What goes wrong:** Direct `import { execa } from 'execa'` fails at build time or bundle time because execa is a CLI external.
**Why it happens:** execa is listed in CLI tsup externals (uses cross-spawn which requires CJS). Must be dynamically imported.
**How to avoid:** Use `const { execa } = await import('execa')` pattern (same as ClaudeCliProvider does).
**Warning signs:** Build error about "require is not defined" or "Cannot find module".

### Pitfall 4: Workspace Version Sync Drift
**What goes wrong:** Release bumps root package.json but misses workspace package versions, causing npm publish to fail or publish mismatched versions.
**Why it happens:** Monorepo has multiple package.json files (root + packages/*).
**How to avoid:** Glob for ALL package.json files in the workspace. Update all that have a `version` field. Report all updated files for visibility.
**Warning signs:** `npm publish` warnings about version mismatch.

### Pitfall 5: Milestone Archive Clobbers Active State
**What goes wrong:** `milestone complete` moves .planning/ contents and breaks the current working state.
**Why it happens:** Moving instead of copying, or not resetting STATE.md/ROADMAP.md for the next milestone.
**How to avoid:** Use `cp` (copy) to archive, then clean up or reinitialize the active .planning/ structure. Write a fresh STATE.md with reset progress.
**Warning signs:** `sunco status` shows stale or missing state after milestone completion.

### Pitfall 6: PR Body Too Long
**What goes wrong:** Auto-generated PR body exceeds GitHub's limit (65536 characters) when including full verification results and changelogs.
**Why it happens:** Phase context + plan summaries + verification report can be very long.
**How to avoid:** Truncate each section with a character budget. Use summary-level data (verdict, finding count) rather than full details. Link to full VERIFICATION.md in the PR body.
**Warning signs:** gh CLI returns error about body length.

### Pitfall 7: Tag Name Conflicts
**What goes wrong:** `simple-git` addTag fails because a tag with that name already exists.
**Why it happens:** User re-runs `sunco release` without incrementing version, or someone manually created a tag.
**How to avoid:** Check if tag exists first with `git.tags()`. If exists, offer to skip tagging or use a different name.
**Warning signs:** Git error "fatal: tag 'vX.Y.Z' already exists".

### Pitfall 8: Ship Skill Kind Must Be 'prompt' (Not 'hybrid')
**What goes wrong:** Setting ship as 'deterministic' blocks the ctx.run('workflow.verify') call since verify is a prompt skill.
**Why it happens:** Ship calls verify internally which needs agent access.
**How to avoid:** Ship skill must be kind: 'prompt' to ensure ctx.agent is available for the verify pre-check. Even though ship itself doesn't call agents directly, it orchestrates a prompt skill.
**Warning signs:** Runtime error about agent not available.

## Code Examples

### Ship Skill Structure (SHP-01)
```typescript
// Source: derived from D-01 through D-04 + existing verify.skill.ts pattern
import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { simpleGit } from 'simple-git';
import { captureGitState } from './shared/git-state.js';

export default defineSkill({
  id: 'workflow.ship',
  command: 'ship',
  kind: 'prompt',  // Needs agent access for verify pre-check
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Create PR with verification pre-check and quality gates',
  options: [
    { flags: '-p, --phase <number>', description: 'Phase to ship' },
    { flags: '--skip-verify', description: 'Skip verification pre-check' },
    { flags: '--draft', description: 'Create draft PR' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // Step 1: Verify pre-check (D-02)
    // Step 2: Create branch if needed (D-01)
    // Step 3: Push to remote
    // Step 4: Create PR via gh CLI (D-03)
    // Step 5: Report result with PR link
  },
});
```

### Release Skill Structure (SHP-02)
```typescript
// Source: derived from D-05 through D-07
import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'workflow.release',
  command: 'release',
  kind: 'deterministic',  // D-07: no agent needed
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Version tagging, changelog, and npm publish',
  options: [
    { flags: '--major', description: 'Bump major version' },
    { flags: '--minor', description: 'Bump minor version' },
    { flags: '--patch', description: 'Bump patch version (default)' },
    { flags: '--dry-run', description: 'Preview without publishing' },
    { flags: '--skip-publish', description: 'Skip npm publish' },
  ],

  async execute(ctx) {
    // Step 1: Read current version from root package.json
    // Step 2: Bump version (D-06)
    // Step 3: Update all workspace package.json files
    // Step 4: Generate/update CHANGELOG.md
    // Step 5: Git commit + tag (D-05)
    // Step 6: npm publish (or dry-run)
    // Step 7: Push tag to remote
  },
});
```

### Milestone Subcommand Router (WF-03~07)
```typescript
// Source: derived from phase.skill.ts pattern + D-08 through D-14
import { defineSkill } from '@sunco/core';

export default defineSkill({
  id: 'workflow.milestone',
  command: 'milestone',
  kind: 'prompt',  // D-14: new and summary need agent
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Milestone lifecycle: new, audit, complete, summary, gaps',

  async execute(ctx) {
    const positionalArgs = (ctx.args._ as string[] | undefined) ?? [];
    const subcommand = positionalArgs[0];

    switch (subcommand) {
      case 'new': return handleNew(ctx);        // WF-03, prompt
      case 'audit': return handleAudit(ctx);      // WF-04, prompt
      case 'complete': return handleComplete(ctx); // WF-05, deterministic
      case 'summary': return handleSummary(ctx);   // WF-06, prompt
      case 'gaps': return handleGaps(ctx);         // WF-07, deterministic
      default:
        return {
          success: true,
          summary: 'Usage: sunco milestone <new|audit|complete|summary|gaps>',
        };
    }
  },
});
```

### CHANGELOG Generation Pattern
```typescript
// Claude's discretion: conventional changelog format
function generateChangelog(
  entries: { type: string; description: string; hash: string }[],
  version: string,
  date: string,
): string {
  const lines: string[] = [];
  lines.push(`## [${version}] - ${date}`);
  lines.push('');

  // Group by type
  const groups: Record<string, typeof entries> = {};
  for (const entry of entries) {
    const key = entry.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  const typeLabels: Record<string, string> = {
    feat: 'Features',
    fix: 'Bug Fixes',
    docs: 'Documentation',
    refactor: 'Refactoring',
    test: 'Tests',
    chore: 'Maintenance',
  };

  for (const [type, items] of Object.entries(groups)) {
    const label = typeLabels[type] ?? type;
    lines.push(`### ${label}`);
    for (const item of items) {
      lines.push(`- ${item.description} (${item.hash.slice(0, 7)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual PR creation | gh CLI automation | gh CLI mature since 2020 | One-command PR with body, labels, reviewers |
| npm version + publish as separate steps | Unified release flow | standard-version deprecated 2023 | Single `sunco release` does all 4 steps |
| Manual CHANGELOG editing | Git log parsing + conventional commits | 2023+ | Auto-generated from commit messages |
| Shell scripts for release | TypeScript skill orchestration | SUNCO architecture | Type-safe, testable, composable |

**Deprecated/outdated:**
- `standard-version`: Deprecated in favor of release-please or custom solutions. SUNCO builds its own lightweight equivalent.
- `conventional-changelog-cli`: Heavy dependency for what is essentially git log parsing + template formatting. Custom is simpler for SUNCO's needs.
- `lerna version`: Lerna's version management is heavy and opinionated. Simple-git + glob does the same for a monorepo.

## Open Questions

1. **Milestone audit scoring algorithm**
   - What we know: D-09 says "achievement score" comparing intent vs actual delivery
   - What's unclear: What constitutes the scoring formula (binary req met/unmet? weighted? percentage?)
   - Recommendation: Use simple percentage: (completed_reqs / total_reqs) * 100 with PASS/WARN/FAIL thresholds (>90% PASS, 70-90% WARN, <70% FAIL)

2. **PR branch naming convention**
   - What we know: D-01 says "create git branch if needed"
   - What's unclear: What naming pattern for ship branches
   - Recommendation: `ship/phase-{N}-{slug}` to match existing branch naming conventions in config.json (`phase_branch_template`)

3. **Milestone new abbreviated flow scope**
   - What we know: D-08 says "runs abbreviated new-project flow (questions -> roadmap)"
   - What's unclear: How abbreviated -- skip research? Skip questions?
   - Recommendation: Keep 3-5 questions (milestone goal, scope, timeline) + agent synthesis into updated REQUIREMENTS.md + ROADMAP.md sections. Skip parallel multi-topic research (that's full `sunco new`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | All skills | Yes | 2.50.1 | None (required) |
| npm | release (publish) | Yes | 10.9.2 | --skip-publish flag |
| gh (GitHub CLI) | ship (PR creation) | No | -- | Show git push URL + manual PR instructions |
| node | Runtime | Yes | v22.16.0 | None (required) |

**Missing dependencies with no fallback:**
- None (git and node are available)

**Missing dependencies with fallback:**
- `gh` CLI is NOT installed on this machine. The ship skill MUST implement the fallback path (D-03): push branch and show manual PR creation instructions. This is not an edge case -- it's the primary path for this environment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 |
| Config file | `packages/skills-workflow/vitest.config.ts` |
| Quick run command | `cd packages/skills-workflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd /Users/min-kyungwook/SUN && npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHP-01 | Ship creates PR with verify pre-check | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/ship.test.ts -x` | Wave 0 |
| SHP-02 | Release bumps version, tags, publishes | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/release.test.ts -x` | Wave 0 |
| WF-03 | Milestone new creates milestone | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/milestone.test.ts -x` | Wave 0 |
| WF-04 | Milestone audit compares intent vs actual | unit | (same file) | Wave 0 |
| WF-05 | Milestone complete archives + tags | unit | (same file) | Wave 0 |
| WF-06 | Milestone summary generates report | unit | (same file) | Wave 0 |
| WF-07 | Milestone gaps creates catch-up phases | unit | (same file) | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/skills-workflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd /Users/min-kyungwook/SUN && npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/ship.test.ts` -- covers SHP-01
- [ ] `src/__tests__/release.test.ts` -- covers SHP-02
- [ ] `src/__tests__/milestone.test.ts` -- covers WF-03 through WF-07
- [ ] `src/__tests__/version-bumper.test.ts` -- covers version bump logic
- [ ] `src/__tests__/changelog-writer.test.ts` -- covers CHANGELOG generation

## Existing Code Reuse Map

### Direct Reuse (import as-is)
| Module | Import Path | Used By | For |
|--------|-------------|---------|-----|
| `captureGitState` | `./shared/git-state.js` | ship, release | Current branch detection, dirty tree check |
| `resolvePhaseDir` | `./shared/phase-reader.js` | ship, milestone audit | Finding phase directory by number |
| `readPhaseArtifact` | `./shared/phase-reader.js` | ship, milestone audit/summary | Reading VERIFICATION.md, CONTEXT.md, PLAN.md files |
| `writePhaseArtifact` | `./shared/phase-reader.js` | milestone audit/summary | Writing audit/summary reports |
| `writePlanningArtifact` | `./shared/planning-writer.js` | milestone new | Writing updated PROJECT.md, REQUIREMENTS.md |
| `parseRoadmap` | `./shared/roadmap-parser.js` | milestone gaps | Reading current roadmap state |
| `addPhase` | `./shared/roadmap-writer.js` | milestone gaps | Adding catch-up phases |
| `parseStateMd` | `./shared/state-reader.js` | milestone complete | Reading current milestone info |
| `simpleGit` | `simple-git` | ship, release, milestone complete | Git operations (already external in tsup) |
| `buildResearchPrompt` | `./prompts/research.js` | milestone new (abbreviated) | Research prompt for milestone scoping |

### Referencing Pattern (follow same structure)
| Reference | Pattern |
|-----------|---------|
| `verify.skill.ts` | ctx.run() pre-check, progress bars, result reporting |
| `phase.skill.ts` | Positional arg routing for subcommands |
| `execute.skill.ts` | execa dynamic import pattern |
| `review.skill.ts` | Agent dispatch with cross-verify pattern |
| `new.skill.ts` | Multi-step orchestration with agent synthesis |

## Recommender Rules Needed

The following rules should be added to `packages/core/src/recommend/rules.ts` for Phase 8 skill transitions:

| Rule | Trigger | Recommendations |
|------|---------|-----------------|
| after-ship-success (exists: Rule 7) | ship success | milestone audit (medium), status (low) -- already exists |
| after-ship-failure | ship failure | debug (high), verify (medium) |
| after-release-success | release success | milestone complete (medium), status (low) |
| after-release-failure | release failure | debug (high), release retry (medium) |
| after-milestone-new-success | milestone success | discuss (high), plan (medium) |
| after-milestone-complete-success | milestone complete | milestone new (high), status (medium) |
| after-milestone-gaps-success | gaps success | plan (high), execute (medium) |
| verify-pass-ship | verify PASS | ship (high) -- Rule 2 already covers this |

Existing rules 7 and 21-22 already cover some ship/milestone transitions. New rules needed: ~5.

## Sources

### Primary (HIGH confidence)
- `packages/skills-workflow/src/verify.skill.ts` -- ctx.run() pre-check pattern
- `packages/skills-workflow/src/phase.skill.ts` -- subcommand routing via positional args
- `packages/skills-workflow/src/execute.skill.ts` -- execa dynamic import, agent dispatch
- `packages/skills-workflow/src/review.skill.ts` -- agent cross-verify pattern
- `packages/skills-workflow/src/shared/` -- all shared utilities (git-state, phase-reader, planning-writer, roadmap-parser, roadmap-writer, state-reader)
- `packages/core/src/recommend/rules.ts` -- existing recommender rules (39 rules, 8 categories)
- `packages/core/src/agent/providers/claude-cli.ts` -- execa import pattern
- `packages/cli/src/cli.ts` -- skill registration and CLI wiring pattern
- `packages/cli/tsup.config.ts` -- external dependencies list
- `packages/skills-workflow/tsup.config.ts` -- entry points and build config

### Secondary (MEDIUM confidence)
- [simple-git documentation](https://github.com/steveukx/git-js) -- addTag, addAnnotatedTag, push, pushTags API
- [semver npm](https://www.npmjs.com/package/semver) -- v7.7.4 for reference (not adding as dep)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in the project, patterns well-established
- Architecture: HIGH -- follows exact patterns from phases 3-7 (subcommand routing, ctx.run, execa dynamic import)
- Pitfalls: HIGH -- identified from direct codebase inspection (gh CLI missing, dirty tree, execa import pattern)
- Recommender rules: HIGH -- existing rule structure analyzed, only ~5 new rules needed
- Milestone audit scoring: MEDIUM -- scoring algorithm is Claude's discretion, no hard requirements

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- all technologies are locked project decisions)
