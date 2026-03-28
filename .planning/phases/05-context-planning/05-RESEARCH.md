# Phase 5: Context + Planning - Research

**Researched:** 2026-03-28
**Domain:** Agent-powered workflow skills (discuss, assume, research, plan) -- spec-driven planning chain
**Confidence:** HIGH

## Summary

Phase 5 delivers 4 agent-powered workflow skills (`sunco discuss`, `sunco assume`, `sunco research`, `sunco plan`) that form the "think before you code" chain. All 4 skills follow the exact same architecture as Phase 4's `sunco new` and `sunco scan`: `defineSkill({ kind: 'prompt' })` with `ctx.agent.run()` dispatch, prompt templates in `prompts/`, and output written via `writePlanningArtifact()` or `ctx.fileStore`. The infrastructure is fully established -- this phase is about writing 4 new skill files, their prompt templates, and wiring them into the barrel exports and CLI.

The key complexity is in the **interaction design** (discuss has multi-step conversation flow), the **plan-checker validation loop** (plan generates then verifies in up to 3 iterations), and **holdout scenario writing** (BDD scenarios to `.sun/scenarios/` that are invisible to coding agents). The codebase already provides all needed primitives: `ctx.ui.ask()`/`askText()` for interaction, `ctx.agent.run()` with role-based permissions for agent dispatch, `ctx.fileStore.write('scenarios', ...)` for scenario storage, `Promise.allSettled()` for parallel dispatch, and `writePlanningArtifact()` for `.planning/` file writes.

**Primary recommendation:** Follow Phase 4's exact patterns (new.skill.ts and scan.skill.ts are the templates). Each skill is a standalone file in `packages/skills-workflow/src/` with companion prompt templates in `prompts/`. No new dependencies needed. The plan-checker loop is the only novel pattern -- implement as a retry loop within plan.skill.ts with a separate verification agent call.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Interactive conversation flow for discuss: (1) Agent reads phase goal from ROADMAP.md, (2) Identifies gray areas via analysis agent, (3) Presents gray areas for user selection via ctx.ui.ask(), (4) Deep-dive each selected area with follow-up questions, (5) Writes CONTEXT.md with locked decisions + Claude's discretion areas.
- **D-02:** Holdout scenarios: During discussion, agent generates acceptance criteria that become holdout scenarios. These are written to .sun/scenarios/ as BDD-style Given/When/Then files. Coding agents cannot access .sun/scenarios/; only verification agents can.
- **D-03:** CONTEXT.md structure follows template: `<domain>`, `<decisions>`, `<canonical_refs>`, `<code_context>`, `<specifics>`, `<deferred>`. Each decision is numbered (D-01, D-02...) and marked as locked or discretionary.
- **D-04:** Uses kind: 'prompt' with role: 'planning' for agent analysis. Interactive UI via ctx.ui.ask() and ctx.ui.askText().
- **D-05:** Agent reads CONTEXT.md + ROADMAP.md + codebase, then presents what it would do before doing it. Output: structured assumptions list with confidence levels.
- **D-06:** User can correct assumptions -- corrections are appended to CONTEXT.md as additional locked decisions.
- **D-07:** Uses kind: 'prompt' with role: 'planning'. Single agent call (not parallel).
- **D-08:** Parallel agent dispatch: 3-5 research agents each investigating a specific topic derived from CONTEXT.md decisions and phase scope.
- **D-09:** Research agents use role: 'research' (read-only permissions). Each produces a focused research document.
- **D-10:** Results synthesized into a single RESEARCH.md in the phase directory. Includes validation architecture section for Nyquist compliance.
- **D-11:** Research topics auto-derived from phase goal + CONTEXT.md, but can be overridden with `--topics "topic1,topic2"`.
- **D-12:** Agent reads CONTEXT.md + RESEARCH.md + REQUIREMENTS.md + ROADMAP.md, produces PLAN.md files with: frontmatter (wave, depends_on, files_modified, autonomous), XML tasks with read_first + acceptance_criteria + action, verification criteria, must_haves.
- **D-13:** Built-in plan-checker validation loop: after plan creation, a separate verification agent checks quality. If issues found, planner revises (max 3 iterations).
- **D-14:** BDD scenario-based completion criteria: each plan's must_haves include observable truths derived from acceptance criteria. These truths are what the verifier checks.
- **D-15:** Plans support wave-based parallel execution. Planner assigns wave numbers based on dependency analysis.
- **D-16:** Uses kind: 'prompt' with role: 'planning' for plan creation, separate agent for verification.
- **D-17:** All 4 skills live in `packages/skills-workflow/src/` as discuss.skill.ts, assume.skill.ts, research.skill.ts, plan.skill.ts.
- **D-18:** Reuse Phase 4's prompt template pattern: agent prompts in `packages/skills-workflow/src/prompts/` (discuss-*.ts, assume.ts, research-*.ts, plan.ts, plan-checker.ts).
- **D-19:** All skills read/write to .planning/ phase directories using the planning-writer utility from Phase 4.
- **D-20:** Scenario files in .sun/scenarios/ use BDD format: `scenario-{id}.md` with Given/When/Then blocks.

