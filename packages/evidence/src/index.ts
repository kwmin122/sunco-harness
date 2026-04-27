import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import {
  EvidenceRecordSchema,
  RuntimeDecisionSchema,
  TaskSchema,
  type EvidenceRecord,
  type RuntimeDecision,
  type Task,
} from '@sunco/core/runtime';

export type EvidenceStoreOptions = {
  cwd: string;
  rootDir?: string;
};

export type CreateTaskInput = {
  id: string;
  goal: string;
  risk?: Task['risk'];
  now?: string;
  metadata?: Record<string, unknown>;
};

export const TASKS_ROOT = '.sunco/tasks';

function assertInside(root: string, target: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const rel = relative(resolvedRoot, resolvedTarget);
  if (rel.startsWith('..') || rel === '..' || rel.includes('..' + '/')) {
    throw new Error(`Path escapes evidence root: ${target}`);
  }
  return resolvedTarget;
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf-8');
  await rename(tmp, path);
}

export class EvidenceStore {
  readonly cwd: string;
  readonly rootDir: string;

  constructor(options: EvidenceStoreOptions) {
    this.cwd = resolve(options.cwd);
    this.rootDir = resolve(this.cwd, options.rootDir ?? TASKS_ROOT);
  }

  taskDir(taskId: string): string {
    return assertInside(this.rootDir, join(this.rootDir, taskId));
  }

  taskPath(taskId: string): string {
    return join(this.taskDir(taskId), 'task.json');
  }

  evidencePath(taskId: string): string {
    return join(this.taskDir(taskId), 'evidence.json');
  }

  decisionsPath(taskId: string): string {
    return join(this.taskDir(taskId), 'decisions.jsonl');
  }

  checksDir(taskId: string): string {
    return join(this.taskDir(taskId), 'checks');
  }

  diffsDir(taskId: string): string {
    return join(this.taskDir(taskId), 'diffs');
  }

  async ensureTaskDirs(taskId: string): Promise<void> {
    await mkdir(this.checksDir(taskId), { recursive: true });
    await mkdir(this.diffsDir(taskId), { recursive: true });
  }

  async createTask(input: CreateTaskInput): Promise<{ task: Task; evidence: EvidenceRecord }> {
    const now = input.now ?? new Date().toISOString();
    const evidenceId = `${input.id}-evidence`;
    const task = TaskSchema.parse({
      id: input.id,
      goal: input.goal,
      status: 'intake',
      risk: input.risk ?? 'repo_mutate',
      createdAt: now,
      updatedAt: now,
      activeEvidenceId: evidenceId,
      evidencePath: relative(this.cwd, this.evidencePath(input.id)),
      metadata: input.metadata ?? {},
    });
    const evidence = EvidenceRecordSchema.parse({
      id: evidenceId,
      taskId: input.id,
      createdAt: now,
      updatedAt: now,
      decisionsLogPath: relative(this.cwd, this.decisionsPath(input.id)),
    });
    await this.ensureTaskDirs(input.id);
    await this.writeTask(task);
    await this.writeEvidence(evidence);
    return { task, evidence };
  }

  async writeTask(task: Task): Promise<Task> {
    const parsed = TaskSchema.parse(task);
    await this.ensureTaskDirs(parsed.id);
    await writeJsonAtomic(this.taskPath(parsed.id), parsed);
    return parsed;
  }

  async readTask(taskId: string): Promise<Task | null> {
    try {
      return TaskSchema.parse(JSON.parse(await readFile(this.taskPath(taskId), 'utf-8')));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async writeEvidence(record: EvidenceRecord): Promise<EvidenceRecord> {
    const parsed = EvidenceRecordSchema.parse(record);
    await this.ensureTaskDirs(parsed.taskId);
    await writeJsonAtomic(this.evidencePath(parsed.taskId), parsed);
    return parsed;
  }

  async readEvidence(taskId: string): Promise<EvidenceRecord | null> {
    try {
      return EvidenceRecordSchema.parse(JSON.parse(await readFile(this.evidencePath(taskId), 'utf-8')));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async updateEvidence(taskId: string, updater: (record: EvidenceRecord) => EvidenceRecord): Promise<EvidenceRecord> {
    const current = await this.readEvidence(taskId);
    if (!current) throw new Error(`Evidence record not found for task: ${taskId}`);
    const updated = EvidenceRecordSchema.parse(updater(current));
    return this.writeEvidence(updated);
  }

  async appendDecision(decision: RuntimeDecision): Promise<RuntimeDecision> {
    const parsed = RuntimeDecisionSchema.parse(decision);
    if (!parsed.taskId) throw new Error('RuntimeDecision.taskId is required for task-scoped evidence');
    await this.ensureTaskDirs(parsed.taskId);
    await writeFile(this.decisionsPath(parsed.taskId), JSON.stringify(parsed) + '\n', {
      encoding: 'utf-8',
      flag: 'a',
    });
    return parsed;
  }

  async readDecisions(taskId: string): Promise<RuntimeDecision[]> {
    try {
      const raw = await readFile(this.decisionsPath(taskId), 'utf-8');
      return raw
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => RuntimeDecisionSchema.parse(JSON.parse(line)));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async writeCheckLog(taskId: string, checkId: string, content: string): Promise<string> {
    await this.ensureTaskDirs(taskId);
    const path = join(this.checksDir(taskId), `${checkId}.log`);
    await writeFile(path, content, 'utf-8');
    return relative(this.cwd, path);
  }

  async writeDiff(taskId: string, name: string, content: string): Promise<string> {
    await this.ensureTaskDirs(taskId);
    const path = join(this.diffsDir(taskId), name);
    await writeFile(path, content, 'utf-8');
    return relative(this.cwd, path);
  }

  async listTaskIds(): Promise<string[]> {
    try {
      const entries = await readdir(this.rootDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }
}
