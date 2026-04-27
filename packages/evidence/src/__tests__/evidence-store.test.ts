import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EvidenceStore } from '../index.js';

const now = '2026-04-27T00:00:00.000Z';

describe('EvidenceStore', () => {
  it('creates task-scoped runtime evidence directories and records', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sunco-evidence-'));
    try {
      const store = new EvidenceStore({ cwd });
      const { task, evidence } = await store.createTask({
        id: 'task-1',
        goal: 'prove evidence store works',
        risk: 'repo_mutate',
        now,
      });

      expect(task.activeEvidenceId).toBe('task-1-evidence');
      expect(evidence.taskId).toBe('task-1');
      await expect(readFile(join(cwd, '.sunco/tasks/task-1/task.json'), 'utf-8')).resolves.toContain('"goal"');
      await expect(readFile(join(cwd, '.sunco/tasks/task-1/evidence.json'), 'utf-8')).resolves.toContain('"checks"');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('appends decisions as JSONL without rewriting earlier entries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sunco-evidence-'));
    try {
      const store = new EvidenceStore({ cwd });
      await store.createTask({ id: 'task-1', goal: 'append decisions', now });

      await store.appendDecision({
        id: 'decision-1',
        taskId: 'task-1',
        at: now,
        source: 'runtime',
        type: 'created',
        summary: 'Task created',
        inputs: {},
        outputs: {},
        metadata: {},
      });
      await store.appendDecision({
        id: 'decision-2',
        taskId: 'task-1',
        at: now,
        source: 'done_gate',
        type: 'blocked',
        summary: 'No evidence',
        inputs: {},
        outputs: {},
        metadata: {},
      });

      const decisions = await store.readDecisions('task-1');
      expect(decisions.map((d) => d.id)).toEqual(['decision-1', 'decision-2']);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('updates evidence and stores check logs/diffs under the task directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'sunco-evidence-'));
    try {
      const store = new EvidenceStore({ cwd });
      await store.createTask({ id: 'task-1', goal: 'write artifacts', now });

      const logPath = await store.writeCheckLog('task-1', 'check-1', 'ok');
      const diffPath = await store.writeDiff('task-1', 'changes.patch', 'diff --git a/a b/a');
      const evidence = await store.updateEvidence('task-1', (record) => ({
        ...record,
        checks: [
          {
            id: 'check-1',
            taskId: 'task-1',
            kind: 'test',
            command: 'npm test',
            status: 'pass',
            required: true,
            startedAt: now,
            completedAt: now,
            durationMs: 1,
            logPath,
            metadata: {},
          },
        ],
        artifacts: [
          { kind: 'diff', path: diffPath, metadata: {} },
        ],
        updatedAt: now,
      }));

      expect(evidence.checks[0].logPath).toBe('.sunco/tasks/task-1/checks/check-1.log');
      expect(evidence.artifacts[0].path).toBe('.sunco/tasks/task-1/diffs/changes.patch');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
