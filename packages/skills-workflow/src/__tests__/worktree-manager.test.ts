/**
 * Tests for Git worktree lifecycle manager
 *
 * Mocks simple-git to verify correct git commands are called
 * without requiring actual git operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock simple-git before importing the module under test
const mockRaw = vi.fn<(...args: unknown[]) => Promise<string>>();
const mockLog = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    raw: mockRaw,
    log: mockLog,
  })),
}));

import { WorktreeManager, type WorktreeInfo } from '../shared/worktree-manager.js';

describe('WorktreeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRaw.mockResolvedValue('');
    mockLog.mockResolvedValue({ all: [] });
  });

  describe('create', () => {
    it('calls git worktree add with correct arguments', async () => {
      const mgr = new WorktreeManager('/repo');

      // Mock Date.now for predictable branch names
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

      const info = await mgr.create('06-01', 'main');

      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'sunco/exec/06-01-1700000000000',
        expect.stringContaining('06-01'),
        'main',
      ]);

      expect(info.planId).toBe('06-01');
      expect(info.branch).toBe('sunco/exec/06-01-1700000000000');
      expect(info.path).toContain('06-01');

      nowSpy.mockRestore();
    });

    it('returns WorktreeInfo with path, branch, and planId', async () => {
      const mgr = new WorktreeManager('/repo');

      const info = await mgr.create('03-02', 'develop');

      expect(info).toHaveProperty('path');
      expect(info).toHaveProperty('branch');
      expect(info).toHaveProperty('planId');
      expect(info.planId).toBe('03-02');
      expect(info.branch).toMatch(/^sunco\/exec\/03-02-\d+$/);
    });

    it('creates worktree path under .sun/worktrees/{planId}', async () => {
      const mgr = new WorktreeManager('/repo');
      const info = await mgr.create('01-05', 'main');

      expect(info.path).toMatch(/\/repo\/.sun\/worktrees\/01-05$/);
    });
  });

  describe('remove', () => {
    it('calls git worktree remove and branch delete for known planId', async () => {
      const mgr = new WorktreeManager('/repo');
      vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

      await mgr.create('06-01', 'main');
      mockRaw.mockClear();

      await mgr.remove('06-01');

      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '--force',
        expect.stringContaining('06-01'),
      ]);
      expect(mockRaw).toHaveBeenCalledWith([
        'branch',
        '-D',
        'sunco/exec/06-01-1700000000000',
      ]);

      vi.spyOn(Date, 'now').mockRestore();
    });

    it('is a no-op for unknown planId (no throw)', async () => {
      const mgr = new WorktreeManager('/repo');

      // Should not throw
      await expect(mgr.remove('nonexistent')).resolves.toBeUndefined();
      expect(mockRaw).not.toHaveBeenCalled();
    });
  });

  describe('removeAll', () => {
    it('removes all managed worktrees and runs git worktree prune', async () => {
      const mgr = new WorktreeManager('/repo');

      await mgr.create('plan-a', 'main');
      await mgr.create('plan-b', 'main');
      mockRaw.mockClear();

      await mgr.removeAll();

      // Should have called worktree remove + branch -D for each, plus prune
      // 2 worktrees * 2 commands each = 4, plus 1 prune = 5
      expect(mockRaw).toHaveBeenCalledTimes(5);

      // Last call should be prune
      expect(mockRaw).toHaveBeenLastCalledWith(['worktree', 'prune']);
    });

    it('is best-effort: catches errors per worktree', async () => {
      const mgr = new WorktreeManager('/repo');

      await mgr.create('plan-fail', 'main');
      mockRaw.mockClear();

      // First call (worktree remove) throws, second call (prune) succeeds
      mockRaw
        .mockRejectedValueOnce(new Error('worktree remove failed'))
        .mockResolvedValue('');

      // Should not throw despite the error
      await expect(mgr.removeAll()).resolves.toBeUndefined();

      // Should still attempt prune
      expect(mockRaw).toHaveBeenCalledWith(['worktree', 'prune']);
    });
  });

  describe('list', () => {
    it('returns git worktree list output', async () => {
      const listOutput =
        '/repo         abc1234 [main]\n/repo/.sun/worktrees/06-01  def5678 [sunco/exec/06-01]';
      mockRaw.mockResolvedValueOnce(listOutput);

      const mgr = new WorktreeManager('/repo');
      const result = await mgr.list();

      expect(mockRaw).toHaveBeenCalledWith(['worktree', 'list']);
      expect(result).toBe(listOutput);
    });
  });

  describe('cherryPick', () => {
    it('cherry-picks all new commits from worktree branch to target branch', async () => {
      const mgr = new WorktreeManager('/repo');
      vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

      await mgr.create('06-01', 'main');
      mockRaw.mockClear();

      // Mock log to return commits from the worktree
      mockLog.mockResolvedValueOnce({
        all: [
          { hash: 'aaa111' },
          { hash: 'bbb222' },
        ],
      });

      const hashes = await mgr.cherryPick('06-01', 'main');

      expect(hashes).toEqual(['aaa111', 'bbb222']);

      // Verify cherry-pick was called for each commit
      expect(mockRaw).toHaveBeenCalledWith(['cherry-pick', 'aaa111']);
      expect(mockRaw).toHaveBeenCalledWith(['cherry-pick', 'bbb222']);

      vi.spyOn(Date, 'now').mockRestore();
    });

    it('returns empty array when no new commits exist', async () => {
      const mgr = new WorktreeManager('/repo');
      await mgr.create('06-01', 'main');
      mockRaw.mockClear();

      mockLog.mockResolvedValueOnce({ all: [] });

      const hashes = await mgr.cherryPick('06-01', 'main');
      expect(hashes).toEqual([]);
      // No cherry-pick calls
      expect(mockRaw).not.toHaveBeenCalled();
    });

    it('returns empty array for unknown planId', async () => {
      const mgr = new WorktreeManager('/repo');
      const hashes = await mgr.cherryPick('nonexistent', 'main');
      expect(hashes).toEqual([]);
    });
  });
});
