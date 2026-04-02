/**
 * Tests for verify.skill.ts (Phase 7, VRF-01 through VRF-09, REV-02, REV-03)
 *
 * Verifies:
 * - Skill metadata (id, command, kind, options)
 * - All 5 layers execute sequentially with VerifyReport
 * - Verdict logic: FAIL (critical/high), WARN (medium/low), PASS (no findings)
 * - Swiss cheese: all layers execute even when one fails
 * - humanGateRequired flag from humanRequired findings
 * - VERIFICATION.md written to phase directory
 * - --auto flag skips human gate prompts
 * - --strict flag treats humanRequired findings as FAIL
 * - Result stored in state for recommender integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext, AgentResult } from '@sunco/core';
import type { LayerResult, VerifyFinding } from '../shared/verify-types.js';

// ---------------------------------------------------------------------------
// Mock verify-layers (all 7 layer functions)
// ---------------------------------------------------------------------------

const mockRunLayer1 = vi.fn<(...args: unknown[]) => Promise<LayerResult>>();
const mockRunLayer2 = vi.fn<(...args: unknown[]) => Promise<LayerResult>>();
const mockRunLayer3 = vi.fn<(...args: unknown[]) => Promise<LayerResult>>();
const mockRunLayer4 = vi.fn<(...args: unknown[]) => Promise<LayerResult>>();
const mockRunLayer5 = vi.fn<(...args: unknown[]) => Promise<LayerResult>>();
const mockRunLayer6 = vi.fn<(...args: unknown[]) => Promise<LayerResult>>();
const mockRunLayer7 = vi.fn<(...args: unknown[]) => Promise<LayerResult>>();

vi.mock('../shared/verify-layers.js', () => ({
  runLayer1MultiAgent: (...args: unknown[]) => mockRunLayer1(...args),
  runLayer2Deterministic: (...args: unknown[]) => mockRunLayer2(...args),
  runLayer3Acceptance: (...args: unknown[]) => mockRunLayer3(...args),
  runLayer4PermissionScope: (...args: unknown[]) => mockRunLayer4(...args),
  runLayer5Adversarial: (...args: unknown[]) => mockRunLayer5(...args),
  runLayer6CrossModel: (...args: unknown[]) => mockRunLayer6(...args),
  runLayer7HumanEval: (...args: unknown[]) => mockRunLayer7(...args),
  VERIFICATION_PERMISSIONS: {
    role: 'verification',
    readPaths: ['**'],
    writePaths: [],
    allowTests: true,
    allowNetwork: false,
    allowGitWrite: false,
    allowCommands: ['npx vitest', 'npm test'],
  },
}));

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

// ---------------------------------------------------------------------------
// Mock plan-parser
// ---------------------------------------------------------------------------

vi.mock('../shared/plan-parser.js', () => ({
  parsePlanMd: vi.fn().mockReturnValue({
    frontmatter: {
      phase: '07-verification-pipeline',
      plan: 2,
      type: 'execute',
      wave: 1,
      depends_on: [],
      files_modified: ['packages/skills-workflow/src/shared/verify-layers.ts'],
      autonomous: true,
      requirements: ['VRF-01'],
    },
    objective: 'Test objective',
    context: '',
    tasks: [{ name: 'Task 1', files: [], action: '', verify: '', done: ['Test passes'] }],
    raw: '---\nphase: 07\n---',
  }),
}));

// ---------------------------------------------------------------------------
// Mock phase-reader
// ---------------------------------------------------------------------------

vi.mock('../shared/phase-reader.js', () => ({
  resolvePhaseDir: vi.fn().mockResolvedValue('/test/project/.planning/phases/07-verification-pipeline'),
  readPhaseArtifact: vi.fn().mockResolvedValue(null),
  writePhaseArtifact: vi.fn().mockResolvedValue('/test/project/.planning/phases/07-verification-pipeline/07-VERIFICATION.md'),
}));

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolvePhaseDir, writePhaseArtifact } from '../shared/phase-reader.js';
import { parsePlanMd } from '../shared/plan-parser.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_DIFF = `diff --git a/src/verify.ts b/src/verify.ts
index abc..def 100644
--- a/src/verify.ts
+++ b/src/verify.ts
@@ -1,3 +1,5 @@
+export function verify() {
+  return true;
+}`;

function makeLayerResult(
  layer: number,
  name: string,
  findings: VerifyFinding[] = [],
  passed = true,
): LayerResult {
  return { layer, name, findings, passed, durationMs: 100 };
}

function makePassingLayers(): void {
  mockRunLayer1.mockResolvedValue(makeLayerResult(1, 'Multi-Agent Generation'));
  mockRunLayer2.mockResolvedValue(makeLayerResult(2, 'Deterministic Guardrails'));
  mockRunLayer3.mockResolvedValue(makeLayerResult(3, 'BDD Acceptance Criteria'));
  mockRunLayer4.mockResolvedValue(makeLayerResult(4, 'Permission Scoping'));
  mockRunLayer5.mockResolvedValue(makeLayerResult(5, 'Adversarial Verification'));
  mockRunLayer6.mockResolvedValue(makeLayerResult(6, 'Cross-Model Verification'));
  mockRunLayer7.mockResolvedValue(makeLayerResult(7, 'Human Eval Gate'));
}

function makeFinding(overrides: Partial<VerifyFinding> = {}): VerifyFinding {
  return {
    layer: 1,
    source: 'security',
    severity: 'medium',
    description: 'Test finding',
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
      run: vi.fn().mockResolvedValue({
        providerId: 'claude-code-cli',
        success: true,
        outputText: '{}',
        artifacts: [],
        warnings: [],
        usage: { estimated: true, wallTimeMs: 1000 },
      } satisfies AgentResult),
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
    args: { phase: 7 },
    signal: new AbortController().signal,
    ...overrides,
  } as unknown as SkillContext;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function setupDefaultMocks(): void {
  vi.mocked(readdir).mockResolvedValue(
    ['07-verification-pipeline'] as unknown as ReturnType<typeof readdir> extends Promise<infer T> ? T : never,
  );
  vi.mocked(readFile).mockResolvedValue('---\nphase: 07-verification-pipeline\nplan: 2\n---\n<objective>test</objective>');
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);

  mockDiff.mockImplementation((args?: string[]) => {
    if (args && args.includes('--cached')) return Promise.resolve(MOCK_DIFF);
    if (args && args.includes('--name-only')) return Promise.resolve('src/verify.ts');
    return Promise.resolve(MOCK_DIFF);
  });
  mockLog.mockResolvedValue({ all: [{ hash: 'abc1234', message: 'test' }] });

  makePassingLayers();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifySkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // Test 1: Skill metadata
  it('has correct skill metadata with id, kind, and options', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');

    expect(verifySkill.id).toBe('workflow.verify');
    expect(verifySkill.kind).toBe('prompt');
    expect(verifySkill.description).toMatch(/7-layer/i);

    // Check options include --phase, --auto, --strict
    const optionFlags = verifySkill.options?.map((o) => o.flags) ?? [];
    expect(optionFlags.some((f) => f.includes('--phase'))).toBe(true);
    expect(optionFlags.some((f) => f.includes('--auto'))).toBe(true);
    expect(optionFlags.some((f) => f.includes('--strict'))).toBe(true);
  });

  // Test 2: Executes all 7 layers and produces VerifyReport
  it('executes all 7 layers sequentially and produces VerifyReport', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');
    const ctx = createMockContext();

    const result = await verifySkill.execute(ctx);

    // All 5 layers called
    expect(mockRunLayer1).toHaveBeenCalledTimes(1);
    expect(mockRunLayer2).toHaveBeenCalledTimes(1);
    expect(mockRunLayer3).toHaveBeenCalledTimes(1);
    expect(mockRunLayer4).toHaveBeenCalledTimes(1);
    expect(mockRunLayer5).toHaveBeenCalledTimes(1);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const report = result.data as Record<string, unknown>;
    expect(report.verdict).toBe('PASS');
    expect(report.layers).toHaveLength(7);
    expect(report.findings).toHaveLength(0);
  });

  // Test 3: FAIL when critical or high severity findings
  it('verdict is FAIL when any finding has critical or high severity', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');

    mockRunLayer1.mockResolvedValue(
      makeLayerResult(1, 'Multi-Agent Generation', [
        makeFinding({ severity: 'critical', description: 'SQL injection' }),
      ], false),
    );

    const ctx = createMockContext();
    const result = await verifySkill.execute(ctx);

    expect(result.success).toBe(false);
    const report = result.data as Record<string, unknown>;
    expect(report.verdict).toBe('FAIL');
  });

  // Test 4: FAIL when any findings exist (zero-tolerance, stop-the-line)
  it('verdict is FAIL when findings are only medium/low severity (zero tolerance)', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');

    mockRunLayer2.mockResolvedValue(
      makeLayerResult(2, 'Deterministic Guardrails', [
        makeFinding({ severity: 'medium', description: 'Missing validation' }),
      ]),
    );

    const ctx = createMockContext();
    const result = await verifySkill.execute(ctx);

    expect(result.success).toBe(false);
    const report = result.data as Record<string, unknown>;
    expect(report.verdict).toBe('FAIL');
  });

  // Test 5: PASS when no findings
  it('verdict is PASS when no findings', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');
    const ctx = createMockContext();

    const result = await verifySkill.execute(ctx);

    const report = result.data as Record<string, unknown>;
    expect(report.verdict).toBe('PASS');
  });

  // Test 6: Swiss cheese - all layers execute even when one fails
  it('all 5 layers execute even when Layer 1 throws (Swiss cheese model)', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');

    // Layer 1 throws
    mockRunLayer1.mockRejectedValue(new Error('Agent timeout'));

    const ctx = createMockContext();
    const result = await verifySkill.execute(ctx);

    // All layers should still be called
    expect(mockRunLayer1).toHaveBeenCalledTimes(1);
    expect(mockRunLayer2).toHaveBeenCalledTimes(1);
    expect(mockRunLayer3).toHaveBeenCalledTimes(1);
    expect(mockRunLayer4).toHaveBeenCalledTimes(1);
    expect(mockRunLayer5).toHaveBeenCalledTimes(1);

    // Result should still be produced (with the error captured)
    expect(result.data).toBeDefined();
    const report = result.data as Record<string, unknown>;
    expect(report.layers).toHaveLength(7);
  });

  // Test 7: humanGateRequired when any finding has humanRequired=true
  it('humanGateRequired is true when any finding has humanRequired=true', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');

    mockRunLayer2.mockResolvedValue(
      makeLayerResult(2, 'Deterministic Guardrails', [
        makeFinding({
          source: 'tribal',
          severity: 'low',
          description: 'Tribal knowledge match',
          humanRequired: true,
        }),
      ]),
    );

    const ctx = createMockContext();
    const result = await verifySkill.execute(ctx);

    const report = result.data as Record<string, unknown>;
    expect(report.humanGateRequired).toBe(true);
  });

  // Test 8: VERIFICATION.md written to phase directory
  it('writes VERIFICATION.md to phase directory', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');
    const ctx = createMockContext();

    await verifySkill.execute(ctx);

    // writePhaseArtifact or writeFile should be called with VERIFICATION.md
    const mockedWriteFile = vi.mocked(writeFile);
    const writeCall = mockedWriteFile.mock.calls.find(
      (call) => String(call[0]).includes('VERIFICATION.md'),
    );
    expect(writeCall).toBeDefined();

    // Content should contain layer sections
    const content = String(writeCall![1]);
    expect(content).toContain('Layer 1');
    expect(content).toContain('Layer 2');
    expect(content).toContain('Layer 3');
    expect(content).toContain('Layer 4');
    expect(content).toContain('Layer 5');
    expect(content).toContain('Verdict');
  });

  // Test 9: --auto flag skips human gate prompts
  it('--auto flag skips human gate prompts', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');

    mockRunLayer2.mockResolvedValue(
      makeLayerResult(2, 'Deterministic Guardrails', [
        makeFinding({ humanRequired: true, severity: 'low', source: 'tribal' }),
      ]),
    );

    const ctx = createMockContext({
      args: { phase: 7, auto: true },
    });

    await verifySkill.execute(ctx);

    // ctx.ui.ask should NOT be called for human gate when --auto
    expect(ctx.ui.ask).not.toHaveBeenCalled();
  });

  // Test 10: --strict flag treats humanRequired findings as FAIL
  it('--strict flag treats humanRequired findings as FAIL', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');

    mockRunLayer2.mockResolvedValue(
      makeLayerResult(2, 'Deterministic Guardrails', [
        makeFinding({
          humanRequired: true,
          severity: 'low',
          source: 'tribal',
          description: 'Tribal match',
        }),
      ]),
    );

    const ctx = createMockContext({
      args: { phase: 7, strict: true },
    });

    const result = await verifySkill.execute(ctx);

    expect(result.success).toBe(false);
    const report = result.data as Record<string, unknown>;
    expect(report.verdict).toBe('FAIL');
  });

  // Test 11: Result stored in state for recommender
  it('stores verify result in state for recommender integration', async () => {
    const { default: verifySkill } = await import('../verify.skill.js');
    const ctx = createMockContext();

    await verifySkill.execute(ctx);

    expect(ctx.state.set).toHaveBeenCalledWith(
      'verify.lastResult',
      expect.objectContaining({
        verdict: 'PASS',
        findingCount: 0,
      }),
    );
  });
});
