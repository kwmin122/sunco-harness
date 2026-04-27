import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  ChangedFileSchema,
  EditTransactionSchema,
  FileHashSchema,
  type ChangedFile,
  type EditTransaction,
  type FileHash,
} from '@sunco/core/runtime';
import { EvidenceStore } from '@sunco/evidence';

const execFileAsync = promisify(execFile);

export type CreateEditTransactionInput = {
  cwd: string;
  taskId: string;
  store?: EvidenceStore;
  now?: string;
};

export type CaptureHashesInput = {
  cwd: string;
  paths: string[];
};

export type DetectStaleFilesInput = {
  cwd: string;
  files: ChangedFile[];
};

export async function hashFile(path: string): Promise<FileHash | null> {
  try {
    const bytes = await readFile(path);
    return FileHashSchema.parse({
      algorithm: 'sha256',
      value: createHash('sha256').update(bytes).digest('hex'),
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR') return null;
    throw err;
  }
}

export async function captureFileHashes(input: CaptureHashesInput): Promise<Record<string, FileHash | null>> {
  const cwd = resolve(input.cwd);
  const entries = await Promise.all(input.paths.map(async (path) => {
    const relativePath = normalizeRelativePath(cwd, path);
    return [relativePath, await hashFile(join(cwd, relativePath))] as const;
  }));
  return Object.fromEntries(entries);
}

export async function detectChangedFiles(cwd: string): Promise<ChangedFile[]> {
  const resolvedCwd = resolve(cwd);
  const status = await gitText(resolvedCwd, ['status', '--porcelain=v1']);
  const lines = status.split('\n').filter((line) => line.trim().length > 0);
  const changed: ChangedFile[] = [];

  for (const line of lines) {
    const code = line.slice(0, 2);
    const rawPath = line.slice(3);
    const parsed = parseStatusLine(code, rawPath);
    if (isRuntimeArtifactPath(parsed.path)) continue;
    const beforePath = parsed.previousPath ?? parsed.path;
    const beforeHash = parsed.status === 'added' ? null : await hashGitHeadPath(resolvedCwd, beforePath);
    const afterHash = parsed.status === 'deleted' ? null : await hashFile(join(resolvedCwd, parsed.path));

    changed.push(ChangedFileSchema.parse({
      path: parsed.path,
      status: parsed.status,
      beforeHash,
      afterHash,
      previousPath: parsed.previousPath,
      metadata: { gitStatus: code.trim() || code },
    }));
  }

  return changed.sort((a, b) => a.path.localeCompare(b.path));
}

export async function detectStaleFiles(input: DetectStaleFilesInput): Promise<string[]> {
  const cwd = resolve(input.cwd);
  const stale: string[] = [];

  for (const file of input.files) {
    if (!file.beforeHash) continue;
    const headHash = await hashGitHeadPath(cwd, file.previousPath ?? file.path);
    if (!headHash || headHash.value !== file.beforeHash.value) {
      stale.push(file.path);
    }
  }

  return stale.sort();
}

export async function createEditTransaction(input: CreateEditTransactionInput): Promise<EditTransaction> {
  const cwd = resolve(input.cwd);
  const now = input.now ?? new Date().toISOString();
  const changedFiles = await detectChangedFiles(cwd);
  const staleFiles = await detectStaleFiles({ cwd, files: changedFiles });
  const diff = await gitText(cwd, ['diff', '--binary', '--no-ext-diff', 'HEAD', '--']);
  const rollback = await gitText(cwd, ['diff', '--binary', '--no-ext-diff', '-R', 'HEAD', '--']);
  const store = input.store ?? new EvidenceStore({ cwd });
  const diffPath = changedFiles.length > 0
    ? await store.writeDiff(input.taskId, 'changes.patch', diff)
    : undefined;
  const rollbackPatchPath = changedFiles.length > 0
    ? await store.writeDiff(input.taskId, 'rollback.patch', rollback)
    : undefined;

  const transaction = EditTransactionSchema.parse({
    id: `edit-${Date.now()}`,
    taskId: input.taskId,
    status: 'observed',
    createdAt: now,
    updatedAt: now,
    changedFiles,
    staleFiles,
    diffPath,
    rollbackPatchPath,
  });

  await store.updateEvidence(input.taskId, (record) => ({
    ...record,
    editTransactions: [
      ...record.editTransactions.filter((edit) => edit.id !== transaction.id),
      transaction,
    ],
    artifacts: [
      ...record.artifacts,
      ...[
        transaction.diffPath ? { kind: 'diff' as const, path: transaction.diffPath, description: 'observed git diff' } : null,
        transaction.rollbackPatchPath ? { kind: 'rollback_patch' as const, path: transaction.rollbackPatchPath, description: 'reverse diff rollback patch' } : null,
      ]
        .filter((artifact): artifact is { kind: 'diff' | 'rollback_patch'; path: string; description: string } => artifact !== null)
        .map((artifact) => ({ ...artifact, metadata: {} })),
    ],
    updatedAt: now,
  }));

  return transaction;
}

export async function createRollbackPatch(cwd: string): Promise<string> {
  return gitText(resolve(cwd), ['diff', '--binary', '--no-ext-diff', '-R', 'HEAD', '--']);
}

export async function createDiffPatch(cwd: string): Promise<string> {
  return gitText(resolve(cwd), ['diff', '--binary', '--no-ext-diff', 'HEAD', '--']);
}

async function hashGitHeadPath(cwd: string, path: string): Promise<FileHash | null> {
  try {
    const stdout = await gitBuffer(cwd, ['show', `HEAD:${path}`]);
    return FileHashSchema.parse({
      algorithm: 'sha256',
      value: createHash('sha256').update(stdout).digest('hex'),
    });
  } catch {
    return null;
  }
}

function parseStatusLine(code: string, rawPath: string): {
  path: string;
  status: ChangedFile['status'];
  previousPath?: string;
} {
  if (code.includes('R')) {
    const [previousPath, path] = rawPath.split(' -> ');
    return { path, previousPath, status: 'renamed' };
  }
  if (code.includes('D')) return { path: rawPath, status: 'deleted' };
  if (code.includes('A') || code === '??') return { path: rawPath, status: 'added' };
  return { path: rawPath, status: 'modified' };
}

function isRuntimeArtifactPath(path: string): boolean {
  return path === '.sunco' || path.startsWith('.sunco/') || path === '.sun' || path.startsWith('.sun/');
}

function normalizeRelativePath(cwd: string, path: string): string {
  const resolved = resolve(cwd, path);
  const rel = relative(cwd, resolved);
  if (rel === '' || rel.startsWith('..')) {
    throw new Error(`Path escapes cwd: ${path}`);
  }
  return rel;
}

async function gitText(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.stdout;
}

async function gitBuffer(cwd: string, args: string[]): Promise<Buffer> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'buffer',
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.stdout;
}
