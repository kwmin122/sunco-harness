/**
 * Tests for scan.skill.ts
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage)
 * - No-provider fallback (graceful error)
 * - Pre-scan context invocation
 * - Parallel agent dispatch (7 documents via Promise.allSettled)
 * - FileStore writes for successful results
 * - Partial failure handling (some agents fail, others succeed)
 * - Total failure handling (all agents fail)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock buildPreScanContext before imports
vi.mock('../shared/pre-scan.js', () => ({
  buildPreScanContext: vi.fn(),
}));

import { buildPreScanContext } from '../shared/pre-scan.js';
import scanSkill from '../scan.skill.js';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { PreScanContext } from '../shared/pre-scan.js';
import type { AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PRE_SCAN: PreScanContext = {
  ecosystems: ['nodejs', 'typescript'],
  primaryEcosystem: 'typescript',
  fileCount: 42,
  fileTree: ['src/index.ts', 'src/lib.ts', 'package.json', 'tsconfig.json'],
  keyFiles: {
    'package.json': '{ "name": "test-project" }',
  },
};

function createMockAgentResult(
  overrides: Partial<AgentResult> = {},
): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: '# Test Document\n\nContent here.',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scanSkill', () => {
  const mockedBuildPreScan = vi.mocked(buildPreScanContext);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedBuildPreScan.mockResolvedValue(MOCK_PRE_SCAN);
  });

  // Test 1: metadata
  it('has correct skill metadata', () => {
    expect(scanSkill.id).toBe('workflow.scan');
    expect(scanSkill.command).toBe('scan');
    expect(scanSkill.kind).toBe('prompt');
    expect(scanSkill.stage).toBe('stable');
  });

  // Test 2: no provider
  it('returns failure when no AI provider is available', async () => {
    const ctx = createMockContext({
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    });

    const result = await scanSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/No AI provider/i);
  });

  // Test 3: pre-scan
  it('calls buildPreScanContext with ctx.cwd', async () => {
    const ctx = createMockContext();
    await scanSkill.execute(ctx);

    expect(mockedBuildPreScan).toHaveBeenCalledWith('/test/project');
  });

  // Test 4: parallel dispatch
  it('dispatches 7 agent.run() calls for 7 documents', async () => {
    const ctx = createMockContext();
    await scanSkill.execute(ctx);

    expect(ctx.agent.run).toHaveBeenCalledTimes(7);
  });

  // Test 5: writes docs
  it('writes successful agent results to fileStore', async () => {
    const ctx = createMockContext();
    await scanSkill.execute(ctx);

    // Should write 7 documents to 'codebase' category
    expect(ctx.fileStore.write).toHaveBeenCalledTimes(7);

    // Check that each call writes to 'codebase' category with a .md filename
    const writeCalls = vi.mocked(ctx.fileStore.write).mock.calls;
    for (const call of writeCalls) {
      expect(call[0]).toBe('codebase');
      expect(call[1]).toMatch(/\.md$/);
      expect(typeof call[2]).toBe('string');
    }
  });

  // Test 6: partial failure
  it('handles partial failure gracefully -- writes successful docs, returns warnings', async () => {
    let callCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          callCount++;
          // Fail on calls 2 and 5
          if (callCount === 2 || callCount === 5) {
            return Promise.reject(new Error('Agent timeout'));
          }
          return Promise.resolve(createMockAgentResult());
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await scanSkill.execute(ctx);

    // 5 of 7 succeed
    expect(result.success).toBe(true);
    expect(ctx.fileStore.write).toHaveBeenCalledTimes(5);
    // Warnings should mention failures
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
  });

  // Test 7: total failure
  it('returns failure when all 7 agents fail', async () => {
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockRejectedValue(new Error('Agent unavailable')),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await scanSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(ctx.fileStore.write).not.toHaveBeenCalled();
  });
});
