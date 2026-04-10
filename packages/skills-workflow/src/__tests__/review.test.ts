/**
 * Tests for review.skill.ts (Phase 25 — Smart Front-Door Router)
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage, category, tier)
 * - Auto-detection: UI signals → design-review
 * - Auto-detection: strategy signals → ceo-review
 * - Auto-detection: default → eng-review
 * - --type override bypasses auto-detection
 * - ctx.run() delegation to correct specialist skill
 * - One-line auto-selection message (D-09)
 * - Graceful fallback on delegation failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, ActiveWork } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mock simple-git + readActiveWork
// ---------------------------------------------------------------------------

const mockDiff = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    diff: mockDiff,
  })),
}));

const mockReadActiveWork = vi.fn();
vi.mock('@sunco/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sunco/core')>();
  return {
    ...actual,
    readActiveWork: (...args: unknown[]) => mockReadActiveWork(...args),
  };
});

// ---------------------------------------------------------------------------
// Mock context factory
// ---------------------------------------------------------------------------

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
      run: vi.fn().mockResolvedValue({ success: true, outputText: '', artifacts: [], warnings: [], usage: { estimated: true, wallTimeMs: 0 } }),
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
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    run: vi.fn().mockResolvedValue({ success: true, summary: 'delegated', data: {} }),
    cwd: '/test/project',
    args: {},
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reviewSkill (auto-routing front-door)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiff.mockResolvedValue('');
    mockReadActiveWork.mockResolvedValue({
      updated_at: '1970-01-01T00:00:00.000Z',
      active_phase: null,
      background_work: [],
      blocked_on: null,
      next_recommended_action: null,
      recent_skill_calls: [],
      routing_misses: [],
    });
  });

  // Test 1: metadata
  it('has correct skill metadata including tier: user (D-08)', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    expect(reviewSkill.id).toBe('workflow.review');
    expect(reviewSkill.command).toBe('review');
    expect(reviewSkill.kind).toBe('prompt');
    expect(reviewSkill.stage).toBe('stable');
    expect(reviewSkill.category).toBe('workflow');
    expect(reviewSkill.tier).toBe('user');
  });

  // Test 2: default auto-detection → eng-review
  it('auto-detects eng-review when diff has implementation files', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('src/auth.ts\nsrc/utils.ts');

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith('workflow.eng-review', expect.any(Object));
  });

  // Test 3: UI signals → design-review
  it('auto-detects design-review when diff contains UI signals', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockImplementation((args?: string[]) => {
      if (args && args.includes('--name-only')) {
        return Promise.resolve('');
      }
      if (args && args.includes('--cached')) {
        return Promise.resolve('src/components/Button.tsx\nsrc/styles/main.css');
      }
      return Promise.resolve('src/components/Button.tsx');
    });

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith('workflow.design-review', expect.any(Object));
  });

  // Test 4: strategy signals → ceo-review
  it('auto-detects ceo-review when diff contains strategy signals', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockImplementation((args?: string[]) => {
      if (args && args.includes('--cached')) {
        return Promise.resolve('PRODUCT-SPEC.md\nROADMAP.md');
      }
      return Promise.resolve('');
    });

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith('workflow.ceo-review', expect.any(Object));
  });

  // Test 5: --type override
  it('--type override bypasses auto-detection (D-07)', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    // Diff has UI signals, but --type forces ceo
    mockDiff.mockResolvedValue('Button.tsx');

    const ctx = createMockContext({ args: { type: 'ceo' } });
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith('workflow.ceo-review', expect.any(Object));
  });

  // Test 6: one-line auto-selection message (D-09)
  it('logs auto-selection message (D-09)', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('src/auth.ts');

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Auto-selected:'),
      expect.any(Object),
    );
  });

  // Test 7: --phase passed through to delegated skill
  it('passes --phase to delegated skill', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('src/auth.ts');

    const ctx = createMockContext({ args: { phase: 25 } });
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ phase: 25 }),
    );
  });

  // Test 8: delegation failure → graceful fallback
  it('returns failure when delegated skill throws', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('src/auth.ts');

    const ctx = createMockContext({
      run: vi.fn().mockRejectedValue(new Error('Specialist skill not found')),
    });
    const result = await reviewSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toContain('eng-review failed');
  });

  // Test 9: empty diff defaults to eng-review
  it('defaults to eng-review when diff is empty', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('');

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith('workflow.eng-review', expect.any(Object));
  });

  // Test 10: result includes routing metadata
  it('result includes routedTo and selectionReason metadata', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('src/auth.ts');

    const ctx = createMockContext();
    const result = await reviewSkill.execute(ctx);

    expect(result.data).toHaveProperty('routedTo', 'workflow.eng-review');
    expect(result.data).toHaveProperty('selectionReason');
  });

  // Test 11: active_phase.current_step=execute routes to eng-review
  it('routes to eng-review when active phase step is execute', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('');
    mockReadActiveWork.mockResolvedValue({
      updated_at: new Date().toISOString(),
      active_phase: { id: '27', slug: 'test', state: 'in_progress', current_step: 'execute', category: 'deep' },
      background_work: [],
      blocked_on: null,
      next_recommended_action: null,
      recent_skill_calls: [],
      routing_misses: [],
    });

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith('workflow.eng-review', expect.any(Object));
  });

  // Test 12: active_phase.current_step=verify routes to ceo-review
  it('routes to ceo-review when active phase step is verify', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('');
    mockReadActiveWork.mockResolvedValue({
      updated_at: new Date().toISOString(),
      active_phase: { id: '27', slug: 'test', state: 'in_progress', current_step: 'verify', category: 'review' },
      background_work: [],
      blocked_on: null,
      next_recommended_action: null,
      recent_skill_calls: [],
      routing_misses: [],
    });

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.run).toHaveBeenCalledWith('workflow.ceo-review', expect.any(Object));
  });
});