### Claude's Discretion
- Gray area identification heuristics for discuss
- Assumption extraction prompts for assume
- Research topic derivation algorithm
- Plan-checker verification dimensions and scoring
- BDD scenario generation format details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WF-09 | `sunco discuss` -- vision extraction, design decisions, acceptance criteria + Holdout scenario generation -> CONTEXT.md | Established pattern: new.skill.ts multi-step flow with ctx.ui.ask()/askText(). FileStore.write('scenarios',...) for holdout storage. writePlanningArtifact() for CONTEXT.md output. |
| WF-10 | `sunco assume` -- agent approach preview (correction opportunity) | Single agent call pattern (like synthesis in new.skill.ts). Reads .planning/ files via node:fs, presents structured output, appends corrections to CONTEXT.md. |
| WF-11 | `sunco research` -- parallel agent domain research | Direct reuse of scan.skill.ts parallel dispatch pattern. Promise.allSettled() with role:'research' permissions. writePlanningArtifact() for RESEARCH.md output. |
| WF-12 | `sunco plan` -- execution plan + BDD completion criteria + plan-checker loop | Planning agent with role:'planning'. Novel plan-checker loop: generate -> verify -> revise (max 3 iterations). Output PLAN.md files to phase directory. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: TypeScript, Commander.js, TOML (smol-toml), tsup, Vitest -- confirmed
- **Clean Room**: No GSD code copying. Concepts only, write from scratch
- **Skill-Only**: All features are skills. No hardcoded commands
- **Deterministic First**: Linters/tests enforce where possible, LLM only when needed
- **Quality**: Each skill is a finished product. All effort/skill/search invested in each one

## Standard Stack

### Core (already installed, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sunco/core | 0.0.1 | defineSkill, SkillContext, AgentRouterApi, SkillUi, FileStoreApi | Project's own core -- all Phase 5 skills import from here |
| @sunco/skills-harness | 0.0.1 | detectEcosystems (for pre-scan if needed) | Project harness skills |
| chalk | 5.6.2 | Terminal color output | Already a dependency of skills-workflow |
| glob | 13.0.6 | File globbing | Already a dependency of skills-workflow |
| simple-git | 3.33.0 | Git operations | Already a dependency of skills-workflow |
| smol-toml | 1.6.1 | TOML parsing (for config reads) | Already a dependency of skills-workflow |

### Supporting (already available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.1.2 | Unit tests | Test all 4 new skills |
| tsup | 8.5.0 | Build | Add new entry points to tsup.config.ts |

### No New Dependencies Required
Phase 5 uses only existing project infrastructure. No npm install needed.

## Architecture Patterns

### File Structure (new files only)
```
packages/skills-workflow/src/
  discuss.skill.ts          # WF-09: Interactive vision extraction
  assume.skill.ts           # WF-10: Approach preview + correction
  research.skill.ts         # WF-11: Parallel domain research (NOT same as prompts/research.ts)
  plan.skill.ts             # WF-12: Execution planning + plan-checker loop
  prompts/
    discuss-analyze.ts      # Gray area identification prompt
    discuss-deepdive.ts     # Deep-dive follow-up prompt
    discuss-scenario.ts     # BDD holdout scenario generation prompt
    assume.ts               # Assumption extraction prompt
    research-domain.ts      # Domain research prompt (parallel agents)
    research-synthesize.ts  # Research synthesis prompt
    plan-create.ts          # Plan creation prompt
    plan-checker.ts         # Plan verification prompt
  shared/
    phase-reader.ts         # Read phase artifacts (CONTEXT.md, RESEARCH.md, etc.)
  __tests__/
    discuss.test.ts
    assume.test.ts
    research-skill.test.ts  # Named to avoid conflict with prompts/research.ts test
    plan.test.ts
```

