/**
 * Tests for release.skill.ts
 *
 * Verifies:
 * 1. Skill metadata (id, command, kind=deterministic, stage, category)
 * 2. Default bump type is 'patch' when no flag
 * 3. --major flag bumps major version
 * 4. --minor flag bumps minor version
 * 5. Reads current version from root package.json
 * 6. Calls updateAllVersions to update workspace packages
 * 7. Generates CHANGELOG.md from git log since last tag
 * 8. Creates annotated git tag v{newVersion}
 * 9. Blocks when working tree is dirty (unless --force)
 * 10. --dry-run reports what would happen without changes
 * 11. --skip-publish skips npm publish step
 * 12. When tag already exists, warns and skips tagging
 * 13. Pushes tag to remote after creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkillContext } from '@sunco/core';

// ---------------------------------------------------------------------------
// Hoisted mocks (Vitest hoisting requirement)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockCaptureGitState: vi.fn(),
  mockBumpVersion: vi.fn(),
  mockUpdateAllVersions: vi.fn(),
  mockParseGitLog: vi.fn(),
  mockGenerateChangelog: vi.fn(),
  mockPrependChangelog: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockExeca: vi.fn(),
  // simple-git instance methods
  mockLog: vi.fn(),
  mockTags: vi.fn(),
  mockAddAnnotatedTag: vi.fn(),
  mockAdd: vi.fn(),
  mockCommit: vi.fn(),
  mockPush: vi.fn(),
  mockPushTags: vi.fn(),
}));

vi.mock('../shared/git-state.js', () => ({
  captureGitState: mocks.mockCaptureGitState,
}));

vi.mock('../shared/version-bumper.js', () => ({
  bumpVersion: mocks.mockBumpVersion,
  updateAllVersions: mocks.mockUpdateAllVersions,
}));

vi.mock('../shared/changelog-writer.js', () => ({
  parseGitLog: mocks.mockParseGitLog,
  generateChangelog: mocks.mockGenerateChangelog,
  prependChangelog: mocks.mockPrependChangelog,
}));

vi.mock('node:fs/promises', () => ({
  readFile: mocks.mockReadFile,
  writeFile: mocks.mockWriteFile,
}));

vi.mock('../shared/gates.js', () => ({
  artifactGate: vi.fn().mockResolvedValue({ passed: true, verdict: 'PASS', reason: 'mock' }),
  proceedGate: vi.fn().mockResolvedValue({ passed: true, verdict: 'PASS', reason: 'mock' }),
  planGate: vi.fn().mockResolvedValue({ passed: true, verdict: 'PASS', reason: 'mock' }),
}));

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    log: mocks.mockLog,
    tags: mocks.mockTags,
    addAnnotatedTag: mocks.mockAddAnnotatedTag,
    add: mocks.mockAdd,
    commit: mocks.mockCommit,
    push: mocks.mockPush,
    pushTags: mocks.mockPushTags,
  })),
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

function setupDefaults() {
  // Clean working tree
  mocks.mockCaptureGitState.mockResolvedValue({
    branch: 'main',
    uncommittedChanges: false,
    uncommittedFiles: [],
  });

  // Root package.json with version
  mocks.mockReadFile.mockImplementation((path: string) => {
    if (path.endsWith('package.json')) {
      return Promise.resolve(JSON.stringify({ name: 'sunco', version: '1.2.3' }));
    }
    if (path.endsWith('CHANGELOG.md')) {
      return Promise.resolve('# Changelog\n\n## [1.2.3] - 2026-03-28\n\nInitial');
    }
    return Promise.reject(new Error(`Not found: ${path}`));
  });

  mocks.mockWriteFile.mockResolvedValue(undefined);

  // Version bumper
  mocks.mockBumpVersion.mockReturnValue('1.2.4');
  mocks.mockUpdateAllVersions.mockResolvedValue(['package.json', 'packages/core/package.json']);

  // Changelog
  mocks.mockParseGitLog.mockReturnValue([
    { type: 'feat', description: 'Add ship skill', hash: 'abc1234' },
  ]);
  mocks.mockGenerateChangelog.mockReturnValue('## [1.2.4] - 2026-03-29\n\n### Features\n\n- Add ship skill');
  mocks.mockPrependChangelog.mockReturnValue('# Changelog\n\n## [1.2.4]\n\n...');

  // Git operations
  mocks.mockLog.mockResolvedValue({
    all: [{ hash: 'abc1234', message: 'feat: add ship skill' }],
  });
  mocks.mockTags.mockResolvedValue({ all: ['v1.2.3'] });
  mocks.mockAddAnnotatedTag.mockResolvedValue(undefined);
  mocks.mockAdd.mockResolvedValue(undefined);
  mocks.mockCommit.mockResolvedValue(undefined);
  mocks.mockPush.mockResolvedValue(undefined);
  mocks.mockPushTags.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('releaseSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // Test 1: metadata
  it('has correct skill metadata', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    expect(releaseSkill.id).toBe('workflow.release');
    expect(releaseSkill.command).toBe('release');
    expect(releaseSkill.kind).toBe('deterministic');
    expect(releaseSkill.stage).toBe('stable');
    expect(releaseSkill.category).toBe('workflow');
    expect(releaseSkill.routing).toBe('directExec');
  });

  // Test 2: default bump is patch
  it('defaults to patch bump when no flag is set', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    await releaseSkill.execute(ctx);

    expect(mocks.mockBumpVersion).toHaveBeenCalledWith('1.2.3', 'patch');
  });

  // Test 3: --major bumps major
  it('bumps major version with --major flag', async () => {
    mocks.mockBumpVersion.mockReturnValue('2.0.0');
    mocks.mockTags.mockResolvedValue({ all: ['v1.2.3'] });

    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext({ args: { major: true } });
    await releaseSkill.execute(ctx);

    expect(mocks.mockBumpVersion).toHaveBeenCalledWith('1.2.3', 'major');
  });

  // Test 4: --minor bumps minor
  it('bumps minor version with --minor flag', async () => {
    mocks.mockBumpVersion.mockReturnValue('1.3.0');
    mocks.mockTags.mockResolvedValue({ all: ['v1.2.3'] });

    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext({ args: { minor: true } });
    await releaseSkill.execute(ctx);

    expect(mocks.mockBumpVersion).toHaveBeenCalledWith('1.2.3', 'minor');
  });

  // Test 5: reads version from root package.json
  it('reads current version from root package.json', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    await releaseSkill.execute(ctx);

    expect(mocks.mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      'utf-8',
    );
  });

  // Test 6: calls updateAllVersions
  it('updates all workspace package versions', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    await releaseSkill.execute(ctx);

    expect(mocks.mockUpdateAllVersions).toHaveBeenCalledWith('/test/project', '1.2.4');
  });

  // Test 7: generates CHANGELOG.md
  it('generates changelog from git log since last tag', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    await releaseSkill.execute(ctx);

    expect(mocks.mockLog).toHaveBeenCalled();
    expect(mocks.mockParseGitLog).toHaveBeenCalled();
    expect(mocks.mockGenerateChangelog).toHaveBeenCalled();
    expect(mocks.mockPrependChangelog).toHaveBeenCalled();
  });

  // Test 8: creates annotated git tag
  it('creates annotated git tag v{newVersion}', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    await releaseSkill.execute(ctx);

    expect(mocks.mockAddAnnotatedTag).toHaveBeenCalledWith('v1.2.4', 'Release v1.2.4');
  });

  // Test 9: blocks on dirty tree without --force
  it('blocks when working tree is dirty without --force', async () => {
    mocks.mockCaptureGitState.mockResolvedValue({
      branch: 'main',
      uncommittedChanges: true,
      uncommittedFiles: ['src/dirty.ts'],
    });

    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    const result = await releaseSkill.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/dirty/i);
  });

  // Test 10: dirty tree with --force proceeds
  it('proceeds with dirty tree when --force is set', async () => {
    mocks.mockCaptureGitState.mockResolvedValue({
      branch: 'main',
      uncommittedChanges: true,
      uncommittedFiles: ['src/dirty.ts'],
    });

    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext({ args: { force: true } });
    const result = await releaseSkill.execute(ctx);

    expect(result.success).toBe(true);
  });

  // Test 11: --dry-run previews without making changes
  it('reports dry-run without making changes', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext({ args: { 'dry-run': true, dryRun: true } });
    const result = await releaseSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.summary).toMatch(/dry run/i);
    expect(result.data).toHaveProperty('dryRun', true);
    // Should NOT call updateAllVersions
    expect(mocks.mockUpdateAllVersions).not.toHaveBeenCalled();
    // Should NOT create tag
    expect(mocks.mockAddAnnotatedTag).not.toHaveBeenCalled();
  });

  // Test 12: --skip-publish skips npm publish
  it('skips npm publish when --skip-publish is set', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext({ args: { 'skip-publish': true, skipPublish: true } });
    const result = await releaseSkill.execute(ctx);

    expect(result.success).toBe(true);
    // npm publish should not be attempted
    expect(mocks.mockExeca).not.toHaveBeenCalled();
  });

  // Test 13: tag already exists -> warn and skip
  it('warns and skips when tag already exists', async () => {
    mocks.mockTags.mockResolvedValue({ all: ['v1.2.3', 'v1.2.4'] });

    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    const result = await releaseSkill.execute(ctx);

    expect(result.success).toBe(true);
    expect(mocks.mockAddAnnotatedTag).not.toHaveBeenCalled();
    expect(ctx.log.warn).toHaveBeenCalled();
  });

  // Test 14: pushes tag to remote
  it('pushes tags to remote after creation', async () => {
    const releaseSkill = (await import('../release.skill.js')).default;
    const ctx = createMockContext();
    await releaseSkill.execute(ctx);

    expect(mocks.mockPush).toHaveBeenCalled();
    expect(mocks.mockPushTags).toHaveBeenCalled();
  });
});
