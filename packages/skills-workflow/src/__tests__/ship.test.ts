/**
 * Tests for ship.skill.ts
 *
 * Verifies:
 * 1. Skill metadata (id, command, kind, stage, category, routing)
 * 2. When verify returns success=false, ship blocks with failure result
 * 3. When verify returns success=true with PASS verdict, ship proceeds to PR creation
 * 4. When --skip-verify is set, verification pre-check is skipped entirely
 * 5. When gh CLI is not available (execa throws), returns success=true with manual fallback
 * 6. When gh CLI is available, calls gh pr create with --title and --body
 * 7. When --draft flag is set, passes --draft to gh pr create
 * 8. PR body includes phase name, verification verdict, changelog summary
 * 9. Creates branch with naming pattern ship/phase-{N}-{slug} if on main
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext } from '@sunco/core';

// ---------------------------------------------------------------------------
// Hoisted mocks (Vitest hoisting requirement)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockCaptureGitState: vi.fn(),
  mockSimpleGit: vi.fn(),
  mockExeca: vi.fn(),
  mockBuildShipPrBody: vi.fn(),
  // simple-git instance methods
  mockCheckoutLocalBranch: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('../shared/git-state.js', () => ({
  captureGitState: mocks.mockCaptureGitState,
}));

vi.mock('simple-git', () => ({
  simpleGit: mocks.mockSimpleGit,
}));

vi.mock('../prompts/ship-pr-body.js', () => ({
  buildShipPrBody: mocks.mockBuildShipPrBody,
}));

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
      run: vi.fn().mockResolvedValue({ success: true }),
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
    run: vi.fn().mockResolvedValue({
      success: true,
      summary: 'Verification PASS',
      data: {
        verdict: 'PASS',
        layers: [],
        findings: [],
        humanGateRequired: false,
        timestamp: '2026-03-29T00:00:00.000Z',
      },
    }),
    cwd: '/test/project',
    args: { phase: 8 },
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setupDefaults() {
  // Default: on a feature branch (not main)
  mocks.mockCaptureGitState.mockResolvedValue({
    branch: 'feature/test',
    uncommittedChanges: false,
    uncommittedFiles: [],
  });

  // simple-git mock instance
  mocks.mockCheckoutLocalBranch.mockResolvedValue(undefined);
  mocks.mockPush.mockResolvedValue(undefined);
  mocks.mockSimpleGit.mockReturnValue({
    checkoutLocalBranch: mocks.mockCheckoutLocalBranch,
    push: mocks.mockPush,
  });

  // buildShipPrBody returns a test PR body
  mocks.mockBuildShipPrBody.mockReturnValue('## Phase 8: shipping\n\nTest PR body');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shipSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupDefaults();
  });

  // Test 1: metadata
  it('has correct skill metadata', async () => {
    const { default: shipSkill } = await import('../ship.skill.js');
    expect(shipSkill.id).toBe('workflow.ship');
    expect(shipSkill.command).toBe('ship');
    expect(shipSkill.kind).toBe('prompt');
    expect(shipSkill.stage).toBe('stable');
    expect(shipSkill.category).toBe('workflow');
    expect(shipSkill.routing).toBe('directExec');
  });

  // Test 2: verify returns failure -> ship blocks
  it('blocks when verify returns success=false', async () => {
    const ctx = createMockContext({
      run: vi.fn().mockResolvedValue({
        success: false,
        summary: 'Verification FAIL: 3 finding(s)',
        data: {
          verdict: 'FAIL',
          layers: [{ layer: 1, name: 'Multi-Agent', findings: [], passed: false, durationMs: 100 }],
          findings: [{ layer: 1, source: 'correctness', severity: 'critical', description: 'Bug found' }],
          humanGateRequired: false,
          timestamp: '2026-03-29T00:00:00.000Z',
        },
      }),
    });

    const { default: shipSkill } = await import('../ship.skill.js');
    const result = await shipSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/verification failed/i);
    expect(ctx.run).toHaveBeenCalledWith('workflow.verify', expect.any(Object));
  });

  // Test 3: verify returns success=true with PASS -> proceeds to PR
  it('proceeds to PR creation when verify passes', async () => {
    // Mock execa to simulate gh CLI available
    vi.doMock('execa', () => ({
      execa: mocks.mockExeca,
    }));

    // gh auth status succeeds
    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'Logged in' });
    // gh pr create succeeds
    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'https://github.com/test/repo/pull/1' });

    const ctx = createMockContext();
    const { default: shipSkill } = await import('../ship.skill.js');
    const result = await shipSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.run).toHaveBeenCalledWith('workflow.verify', expect.any(Object));
  });

  // Test 4: --skip-verify skips verification
  it('skips verification when --skip-verify is set', async () => {
    vi.doMock('execa', () => ({
      execa: mocks.mockExeca,
    }));

    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'Logged in' });
    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'https://github.com/test/repo/pull/2' });

    const ctx = createMockContext({
      args: { phase: 8, 'skip-verify': true, skipVerify: true },
    });

    const { default: shipSkill } = await import('../ship.skill.js');
    const result = await shipSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.run).not.toHaveBeenCalled();
  });

  // Test 5: gh CLI not available -> fallback
  it('returns manual fallback when gh CLI is not available', async () => {
    vi.doMock('execa', () => ({
      execa: mocks.mockExeca,
    }));

    // gh auth status throws (not installed/not authenticated)
    mocks.mockExeca.mockRejectedValueOnce(new Error('gh: command not found'));

    const ctx = createMockContext();
    const { default: shipSkill } = await import('../ship.skill.js');
    const result = await shipSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    expect(result.data).toHaveProperty('manual', true);
  });

  // Test 6: gh CLI available -> calls gh pr create
  it('calls gh pr create when gh is available', async () => {
    vi.doMock('execa', () => ({
      execa: mocks.mockExeca,
    }));

    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'Logged in' });
    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'https://github.com/test/repo/pull/3' });

    const ctx = createMockContext();
    const { default: shipSkill } = await import('../ship.skill.js');
    const result = await shipSkill.execute(ctx);

    expect(result.success).toBe(true);
    // Verify gh pr create was called (2nd execa call)
    expect(mocks.mockExeca).toHaveBeenCalledTimes(2);
    const prCreateCall = mocks.mockExeca.mock.calls[1];
    expect(prCreateCall[0]).toBe('gh');
    expect(prCreateCall[1]).toContain('pr');
    expect(prCreateCall[1]).toContain('create');
  });

  // Test 7: --draft flag
  it('passes --draft to gh pr create when draft flag is set', async () => {
    vi.doMock('execa', () => ({
      execa: mocks.mockExeca,
    }));

    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'Logged in' });
    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'https://github.com/test/repo/pull/4' });

    const ctx = createMockContext({
      args: { phase: 8, draft: true },
    });

    const { default: shipSkill } = await import('../ship.skill.js');
    const result = await shipSkill.execute(ctx);

    expect(result.success).toBe(true);
    const prCreateCall = mocks.mockExeca.mock.calls[1];
    expect(prCreateCall[1]).toContain('--draft');
  });

  // Test 8: PR body includes phase info and verdict
  it('builds PR body with phase name, verification verdict, and changelog', async () => {
    vi.doMock('execa', () => ({
      execa: mocks.mockExeca,
    }));

    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'Logged in' });
    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'https://github.com/test/repo/pull/5' });

    const ctx = createMockContext();
    const { default: shipSkill } = await import('../ship.skill.js');
    await shipSkill.execute(ctx);

    expect(mocks.mockBuildShipPrBody).toHaveBeenCalledWith(
      expect.objectContaining({
        phaseNumber: 8,
        verifyVerdict: expect.any(String),
      }),
    );
  });

  // Test 9: creates branch when on main
  it('creates ship branch when on main', async () => {
    mocks.mockCaptureGitState.mockResolvedValue({
      branch: 'main',
      uncommittedChanges: false,
      uncommittedFiles: [],
    });

    vi.doMock('execa', () => ({
      execa: mocks.mockExeca,
    }));

    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'Logged in' });
    mocks.mockExeca.mockResolvedValueOnce({ stdout: 'https://github.com/test/repo/pull/6' });

    const ctx = createMockContext();
    const { default: shipSkill } = await import('../ship.skill.js');
    await shipSkill.execute(ctx);

    expect(mocks.mockCheckoutLocalBranch).toHaveBeenCalledWith(
      expect.stringMatching(/^ship\/phase-8-/),
    );
  });
});
