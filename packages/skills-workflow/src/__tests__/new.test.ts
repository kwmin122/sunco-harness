/**
 * Tests for new.skill.ts (sunco new)
 *
 * Agent-powered greenfield project bootstrap that guides users from idea to roadmap.
 * Multi-step flow: idea -> questions -> parallel research -> synthesis -> artifact writing.
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage)
 * - CLI arg idea input (skips askText)
 * - Interactive idea input (calls askText)
 * - No provider graceful fallback
 * - 5-8 clarifying questions asked
 * - Parallel research dispatch via Promise.allSettled
 * - Synthesis via planning agent
 * - 3 artifacts written (PROJECT.md, REQUIREMENTS.md, ROADMAP.md)
 * - Partial research failure tolerance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before imports
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock prompt builders to return fixed strings
vi.mock('../prompts/index.js', () => ({
  buildResearchPrompt: vi.fn(
    (topic: string) => `research-prompt-for-${topic}`,
  ),
  buildSynthesisPrompt: vi.fn(() => 'synthesis-prompt'),
}));

import { mkdir, writeFile } from 'node:fs/promises';
import newSkill from '../new.skill.js';
import type { SkillContext } from '@sunco/core';
import type { AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYNTHESIS_OUTPUT = [
  '# My Project\n\n## What This Is\nA cool project\n\n## Core Value\nAwesome',
  '# Requirements: My Project\n\n## v1 Requirements\n- REQ-01: Must work',
  '# Roadmap: My Project\n\n## Overview\nPhased approach\n\n## Phases\n- [ ] Phase 1: Setup',
].join('\n---DOCUMENT_SEPARATOR---\n');

function makeAgentResult(overrides?: Partial<AgentResult>): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: 'research output',
    artifacts: [],
    warnings: [],
    usage: {
      inputTokens: 100,
      outputTokens: 200,
      estimated: true,
      wallTimeMs: 1000,
    },
    ...overrides,
  };
}

/** Track askText and ask call counts */
let askTextCallCount: number;
let askCallCount: number;

