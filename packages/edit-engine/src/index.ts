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
  const status = await gitText(resolvedCwd, ['status', '--porcelain=v1', '-uall']);
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
  const diff = await createPatchForFiles(cwd, changedFiles, 'forward');
  const rollback = await createPatchForFiles(cwd, changedFiles, 'rollback');
  const patchMissing = changedFiles.length > 0 && (diff.trim().length === 0 || rollback.trim().length === 0);
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
    status: staleFiles.length > 0 ? 'stale' : patchMissing ? 'failed' : 'observed',
    createdAt: now,
    updatedAt: now,
    changedFiles,
    staleFiles,
    diffPath,
    rollbackPatchPath,
    failureReason: patchMissing ? 'changed files were detected but diff or rollback patch was empty' : undefined,
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
  const resolvedCwd = resolve(cwd);
  return createPatchForFiles(resolvedCwd, await detectChangedFiles(resolvedCwd), 'rollback');
}

export async function createDiffPatch(cwd: string): Promise<string> {
  const resolvedCwd = resolve(cwd);
  return createPatchForFiles(resolvedCwd, await detectChangedFiles(resolvedCwd), 'forward');
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

async function createPatchForFiles(cwd: string, files: ChangedFile[], direction: 'forward' | 'rollback'): Promise<string> {
  if (files.length === 0) return '';
  const trackedArgs = direction === 'forward'
    ? ['diff', '--binary', '--no-ext-diff', 'HEAD', '--']
    : ['diff', '--binary', '--no-ext-diff', '-R', 'HEAD', '--'];
  const trackedPatch = await gitText(cwd, trackedArgs);
  const untrackedPatches = await Promise.all(files.filter(isUntrackedFile).map((file) => (
    direction === 'forward'
      ? gitText(cwd, ['diff', '--no-index', '--binary', '--', '/dev/null', file.path], [0, 1])
      : gitText(cwd, ['diff', '--no-index', '--binary', '--', file.path, '/dev/null'], [0, 1])
  )));
  const patches = [trackedPatch, ...untrackedPatches]
    .map((patch) => patch.trimEnd())
    .filter((patch) => patch.length > 0);
  return patches.length > 0 ? patches.join('\n') + '\n' : '';
}

function isUntrackedFile(file: ChangedFile): boolean {
  return file.status === 'added' && file.beforeHash === null && file.metadata.gitStatus === '??';
}

function normalizeRelativePath(cwd: string, path: string): string {
  const resolved = resolve(cwd, path);
  const rel = relative(cwd, resolved);
  if (rel === '' || rel.startsWith('..')) {
    throw new Error(`Path escapes cwd: ${path}`);
  }
  return rel;
}

async function gitText(cwd: string, args: string[], allowedExitCodes = [0]): Promise<string> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return result.stdout;
  } catch (err) {
    const error = err as Error & { code?: number | string; stdout?: string };
    const code = typeof error.code === 'number' ? error.code : Number(error.code);
    if (allowedExitCodes.includes(code)) return error.stdout ?? '';
    throw err;
  }
}

async function gitBuffer(cwd: string, args: string[]): Promise<Buffer> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'buffer',
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.stdout;
}