### Pattern 1: Prompt Skill with Agent Dispatch
**What:** All 4 skills follow the same pattern as new.skill.ts / scan.skill.ts
**When to use:** Every skill in this phase
**Example:**
```typescript
// Source: packages/skills-workflow/src/new.skill.ts (existing pattern)
import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';

export default defineSkill({
  id: 'workflow.discuss',
  command: 'discuss',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description: 'Extract vision, design decisions, and acceptance criteria',

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({ title: 'Discuss', description: '...' });

    // Check provider availability
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      // ... graceful error
    }

    // Dispatch agent
    const result = await ctx.agent.run({
      role: 'planning',
      prompt: buildDiscussAnalyzePrompt(/* ... */),
      permissions: { role: 'planning', readPaths: ['**'], writePaths: ['.planning/**'], ... },
      timeout: 120_000,
    });

    // Write output
    await writePlanningArtifact(ctx.cwd, `phases/${padded}-${slug}/${padded}-CONTEXT.md`, content);

    return { success: true, summary: '...' };
  },
});
```

### Pattern 2: Interactive Multi-Step Flow (discuss)
**What:** Sequential conversation with agent analysis between user interactions
**When to use:** `sunco discuss` -- the most interactive skill
**Example:**
```typescript
// Step 1: Read phase context from ROADMAP.md
const roadmapContent = await readFile(join(ctx.cwd, '.planning', 'ROADMAP.md'), 'utf-8');
const phaseGoal = extractPhaseGoal(roadmapContent, phaseNumber);

// Step 2: Agent identifies gray areas
const analysisResult = await ctx.agent.run({
  role: 'planning',
  prompt: buildDiscussAnalyzePrompt(phaseGoal, requirements),
  permissions: PLANNING_PERMISSIONS,
});

// Step 3: Parse gray areas, present to user
const grayAreas = parseGrayAreas(analysisResult.outputText);
for (const area of grayAreas) {
  const decision = await ctx.ui.ask({
    message: area.question,
    options: area.options.map(opt => ({ id: opt.id, label: opt.label })),
  });
  answers[area.id] = decision.selectedLabel;
}

// Step 4: Deep-dive follow-ups
for (const area of selectedAreas) {
  const followUp = await ctx.agent.run({
    role: 'planning',
    prompt: buildDiscussDeepDivePrompt(area, answers),
    permissions: PLANNING_PERMISSIONS,
  });
  // May ask further questions...
}

// Step 5: Write CONTEXT.md
```

### Pattern 3: Parallel Agent Dispatch (research)
**What:** Multiple agents run concurrently with Promise.allSettled
**When to use:** `sunco research` -- 3-5 parallel research agents
**Example:**
```typescript
// Source: packages/skills-workflow/src/scan.skill.ts (existing pattern)
const RESEARCH_PERMISSIONS: PermissionSet = {
  role: 'research',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

const results = await Promise.allSettled(
  topics.map(async (topic) => {
    const result = await ctx.agent.run({
      role: 'research',
      prompt: buildResearchDomainPrompt(topic, contextMd),
      permissions: RESEARCH_PERMISSIONS,
      timeout: 120_000,
    });
    return { topic, result };
  }),
);
```

### Pattern 4: Plan-Checker Validation Loop (plan)
**What:** Generate plan, verify with separate agent, revise if needed (max 3 iterations)
**When to use:** `sunco plan` only -- unique to this phase
**Example:**
```typescript
const MAX_PLAN_CHECK_ITERATIONS = 3;
let plan: string;
let issues: string[] = [];

for (let i = 0; i < MAX_PLAN_CHECK_ITERATIONS; i++) {
  // Generate or revise plan
  const planResult = await ctx.agent.run({
    role: 'planning',
    prompt: i === 0
      ? buildPlanCreatePrompt(contextMd, researchMd, requirementsMd, roadmapMd)
      : buildPlanRevisePrompt(plan, issues),
    permissions: PLANNING_WRITE_PERMISSIONS,
    timeout: 180_000,
  });
  plan = planResult.outputText;

  // Verify with separate agent
  const checkResult = await ctx.agent.run({
    role: 'verification',
    prompt: buildPlanCheckerPrompt(plan, contextMd, requirementsMd),
    permissions: VERIFICATION_PERMISSIONS,
    timeout: 120_000,
  });

  issues = parsePlanCheckerIssues(checkResult.outputText);
  if (issues.length === 0) break;

  progress.update({ message: `Iteration ${i + 1}: ${issues.length} issues found, revising...` });
}
```

