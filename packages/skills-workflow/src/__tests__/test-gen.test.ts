/**
 * Tests for test-gen.skill.ts (Phase 7, VRF-10, REV-04)
 *
 * Verifies:
 * - Skill metadata (id, command, kind, stage, category)
 * - Reads specified files and dispatches agent with buildTestGenPrompt
 * - Writes generated tests to __tests__/ directory (D-18)
 * - --mock-external dispatches agent with buildTestGenMockPrompt for Digital Twin (D-17, REV-04)
 * - --mock-external writes mock server code to .sun/mocks/
 * - Handles agent output parsing (extract code blocks)
 * - No files specified generates tests for recently modified files
 * - Returns generated file paths in result data
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
// Mock simple-git (for git diff --name-only fallback)
// ---------------------------------------------------------------------------

const mockDiffNameOnly = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    diff: mockDiffNameOnly,
  })),
}));

import { readFile, writeFile, mkdir } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SOURCE_CODE = `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}`;

const MOCK_AGENT_TEST_OUTPUT = `Here are the generated tests:

\`\`\`typescript
// __tests__/math.test.ts
import { describe, it, expect } from 'vitest';
import { add, multiply } from '../math.js';

describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});

describe('multiply', () => {
  it('should multiply two numbers', () => {
    expect(multiply(2, 3)).toBe(6);
  });
});
\`\`\``;

const MOCK_AGENT_MOCK_OUTPUT = `\`\`\`json
{
  "mockServer": "import express from 'express';\\nconst app = express();\\napp.get('/users', (req, res) => res.json([{ id: 1, name: 'Test' }]));\\napp.listen(3001);",
  "endpoints": [
    { "method": "GET", "path": "/users", "description": "Returns list of mock users" }
  ]
}
\`\`\``;

// ---------------------------------------------------------------------------
// Mock context factory
// ---------------------------------------------------------------------------

function createMockAgentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    providerId: 'claude-code-cli',
    success: true,
    outputText: MOCK_AGENT_TEST_OUTPUT,
    artifacts: [],
    warnings: [],
    usage: { estimated: true, wallTimeMs: 1000 },
    ...overrides,
  };
}

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
      crossVerify: vi.fn(),
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
    args: { files: ['src/math.ts'] },
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupReadFile(): void {
  vi.mocked(readFile).mockImplementation((path: unknown) => {
    if (String(path).includes('math.ts')) {
      return Promise.resolve(MOCK_SOURCE_CODE);
    }
    return Promise.reject(new Error('ENOENT'));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('testGenSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  // Test 1: Skill metadata
  it('has correct skill metadata', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    expect(testGenSkill.id).toBe('workflow.test-gen');
    expect(testGenSkill.command).toBe('test-gen');
    expect(testGenSkill.kind).toBe('prompt');
    expect(testGenSkill.description).toMatch(/test/i);
  });

  // Test 2: Reads files and dispatches agent
  it('reads specified files and dispatches agent with buildTestGenPrompt', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    setupReadFile();

    const ctx = createMockContext();
    await testGenSkill.execute(ctx);

    // readFile should be called for the source file
    expect(readFile).toHaveBeenCalledWith(
      expect.stringContaining('math.ts'),
      'utf-8',
    );

    // Agent should be dispatched with a prompt containing the source code
    expect(ctx.agent.run).toHaveBeenCalledTimes(1);
    const agentCall = vi.mocked(ctx.agent.run).mock.calls[0]![0];
    expect(agentCall.prompt).toContain('add');
    expect(agentCall.prompt).toContain('multiply');
    expect(agentCall.role).toBe('verification');
  });

  // Test 3: Writes generated tests to __tests__/ directory
  it('writes generated tests to __tests__/ directory following project conventions (D-18)', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    setupReadFile();

    const ctx = createMockContext();
    await testGenSkill.execute(ctx);

    // writeFile should be called with a path in __tests__/
    expect(writeFile).toHaveBeenCalled();
    const writePath = String(vi.mocked(writeFile).mock.calls[0]![0]);
    expect(writePath).toContain('__tests__');
  });

  // Test 4: --mock-external dispatches agent with mock prompt
  it('--mock-external dispatches agent with buildTestGenMockPrompt for Digital Twin (D-17, REV-04)', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    setupReadFile();

    const mockRunFn = vi.fn()
      .mockResolvedValueOnce(createMockAgentResult())
      .mockResolvedValueOnce(createMockAgentResult({ outputText: MOCK_AGENT_MOCK_OUTPUT }));

    const ctx = createMockContext({
      args: { files: ['src/math.ts'], 'mock-external': true, mockExternal: true },
      agent: {
        run: mockRunFn,
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    await testGenSkill.execute(ctx);

    // Agent should be called twice: once for tests, once for mock server
    expect(mockRunFn).toHaveBeenCalledTimes(2);
  });

  // Test 5: --mock-external writes mock server code to .sun/mocks/
  it('--mock-external writes mock server code to .sun/mocks/ (D-18)', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    setupReadFile();

    const mockRunFn = vi.fn()
      .mockResolvedValueOnce(createMockAgentResult())
      .mockResolvedValueOnce(createMockAgentResult({ outputText: MOCK_AGENT_MOCK_OUTPUT }));

    const ctx = createMockContext({
      args: { files: ['src/math.ts'], 'mock-external': true, mockExternal: true },
      agent: {
        run: mockRunFn,
        crossVerify: vi.fn(),
        listProviders: vi.fn().mockResolvedValue(['claude-code-cli']),
      } as unknown as SkillContext['agent'],
    });

    await testGenSkill.execute(ctx);

    // Should write to .sun/mocks/
    const writeCalls = vi.mocked(writeFile).mock.calls;
    const mockWriteCall = writeCalls.find((c) => String(c[0]).includes('.sun/mocks'));
    expect(mockWriteCall).toBeDefined();
  });

  // Test 6: Handles agent output parsing (code block extraction)
  it('handles agent output parsing (extract code blocks from response)', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    setupReadFile();

    const ctx = createMockContext();
    const result = await testGenSkill.execute(ctx);

    expect(result.success).toBe(true);
    // Should have written at least one test file
    expect(writeFile).toHaveBeenCalled();
  });

  // Test 7: No files specified uses git diff
  it('with no files specified generates tests for recently modified files', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    mockDiffNameOnly.mockResolvedValue('src/math.ts\nsrc/utils.ts');
    setupReadFile();

    const ctx = createMockContext({
      args: {}, // no files specified
    });

    await testGenSkill.execute(ctx);

    // Should have called git diff for file discovery
    expect(mockDiffNameOnly).toHaveBeenCalled();
  });

  // Test 8: Returns generated file paths in result data
  it('returns generated file paths in result data', async () => {
    const { default: testGenSkill } = await import('../test-gen.skill.js');

    setupReadFile();

    const ctx = createMockContext();
    const result = await testGenSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as { generatedFiles: string[] };
    expect(data.generatedFiles).toBeDefined();
    expect(Array.isArray(data.generatedFiles)).toBe(true);
    expect(data.generatedFiles.length).toBeGreaterThan(0);
  });
});
