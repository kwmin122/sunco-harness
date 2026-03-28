/**
 * Tests for research.skill.ts (Phase 5, WF-11)
 *
 * Named research-skill.test.ts (not research.test.ts) to avoid confusion
 * with the existing prompts/research.ts from Phase 4 (Pitfall 4).
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage, category, routing)
 * - No-provider fallback (graceful error)
 * - Missing CONTEXT.md fallback
 * - Topic auto-derivation from CONTEXT.md
 * - --topics override
 * - Parallel dispatch with Promise.allSettled (3-5 agents)
 * - Partial failure handling (some agents fail, synthesis proceeds)
 * - All-fail handling
 * - Synthesis success (RESEARCH.md written)
 * - Synthesis failure fallback (raw results written)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Mock fs/promises before imports
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_CONTEXT_MD = `# Phase 5: Context + Planning - Context

<decisions>
## Implementation Decisions

### sunco discuss (WF-09)
- **D-01:** Interactive conversation flow
- **D-02:** Holdout scenarios

### sunco research (WF-11)
- **D-08:** Parallel agent dispatch: 3-5 research agents
- **D-09:** Research agents use role: 'research' (read-only permissions)
</decisions>
`;

const MOCK_STATE_MD = `---
status: executing
progress:
  total_phases: 10
  completed_phases: 4
  total_plans: 35
  completed_plans: 30
  percent: 85
---

# Project State

## Current Position

Phase: 05 (context-planning) -- EXECUTING
Plan: 3 of 5
`;

const MOCK_ROADMAP_MD = `# Roadmap

- [ ] **Phase 5: Context + Planning** - Agent-powered workflow skills

### Phase 5: Context + Planning

**Requirements**: WF-09, WF-10, WF-11, WF-12

Plans:
- [ ] 05-01-PLAN.md -- discuss skill
- [ ] 05-02-PLAN.md -- assume skill
- [ ] 05-03-PLAN.md -- research skill
`;

function createMockAgentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: '## Standard Stack\n\nContent here.\n\n## Confidence: HIGH\nWell-established domain.',
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
// Helper: setup file mocks for a normal flow
// ---------------------------------------------------------------------------

function setupNormalFileMocks(): void {
  const mockedReaddir = vi.mocked(readdir);
  mockedReaddir.mockResolvedValue(['05-context-planning'] as unknown as ReturnType<typeof readdir> extends Promise<infer T> ? T : never);

  const mockedReadFile = vi.mocked(readFile);
  mockedReadFile.mockImplementation((path: Parameters<typeof readFile>[0]) => {
    const p = String(path);
    if (p.includes('STATE.md')) return Promise.resolve(MOCK_STATE_MD);
    if (p.includes('CONTEXT.md')) return Promise.resolve(MOCK_CONTEXT_MD);
    if (p.includes('ROADMAP.md')) return Promise.resolve(MOCK_ROADMAP_MD);
    return Promise.reject(new Error(`File not found: ${p}`));
  });

  const mockedMkdir = vi.mocked(mkdir);
  mockedMkdir.mockResolvedValue(undefined);

  const mockedWriteFile = vi.mocked(writeFile);
  mockedWriteFile.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('researchSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: metadata
  it('has correct skill metadata', async () => {
    const { default: researchSkill } = await import('../research.skill.js');

    expect(researchSkill.id).toBe('workflow.research');
    expect(researchSkill.command).toBe('research');
    expect(researchSkill.kind).toBe('prompt');
    expect(researchSkill.stage).toBe('stable');
    expect(researchSkill.category).toBe('workflow');
    expect(researchSkill.routing).toBe('routable');
  });

  // Test 2: no provider
  it('returns failure when no AI provider is available', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    const ctx = createMockContext({
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    });

    const result = await researchSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/No AI provider/i);
  });

  // Test 3: missing CONTEXT.md
  it('returns failure when CONTEXT.md is missing', async () => {
    const { default: researchSkill } = await import('../research.skill.js');

    const mockedReaddir = vi.mocked(readdir);
    mockedReaddir.mockResolvedValue(['05-context-planning'] as unknown as ReturnType<typeof readdir> extends Promise<infer T> ? T : never);

    const mockedReadFile = vi.mocked(readFile);
    mockedReadFile.mockImplementation((path: Parameters<typeof readFile>[0]) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(MOCK_STATE_MD);
      if (p.includes('ROADMAP.md')) return Promise.resolve(MOCK_ROADMAP_MD);
      return Promise.reject(new Error('ENOENT'));
    });

    const ctx = createMockContext();
    const result = await researchSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/CONTEXT\.md|discuss/i);
  });

  // Test 4: topic auto-derivation
  it('auto-derives topics from CONTEXT.md via planning agent', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          if (agentCallCount === 1) {
            // Topic derivation agent
            return Promise.resolve(
              createMockAgentResult({
                outputText: 'Interactive conversation patterns\nAgent dispatch and orchestration\nBDD scenario generation',
              }),
            );
          }
          // Research agents + synthesis
          return Promise.resolve(createMockAgentResult());
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    await researchSkill.execute(ctx);

    // First call is topic derivation, then 3 research agents, then synthesis = 5 total
    expect(ctx.agent.run).toHaveBeenCalledTimes(5);
    // First call should be role: 'planning' for topic derivation
    const firstCall = vi.mocked(ctx.agent.run).mock.calls[0]![0];
    expect(firstCall.role).toBe('planning');
  });

  // Test 5: --topics override
  it('uses provided --topics instead of auto-derivation', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    const ctx = createMockContext({
      args: { topics: 'auth patterns,session management' },
    });

    await researchSkill.execute(ctx);

    // No topic derivation call. 2 research agents + 1 synthesis = 3 total
    expect(ctx.agent.run).toHaveBeenCalledTimes(3);
    // First call should be role: 'research' (not planning)
    const firstCall = vi.mocked(ctx.agent.run).mock.calls[0]![0];
    expect(firstCall.role).toBe('research');
  });

  // Test 6: parallel dispatch uses Promise.allSettled pattern
  it('dispatches research agents with role:research and read-only permissions', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    let agentCallCount = 0;
    const ctx = createMockContext({
      args: { topics: 'topic1,topic2,topic3' },
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          return Promise.resolve(createMockAgentResult());
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    await researchSkill.execute(ctx);

    // 3 research agents + 1 synthesis = 4
    expect(ctx.agent.run).toHaveBeenCalledTimes(4);

    // Check research agents have role: 'research' and read-only permissions
    const researchCalls = vi.mocked(ctx.agent.run).mock.calls.slice(0, 3);
    for (const call of researchCalls) {
      expect(call[0].role).toBe('research');
      expect(call[0].permissions.role).toBe('research');
      expect(call[0].permissions.readPaths).toEqual(['**']);
      expect(call[0].permissions.writePaths).toEqual([]);
    }
  });

  // Test 7: partial failure -- some agents fail, synthesis proceeds
  it('handles partial failure: synthesizes from successful results only', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    let callCount = 0;
    const ctx = createMockContext({
      args: { topics: 'topic1,topic2,topic3,topic4' },
      agent: {
        run: vi.fn().mockImplementation(() => {
          callCount++;
          // Fail agents 2 and 3 (out of 4 research agents)
          if (callCount === 2 || callCount === 3) {
            return Promise.reject(new Error('Agent timeout'));
          }
          return Promise.resolve(createMockAgentResult());
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await researchSkill.execute(ctx);

    // Should succeed because at least 1 research agent succeeded
    expect(result.success).toBe(true);
    // Should have warnings about failed agents
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
  });

  // Test 8: all research agents fail
  it('returns failure when all research agents fail', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    let callCount = 0;
    const ctx = createMockContext({
      args: { topics: 'topic1,topic2' },
      agent: {
        run: vi.fn().mockImplementation(() => {
          callCount++;
          // All research agents fail (calls 1 and 2)
          if (callCount <= 2) {
            return Promise.reject(new Error('Agent unavailable'));
          }
          // This should not be reached (no synthesis if all fail)
          return Promise.resolve(createMockAgentResult());
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await researchSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/fail|error/i);
  });

  // Test 9: synthesis writes RESEARCH.md
  it('writes RESEARCH.md to phase directory on success', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    const ctx = createMockContext({
      args: { topics: 'topic1' },
    });

    // Synthesis agent returns the RESEARCH.md content
    let callCount = 0;
    vi.mocked(ctx.agent.run).mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        // Synthesis call
        return Promise.resolve(
          createMockAgentResult({
            outputText: '---\nphase: 5\ndomain: Context Planning\nconfidence: HIGH\n---\n\n# Phase 5: Research\n\n## Summary\nResearch findings.',
          }),
        );
      }
      return Promise.resolve(createMockAgentResult());
    });

    await researchSkill.execute(ctx);

    // writeFile should have been called with a path containing RESEARCH.md
    const mockedWriteFile = vi.mocked(writeFile);
    expect(mockedWriteFile).toHaveBeenCalled();
    const writePath = String(mockedWriteFile.mock.calls[0]![0]);
    expect(writePath).toMatch(/RESEARCH\.md$/);
  });

  // Test 10: synthesis failure falls back to raw results
  it('writes raw results as fallback when synthesis fails', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    let callCount = 0;
    const ctx = createMockContext({
      args: { topics: 'topic1' },
      agent: {
        run: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Research agent succeeds
            return Promise.resolve(createMockAgentResult({ outputText: '## Standard Stack\nSome research' }));
          }
          // Synthesis agent fails
          return Promise.reject(new Error('Synthesis failed'));
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await researchSkill.execute(ctx);

    // Should still succeed (fallback mode)
    expect(result.success).toBe(true);
    // Warnings about synthesis failure
    expect(result.warnings).toBeDefined();

    // Raw results should be written
    const mockedWriteFile = vi.mocked(writeFile);
    expect(mockedWriteFile).toHaveBeenCalled();
  });

  // Test 11: topic cap at 5
  it('caps auto-derived topics at 5', async () => {
    const { default: researchSkill } = await import('../research.skill.js');
    setupNormalFileMocks();

    let agentCallCount = 0;
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockImplementation(() => {
          agentCallCount++;
          if (agentCallCount === 1) {
            // Topic derivation returns 7 topics (should be capped at 5)
            return Promise.resolve(
              createMockAgentResult({
                outputText: 'Topic 1\nTopic 2\nTopic 3\nTopic 4\nTopic 5\nTopic 6\nTopic 7',
              }),
            );
          }
          return Promise.resolve(createMockAgentResult());
        }),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    await researchSkill.execute(ctx);

    // 1 topic derivation + 5 research agents (capped) + 1 synthesis = 7
    expect(ctx.agent.run).toHaveBeenCalledTimes(7);
  });
});