function createMockContext(
  overrides: Partial<SkillContext> = {},
): SkillContext {
  askTextCallCount = 0;
  askCallCount = 0;

  return {
    config: {} as SkillContext['config'],
    state: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([]),
      has: vi.fn().mockResolvedValue(false),
    } as unknown as SkillContext['state'],
    fileStore: {} as SkillContext['fileStore'],
    agent: {
      run: vi.fn().mockImplementation(() =>
        Promise.resolve(makeAgentResult({ outputText: SYNTHESIS_OUTPUT })),
      ),
      crossVerify: vi.fn(),
      listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
    } as unknown as SkillContext['agent'],
    recommend: {
      getRecommendations: vi.fn().mockReturnValue([]),
      getTopRecommendation: vi.fn().mockReturnValue(undefined),
    },
    ui: {
      entry: vi.fn().mockResolvedValue(undefined),
      ask: vi.fn().mockImplementation(() => {
        askCallCount++;
        return Promise.resolve({
          selectedId: 'typescript',
          selectedLabel: 'TypeScript',
          source: 'keyboard' as const,
        });
      }),
      askText: vi.fn().mockImplementation(() => {
        askTextCallCount++;
        return Promise.resolve({
          text: 'test answer',
          source: 'keyboard' as const,
        });
      }),
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

describe('newSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: metadata
  it('has correct skill metadata', () => {
    expect(newSkill.id).toBe('workflow.new');
    expect(newSkill.command).toBe('new');
    expect(newSkill.kind).toBe('prompt');
    expect(newSkill.stage).toBe('stable');
  });

  // Test 2: CLI arg idea
  it('uses positional args as idea without calling askText for idea', async () => {
    const ctx = createMockContext({
      args: { _: ['my', 'cool', 'app'] },
    } as Partial<SkillContext>);

    await newSkill.execute(ctx);

    // askText should NOT have been called for the idea itself
    // (it may be called for freeform questions later)
    const askTextCalls = vi.mocked(ctx.ui.askText).mock.calls;
    const ideaCall = askTextCalls.find((call) =>
      (call[0] as { message: string }).message.toLowerCase().includes('idea'),
    );
    expect(ideaCall).toBeUndefined();
  });

  // Test 3: interactive idea
  it('calls askText for idea when no positional args', async () => {
    const ctx = createMockContext({
      args: { _: [] },
    } as Partial<SkillContext>);

    await newSkill.execute(ctx);

    const askTextCalls = vi.mocked(ctx.ui.askText).mock.calls;
    const ideaCall = askTextCalls.find((call) =>
      (call[0] as { message: string }).message.toLowerCase().includes('idea'),
    );
    expect(ideaCall).toBeDefined();
  });

  // Test 4: no provider
  it('returns failure when no AI provider is available', async () => {
    const ctx = createMockContext({
      args: { _: ['test', 'project'] },
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    } as Partial<SkillContext>);

    const result = await newSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toBeDefined();
    // Should mention provider/unavailable
    expect(
      result.summary?.toLowerCase().includes('provider') ||
        result.summary?.toLowerCase().includes('unavailable') ||
        result.summary?.toLowerCase().includes('no ai') ||
        result.summary?.toLowerCase().includes('agent'),
    ).toBe(true);
  });

  // Test 5: clarifying questions
  it('asks 5-8 clarifying questions', async () => {
    const ctx = createMockContext({
      args: { _: ['my', 'cool', 'app'] },
    } as Partial<SkillContext>);

    await newSkill.execute(ctx);

    const totalQuestions = askTextCallCount + askCallCount;
    expect(totalQuestions).toBeGreaterThanOrEqual(5);
    expect(totalQuestions).toBeLessThanOrEqual(8);
  });

  // Test 6: research dispatch
  it('dispatches parallel research agents with role research', async () => {
    const ctx = createMockContext({
      args: { _: ['my', 'cool', 'app'] },
    } as Partial<SkillContext>);

    await newSkill.execute(ctx);

    const agentRunCalls = vi.mocked(ctx.agent.run).mock.calls;
    const researchCalls = agentRunCalls.filter(
      (call) => (call[0] as { role: string }).role === 'research',
    );
    expect(researchCalls.length).toBeGreaterThanOrEqual(3);
  });

  // Test 7: synthesis
  it('calls synthesis agent with role planning after research', async () => {
    const ctx = createMockContext({
      args: { _: ['my', 'cool', 'app'] },
    } as Partial<SkillContext>);

    await newSkill.execute(ctx);

    const agentRunCalls = vi.mocked(ctx.agent.run).mock.calls;
    const planningCalls = agentRunCalls.filter(
      (call) => (call[0] as { role: string }).role === 'planning',
    );
    expect(planningCalls.length).toBe(1);
  });

  // Test 8: artifacts written
  it('writes 3 planning artifacts after synthesis', async () => {
    const ctx = createMockContext({
      args: { _: ['my', 'cool', 'app'] },
    } as Partial<SkillContext>);

    await newSkill.execute(ctx);

    const writeCalls = vi.mocked(writeFile).mock.calls;
    const planningWrites = writeCalls.filter((call) =>
      String(call[0]).includes('.planning'),
    );

    // Should write PROJECT.md, REQUIREMENTS.md, ROADMAP.md
    expect(planningWrites.length).toBe(3);

    const writtenPaths = planningWrites.map((call) => String(call[0]));
    expect(writtenPaths.some((p) => p.includes('PROJECT.md'))).toBe(true);
    expect(writtenPaths.some((p) => p.includes('REQUIREMENTS.md'))).toBe(true);
    expect(writtenPaths.some((p) => p.includes('ROADMAP.md'))).toBe(true);
  });

  // Test 9: partial research failure
  it('synthesizes with available results when some research agents fail', async () => {
    let callIndex = 0;
    const ctx = createMockContext({
      args: { _: ['my', 'cool', 'app'] },
      agent: {
        run: vi.fn().mockImplementation((req: { role: string }) => {
          if (req.role === 'research') {
            callIndex++;
            // Fail every other research call
            if (callIndex % 2 === 0) {
              return Promise.reject(new Error('Agent timeout'));
            }
            return Promise.resolve(makeAgentResult());
          }
          // Planning/synthesis call succeeds
          return Promise.resolve(
            makeAgentResult({ outputText: SYNTHESIS_OUTPUT }),
          );
        }),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    } as Partial<SkillContext>);

    const result = await newSkill.execute(ctx);

    // Should still succeed despite partial failures
    expect(result.success).toBe(true);

    // Synthesis should still have been called
    const agentRunCalls = vi.mocked(ctx.agent.run).mock.calls;
    const planningCalls = agentRunCalls.filter(
      (call) => (call[0] as { role: string }).role === 'planning',
    );
    expect(planningCalls.length).toBe(1);
  });
});
