/**
 * Tests for plan.skill.ts
 *
 * Verifies:
 * 1. Skill metadata (id, command, kind, stage)
 * 2. No provider: returns failure
 * 3. Missing CONTEXT.md: returns failure with guidance message
 * 4. Normal flow: planning agent succeeds, checker returns NO_ISSUES_FOUND, plans written
 * 5. Checker finds issues, revise loop runs (2 iterations)
 * 6. Max iterations reached: plans accepted with warnings
 * 7. --skip-check flag: no checker agent call
 * 8. Checker agent failure: plan accepted without verification
 * 9. Multiple plans: output with ---PLAN_SEPARATOR--- produces multiple files
 * 10. Missing RESEARCH.md: proceeds without it (warning only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../shared/roadmap-parser.js', () => ({
  parseRoadmap: vi.fn().mockReturnValue({
    phases: [
      {
        number: 5,
        name: 'context-planning',
        description: 'Context and planning skills',
        completed: false,
        requirements: ['WF-09', 'WF-10', 'WF-11', 'WF-12'],
        plans: [],
        planCount: null,
        completedCount: 0,
      },
    ],
    progress: [],
  }),
}));

import { readFile, readdir, writeFile } from 'node:fs/promises';
import planSkill from '../plan.skill.js';

const mockedReadFile = vi.mocked(readFile);
const mockedReaddir = vi.mocked(readdir);
const mockedWriteFile = vi.mocked(writeFile);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CONTEXT_MD = '# Phase 5 Context\n\nDecisions about context planning skills.';
const MOCK_RESEARCH_MD = '# Phase 5 Research\n\nTechnical findings.';
const MOCK_REQUIREMENTS_MD = '# Requirements\n\n- WF-09: discuss skill\n- WF-12: plan skill';
const MOCK_ROADMAP_MD = `# Roadmap

- [ ] **Phase 5: context-planning** - Context and planning skills

### Phase 5: context-planning

**Requirements**: WF-09, WF-10, WF-11, WF-12

Plans:
- [ ] 05-01-PLAN.md -- discuss skill
- [ ] 05-04-PLAN.md -- plan skill`;

const MOCK_PLAN_OUTPUT = `---
phase: 05-context-planning
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plan.ts
autonomous: true
requirements:
  - WF-12
must_haves:
  truths:
    - "plan skill produces PLAN.md files"
  artifacts:
    - path: src/plan.ts
      provides: plan skill
  key_links: []
---

<objective>Create plan skill</objective>
<tasks>
<task type="auto">
  <name>Task 1: Create plan skill</name>
  <files>src/plan.ts</files>
  <action>Implement the plan skill</action>
  <verify><automated>echo ok</automated></verify>
  <done>- Plan skill created</done>
</task>
</tasks>`;

const MOCK_MULTI_PLAN_OUTPUT = `${MOCK_PLAN_OUTPUT}

---PLAN_SEPARATOR---

---
phase: 05-context-planning
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/checker.ts
autonomous: true
requirements:
  - WF-12
must_haves:
  truths:
    - "checker validates plans"
  artifacts:
    - path: src/checker.ts
      provides: checker
  key_links: []
---

<objective>Create checker</objective>
<tasks>
<task type="auto">
  <name>Task 1: Create checker</name>
  <files>src/checker.ts</files>
  <action>Implement checker</action>
  <verify><automated>echo ok</automated></verify>
  <done>- Checker created</done>
</task>
</tasks>`;

function createMockAgentResult(
  overrides: Partial<AgentResult> = {},
): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: MOCK_PLAN_OUTPUT,
    artifacts: [],
    warnings: [],
    usage: { estimated: true, wallTimeMs: 1000 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock context factory
// ---------------------------------------------------------------------------

function createMockContext(
  overrides: Partial<SkillContext> = {},
): SkillContext {
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
      ask: vi.fn().mockResolvedValue({
        selectedId: '',
        selectedLabel: '',
        source: 'default',
      }),
      askText: vi.fn().mockResolvedValue({ text: '', source: 'default' }),
      progress: vi.fn().mockReturnValue({
        update: vi.fn(),
        done: vi.fn(),
      }),
      result: vi.fn().mockResolvedValue(undefined),
    },
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    run: vi.fn().mockResolvedValue({ success: true }),
    cwd: '/test/project',
    args: {},
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

/**
 * Setup fs mocks for a valid project with all phase artifacts.
 */
