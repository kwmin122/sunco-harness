/**
 * Tests for validate.skill.ts (Phase 7, VRF-10, VRF-11)
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage, category)
 * - Spawns vitest with --coverage flags and parses json-summary output
 * - Report includes overall percentages for lines/statements/branches/functions
 * - Identifies uncovered files in the report
 * - Compares with previous snapshot from state and computes delta
 * - Saves current snapshot to state for future comparison (D-15)
 * - Returns success=true when coverage above threshold, false when below
 * - Handles missing coverage-summary.json gracefully (Pitfall 3)
 * - Respects --threshold option for pass/fail determination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mock node:child_process
// ---------------------------------------------------------------------------

const mockExecFile = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

// ---------------------------------------------------------------------------
// Mock node:fs/promises
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock node:util (for promisify)
// ---------------------------------------------------------------------------

vi.mock('node:util', () => ({
  promisify: vi.fn((fn: unknown) => fn),
}));

import { readFile, mkdir } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COVERAGE_JSON = JSON.stringify({
  total: {
    lines: { total: 200, covered: 180, skipped: 0, pct: 90 },
    statements: { total: 220, covered: 190, skipped: 0, pct: 86.36 },
    branches: { total: 50, covered: 40, skipped: 0, pct: 80 },
    functions: { total: 30, covered: 28, skipped: 0, pct: 93.33 },
  },
  '/src/utils/math.ts': {
    lines: { total: 100, covered: 95, skipped: 0, pct: 95 },
    statements: { total: 110, covered: 100, skipped: 0, pct: 90.91 },
    branches: { total: 20, covered: 18, skipped: 0, pct: 90 },
    functions: { total: 15, covered: 14, skipped: 0, pct: 93.33 },
  },
  '/src/uncovered.ts': {
    lines: { total: 40, covered: 0, skipped: 0, pct: 0 },
    statements: { total: 40, covered: 0, skipped: 0, pct: 0 },
    branches: { total: 10, covered: 0, skipped: 0, pct: 0 },
    functions: { total: 5, covered: 0, skipped: 0, pct: 0 },
  },
});

const LOW_COVERAGE_JSON = JSON.stringify({
  total: {
    lines: { total: 200, covered: 100, skipped: 0, pct: 50 },
    statements: { total: 220, covered: 110, skipped: 0, pct: 50 },
    branches: { total: 50, covered: 25, skipped: 0, pct: 50 },
    functions: { total: 30, covered: 15, skipped: 0, pct: 50 },
  },
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
      run: vi.fn(),
      crossVerify: vi.fn(),
      listProviders: vi.fn().mockResolvedValue([]),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupExecFileSuccess(): void {
  mockExecFile.mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb?: (err: Error | null, stdout: string, stderr: string) => void) => {
      if (cb) {
        cb(null, 'Test Suites: 5 passed, 5 total', '');
      }
      return { stdout: 'Test Suites: 5 passed, 5 total', stderr: '' };
    },
  );
}

function setupCoverageFileRead(): void {
  vi.mocked(readFile).mockImplementation((path: unknown) => {
    if (String(path).includes('coverage-summary.json')) {
      return Promise.resolve(COVERAGE_JSON);
    }
    return Promise.reject(new Error('ENOENT'));
  });
  vi.mocked(mkdir).mockResolvedValue(undefined);
}

function setupLowCoverageFileRead(): void {
  vi.mocked(readFile).mockImplementation((path: unknown) => {
    if (String(path).includes('coverage-summary.json')) {
      return Promise.resolve(LOW_COVERAGE_JSON);
    }
    return Promise.reject(new Error('ENOENT'));
  });
  vi.mocked(mkdir).mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
  });

  // Test 1: Skill metadata
  it('has correct skill metadata', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    expect(validateSkill.id).toBe('workflow.validate');
    expect(validateSkill.command).toBe('validate');
    expect(validateSkill.kind).toBe('deterministic');
    expect(validateSkill.description).toMatch(/coverage/i);
  });

  // Test 2: Spawns vitest with --coverage flags
  it('spawns vitest with --coverage flags and parses json-summary output', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    setupExecFileSuccess();
    setupCoverageFileRead();

    const ctx = createMockContext();
    await validateSkill.execute(ctx);

    // execFile should be called with npx vitest and coverage flags
    expect(mockExecFile).toHaveBeenCalled();
    const callArgs = mockExecFile.mock.calls[0];
    const cmd = String(callArgs[0]);
    const args = callArgs[1] as string[];
    expect(cmd).toContain('npx');
    expect(args.some((a: string) => a.includes('vitest'))).toBe(true);
    expect(args.some((a: string) => a.includes('coverage'))).toBe(true);
  });

  // Test 3: Report includes overall percentages
  it('report includes overall percentages for lines/statements/branches/functions', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    setupExecFileSuccess();
    setupCoverageFileRead();

    const ctx = createMockContext();
    const result = await validateSkill.execute(ctx);

    expect(result.data).toBeDefined();
    const report = result.data as { overall: { lines: { pct: number }; statements: { pct: number }; branches: { pct: number }; functions: { pct: number } } };
    expect(report.overall.lines.pct).toBe(90);
    expect(report.overall.statements.pct).toBe(86.36);
    expect(report.overall.branches.pct).toBe(80);
    expect(report.overall.functions.pct).toBe(93.33);
  });

  // Test 4: Identifies uncovered files
  it('identifies uncovered files in the report', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    setupExecFileSuccess();
    setupCoverageFileRead();

    const ctx = createMockContext();
    const result = await validateSkill.execute(ctx);

    const report = result.data as { uncoveredFiles: string[] };
    expect(report.uncoveredFiles).toContain('/src/uncovered.ts');
  });

  // Test 5: Compares with previous snapshot and computes delta
  it('compares with previous snapshot from state and computes delta', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    setupExecFileSuccess();
    setupCoverageFileRead();

    const previousSnapshot = {
      lines: { total: 200, covered: 160, skipped: 0, pct: 80 },
      statements: { total: 220, covered: 170, skipped: 0, pct: 77.27 },
      branches: { total: 50, covered: 35, skipped: 0, pct: 70 },
      functions: { total: 30, covered: 25, skipped: 0, pct: 83.33 },
    };

    const ctx = createMockContext({
      state: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'validate.lastSnapshot') return Promise.resolve(previousSnapshot);
          return Promise.resolve(null);
        }),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(false),
        list: vi.fn().mockResolvedValue([]),
        has: vi.fn().mockResolvedValue(false),
      } as unknown as SkillContext['state'],
    });

    const result = await validateSkill.execute(ctx);

    const report = result.data as { delta: { lines: number; statements: number; branches: number; functions: number } };
    expect(report.delta).toBeDefined();
    expect(report.delta.lines).toBeCloseTo(10, 0); // 90 - 80
  });

  // Test 6: Saves current snapshot to state
  it('saves current snapshot to state for future comparison (D-15)', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    setupExecFileSuccess();
    setupCoverageFileRead();

    const ctx = createMockContext();
    await validateSkill.execute(ctx);

    expect(ctx.state.set).toHaveBeenCalledWith(
      'validate.lastSnapshot',
      expect.objectContaining({
        lines: expect.objectContaining({ pct: 90 }),
      }),
    );
  });

  // Test 7: Returns success=true when coverage above threshold
  it('returns success=true when coverage above threshold, success=false when below', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    // Above threshold (90% > 80%)
    setupExecFileSuccess();
    setupCoverageFileRead();

    const ctx1 = createMockContext();
    const result1 = await validateSkill.execute(ctx1);
    expect(result1.success).toBe(true);

    // Below threshold (50% < 80%)
    vi.clearAllMocks();
    setupExecFileSuccess();
    setupLowCoverageFileRead();

    const ctx2 = createMockContext();
    const result2 = await validateSkill.execute(ctx2);
    expect(result2.success).toBe(false);
  });

  // Test 8: Handles missing coverage-summary.json gracefully
  it('handles missing coverage-summary.json gracefully (Pitfall 3)', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    setupExecFileSuccess();

    // readFile always fails
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'));
    vi.mocked(mkdir).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const result = await validateSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/coverage.*not found|vitest.*coverage/i);
  });

  // Test 9: Respects --threshold option
  it('respects --threshold option for pass/fail determination', async () => {
    const { default: validateSkill } = await import('../validate.skill.js');

    setupExecFileSuccess();
    setupCoverageFileRead(); // 90% coverage

    // Set threshold to 95% -- should fail
    const ctx = createMockContext({
      args: { threshold: 95 },
    });
    const result = await validateSkill.execute(ctx);
    expect(result.success).toBe(false);
  });
});
