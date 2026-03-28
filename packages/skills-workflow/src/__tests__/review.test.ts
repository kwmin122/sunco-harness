/**
 * Tests for review.skill.ts (Phase 6, WF-13)
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage, category)
 * - No-provider fallback (graceful error)
 * - Empty diff returns failure
 * - Default mode (no --phase): reviews staged+unstaged changes
 * - Phase mode (--phase N): resolves phase dir, generates diff
 * - Provider flag filtering (--claude filters to claude-family)
 * - crossVerify called with correct request and providerIds
 * - Synthesis agent called with review results
 * - REVIEWS.md written to correct location
 * - Diff truncation at 50,000 chars
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mock node:fs/promises
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock simple-git
// ---------------------------------------------------------------------------

const mockDiff = vi.fn();
const mockLog = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    diff: mockDiff,
    log: mockLog,
  })),
}));

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index abc1234..def5678 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,10 @@ export function authenticate(token: string) {
+  if (!token) {
+    throw new Error('Token required');
+  }
   return verify(token);
 }`;

function createMockAgentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: '{"findings": [{"dimension": "Security vulnerabilities", "severity": "medium", "description": "Token not sanitized", "file": "src/auth.ts", "suggestion": "Sanitize token input"}]}',
    artifacts: [],
    warnings: [],
    usage: { estimated: true, wallTimeMs: 1000 },
    ...overrides,
  };
}

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
      run: vi.fn().mockResolvedValue(createMockAgentResult({
        outputText: '# Code Review Report\n\n## Summary\nReview complete.',
      })),
      crossVerify: vi.fn().mockResolvedValue([
        createMockAgentResult({ providerId: 'claude-code-cli' }),
      ]),
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
// Setup helpers
// ---------------------------------------------------------------------------

function setupDefaultDiffMocks(): void {
  // staged diff
  mockDiff.mockImplementation((args?: string[]) => {
    if (args && args.includes('--cached')) {
      return Promise.resolve(MOCK_DIFF);
    }
    // unstaged diff
    return Promise.resolve('');
  });
}

function setupPhaseDiffMocks(): void {
  const mockedReaddir = vi.mocked(readdir);
  mockedReaddir.mockResolvedValue(
    ['06-execution-review'] as unknown as ReturnType<typeof readdir> extends Promise<infer T> ? T : never,
  );

  mockLog.mockResolvedValue({
    all: [{ hash: 'abc1234' }],
  });

  mockDiff.mockResolvedValue(MOCK_DIFF);

  const mockedMkdir = vi.mocked(mkdir);
  mockedMkdir.mockResolvedValue(undefined);

  const mockedWriteFile = vi.mocked(writeFile);
  mockedWriteFile.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reviewSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default fs mocks
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  // Test 1: metadata
  it('has correct skill metadata', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    expect(reviewSkill.id).toBe('workflow.review');
    expect(reviewSkill.command).toBe('review');
    expect(reviewSkill.kind).toBe('prompt');
    expect(reviewSkill.stage).toBe('stable');
    expect(reviewSkill.category).toBe('workflow');
  });

  // Test 2: no provider returns failure
  it('returns failure when no AI provider is available', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');
    const ctx = createMockContext({
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    });

    const result = await reviewSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/No AI provider/i);
  });

  // Test 3: empty diff returns failure
  it('returns failure when diff is empty (no changes to review)', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    mockDiff.mockResolvedValue('');

    const ctx = createMockContext();
    const result = await reviewSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/No changes to review/i);
  });

  // Test 4: default mode calls git diff for staged+unstaged
  it('default mode: calls git.diff() and git.diff(["--cached"])', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    setupDefaultDiffMocks();

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    // Should call diff at least twice: once for staged, once for unstaged
    expect(mockDiff).toHaveBeenCalledWith(['--cached']);
    expect(mockDiff).toHaveBeenCalledWith();
  });

  // Test 5: phase mode resolves phase dir
  it('phase mode: resolves phase dir and generates diff', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    setupPhaseDiffMocks();

    const ctx = createMockContext({
      args: { phase: 6 },
    });

    await reviewSkill.execute(ctx);

    // Should have called diff for phase mode
    expect(mockDiff).toHaveBeenCalled();
    // crossVerify should have been called
    expect(ctx.agent.crossVerify).toHaveBeenCalled();
  });

  // Test 6: provider flag filtering
  it('--claude flag filters to claude-family providers', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    setupDefaultDiffMocks();

    const ctx = createMockContext({
      args: { claude: true },
      agent: {
        run: vi.fn().mockResolvedValue(createMockAgentResult({
          outputText: '# Code Review Report\n\n## Summary\nDone.',
        })),
        crossVerify: vi.fn().mockResolvedValue([
          createMockAgentResult({ providerId: 'claude-code-cli' }),
        ]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli', 'openai-sdk', 'google-sdk']),
      } as unknown as SkillContext['agent'],
    });

    await reviewSkill.execute(ctx);

    // crossVerify should be called with filtered providerIds containing only claude
    const crossVerifyCall = vi.mocked(ctx.agent.crossVerify).mock.calls[0];
    expect(crossVerifyCall).toBeDefined();
    const providerIds = crossVerifyCall![1];
    expect(providerIds).toBeDefined();
    expect(providerIds!.every((id: string) => id.includes('claude'))).toBe(true);
  });

  // Test 7: crossVerify called with correct request
  it('crossVerify called with correct request and providerIds', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    setupDefaultDiffMocks();

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    expect(ctx.agent.crossVerify).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(ctx.agent.crossVerify).mock.calls[0]!;
    const request = callArgs[0];
    expect(request.role).toBe('verification');
    expect(request.permissions.role).toBe('verification');
    expect(request.prompt).toContain('SQL safety');
    expect(request.prompt).toContain('diff');
  });

  // Test 8: synthesis agent called with review results
  it('synthesis agent called with review results', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    setupDefaultDiffMocks();

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    // ctx.agent.run should be called for synthesis
    expect(ctx.agent.run).toHaveBeenCalledTimes(1);
    const synthCall = vi.mocked(ctx.agent.run).mock.calls[0]![0];
    expect(synthCall.role).toBe('planning');
    expect(synthCall.prompt).toContain('Provider');
  });

  // Test 9: REVIEWS.md written to correct location
  it('writes REVIEWS.md to .planning/ in default mode', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    setupDefaultDiffMocks();

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    const mockedWriteFile = vi.mocked(writeFile);
    expect(mockedWriteFile).toHaveBeenCalled();
    const writePath = String(mockedWriteFile.mock.calls[0]![0]);
    expect(writePath).toMatch(/REVIEWS\.md$/);
    expect(writePath).toContain('.planning');
  });

  // Test 10: REVIEWS.md written to phase dir in phase mode
  it('writes REVIEWS.md to phase directory in --phase mode', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    setupPhaseDiffMocks();

    const ctx = createMockContext({
      args: { phase: 6 },
    });

    await reviewSkill.execute(ctx);

    const mockedWriteFile = vi.mocked(writeFile);
    expect(mockedWriteFile).toHaveBeenCalled();
    const writePath = String(mockedWriteFile.mock.calls[0]![0]);
    expect(writePath).toMatch(/REVIEWS\.md$/);
    expect(writePath).toContain('06-execution-review');
  });

  // Test 11: diff truncation
  it('truncates diff exceeding 50,000 chars with warning', async () => {
    const { default: reviewSkill } = await import('../review.skill.js');

    // Generate a diff longer than 50K chars
    const longDiff = 'a'.repeat(60_000);
    mockDiff.mockImplementation((args?: string[]) => {
      if (args && args.includes('--cached')) {
        return Promise.resolve(longDiff);
      }
      return Promise.resolve('');
    });

    const ctx = createMockContext();
    await reviewSkill.execute(ctx);

    // crossVerify should have been called with a prompt containing truncation notice
    const crossVerifyCall = vi.mocked(ctx.agent.crossVerify).mock.calls[0];
    expect(crossVerifyCall).toBeDefined();
    const request = crossVerifyCall![0];
    expect(request.prompt).toContain('truncated');
  });
});
