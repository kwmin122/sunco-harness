import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { EvidenceStore } from '@sunco/evidence';
import { captureFileHashes, createDiffPatch, createEditTransaction, createRollbackPatch, detectChangedFiles, detectStaleFiles, hashFile } from '../index.js';

const execFileAsync = promisify(execFile);
const now = '2026-04-27T00:00:00.000Z';

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

async function makeRepo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'sunco-edit-'));
  await git(cwd, ['init']);
  await git(cwd, ['config', 'user.email', 'sunco@example.com']);
  await git(cwd, ['config', 'user.name', 'SUNCO Test']);
  await writeFile(join(cwd, 'file.txt'), 'before\n', 'utf-8');
  await git(cwd, ['add', 'file.txt']);
  await git(cwd, ['commit', '-m', 'initial']);
  return cwd;
}

describe('Hash Edit Engine', () => {
  it('hashes files and captures a path map', async () => {
    const cwd = await makeRepo();
    try {
      const hash = await hashFile(join(cwd, 'file.txt'));
      expect(hash?.algorithm).toBe('sha256');
      const hashes = await captureFileHashes({ cwd, paths: ['file.txt'] });
      expect(hashes['file.txt']?.value).toBe(hash?.value);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('detects modified files with before and after hashes', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(join(cwd, 'file.txt'), 'after\n', 'utf-8');
      const changed = await detectChangedFiles(cwd);

      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({ path: 'file.txt', status: 'modified' });
      expect(changed[0].beforeHash?.value).not.toBe(changed[0].afterHash?.value);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('creates diff and rollback patch records in task evidence', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(join(cwd, 'file.txt'), 'after\n', 'utf-8');
      const store = new EvidenceStore({ cwd });
      await store.createTask({ id: 'task-1', goal: 'record edit evidence', now });

      const transaction = await createEditTransaction({ cwd, taskId: 'task-1', store, now });
      const evidence = await store.readEvidence('task-1');
      const diff = await createDiffPatch(cwd);
      const rollback = await createRollbackPatch(cwd);

      expect(transaction.changedFiles[0].path).toBe('file.txt');
      expect(transaction.diffPath).toBe('.sunco/tasks/task-1/diffs/changes.patch');
      expect(transaction.rollbackPatchPath).toBe('.sunco/tasks/task-1/diffs/rollback.patch');
      expect(evidence?.editTransactions).toHaveLength(1);
      expect(diff).toContain('-before');
      expect(rollback).toContain('-after');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('records non-empty diff and rollback evidence for untracked added files', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(join(cwd, 'added.js'), 'export const added = true;\n', 'utf-8');
      const store = new EvidenceStore({ cwd });
      await store.createTask({ id: 'task-1', goal: 'record untracked add', now });

      const transaction = await createEditTransaction({ cwd, taskId: 'task-1', store, now });
      const diff = await createDiffPatch(cwd);
      const rollback = await createRollbackPatch(cwd);

      expect(transaction.status).toBe('observed');
      expect(transaction.changedFiles).toMatchObject([{ path: 'added.js', status: 'added' }]);
      expect(diff).toContain('new file mode');
      expect(diff).toContain('+export const added = true;');
      expect(rollback).toContain('deleted file mode');
      expect(rollback).toContain('-export const added = true;');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('detects stale expected before hashes against HEAD', async () => {
    const cwd = await makeRepo();
    try {
      await writeFile(join(cwd, 'file.txt'), 'after\n', 'utf-8');
      const changed = await detectChangedFiles(cwd);
      const stale = await detectStaleFiles({
        cwd,
        files: [{
          ...changed[0],
          beforeHash: { algorithm: 'sha256', value: 'not-the-head-hash' },
        }],
      });

      expect(stale).toEqual(['file.txt']);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