### Pattern 5: FileStore for Holdout Scenarios
**What:** BDD scenarios written to .sun/scenarios/ via ctx.fileStore
**When to use:** `sunco discuss` writes scenarios, `sunco verify` reads them (Phase 7)
**Example:**
```typescript
// Write holdout scenario
await ctx.fileStore.write(
  'scenarios',
  `scenario-${id}.md`,
  formatBddScenario(scenario),
);

// Scenario format:
// # Scenario: {title}
// ## Given
// {preconditions}
// ## When
// {actions}
// ## Then
// {expected outcomes}
```

### Permission Patterns by Skill
| Skill | Agent Role | Read Permissions | Write Permissions |
|-------|-----------|-----------------|-------------------|
| discuss (analysis) | planning | ['**'] | [] |
| discuss (scenario write) | -- | -- | ctx.fileStore.write('scenarios',...) |
| assume | planning | ['**'] | [] |
| research | research | ['**'] | [] |
| plan (creation) | planning | ['**'] | ['.planning/**'] |
| plan (checker) | verification | ['**'] | [] |

### Anti-Patterns to Avoid
- **Direct file writes without planning-writer:** Use `writePlanningArtifact()` for `.planning/` files and `ctx.fileStore.write()` for `.sun/` files. Never use raw `writeFile()` for these directories.
- **Hardcoded phase numbers:** Always derive phase number from ctx.args or STATE.md. Never hardcode `05` or similar.
- **Blocking on agent failure:** Use `Promise.allSettled()` for parallel dispatch. Handle partial failures gracefully -- some research agents failing should not block the entire operation.
- **Skipping provider availability check:** Every prompt skill must check `ctx.agent.listProviders()` before attempting dispatch. Return graceful error if empty.
- **Mixing research and planning permissions:** Research agents must be read-only (writePaths: []). Only planning agents get write permissions, and only to `.planning/**`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase directory path resolution | Custom path logic | Reuse context.skill.ts `findContextFile()` pattern | Already handles padded phase numbers and directory scanning |
| ROADMAP.md parsing | Manual regex | `parseRoadmap()` from `shared/roadmap-parser.ts` | Already tested, handles edge cases |
| STATE.md parsing | Manual YAML extraction | `parseStateMd()` from `shared/state-reader.ts` | Tested frontmatter parser with nested blocks |
| File writing to .planning/ | Raw writeFile | `writePlanningArtifact()` from `shared/planning-writer.ts` | Path traversal guard built in |
| File writing to .sun/ | Raw writeFile | `ctx.fileStore.write(category, filename, content)` | Safe path resolution, auto-creates directories |
| Mock SkillContext in tests | Custom mock factory | Copy `createMockContext()` from new.test.ts or scan.test.ts | Proven pattern covering all ctx fields |

**Key insight:** Phase 5 adds no new infrastructure. Every building block (agent dispatch, UI interaction, file I/O, parallel execution) exists and is tested. The skill is in composing these existing primitives into new workflows with well-crafted prompts.

## Common Pitfalls

### Pitfall 1: Prompt Template Output Parsing
**What goes wrong:** Agent output doesn't match expected format. Parsing fails silently or crashes.
**Why it happens:** LLM output is non-deterministic. Even with clear instructions, the agent may omit separators, change format, or add extra text.
**How to avoid:** Always have fallback parsing. Use defensive string splitting. If `---DOCUMENT_SEPARATOR---` fails (as in new.skill.ts), write entire output as single file. For structured data extraction, use regex with graceful defaults.
**Warning signs:** Tests that mock agent output but use the exact expected format -- they won't catch format variations.

