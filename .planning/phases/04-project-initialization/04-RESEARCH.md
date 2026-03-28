# Phase 4: Project Initialization - Research

**Researched:** 2026-03-28
**Domain:** Agent-powered project bootstrapping (sunco new + sunco scan)
**Confidence:** HIGH

## Summary

Phase 4 implements two prompt skills (`sunco new` and `sunco scan`) that are the first agent-dispatching skills in the SUN system. Both skills follow the established `defineSkill()` pattern from Phase 1, live in `packages/skills-workflow/src/`, and use `ctx.agent.run()` to dispatch parallel research/analysis agents via the AgentRouter. The core infrastructure (AgentRouter, providers, permissions, FileStore, SkillUi) is already complete from Phase 1.

The primary technical challenge is that `sunco new` requires freeform text input (user's idea, answers to clarifying questions) but the current `SkillUi.ask()` only supports choice-based selection via `AskInput.options`. A new `askText()` method must be added to SkillUi, UiAdapter, and both adapter implementations (InkUiAdapter with ink-text-input, SilentUiAdapter with stdin fallback). This is the only infrastructure gap; everything else can be built on top of existing APIs.

**Primary recommendation:** Add `askText()` to SkillUi as a prerequisite, then implement both skills following established skill patterns. Keep agent prompts in separate `prompts/*.ts` files. Use `Promise.allSettled()` for parallel agent dispatch with graceful partial failure handling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Multi-step orchestrated flow for sunco new: (1) Accept idea as CLI arg or interactive prompt, (2) Ask 5-8 clarifying questions via ctx.ui.ask(), (3) Dispatch parallel research agents via ctx.agent.run() with role: 'research', (4) Synthesize research into requirements, (5) Generate roadmap from requirements. Each step shows progress via ctx.ui.progress().
- **D-02:** Research dispatches use AgentRouter with multiple parallel agent.run() calls. Research topics are derived from the user's idea and answers. Each research agent gets a focused prompt with scoped permissions (read-only).
- **D-03:** Output artifacts: PROJECT.md (vision, core value, constraints), REQUIREMENTS.md (categorized requirements), ROADMAP.md (phased plan with success criteria). All written to .planning/ directory.
- **D-04:** The question flow is adaptive -- later questions informed by earlier answers. Use ctx.ui.ask() for interactive choices, plain text input for freeform answers.
- **D-05:** Research results are synthesized by a single planning agent call (role: 'planning') that reads all research outputs and generates the requirements + roadmap.
- **D-06:** sunco new is kind: 'prompt' -- uses agent dispatch. Falls back gracefully if no agent provider is available.
- **D-07:** Produces 7 analysis documents in .sun/codebase/: STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTS.md, INTEGRATIONS.md, CONCERNS.md.
- **D-08:** Analysis uses parallel agent dispatch -- 4-7 agents each focused on one document, running simultaneously via Promise.allSettled(). Each agent gets read-only permissions scoped to the project directory.
- **D-09:** Each agent receives a focused prompt with specific questions to answer about the codebase. Prompts reference the document template and expected sections.
- **D-10:** Deterministic pre-scan first: glob file tree, count lines, detect stack markers (reuse Phase 2 ecosystem-detector), sample key files. This pre-scan output is passed as context to all agents.
- **D-11:** sunco scan is kind: 'prompt' -- uses agent dispatch. Falls back gracefully if no provider available.
- **D-12:** Scan results are written via ctx.fileStore.write('codebase', 'STACK.md', content) to .sun/codebase/.
- **D-13:** Both skills live in `packages/skills-workflow/src/` as `new.skill.ts` and `scan.skill.ts`.
- **D-14:** Reuse Phase 2's ecosystem-detector for deterministic pre-scan in both skills.
- **D-15:** Agent prompts are defined as template strings in separate files (e.g., `prompts/research.ts`, `prompts/scan-stack.ts`) to keep skill files clean and prompts maintainable.
- **D-16:** Progress reporting via ctx.ui.progress() for each step (questioning, researching, synthesizing, writing).

### Claude's Discretion
- Exact question phrasing for sunco new interactive flow
- Research topic selection heuristics
- Agent prompt templates content
- Document section structure for scan outputs
- Error handling for partial agent failures (some agents succeed, others fail)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WF-01 | `sunco new` -- idea->questions->parallel research->requirements->roadmap auto-generation | D-01 through D-06 define the full flow. AgentRouter.run() with role:'research' for parallel dispatch, role:'planning' for synthesis. ctx.ui.ask()/askText() for interactive flow. FileStore.write() for .planning/ output. |
| WF-02 | `sunco scan` -- existing codebase 7-document analysis | D-07 through D-12 define the scan flow. detectEcosystems() for pre-scan, Promise.allSettled() for parallel agent dispatch, ctx.fileStore.write('codebase', ...) for output. |
</phase_requirements>

## Standard Stack

### Core (already installed -- from Phase 1)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @sunco/core | 0.0.1 | Skill system, AgentRouter, SkillUi, FileStore, StateApi | Installed |
| @sunco/skills-harness | 0.0.1 | detectEcosystems() for pre-scan | Installed |
| ink | 6.8.0 | Terminal UI rendering | Installed |
| ink-select-input | 6.2.0 | Choice selection UI | Installed |
| execa | 9.6.1 | Claude CLI subprocess spawning | Installed |
| glob | 13.0.6 | File tree scanning | Installed |

### New Dependencies Required
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| ink-text-input | 6.0.0 | Freeform text input in terminal | SkillUi.ask() only supports choice; sunco new needs freeform text (idea, answers). Peer deps: ink>=5, react>=18 -- compatible. |

### No New Dependencies Needed
- AgentRouter already handles provider selection, permission enforcement, and result normalization
- FileStore already supports arbitrary category/filename writes (e.g., 'codebase', 'STACK.md')
- detectEcosystems() already does marker-based stack detection
- Promise.allSettled() is native JavaScript

**Installation:**
```bash
cd packages/core && npm install ink-text-input@6.0.0
```

## Architecture Patterns

### Project Structure Addition
```
packages/skills-workflow/src/
  new.skill.ts              # sunco new skill definition + orchestration
  scan.skill.ts             # sunco scan skill definition + orchestration
  prompts/                  # NEW directory for agent prompt templates
    research.ts             # Research agent prompt builder
    synthesis.ts            # Planning/synthesis agent prompt builder
    scan-stack.ts           # Scan: STACK.md agent prompt
    scan-architecture.ts    # Scan: ARCHITECTURE.md agent prompt
    scan-structure.ts       # Scan: STRUCTURE.md agent prompt
    scan-conventions.ts     # Scan: CONVENTIONS.md agent prompt
    scan-tests.ts           # Scan: TESTS.md agent prompt
    scan-integrations.ts    # Scan: INTEGRATIONS.md agent prompt
    scan-concerns.ts        # Scan: CONCERNS.md agent prompt
    index.ts                # Barrel export
```

### Pattern 1: SkillUi.askText() Extension
**What:** Add a freeform text input method to the SkillUi interface alongside the existing ask() for choices.
**When to use:** When skills need the user to type arbitrary text (ideas, descriptions, answers).
**Confidence:** HIGH -- this is a necessary extension to the existing two-layer UI pattern (D-38).

The interface extension:
```typescript
// In SkillUi.ts -- new types
export interface AskTextInput {
  /** Question/prompt message */
  message: string;
  /** Placeholder text shown before user types */
  placeholder?: string;
  /** Default value (used in non-interactive mode) */
  defaultValue?: string;
}

export interface UiTextResult {
  /** The text the user entered */
  text: string;
  /** How the text was provided */
  source: 'keyboard' | 'default' | 'noninteractive' | 'cli-arg';
}

// In SkillUi interface -- new method
export interface SkillUi {
  // ... existing methods ...
  /** Prompt the user for freeform text input */
  askText(input: AskTextInput): Promise<UiTextResult>;
}
```

The UiPatternKind needs to add `'askText'` and both adapters (InkUiAdapter, SilentUiAdapter) need to handle the new pattern kind.

### Pattern 2: Prompt Skill Orchestration (sunco new)
**What:** Multi-step skill that combines interactive UI + parallel agent dispatch + file writing.
**When to use:** Any skill that orchestrates a user conversation followed by agent work.

```typescript
// Source: Established pattern from skill types + agent router API
import { defineSkill } from '@sunco/core';
import { buildResearchPrompt, buildSynthesisPrompt } from './prompts/index.js';

export default defineSkill({
  id: 'workflow.new',
  command: 'new',
  kind: 'prompt',   // Agent access required
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  description: 'Bootstrap a new project from an idea',

  async execute(ctx) {
    // Step 1: Get idea (from CLI arg or interactive)
    const positional = (ctx.args._ as string[] | undefined) ?? [];
    let idea = positional.join(' ').trim();
    if (!idea) {
      const response = await ctx.ui.askText({ message: 'Describe your idea:' });
      idea = response.text;
    }

    // Step 2: Ask clarifying questions (adaptive)
    const progress = ctx.ui.progress({ title: 'Gathering context', total: 8 });
    const answers: Record<string, string> = {};
    // ... adaptive question loop using ctx.ui.ask() for choices, ctx.ui.askText() for freeform ...

    // Step 3: Parallel research dispatch
    progress.done({ summary: 'Context gathered' });
    const researchProgress = ctx.ui.progress({ title: 'Researching', total: topics.length });
    const researchResults = await Promise.allSettled(
      topics.map(topic =>
        ctx.agent.run({
          role: 'research',
          prompt: buildResearchPrompt(topic, idea, answers),
          permissions: {
            role: 'research',
            readPaths: ['**'],
            writePaths: [],
            allowTests: false,
            allowNetwork: false,
            allowGitWrite: false,
            allowCommands: [],
          },
        })
      )
    );

    // Step 4: Synthesize via planning agent
    // Step 5: Write artifacts to .planning/
    return { success: true, summary: 'Project initialized' };
  },
});
```

### Pattern 3: Parallel Agent Scan with Pre-scan (sunco scan)
**What:** Deterministic file analysis followed by parallel agent dispatch, each agent producing one document.
**When to use:** When analyzing an existing codebase with multiple independent analysis dimensions.

```typescript
// Source: Established patterns from ecosystem-detector + agent router
import { detectEcosystems } from '@sunco/skills-harness';
import { buildScanPrompt } from './prompts/index.js';

// Pre-scan: deterministic data gathering
const ecosystems = await detectEcosystems({ cwd: ctx.cwd });
const fileTree = await glob('**/*', { cwd: ctx.cwd, ignore: ['node_modules/**', '.git/**'] });
const preScanContext = buildPreScanContext(ecosystems, fileTree, sampleFiles);

// Parallel agent dispatch
const SCAN_DOCS = ['STACK', 'ARCHITECTURE', 'STRUCTURE', 'CONVENTIONS', 'TESTS', 'INTEGRATIONS', 'CONCERNS'];
const results = await Promise.allSettled(
  SCAN_DOCS.map(doc =>
    ctx.agent.run({
      role: 'research',
      prompt: buildScanPrompt(doc, preScanContext),
      permissions: {
        role: 'research',
        readPaths: ['**'],
        writePaths: [],
        allowTests: false,
        allowNetwork: false,
        allowGitWrite: false,
        allowCommands: [],
      },
    })
  )
);

// Write successful results to .sun/codebase/
for (let i = 0; i < SCAN_DOCS.length; i++) {
  const outcome = results[i];
  if (outcome.status === 'fulfilled' && outcome.value.success) {
    await ctx.fileStore.write('codebase', `${SCAN_DOCS[i]}.md`, outcome.value.outputText);
  }
}
```

### Pattern 4: Graceful Agent Unavailability Fallback (D-06, D-11)
**What:** Prompt skills must handle the case where no agent provider is available.
**When to use:** Every prompt skill needs this at the top of execute().

```typescript
// Check provider availability before any agent work
const providers = await ctx.agent.listProviders();
if (providers.length === 0) {
  await ctx.ui.result({
    success: false,
    title: 'New Project',
    summary: 'No AI provider available. Install Claude CLI or set ANTHROPIC_API_KEY.',
    warnings: [
      'Claude CLI: install from https://docs.anthropic.com/claude-code',
      'API Key: export ANTHROPIC_API_KEY=sk-...',
    ],
  });
  return { success: false, summary: 'No AI provider available' };
}
```

### Anti-Patterns to Avoid
- **Hardcoding prompts in skill files:** Prompts should be in `prompts/*.ts` (D-15). Skill files handle orchestration only.
- **Using Promise.all for agent dispatch:** Use `Promise.allSettled()` -- one agent failure should not abort the entire scan or research batch.
- **Exceeding role permissions:** Research agents MUST use `role: 'research'` with read-only permissions. Planning agent uses `role: 'planning'` with `.planning/**` write scope. Never use `role: 'execution'`.
- **Writing to .planning/ directly via fs:** Use `ctx.fileStore.write()` for .sun/ paths. For .planning/ paths (sunco new output), use node:fs/promises directly but with path safety checks (join + resolve within cwd).
- **Blocking on a single slow agent:** Set per-request timeouts on agent.run() to prevent one stuck research agent from blocking the entire flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ecosystem detection | Custom file scanning | `detectEcosystems()` from @sunco/skills-harness | Already handles 19 markers, dedup, confidence levels |
| Provider selection | Manual CLI/SDK checks | `ctx.agent.run()` via AgentRouter | Router selects provider by role, enforces permissions, tracks usage |
| File writing to .sun/ | Direct fs.writeFile | `ctx.fileStore.write(category, filename, content)` | Path traversal protection, auto directory creation |
| Interactive choices | Raw readline | `ctx.ui.ask()` with AskInput | Ink rendering, non-TTY fallback, consistent UX |
| Progress display | console.log progress | `ctx.ui.progress()` -> ProgressHandle | Ink-based rendering with update/done lifecycle |
| Text input | readline.createInterface | `ctx.ui.askText()` (new, to be built) | Consistent with SkillUi pattern, Ink rendering |

**Key insight:** Phase 4 is an orchestration phase. The heavy lifting (agent routing, permissions, UI, file storage) is already built. The skill code is "glue" that connects user interaction -> agent dispatch -> file output. Do not rebuild what Phase 1 provides.

## Common Pitfalls

### Pitfall 1: askText() Not Available
**What goes wrong:** Trying to use ctx.ui.ask() for freeform text input fails because AskInput requires options array.
**Why it happens:** Phase 1 only built choice-based ask(). D-04 explicitly says "plain text input for freeform answers."
**How to avoid:** Build askText() on SkillUi, UiAdapter, InkUiAdapter (using ink-text-input), and SilentUiAdapter (using defaultValue) BEFORE implementing sunco new.
**Warning signs:** AskInput requires `options: AskOption[]` -- no way to express "type your answer here."

### Pitfall 2: FileStore Category for .planning/ vs .sun/
**What goes wrong:** D-03 says sunco new writes to `.planning/` directory (PROJECT.md, REQUIREMENTS.md, ROADMAP.md), but FileStore operates within `.sun/` only.
**Why it happens:** FileStore has a `.sun/` root and path traversal guard that prevents writing outside.
**How to avoid:** For `.planning/` output, use `node:fs/promises` directly with path safety (resolve within `ctx.cwd`). FileStore is only for `.sun/` artifacts (which sunco scan uses via D-12).
**Warning signs:** FileStore's `resolveSafePath()` throws if the resolved path escapes `.sun/`.

### Pitfall 3: Parallel Agent Dispatch with Partial Failures
**What goes wrong:** One agent in a batch of 7 fails and the skill reports complete failure.
**Why it happens:** Using Promise.all instead of Promise.allSettled, or not handling individual rejection states.
**How to avoid:** Always use `Promise.allSettled()`. Collect successful results, warn about failures, write what succeeded. A 5/7 scan result is better than nothing.
**Warning signs:** Agent timeout or provider error killing the entire batch.

### Pitfall 4: Research Permissions Violation
**What goes wrong:** Research agent prompt asks the agent to write files, which violates the research role's read-only constraint.
**Why it happens:** The Permission Harness enforces `ROLE_PERMISSIONS.research.writePaths = []`. If the request includes writePaths, enforcePermissions() throws PermissionDeniedError.
**How to avoid:** Research/scan agent requests MUST have `writePaths: []`. The skill code (not the agent) writes the output files after collecting agent results.
**Warning signs:** PermissionDeniedError from permission.ts before agent even executes.

### Pitfall 5: Writing to .planning/ in User's Project (sunco new)
**What goes wrong:** `sunco new` writes PROJECT.md to `.planning/` but this is the user's project, not SUN's internal planning directory.
**Why it happens:** Confusion between SUN's own `.planning/` directory and the `.planning/` that sunco new creates in the user's project.
**How to avoid:** `sunco new` creates `.planning/` relative to `ctx.cwd` (the user's project root). Use `path.join(ctx.cwd, '.planning', filename)` with `mkdir({ recursive: true })`. This is NOT the same as SUN's internal planning.
**Warning signs:** Files accidentally written to SUN's own .planning/ directory.

### Pitfall 6: Agent Prompt Size Limits
**What goes wrong:** Pre-scan context (full file tree) is too large to include in agent prompt, exceeding token limits.
**Why it happens:** Large codebases can have thousands of files. Passing the entire tree as prompt context.
**How to avoid:** Truncate file tree to reasonable depth (3-4 levels), filter out node_modules/.git/dist, limit to first 500 entries. Include summary statistics instead of exhaustive lists. Sample 5-10 key files (package.json, tsconfig.json, entry points) rather than all files.
**Warning signs:** Agent response is garbage or truncated, or execa times out.

### Pitfall 7: tsup Entry Points and Exports
**What goes wrong:** New skill files not included in tsup build, new prompts directory not bundled.
**Why it happens:** tsup.config.ts and package.json exports must be updated for each new skill file.
**How to avoid:** Add `src/new.skill.ts` and `src/scan.skill.ts` to tsup entry points. Add corresponding exports in package.json. Prompts are imported by skill files so they are bundled automatically (no separate entry needed).
**Warning signs:** `Module not found` errors at runtime after build.

### Pitfall 8: CLI Wiring for New Skills
**What goes wrong:** Skills are defined but not registered in the CLI entry point.
**Why it happens:** `packages/cli/src/cli.ts` has a `preloadedSkills` array that must include every skill.
**How to avoid:** Add `newSkill` and `scanSkill` to the imports from @sunco/skills-workflow and add them to `preloadedSkills` array. Also update the barrel export in `packages/skills-workflow/src/index.ts`.
**Warning signs:** `sunco new` returns "Unknown command" error.

## Code Examples

### Example 1: Pre-scan Context Builder for sunco scan
```typescript
// Source: Adapts patterns from ecosystem-detector.ts + glob usage in Phase 2
import { detectEcosystems } from '@sunco/skills-harness';
import { glob } from 'glob';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

interface PreScanContext {
  ecosystems: string[];
  primaryEcosystem: string | null;
  fileCount: number;
  fileTree: string[];       // Truncated to 500 entries
  keyFiles: Record<string, string>;  // filename -> content (sampled)
  totalLines: number;
}

const KEY_FILES = [
  'package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod',
  'pyproject.toml', 'README.md', 'docker-compose.yml',
];

async function buildPreScanContext(cwd: string): Promise<PreScanContext> {
  const [ecosystems, fileTree] = await Promise.all([
    detectEcosystems({ cwd }),
    glob('**/*', {
      cwd,
      ignore: ['node_modules/**', '.git/**', 'dist/**', '.sun/**', '*.lock'],
      maxDepth: 4,
    }),
  ]);

  // Sample key files (read first 200 lines each)
  const keyFiles: Record<string, string> = {};
  for (const name of KEY_FILES) {
    try {
      const content = await readFile(join(cwd, name), 'utf-8');
      keyFiles[name] = content.slice(0, 5000); // Cap at 5KB per file
    } catch { /* skip missing */ }
  }

  return {
    ecosystems: ecosystems.ecosystems,
    primaryEcosystem: ecosystems.primaryEcosystem,
    fileCount: fileTree.length,
    fileTree: fileTree.slice(0, 500),
    keyFiles,
    totalLines: 0, // Optional: count via wc -l equivalent
  };
}
```

### Example 2: Prompt Template Pattern
```typescript
// Source: D-15 -- prompts as template strings in separate files
// packages/skills-workflow/src/prompts/scan-stack.ts

export function buildScanStackPrompt(preScan: PreScanContext): string {
  return `You are analyzing an existing codebase to document its technology stack.

## Pre-scan Data (deterministic, verified)

Detected ecosystems: ${preScan.ecosystems.join(', ')}
Primary ecosystem: ${preScan.primaryEcosystem ?? 'unknown'}
Total files: ${preScan.fileCount}

### Key Configuration Files
${Object.entries(preScan.keyFiles)
  .map(([name, content]) => `#### ${name}\n\`\`\`\n${content}\n\`\`\``)
  .join('\n\n')}

## Your Task

Produce a STACK.md document with these sections:

### Runtime & Language
| Technology | Version | Purpose |
(Identify from package.json, lock files, config files)

### Frameworks
(React, Express, FastAPI, etc. -- identify from dependencies)

### Build Tools
(Bundlers, compilers, transpilers)

### Testing
(Test runners, assertion libraries, coverage tools)

### Infrastructure
(Databases, caches, message queues -- from docker-compose, config, deps)

### External Services
(APIs, SaaS integrations -- from env vars, config files, imports)

Be specific with version numbers. Only report what the pre-scan data supports.
Do NOT hallucinate technologies not evidenced in the data.`;
}
```

### Example 3: Graceful Partial Failure Handling
```typescript
// Source: D-08 pattern using Promise.allSettled
interface ScanResult {
  docName: string;
  content: string | null;
  error?: string;
}

async function dispatchScanAgents(
  ctx: SkillContext,
  preScan: PreScanContext,
  docNames: string[],
  promptBuilders: Record<string, (ps: PreScanContext) => string>,
): Promise<ScanResult[]> {
  const settled = await Promise.allSettled(
    docNames.map(async (doc) => {
      const prompt = promptBuilders[doc]!(preScan);
      const result = await ctx.agent.run({
        role: 'research',
        prompt,
        permissions: {
          role: 'research',
          readPaths: ['**'],
          writePaths: [],
          allowTests: false,
          allowNetwork: false,
          allowGitWrite: false,
          allowCommands: [],
        },
        timeout: 60_000, // 60s per agent
      });
      return { docName: doc, content: result.outputText };
    })
  );

  return settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    return {
      docName: docNames[i]!,
      content: null,
      error: outcome.reason instanceof Error ? outcome.reason.message : 'Unknown error',
    };
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential agent calls | Parallel via Promise.allSettled | Phase 1 (AgentRouter.crossVerify pattern) | 4-7x throughput for scan/research |
| Hardcoded prompts | Template functions in prompts/ directory | D-15 (this phase) | Maintainable, testable prompts |
| Manual provider selection | Role-based routing (sdk for research, cli for execution) | Phase 1 D-23 | Automatic best-provider selection |

**Deprecated/outdated:**
- None -- this phase builds on Phase 1 patterns which are current

## Open Questions

1. **askText() implementation scope**
   - What we know: ctx.ui.ask() only supports choices. D-04 explicitly requires "plain text input for freeform answers."
   - What's unclear: Should askText() be a separate SkillUi method or an extension of ask() with an optional text mode?
   - Recommendation: Separate method `askText()` is cleaner -- avoids overloading ask() with two different return types. Add it to SkillUi, UiAdapter (new pattern kind 'askText'), InkUiAdapter (ink-text-input), SilentUiAdapter (return defaultValue).

2. **sunco new: .planning/ write mechanism**
   - What we know: FileStore only writes to .sun/. D-03 says output goes to .planning/.
   - What's unclear: Should we extend FileStore to support .planning/ or use direct fs writes?
   - Recommendation: Use direct `node:fs/promises` with `mkdir({ recursive: true })` for .planning/ writes. Do NOT extend FileStore -- its .sun/ scope is intentional. Create a small helper function `writePlanningArtifact(cwd, filename, content)` in shared/.

3. **Agent prompt token budget**
   - What we know: Pre-scan context + prompt template + expected output must fit in context window.
   - What's unclear: Exact token limit depends on provider (Claude CLI vs SDK model).
   - Recommendation: Keep pre-scan context under 5000 tokens. Truncate file trees to 500 entries, cap file samples at 5KB each. This fits comfortably in any Claude model's context.

4. **Adaptive question flow (D-04)**
   - What we know: "Later questions informed by earlier answers." Questions are not static.
   - What's unclear: How much adaptation? Simple branching or agent-generated questions?
   - Recommendation: Start with a deterministic question tree (3-4 branching paths based on project type). Do NOT use an agent to generate questions -- that adds latency and cost for minimal value. The 5-8 questions should be pre-defined with conditional branches.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | YES | v22.16.0 | -- |
| npm | Package management | YES | 10.9.2 | -- |
| Claude CLI | Agent provider (cli) | YES (at ~/.local/bin/claude) | -- | Claude SDK provider |
| ANTHROPIC_API_KEY | Agent provider (sdk) | NO | -- | Claude CLI provider |
| ink-text-input | Freeform text UI | NOT INSTALLED | 6.0.0 needed | Must install |

**Missing dependencies with no fallback:**
- ink-text-input: Must be installed for freeform text input in sunco new

**Missing dependencies with fallback:**
- ANTHROPIC_API_KEY: Not set, but Claude CLI is available as fallback provider
- Claude CLI not on PATH: Available at ~/.local/bin/claude, user may need to update PATH

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 |
| Config file | packages/skills-workflow/vitest.config.ts |
| Quick run command | `cd packages/skills-workflow && npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` (workspace root -- all packages) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WF-01 | sunco new: skill metadata correct | unit | `npx vitest run src/__tests__/new.test.ts -t "metadata"` | No -- Wave 0 |
| WF-01 | sunco new: accepts idea from CLI args | unit | `npx vitest run src/__tests__/new.test.ts -t "cli arg"` | No -- Wave 0 |
| WF-01 | sunco new: falls back when no provider | unit | `npx vitest run src/__tests__/new.test.ts -t "no provider"` | No -- Wave 0 |
| WF-01 | sunco new: dispatches parallel research agents | unit | `npx vitest run src/__tests__/new.test.ts -t "research"` | No -- Wave 0 |
| WF-01 | sunco new: synthesizes and writes artifacts | unit | `npx vitest run src/__tests__/new.test.ts -t "synthesis"` | No -- Wave 0 |
| WF-02 | sunco scan: skill metadata correct | unit | `npx vitest run src/__tests__/scan.test.ts -t "metadata"` | No -- Wave 0 |
| WF-02 | sunco scan: runs pre-scan with ecosystem detection | unit | `npx vitest run src/__tests__/scan.test.ts -t "pre-scan"` | No -- Wave 0 |
| WF-02 | sunco scan: dispatches 7 parallel agents | unit | `npx vitest run src/__tests__/scan.test.ts -t "parallel"` | No -- Wave 0 |
| WF-02 | sunco scan: writes docs to .sun/codebase/ | unit | `npx vitest run src/__tests__/scan.test.ts -t "writes"` | No -- Wave 0 |
| WF-02 | sunco scan: handles partial agent failures | unit | `npx vitest run src/__tests__/scan.test.ts -t "partial"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/skills-workflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run` (full workspace)
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `packages/skills-workflow/src/__tests__/new.test.ts` -- covers WF-01
- [ ] `packages/skills-workflow/src/__tests__/scan.test.ts` -- covers WF-02
- [ ] `packages/core/src/ui/__tests__/askText.test.ts` -- covers askText() extension
- [ ] Mock patterns already established in existing tests (context.test.ts has createMockContext)

## Project Constraints (from CLAUDE.md)

**Directives that constrain this phase:**
1. **Skill-Only:** All functionality as skills. sunco new and sunco scan are skills via defineSkill().
2. **Clean Room:** GSD code copy prohibited. Concepts only, implemented from scratch.
3. **Quality:** Each skill is a finished product. All effort/search invested per skill.
4. **Tech Stack locked:** TypeScript, Commander.js, TOML, tsup, Vitest.
5. **Deterministic First:** Pre-scan (ecosystem detection, file tree) is deterministic. Only research/synthesis uses agents.
6. **kind: 'prompt':** Both skills must declare kind: 'prompt' since they use agent dispatch.
7. **Distribution:** Skills bundled via tsup into CLI package for npm distribution.

## Sources

### Primary (HIGH confidence)
- `packages/core/src/agent/types.ts` -- AgentRequest, AgentResult, PermissionSet interfaces
- `packages/core/src/agent/router.ts` -- createAgentRouter(), run(), crossVerify()
- `packages/core/src/agent/permission.ts` -- ROLE_PERMISSIONS defaults, enforcePermissions()
- `packages/core/src/skill/types.ts` -- SkillDefinition, SkillContext, SkillResult
- `packages/core/src/skill/define.ts` -- defineSkill() factory
- `packages/core/src/state/file-store.ts` -- FileStore.write() with path traversal guard
- `packages/core/src/ui/adapters/SkillUi.ts` -- SkillUi interface (ask, entry, progress, result)
- `packages/core/src/ui/adapters/InkUiAdapter.ts` -- Current Ink rendering implementation
- `packages/skills-harness/src/init/ecosystem-detector.ts` -- detectEcosystems()
- `packages/skills-workflow/src/note.skill.ts` -- Reference skill pattern
- `packages/skills-workflow/src/__tests__/context.test.ts` -- Reference test pattern (createMockContext)
- `packages/cli/src/cli.ts` -- CLI wiring pattern (preloadedSkills)

### Secondary (MEDIUM confidence)
- npm registry: ink-text-input@6.0.0 verified (peer deps: ink>=5, react>=18)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all infrastructure exists from Phase 1, only ink-text-input is new (verified on npm)
- Architecture: HIGH -- patterns are directly derived from existing codebase (defineSkill, AgentRouter.run, FileStore.write)
- Pitfalls: HIGH -- identified from actual code analysis (FileStore .sun/ scope, askText gap, Permission enforcement, tsup entry points)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- all dependencies are locked versions)
