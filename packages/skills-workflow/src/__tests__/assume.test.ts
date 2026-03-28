/**
 * Tests for assume.skill.ts
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage, routing)
 * - No-provider fallback (returns failure)
 * - Missing CONTEXT.md (returns failure with "discuss first" message)
 * - Normal flow with all assumptions approved (no CONTEXT.md write)
 * - Normal flow with corrections (CONTEXT.md appended with new D-{N+1} decisions)
 * - Agent failure (returns failure)
 * - Assumption parsing fallback (graceful handling of malformed agent output)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises before imports
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock the prompt builder
vi.mock('../prompts/assume.js', () => ({
  buildAssumePrompt: vi.fn().mockReturnValue('mock assume prompt'),
}));

import { readFile, writeFile, readdir } from 'node:fs/promises';
import assumeSkill from '../assume.skill.js';
import type { SkillContext } from '@sunco/core';
import type { AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_CONTEXT_MD = `# Phase 5: Context + Planning - Context

<decisions>
## Implementation Decisions

- **D-01:** Interactive conversation flow
- **D-02:** Holdout scenarios
- **D-03:** CONTEXT.md structure follows template

### Claude's Discretion
- Gray area identification heuristics
</decisions>
`;

const SAMPLE_ROADMAP_MD = `# SUNCO Roadmap

## Phase 5: Context + Planning

Build the discuss -> assume -> research -> plan chain.
`;

const SAMPLE_STATE_MD = `---
status: executing
progress:
  total_phases: 10
  completed_phases: 4
---

# Project State

## Current Position

Phase: 05 (context-planning) -- EXECUTING
Plan: 2 of 5
`;

const AGENT_OUTPUT_ALL_ASSUMPTIONS = `---ASSUMPTION---
ID: A-1
AREA: File Structure
ASSUMPTION: New skill files go in packages/skills-workflow/src/
CONFIDENCE: HIGH
RATIONALE: All existing skills follow this pattern
ALTERNATIVE: Could use a subdirectory but existing convention is flat

---ASSUMPTION---
ID: A-2
AREA: API Design
ASSUMPTION: Use ctx.ui.ask() for interactive assumption review
CONFIDENCE: MEDIUM
RATIONALE: Other interactive skills use this pattern
ALTERNATIVE: Could batch-display all assumptions and ask for corrections at once
`;

function createMockAgentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: AGENT_OUTPUT_ALL_ASSUMPTIONS,
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
        selectedId: 'approve',
        selectedLabel: 'Correct',
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

describe('assumeSkill', () => {
  const mockedReadFile = vi.mocked(readFile);
  const mockedWriteFile = vi.mocked(writeFile);
  const mockedReaddir = vi.mocked(readdir);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: phase directory exists with CONTEXT.md and STATE.md
    mockedReaddir.mockResolvedValue(
      ['05-context-planning'] as unknown as Awaited<ReturnType<typeof readdir>>,
    );
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('CONTEXT.md')) return Promise.resolve(SAMPLE_CONTEXT_MD);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP_MD);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE_MD);
      return Promise.reject(new Error('ENOENT'));
    });
    mockedWriteFile.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  it('has correct skill metadata', () => {
    expect(assumeSkill.id).toBe('workflow.assume');
    expect(assumeSkill.command).toBe('assume');
    expect(assumeSkill.kind).toBe('prompt');
    expect(assumeSkill.stage).toBe('stable');
    expect(assumeSkill.category).toBe('workflow');
    expect(assumeSkill.routing).toBe('routable');
  });

  // -------------------------------------------------------------------------
  // No provider
  // -------------------------------------------------------------------------

  it('returns failure when no AI provider is available', async () => {
    const ctx = createMockContext({
      agent: {
        run: vi.fn(),
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue([]),
      } as unknown as SkillContext['agent'],
    });

    const result = await assumeSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/No AI provider/i);
  });

  // -------------------------------------------------------------------------
  // Missing CONTEXT.md
  // -------------------------------------------------------------------------

  it('returns failure when CONTEXT.md is missing', async () => {
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE_MD);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP_MD);
      return Promise.reject(new Error('ENOENT'));
    });

    const ctx = createMockContext();
    const result = await assumeSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/discuss/i);
  });

  // -------------------------------------------------------------------------
  // Normal flow: all approved (no CONTEXT.md modification)
  // -------------------------------------------------------------------------

  it('dispatches single planning agent and presents assumptions', async () => {
    const ctx = createMockContext();
    const result = await assumeSkill.execute(ctx);

    expect(result.success).toBe(true);
    // Single agent call
    expect(ctx.agent.run).toHaveBeenCalledTimes(1);
    // Verify role is planning
    const agentCall = vi.mocked(ctx.agent.run).mock.calls[0]![0];
    expect(agentCall.role).toBe('planning');
    expect(agentCall.permissions.writePaths).toEqual([]);
    // Two assumptions = two ask calls
    expect(ctx.ui.ask).toHaveBeenCalledTimes(2);
  });

  it('does not modify CONTEXT.md when all assumptions are approved', async () => {
    const ctx = createMockContext();
    await assumeSkill.execute(ctx);

    // writeFile should not be called for CONTEXT.md
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Normal flow: corrections appended to CONTEXT.md
  // -------------------------------------------------------------------------

  it('appends corrections to CONTEXT.md as new numbered decisions', async () => {
    let askCallCount = 0;
    const ctx = createMockContext({
      ui: {
        entry: vi.fn().mockResolvedValue(undefined),
        ask: vi.fn().mockImplementation(() => {
          askCallCount++;
          // First assumption: approve. Second assumption: correct.
          if (askCallCount === 1) {
            return Promise.resolve({ selectedId: 'approve', selectedLabel: 'Correct', source: 'user' });
          }
          return Promise.resolve({ selectedId: 'correct', selectedLabel: 'Needs correction', source: 'user' });
        }),
        askText: vi.fn().mockResolvedValue({
          text: 'Use batch display instead of one-by-one',
          source: 'user',
        }),
        progress: vi.fn().mockReturnValue({ update: vi.fn(), done: vi.fn() }),
        result: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Partial<SkillContext>);

    await assumeSkill.execute(ctx);

    // writeFile should be called to update CONTEXT.md
    expect(mockedWriteFile).toHaveBeenCalledTimes(1);
    const writtenContent = String(mockedWriteFile.mock.calls[0]![1]);
    // Should contain the new decision
    expect(writtenContent).toContain('D-04');
    expect(writtenContent).toContain('CORRECTION from assume');
    expect(writtenContent).toContain('Use batch display instead of one-by-one');
    expect(writtenContent).toContain('corrects assumption A-2');
    // Should preserve existing content
    expect(writtenContent).toContain('D-01');
    expect(writtenContent).toContain('D-02');
    expect(writtenContent).toContain('D-03');
  });

  // -------------------------------------------------------------------------
  // Agent failure
  // -------------------------------------------------------------------------

  it('returns failure when agent fails', async () => {
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockResolvedValue(createMockAgentResult({ success: false, outputText: 'Agent error' })),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await assumeSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/agent/i);
  });

  // -------------------------------------------------------------------------
  // Assumption parse fallback
  // -------------------------------------------------------------------------

  it('handles malformed agent output gracefully', async () => {
    const ctx = createMockContext({
      agent: {
        run: vi.fn().mockResolvedValue(
          createMockAgentResult({ outputText: 'No assumptions here, just plain text.' }),
        ),
        crossVerify: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    const result = await assumeSkill.execute(ctx);

    // Should still succeed but with 0 assumptions reviewed
    expect(result.success).toBe(true);
    expect(result.summary).toContain('0');
    expect(ctx.ui.ask).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Phase option
  // -------------------------------------------------------------------------

  it('uses phase from args when provided', async () => {
    const ctx = createMockContext({
      args: { phase: 3 },
    });

    mockedReaddir.mockResolvedValue(
      ['03-standalone-ts-skills'] as unknown as Awaited<ReturnType<typeof readdir>>,
    );
    mockedReadFile.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('STATE.md')) return Promise.resolve(SAMPLE_STATE_MD);
      if (p.includes('ROADMAP.md')) return Promise.resolve(SAMPLE_ROADMAP_MD);
      if (p.includes('03-') && p.includes('CONTEXT.md')) return Promise.resolve(SAMPLE_CONTEXT_MD);
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await assumeSkill.execute(ctx);
    expect(result.success).toBe(true);
  });
});