### Pitfall 2: discuss Skill State Management
**What goes wrong:** Multi-step conversation flow loses context between steps. Later questions don't reference earlier answers.
**Why it happens:** Each `ctx.agent.run()` call is stateless. Previous conversation context must be explicitly passed.
**How to avoid:** Accumulate all decisions/answers in a local object and pass the full context to each subsequent agent call. Build prompts that include all prior answers.
**Warning signs:** Follow-up questions feel generic rather than contextual.

### Pitfall 3: Plan-Checker Infinite Loop
**What goes wrong:** Checker always finds issues, planner revises but introduces new issues, loop never converges.
**Why it happens:** Checker criteria too strict, or planner and checker have conflicting expectations.
**How to avoid:** Hard cap at 3 iterations (D-13). After max iterations, accept the plan with warnings about remaining issues. Make checker criteria concrete and finite.
**Warning signs:** Iteration count consistently hitting the max (3) in testing.

### Pitfall 4: File Naming Conflicts
**What goes wrong:** `research.skill.ts` wants to import from `prompts/research.ts` (Phase 4's existing file) instead of the new Phase 5 research prompts.
**Why it happens:** Phase 4 already has `prompts/research.ts` for the "sunco new" research prompt builder.
**How to avoid:** Name Phase 5's research prompts distinctly: `research-domain.ts`, `research-synthesize.ts`. Import by full path. Name the test `research-skill.test.ts` to avoid confusion.
**Warning signs:** Import conflicts during development, wrong prompt builder being called.

### Pitfall 5: Planning-Writer Path Depth
**What goes wrong:** `writePlanningArtifact()` currently only handles flat filenames in `.planning/`. Phase 5 needs to write to subdirectories like `.planning/phases/05-context-planning/05-CONTEXT.md`.
**Why it happens:** The existing `writePlanningArtifact()` creates `.planning/` and writes a flat file. It doesn't handle nested paths.
**How to avoid:** Either extend `writePlanningArtifact()` to handle subdirectory paths (with recursive mkdir), or use `node:fs/promises` directly for phase directory writes (same as Phase 4 context.skill.ts reads). Verify path traversal safety.
**Warning signs:** Files written to wrong location, `.planning/` instead of `.planning/phases/XX-name/`.

### Pitfall 6: CONTEXT.md Append Semantics for assume
**What goes wrong:** `sunco assume` corrections should append to CONTEXT.md, but overwrite it instead.
**Why it happens:** Writing to an existing file requires read-then-append logic, not just write.
**How to avoid:** Read existing CONTEXT.md content first, parse it, append new decisions to the decisions section, then write back. Use a dedicated helper for this.
**Warning signs:** CONTEXT.md losing previously captured decisions when assume runs.

### Pitfall 7: tsup Entry Points
**What goes wrong:** New skills are importable from index.ts but can't be imported individually via package.json exports.
**Why it happens:** tsup.config.ts and package.json exports need to be updated for each new skill file.
**How to avoid:** Add all 4 new skill files to tsup.config.ts entry array AND add matching exports to package.json.
**Warning signs:** Build succeeds but individual skill imports fail.

## Code Examples

### Existing Mock Context Pattern (for tests)
```typescript
// Source: packages/skills-workflow/src/__tests__/scan.test.ts
function createMockContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['state'],
    fileStore: {
      read: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(false),
      exists: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['fileStore'],
    agent: {
      run: vi.fn().mockResolvedValue(createMockAgentResult()),
      crossVerify: vi.fn().mockResolvedValue([]),
      listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
    } as unknown as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockResolvedValue({ selectedId: '', selectedLabel: '', source: 'default' }),
      askText: vi.fn().mockResolvedValue({ text: '', source: 'default' }),
      progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd: '/test/project',
    args: {},
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}
```

### Existing Prompt Template Pattern
```typescript
// Source: packages/skills-workflow/src/prompts/research.ts
export function buildResearchPrompt(
  topic: string,
  idea: string,
  context: Record<string, string>,
): string {
  const contextLines = Object.entries(context)
    .map(([key, value]) => `- **${key}**: ${value}`)
    .join('\n');

  return `You are a technical researcher. Your task is to research ONE specific topic...

## Project Idea
${idea}

## Context (from user answers)
${contextLines || '(no additional context provided)'}

## Research Topic: ${topic}
...`;
}
```

### Existing Barrel Export + CLI Wiring Pattern
```typescript
// Source: packages/skills-workflow/src/index.ts (add new skills)
export { default as discussSkill } from './discuss.skill.js';
export { default as assumeSkill } from './assume.skill.js';
export { default as researchSkill } from './research.skill.js';
export { default as planSkill } from './plan.skill.js';

// Source: packages/cli/src/cli.ts (add to preloadedSkills array)
import { discussSkill, assumeSkill, researchSkill, planSkill } from '@sunco/skills-workflow';
const preloadedSkills = [
  // ... existing skills ...
  // Phase 5 context + planning skills
  discussSkill,
  assumeSkill,
  researchSkill,
  planSkill,
];
```

### Phase Directory Resolution Helper
```typescript
// New shared utility: packages/skills-workflow/src/shared/phase-reader.ts
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function resolvePhaseDir(cwd: string, phaseNumber: number): Promise<string | null> {
  const phasesDir = join(cwd, '.planning', 'phases');
  try {
    const entries = await readdir(phasesDir);
    const padded = String(phaseNumber).padStart(2, '0');
    const match = entries.find((e) => e.startsWith(`${padded}-`));
    return match ? join(phasesDir, match) : null;
  } catch {
    return null;
  }
}

export async function readPhaseArtifact(
  cwd: string,
  phaseNumber: number,
  filename: string,
): Promise<string | null> {
  const dir = await resolvePhaseDir(cwd, phaseNumber);
  if (!dir) return null;
  try {
    return await readFile(join(dir, filename), 'utf-8');
  } catch {
    return null;
  }
}

export async function writePhaseArtifact(
  cwd: string,
  phaseNumber: number,
  slug: string,
  filename: string,
  content: string,
): Promise<string> {
  const phasesDir = join(cwd, '.planning', 'phases');
  const padded = String(phaseNumber).padStart(2, '0');
  const phaseDir = join(phasesDir, `${padded}-${slug}`);
  await mkdir(phaseDir, { recursive: true });
  const filePath = join(phaseDir, filename);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}
```

### PLAN.md Output Format (target format plan.skill.ts must produce)
```yaml
---
phase: 05-context-planning
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/skills-workflow/src/discuss.skill.ts
  - packages/skills-workflow/src/prompts/discuss-analyze.ts
autonomous: true
requirements:
  - WF-09

must_haves:
  truths:
    - "sunco discuss reads phase goal from ROADMAP.md and identifies gray areas"
    - "User selects gray areas via interactive ctx.ui.ask()"
  artifacts:
    - path: "packages/skills-workflow/src/discuss.skill.ts"
      provides: "discuss skill with multi-step conversation flow"
      contains: "defineSkill"
  key_links:
    - from: "packages/skills-workflow/src/index.ts"
      to: "discuss.skill.ts"
      via: "barrel re-export"
---

<objective>
...
</objective>
```

### BDD Scenario Format (for .sun/scenarios/)
```markdown
# Scenario: Phase 5 discuss produces valid CONTEXT.md

## Given
- A project with .planning/ROADMAP.md containing Phase 5 details
- Phase 5 has requirements WF-09, WF-10, WF-11, WF-12

## When
- User runs `sunco discuss` targeting Phase 5
- User answers all gray area questions

## Then
- .planning/phases/05-context-planning/05-CONTEXT.md is created
- CONTEXT.md contains <decisions> section with numbered decisions
- CONTEXT.md contains <canonical_refs> section
- At least 1 holdout scenario is written to .sun/scenarios/
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic planning agent | Chain of specialized skills (discuss -> assume -> research -> plan) | Phase 5 design | Each step is independently runnable and restartable |
| Trust agent plans blindly | Plan-checker validation loop (D-13) | Phase 5 design | Plans must pass verification before execution |
| All acceptance criteria visible | Holdout scenarios in .sun/scenarios/ | Phase 5 design (D-02) | Swiss cheese first layer: coding agents cannot see verification criteria |

## Open Questions

1. **discuss Skill: How to determine current phase number**
   - What we know: ctx.args can accept a `--phase` flag or positional arg. STATE.md has current phase.
   - What's unclear: Should discuss default to current phase from STATE.md, or require explicit phase number?
   - Recommendation: Default to current phase from STATE.md (same pattern as context.skill.ts), but allow `--phase N` override via skill options.

2. **research Skill: How many topics to auto-derive**
   - What we know: D-08 says 3-5 research agents. Topics derived from CONTEXT.md decisions.
   - What's unclear: Exact algorithm for topic derivation from decisions.
   - Recommendation: Claude's discretion area. Agent analyzes CONTEXT.md and proposes topics. Start with the agent's suggested topics, cap at 5.

3. **plan Skill: Multiple PLAN.md files per invocation?**
   - What we know: D-12 describes PLAN.md format. Phases have multiple plans (Phase 1 had 12, Phase 4 had 4).
   - What's unclear: Does one `sunco plan` invocation produce all plans, or one plan at a time?
   - Recommendation: One invocation produces ALL plans for the phase. The agent determines plan count based on requirements and scope. Each plan is a separate file (e.g., `05-01-PLAN.md`, `05-02-PLAN.md`).

4. **plan-checker: Verification vs Planning permissions?**
   - What we know: D-16 says separate agent for verification. The PermissionSet has `role: 'verification'`.
   - What's unclear: Whether the plan-checker agent uses 'verification' role or 'planning' role.
   - Recommendation: Use `role: 'verification'` with read-only permissions. The checker should not modify plans, only evaluate them.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 |
| Config file | `packages/skills-workflow/vitest.config.ts` |
| Quick run command | `cd packages/skills-workflow && npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` (workspace root) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WF-09 | discuss produces CONTEXT.md + holdout scenarios | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/discuss.test.ts -x` | Wave 0 |
| WF-10 | assume presents approach, appends corrections to CONTEXT.md | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/assume.test.ts -x` | Wave 0 |
| WF-11 | research dispatches parallel agents, produces RESEARCH.md | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/research-skill.test.ts -x` | Wave 0 |
| WF-12 | plan produces PLAN.md files passing plan-checker validation | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/plan.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/skills-workflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run` (full workspace suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/discuss.test.ts` -- covers WF-09 (multi-step conversation, scenario generation)
- [ ] `src/__tests__/assume.test.ts` -- covers WF-10 (single agent call, CONTEXT.md append)
- [ ] `src/__tests__/research-skill.test.ts` -- covers WF-11 (parallel dispatch, synthesis)
- [ ] `src/__tests__/plan.test.ts` -- covers WF-12 (plan creation, checker loop, PLAN.md output)

## Sources

### Primary (HIGH confidence)
- `packages/skills-workflow/src/new.skill.ts` -- multi-step agent skill reference pattern
- `packages/skills-workflow/src/scan.skill.ts` -- parallel agent dispatch reference pattern
- `packages/skills-workflow/src/__tests__/new.test.ts` -- mock context factory + test patterns
- `packages/core/src/agent/types.ts` -- AgentRequest, AgentResult, PermissionSet, AgentRole
- `packages/core/src/skill/types.ts` -- SkillDefinition, SkillContext, SkillResult
- `packages/core/src/ui/adapters/SkillUi.ts` -- SkillUi, AskInput, AskTextInput
- `packages/core/src/state/file-store.ts` -- FileStore.write() for .sun/scenarios/
- `packages/skills-workflow/src/shared/planning-writer.ts` -- writePlanningArtifact()
- `packages/skills-workflow/src/shared/roadmap-parser.ts` -- parseRoadmap()
- `packages/skills-workflow/src/shared/state-reader.ts` -- parseStateMd()
- `packages/skills-workflow/src/context.skill.ts` -- findContextFile() phase directory resolution

### Secondary (MEDIUM confidence)
- `.planning/phases/04-project-initialization/04-01-PLAN.md` -- PLAN.md format reference
- `.planning/phases/05-context-planning/05-CONTEXT.md` -- locked decisions for this phase
- `.planning/REQUIREMENTS.md` -- WF-09 through WF-12 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing infrastructure verified in codebase
- Architecture: HIGH - follows exact patterns from Phase 4 skills (new.skill.ts, scan.skill.ts), verified by reading source
- Pitfalls: HIGH - derived from codebase analysis (naming conflicts, path handling, append semantics)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- internal project patterns, no external dependency changes)
