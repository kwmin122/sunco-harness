/**
 * Worktree manager - Git worktree lifecycle for parallel agent execution
 *
 * Encapsulates worktree creation, removal, and cherry-pick operations
 * using simple-git raw() commands. Each executor agent gets an isolated
 * worktree for safe parallel file operations.
 *
 * Naming: sunco/exec/{planId}-{timestamp} for branches,
 *         .sun/worktrees/{planId} for worktree paths.
 */

import { join } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';

export interface WorktreeInfo {
  path: string;
  branch: string;
  planId: string;
}

export class WorktreeManager {
  private git: SimpleGit;
  private basePath: string;
  private worktrees: WorktreeInfo[] = [];

  constructor(cwd: string) {
    this.git = simpleGit(cwd);
    this.basePath = join(cwd, '.sun', 'worktrees');
  }

  /**
   * Create a worktree for a plan execution.
   * Creates a new branch from baseBranch in an isolated directory.
   */
  async create(planId: string, baseBranch: string): Promise<WorktreeInfo> {
    const branchName = `sunco/exec/${planId}-${Date.now()}`;
    const worktreePath = join(this.basePath, planId);

    try {
      await this.git.raw([
        'worktree',
        'add',
        '-b',
        branchName,
        worktreePath,
        baseBranch,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to create worktree for plan '${planId}': ${msg}`);
    }

    const info: WorktreeInfo = { path: worktreePath, branch: branchName, planId };
    this.worktrees.push(info);
    return info;
  }

  /**
   * Remove a worktree and its branch.
   * No-op for unknown planIds (does not throw).
   */
  async remove(planId: string): Promise<void> {
    const wt = this.worktrees.find((w) => w.planId === planId);
    if (!wt) return;

    try {
      await this.git.raw(['worktree', 'remove', '--force', wt.path]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to remove worktree for plan '${planId}': ${msg}`);
    }

    try {
      await this.git.raw(['branch', '-D', wt.branch]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to delete branch '${wt.branch}': ${msg}`);
    }

    this.worktrees = this.worktrees.filter((w) => w.planId !== planId);
  }

  /**
   * Remove all managed worktrees (best-effort cleanup).
   * Catches errors per worktree so one failure doesn't prevent others.
   * Runs git worktree prune after all removals.
   */
  async removeAll(): Promise<void> {
    for (const wt of [...this.worktrees]) {
      try {
        await this.remove(wt.planId);
      } catch {
        // Best-effort: continue with other worktrees
      }
    }

    try {
      await this.git.raw(['worktree', 'prune']);
    } catch {
      // Best-effort prune
    }
  }

  /**
   * List all git worktrees (returns raw git output).
   */
  async list(): Promise<string> {
    return this.git.raw(['worktree', 'list']);
  }

  /**
   * Cherry-pick all new commits from a worktree branch back to the target branch.
   * Returns array of cherry-picked commit hashes.
   * Returns empty array for unknown planIds.
   */
  async cherryPick(planId: string, targetBranch: string): Promise<string[]> {
    const wt = this.worktrees.find((w) => w.planId === planId);
    if (!wt) return [];

    const worktreeGit = simpleGit(wt.path);

    // Get new commits in the worktree branch (since diverging from target)
    const log = await worktreeGit.log({ from: targetBranch, to: 'HEAD' });

    const hashes: string[] = [];
    for (const commit of log.all) {
      try {
        await this.git.raw(['cherry-pick', commit.hash]);
        hashes.push(commit.hash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Cherry-pick conflict for commit '${commit.hash}' from plan '${planId}': ${msg}`,
        );
      }
    }

    return hashes;
  }
}
