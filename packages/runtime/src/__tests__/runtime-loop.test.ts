import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { getRuntimeStatus, runRuntimeLoop } from '../index.js';

const execFileAsync = promisify(execFile);
const now = '2026-04-27T00:00:00.000Z';

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

type MakeProjectOptions = {
  mutate?: boolean;
  untracked?: boolean;
};

async function makeProject(
  testScript = 'node -e "console.log(\'ok\')"',
  options: MakeProjectOptions = {},
): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'sunco-runtime-'));
  await git(cwd, ['init']);
  await git(cwd, ['config', 'user.email', 'sunco@example.com']);
  await git(cwd, ['config', 'user.name', 'SUNCO Test']);
  await writeFile(join(cwd, 'package-lock.json'), '{}\n', 'utf-8');
  await writeFile(join(cwd, 'package.json'), JSON.stringify({
    type: 'module',
    scripts: {
      test: testScript,
    },
  }, null, 2) + '\n', 'utf-8');
  await writeFile(join(cwd, 'src.txt'), 'before\n', 'utf-8');
  await git(cwd, ['add', '.']);
  await git(cwd, ['commit', '-m', 'initial']);
  if (options.mutate ?? true) {
    await writeFile(join(cwd, 'src.txt'), 'after\n', 'utf-8');
  }
  if (options.untracked) {
    await writeFile(join(cwd, 'added.js'), 'export const added = true;\n', 'utf-8');
  }
  return cwd;
}

describe('Runtime Loop MVP', () => {
  it('creates task evidence, verifies, gates, and marks a passing task done', async () => {
    const cwd = await makeProject();
    try {
      const result = await runRuntimeLoop({
        cwd,
        goal: 'record a passing runtime loop',
        taskId: 'task-1',
        now: () => now,
      });

      expect(result.task.status).toBe('done');
      expect(result.gate.status).toBe('passed');
      expect(result.evidence?.checks[0].status).toBe('pass');
      expect(result.evidence?.editTransactions[0].changedFiles[0].path).toBe('src.txt');

      const status = await getRuntimeStatus({ cwd, taskId: 'task-1', now });
      expect(status.checks.passed).toBe(1);
      expect(status.changedFiles).toEqual(['src.txt']);
      expect(status.nextAction).toBe('ready to mark done');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('blocks a task when verifier evidence fails', async () => {
    const cwd = await makeProject('node -e "process.exit(5)"');
    try {
      const result = await runRuntimeLoop({
        cwd,
        goal: 'record a failing runtime loop',
        taskId: 'task-1',
        now: () => now,
      });

      expect(result.task.status).toBe('blocked');
      expect(result.gate.status).toBe('blocked');
      expect(result.gate.failedChecks).toEqual(['test-1']);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('blocks repo mutation tasks with zero changed-file evidence', async () => {
    const cwd = await makeProject(undefined, { mutate: false });
    try {
      const result = await runRuntimeLoop({
        cwd,
        goal: 'do not allow a false done mutation',
        taskId: 'task-1',
        now: () => now,
      });

      expect(result.task.status).toBe('blocked');
      expect(result.gate.status).toBe('blocked');
      expect(result.evidence?.editTransactions[0].changedFiles).toEqual([]);
      expect(result.gate.reasons).toContain('changed-file evidence is required for risk repo_mutate');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('records diff and rollback evidence for untracked added files', async () => {
    const cwd = await makeProject(undefined, { mutate: false, untracked: true });
    try {
      const result = await runRuntimeLoop({
        cwd,
        goal: 'add a new source file',
        taskId: 'task-1',
        now: () => now,
      });

      expect(result.task.status).toBe('done');
      expect(result.gate.status).toBe('passed');
      expect(result.evidence?.editTransactions[0].changedFiles.map((file) => file.path)).toEqual(['added.js']);

      const diff = await readFile(join(cwd, '.sunco/tasks/task-1/diffs/changes.patch'), 'utf-8');
      const rollback = await readFile(join(cwd, '.sunco/tasks/task-1/diffs/rollback.patch'), 'utf-8');
      expect(diff).toContain('new file mode');
      expect(diff).toContain('+export const added = true;');
      expect(rollback).toContain('deleted file mode');
      expect(rollback).toContain('-export const added = true;');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