function setupValidProject(opts: { hasResearch?: boolean } = {}): void {
  const { hasResearch = true } = opts;

  mockedReaddir.mockImplementation(async (dirPath) => {
    const p = String(dirPath);
    if (p.includes('.planning/phases')) {
      return ['05-context-planning'] as unknown as ReturnType<typeof readdir>;
    }
    return [] as unknown as ReturnType<typeof readdir>;
  });

  mockedReadFile.mockImplementation(async (filePath) => {
    const p = String(filePath);
    if (p.includes('CONTEXT.md')) return MOCK_CONTEXT_MD;
    if (p.includes('RESEARCH.md')) {
      if (!hasResearch) throw new Error('ENOENT');
      return MOCK_RESEARCH_MD;
    }
    if (p.includes('REQUIREMENTS.md')) return MOCK_REQUIREMENTS_MD;
    if (p.includes('ROADMAP.md')) return MOCK_ROADMAP_MD;
    if (p.includes('STATE.md')) return `---\nstatus: executing\n---\n\nPhase: 05 (context-planning)`;
    throw new Error(`ENOENT: ${p}`);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('planSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: metadata
  it('has correct skill metadata', () => {
    expect(planSkill.id).toBe('workflow.plan');
    expect(planSkill.command).toBe('plan');
    expect(planSkill.kind).toBe('prompt');
    expect(planSkill.stage).toBe('stable');
    expect(planSkill.category).toBe('workflow');
    expect(planSkill.routing).toBe('routable');
  });

  // Test 2: no provider
  it('returns failure when no AI provider is available', async () => {
    setupValidProject();
    const ctx = createMockContext({
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/No AI provider/i);
  });

  // Test 3: missing CONTEXT.md
  it('returns failure when CONTEXT.md is missing', async () => {
    mockedReaddir.mockResolvedValue(['05-context-planning'] as unknown as ReturnType<typeof readdir>);
    mockedReadFile.mockImplementation(async (filePath) => {
      const p = String(filePath);
      if (p.includes('CONTEXT.md')) throw new Error('ENOENT');
      if (p.includes('ROADMAP.md')) return MOCK_ROADMAP_MD;
      if (p.includes('REQUIREMENTS.md')) return MOCK_REQUIREMENTS_MD;
      if (p.includes('STATE.md')) return `---\nstatus: executing\n---\n\nPhase: 05 (context-planning)`;
      throw new Error(`ENOENT: ${p}`);
    });

    const ctx = createMockContext();
    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/discuss/i);
  });

  // Test 4: normal flow -- planning agent succeeds, checker passes
  it('creates plans when planning agent succeeds and checker finds no issues', async () => {
    setupValidProject();

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          if (agentCallCount === 1) {
            // Planning agent
            return Promise.resolve(createMockAgentResult({ outputText: MOCK_PLAN_OUTPUT }));
          }
          // Checker agent
          return Promise.resolve(createMockAgentResult({ outputText: 'NO_ISSUES_FOUND' }));
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toMatch(/Created 1 plan/);
    expect(mockedWriteFile).toHaveBeenCalled();
    // Both planning and checker agents called
    expect(ctx.agent.run).toHaveBeenCalledTimes(2);
  });

  // Test 5: checker finds issues, revise loop runs
  it('runs revise loop when checker finds blockers', async () => {
    setupValidProject();

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          if (agentCallCount === 1) {
            // Initial planning agent
            return Promise.resolve(createMockAgentResult({ outputText: MOCK_PLAN_OUTPUT }));
          }
          if (agentCallCount === 2) {
            // First checker -- finds blocker
            return Promise.resolve(createMockAgentResult({
              outputText: `---ISSUE---
PLAN: 01
DIMENSION: task_completeness
SEVERITY: blocker
DESCRIPTION: Task 1 missing verify section
FIX_HINT: Add <verify> section`,
            }));
          }
          if (agentCallCount === 3) {
            // Revise agent
            return Promise.resolve(createMockAgentResult({ outputText: MOCK_PLAN_OUTPUT }));
          }
          // Second checker -- passes
          return Promise.resolve(createMockAgentResult({ outputText: 'NO_ISSUES_FOUND' }));
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(true);
    // 4 agent calls: plan -> check -> revise -> check
    expect(ctx.agent.run).toHaveBeenCalledTimes(4);
  });

  // Test 6: max iterations reached
  it('accepts plans with warnings when max iterations reached', async () => {
    setupValidProject();

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          // Alternate between plan/revise and checker with blockers
          if (agentCallCount % 2 === 1) {
            // Planning or revise agent
            return Promise.resolve(createMockAgentResult({ outputText: MOCK_PLAN_OUTPUT }));
          }
          // Checker always finds blockers
          return Promise.resolve(createMockAgentResult({
            outputText: `---ISSUE---
PLAN: 01
DIMENSION: scope_sanity
SEVERITY: blocker
DESCRIPTION: Too many tasks
FIX_HINT: Split into smaller plans`,
          }));
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    // Max 3 iterations: plan + check + revise + check + revise + check = 6 calls
    expect(ctx.agent.run).toHaveBeenCalledTimes(6);
  });

  // Test 7: --skip-check flag
  it('skips checker when --skip-check flag is set', async () => {
    setupValidProject();

    const ctx = createMockContext({
      args: { 'skip-check': true },
      agent: {
        run: vi.fn().mockResolvedValue(createMockAgentResult({ outputText: MOCK_PLAN_OUTPUT })),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(true);
    // Only planning agent called, no checker
    expect(ctx.agent.run).toHaveBeenCalledTimes(1);
  });

  // Test 8: checker agent failure
  it('accepts plan without verification when checker agent fails', async () => {
    setupValidProject();

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          if (agentCallCount === 1) {
            // Planning agent succeeds
            return Promise.resolve(createMockAgentResult({ outputText: MOCK_PLAN_OUTPUT }));
          }
          // Checker agent fails
          return Promise.reject(new Error('Agent timeout'));
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.log.warn).toHaveBeenCalled();
  });

  // Test 9: multiple plans with PLAN_SEPARATOR
  it('writes multiple plan files when output contains PLAN_SEPARATOR', async () => {
    setupValidProject();

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          if (agentCallCount === 1) {
            return Promise.resolve(createMockAgentResult({ outputText: MOCK_MULTI_PLAN_OUTPUT }));
          }
          return Promise.resolve(createMockAgentResult({ outputText: 'NO_ISSUES_FOUND' }));
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toMatch(/Created 2 plans/);
    // writeFile called twice (one per plan)
    expect(mockedWriteFile).toHaveBeenCalledTimes(2);
  });

  // Test 10: missing RESEARCH.md
  it('proceeds without RESEARCH.md and logs warning', async () => {
    setupValidProject({ hasResearch: false });

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          if (agentCallCount === 1) {
            return Promise.resolve(createMockAgentResult({ outputText: MOCK_PLAN_OUTPUT }));
          }
          return Promise.resolve(createMockAgentResult({ outputText: 'NO_ISSUES_FOUND' }));
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await planSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.log.warn).toHaveBeenCalled();
  });
});
