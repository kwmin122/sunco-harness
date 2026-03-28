/**
 * Git state - Capture current branch and uncommitted changes
 */

import type { GitState } from './types.js';
import { simpleGit } from 'simple-git';

/**
 * Capture the current git branch and uncommitted file status.
 * Returns a safe fallback if git operations fail.
 */
export async function captureGitState(cwd: string): Promise<GitState> {
  try {
    const git = simpleGit(cwd);
    const status = await git.status();
    return {
      branch: status.current ?? 'unknown',
      uncommittedChanges: status.files.length > 0,
      uncommittedFiles: status.files.map((f) => f.path),
    };
  } catch {
    return {
      branch: 'unknown',
      uncommittedChanges: false,
      uncommittedFiles: [],
    };
  }
}
