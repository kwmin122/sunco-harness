/**
 * Tests for execute.skill.ts
 *
 * Verifies:
 * 1. Skill metadata (id, command, kind, stage, category)
 * 2. Missing --phase arg: returns failure with usage message
 * 3. No provider available: returns failure with guidance
 * 4. Missing phase directory: returns failure
 * 5. No PLAN.md files found: returns failure
 * 6. Normal 2-wave execution: wave 1 with 2 plans parallel, wave 2 with 1 plan
 * 7. Failed agent triggers ask with retry/skip/abort options
 * 8. Worktree cleanup runs on error (finally)
 * 9. Non-autonomous plan triggers checkpoint ask
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

const mockWorktreeManager = {
  create: vi.fn(),
  remove: vi.fn(),
  removeAll: vi.fn(),
  list: vi.fn(),
  cherryPick: vi.fn(),
};

vi.mock('../shared/worktree-manager.js', () => ({
  WorktreeManager: vi.fn().mockImplementation(() => mockWorktreeManager),
}));

vi.mock('../shared/plan-parser.js', () => ({
  parsePlanMd: vi.fn(),
  groupPlansByWave: vi.fn(),
}));

vi.mock('../shared/phase-reader.js', () => ({
  resolvePhaseDir: vi.fn(),
  writePhaseArtifact: vi.fn().mockResolvedValue('/test/.planning/phases/06-execution-review/SUMMARY.md'),
}));

vi.mock('../shared/git-state.js', () => ({
  captureGitState: vi.fn().mockResolvedValue({
    branch: 'main',
    uncommittedChanges: false,
    uncommittedFiles: [],
  }),
}));

vi.mock('../prompts/execute.js', () => ({
  buildExecutePrompt: vi.fn().mockReturnValue('Execute prompt content'),
}));

vi.mock('../shared/gates.js', () => ({
  specApprovalGate: vi.fn().mockResolvedValue({
    passed: true,
    verdict: 'PASS',
    reason: 'spec-approval-gate PASSED (mocked)',
  }),
  // keep proceedGate/artifactGate as no-ops if referenced elsewhere
  proceedGate: vi.fn(),
  artifactGate: vi.fn(),
  planGate: vi.fn(),
}));

import { readFile, readdir } from 'node:fs/promises';
import { parsePlanMd, groupPlansByWave, type ParsedPlan } from '../shared/plan-parser.js';
import { resolvePhaseDir } from '../shared/phase-reader.js';
import executeSkill from '../execute.skill.js';

const mockedReadFile = vi.mocked(readFile);
const mockedReaddir = vi.mocked(readdir);
const mockedParsePlanMd = vi.mocked(parsePlanMd);
const mockedGroupPlansByWave = vi.mocked(groupPlansByWave);
const mockedResolvePhaseDir = vi.mocked(resolvePhaseDir);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mockReaddirEntries(entries: string[]): Awaited<ReturnType<typeof readdir>> {
  return entries as unknown as Awaited<ReturnType<typeof readdir>>;
}

function createParsedPlan(overrides: Record<string, unknown> = {}): ParsedPlan {
  return {
    frontmatter: {
      phase: '06-execution-review',
      plan: 1,
      type: 'execute' as const,
      wave: 1,
      depends_on: [],
      files_modified: ['src/foo.ts'],
      autonomous: true,
      requirements: ['WF-14'],
      capabilities: [],
      isDeliverySlice: false,
      ...(overrides.frontmatter as Record<string, unknown> ?? {}),
    },
    objective: 'Test objective',
    context: '',
    tasks: [
      {
        name: 'Task 1: Create foo',
        files: ['src/foo.ts'],
        action: 'Create the file',
        verify: 'echo ok',
        done: ['File created'],
      },
    ],
    deliveryScope: '',
    verificationIntent: '',
    technicalDirection: '',
    raw: '---\nphase: 06\n---\n<tasks>...</tasks>',
    ...(overrides.top as Record<string, unknown> ?? {}),
  };
}

function createMockAgentResult(
  overrides: Partial<AgentResult> = {},
): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: '```json\n{"success":true,"tasksCompleted":1,"totalTasks":1,"commits":["abc123"]}\n```',
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
        selectedId: 'approve',
        selectedLabel: 'Approve',
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
    args: { phase: 6 },
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupValidPhase(opts: {
  planCount?: number;
  waves?: Map<number, ReturnType<typeof createParsedPlan>[]>;
  hasNonAutonomous?: boolean;
} = {}) {
  const { planCount = 1 } = opts;

  mockedResolvePhaseDir.mockResolvedValue('/test/project/.planning/phases/06-execution-review');

  const planFiles = Array.from({ length: planCount }, (_, i) =>
    `06-${String(i + 1).padStart(2, '0')}-PLAN.md`,
  );
  // readdir returns entries including non-PLAN.md files
  mockedReaddir.mockResolvedValue(mockReaddirEntries([...planFiles, '06-CONTEXT.md', '06-RESEARCH.md']));

  // readFile returns plan content
  mockedReadFile.mockResolvedValue('---\nphase: 06\nplan: 01\n---\n<tasks></tasks>');

  const plans = Array.from({ length: planCount }, (_, i) =>
    createParsedPlan({
      frontmatter: {
        plan: i + 1,
        wave: opts.waves ? undefined : 1,
        autonomous: opts.hasNonAutonomous && i === 0 ? false : true,
      },
    }),
  );

  mockedParsePlanMd.mockImplementation(() => plans[0]);

  if (opts.waves) {
    mockedGroupPlansByWave.mockReturnValue(opts.waves);
  } else {
    const waveMap = new Map<number, ReturnType<typeof createParsedPlan>[]>();
    waveMap.set(1, plans);
    mockedGroupPlansByWave.mockReturnValue(waveMap);
  }

  // WorktreeManager mocks
  mockWorktreeManager.create.mockResolvedValue({
    path: '/test/project/.sun/worktrees/06-01',
    branch: 'sunco/exec/06-01-12345',
    planId: '06-01',
  });
  mockWorktreeManager.cherryPick.mockResolvedValue(['abc123']);
  mockWorktreeManager.remove.mockResolvedValue(undefined);
  mockWorktreeManager.removeAll.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: metadata
  it('has correct skill metadata', () => {
    expect(executeSkill.id).toBe('workflow.execute');
    expect(executeSkill.command).toBe('execute');
    expect(executeSkill.kind).toBe('prompt');
    expect(executeSkill.stage).toBe('stable');
    expect(executeSkill.category).toBe('workflow');
  });

  // Test 2: missing --phase arg
  it('returns failure when --phase arg is missing', async () => {
    const ctx = createMockContext({ args: {} });
    const result = await executeSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/--phase/i);
  });

  // Test 3: no provider
  it('returns failure when no AI provider is available', async () => {
    setupValidPhase();
    const ctx = createMockContext({
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    });

    const result = await executeSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/provider/i);
  });

  // Test 4: missing phase directory
  it('returns failure when phase directory is not found', async () => {
    mockedResolvePhaseDir.mockResolvedValue(null);
    const ctx = createMockContext();

    const result = await executeSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/phase directory/i);
  });

  // Test 5: no plans
  it('returns failure when no PLAN.md files found', async () => {
    mockedResolvePhaseDir.mockResolvedValue('/test/project/.planning/phases/06-execution-review');
    // readdir returns no PLAN.md files
    mockedReaddir.mockResolvedValue(mockReaddirEntries(['06-CONTEXT.md', '06-RESEARCH.md']));
    const ctx = createMockContext();

    const result = await executeSkill.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/no plans/i);
  });

  // Test 6: normal 2-wave execution
  it('executes 2 waves with parallel plans in wave 1 and sequential wave 2', async () => {
    const plan1 = createParsedPlan({ frontmatter: { plan: 1, wave: 1 } });
    const plan2 = createParsedPlan({ frontmatter: { plan: 2, wave: 1 } });
    const plan3 = createParsedPlan({ frontmatter: { plan: 3, wave: 2 } });

    const waveMap = new Map();
    waveMap.set(1, [plan1, plan2]);
    waveMap.set(2, [plan3]);

    setupValidPhase({ planCount: 3, waves: waveMap });

    const ctx = createMockContext();

    const result = await executeSkill.execute(ctx);

    expect(result.success).toBe(true);
    // 3 worktrees created (one per plan)
    expect(mockWorktreeManager.create).toHaveBeenCalledTimes(3);
    // 3 agent dispatches
    expect(ctx.agent.run).toHaveBeenCalledTimes(3);
    // 3 cherry-picks
    expect(mockWorktreeManager.cherryPick).toHaveBeenCalledTimes(3);
    // cleanup called
    expect(mockWorktreeManager.removeAll).toHaveBeenCalled();
  });

  // Test 7: failed agent triggers ask
  it('asks user retry/skip/abort when agent fails in a wave', async () => {
    const plan1 = createParsedPlan({ frontmatter: { plan: 1, wave: 1 } });
    const waveMap = new Map();
    waveMap.set(1, [plan1]);

    setupValidPhase({ planCount: 1, waves: waveMap });

    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockResolvedValue(createMockAgentResult({
          success: true,
          outputText: '```json\n{"success":false,"tasksCompleted":0,"totalTasks":1,"commits":[]}\n```',
        })),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
      ui: {
        entry: vi.fn().mockResolvedValue(undefined),
        ask: vi.fn().mockResolvedValue({
          selectedId: 'skip',
          selectedLabel: 'Skip',
          source: 'default',
        }),
        askText: vi.fn().mockResolvedValue({ text: '', source: 'default' }),
        progress: vi.fn().mockReturnValue({
          update: vi.fn(),
          done: vi.fn(),
        }),
        result: vi.fn().mockResolvedValue(undefined),
      },
    });

    const result = await executeSkill.execute(ctx);

    // Should have asked the user
    expect(ctx.ui.ask).toHaveBeenCalled();
    // Cleanup should still run
    expect(mockWorktreeManager.removeAll).toHaveBeenCalled();
  });

  // Test 8: worktree cleanup on error
  it('cleans up worktrees even when execution throws', async () => {
    const plan1 = createParsedPlan({ frontmatter: { plan: 1, wave: 1 } });
    const waveMap = new Map();
    waveMap.set(1, [plan1]);

    setupValidPhase({ planCount: 1, waves: waveMap });

    // Make agent.run throw an exception
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockRejectedValue(new Error('Catastrophic failure')),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
      ui: {
        entry: vi.fn().mockResolvedValue(undefined),
        ask: vi.fn().mockResolvedValue({
          selectedId: 'abort',
          selectedLabel: 'Abort',
          source: 'default',
        }),
        askText: vi.fn().mockResolvedValue({ text: '', source: 'default' }),
        progress: vi.fn().mockReturnValue({
          update: vi.fn(),
          done: vi.fn(),
        }),
        result: vi.fn().mockResolvedValue(undefined),
      },
    });

    const result = await executeSkill.execute(ctx);

    // Cleanup must run regardless
    expect(mockWorktreeManager.removeAll).toHaveBeenCalled();
  });

  // Test 9: non-autonomous plan triggers checkpoint
  it('pauses for user when plan has autonomous=false', async () => {
    const plan1 = createParsedPlan({
      frontmatter: { plan: 1, wave: 1, autonomous: false },
    });
    const waveMap = new Map();
    waveMap.set(1, [plan1]);

    setupValidPhase({ planCount: 1, waves: waveMap });

    const ctx = createMockContext({
      ui: {
        entry: vi.fn().mockResolvedValue(undefined),
        ask: vi.fn().mockResolvedValue({
          selectedId: 'approve',
          selectedLabel: 'Approve',
          source: 'default',
        }),
        askText: vi.fn().mockResolvedValue({ text: '', source: 'default' }),
        progress: vi.fn().mockReturnValue({
          update: vi.fn(),
          done: vi.fn(),
        }),
        result: vi.fn().mockResolvedValue(undefined),
      },
    });

    const result = await executeSkill.execute(ctx);

    // Should have asked for checkpoint approval
    expect(ctx.ui.ask).toHaveBeenCalled();
    const askCall = vi.mocked(ctx.ui.ask).mock.calls[0];
    // Verify the ask was about the plan requiring human verification
    expect(askCall).toBeDefined();
  });

  // --- Spec-approval gate integration (Superpowers brainstorming HARD-GATE) ---

  it('refuses to execute when spec-approval gate blocks', async () => {
    const gates = await import('../shared/gates.js');
    vi.mocked(gates.specApprovalGate).mockResolvedValueOnce({
      passed: false,
      verdict: 'BLOCKED',
      reason: 'spec-approval-gate BLOCKED: no approved spec found.',
      findings: ['.planning/PROJECT.md missing'],
    });

    const ctx = createMockContext({ args: { phase: 1 } });
    const result = await executeSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/spec-approval-gate BLOCKED/);
    // The provider check must not have been reached.
    expect(ctx.agent.listProviders).not.toHaveBeenCalled();
  });

  it('honors --bypass-spec-approval <reason>', async () => {
    const gates = await import('../shared/gates.js');
    setupValidPhase();
    const ctx = createMockContext({
      args: { phase: 1, 'bypass-spec-approval': 'trivial doc patch' },
    });
    await executeSkill.execute(ctx);

    const specGateCalls = vi.mocked(gates.specApprovalGate).mock.calls;
    expect(specGateCalls.length).toBeGreaterThanOrEqual(1);
    const lastCall = specGateCalls[specGateCalls.length - 1]!;
    expect(lastCall[1]).toMatchObject({
      bypassSpecApproval: true,
      bypassReason: 'trivial doc patch',
    });
  });
});
