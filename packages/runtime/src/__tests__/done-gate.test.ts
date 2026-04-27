import { describe, expect, it } from 'vitest';
import { EvidenceRecordSchema, TaskSchema, type EvidenceRecord, type Task } from '@sunco/core/runtime';
import { evaluateDoneGate } from '../index.js';

const now = '2026-04-27T00:00:00.000Z';

function makeTask(overrides: Partial<Task> = {}): Task {
  return TaskSchema.parse({
    id: 'task-1',
    goal: 'ship proof-first runtime',
    status: 'verifying',
    risk: 'repo_mutate',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return EvidenceRecordSchema.parse({
    id: 'evidence-1',
    taskId: 'task-1',
    createdAt: now,
    updatedAt: now,
    checks: [{
      id: 'test-1',
      taskId: 'task-1',
      kind: 'test',
      command: 'npm test',
      status: 'pass',
      required: true,
      startedAt: now,
      completedAt: now,
      durationMs: 1,
    }],
    editTransactions: [{
      id: 'edit-1',
      taskId: 'task-1',
      status: 'observed',
      createdAt: now,
      updatedAt: now,
      changedFiles: [{
        path: 'src/index.ts',
        status: 'modified',
        beforeHash: { algorithm: 'sha256', value: 'before' },
        afterHash: { algorithm: 'sha256', value: 'after' },
      }],
      diffPath: '.sunco/tasks/task-1/diffs/changes.patch',
      rollbackPatchPath: '.sunco/tasks/task-1/diffs/rollback.patch',
    }],
    ...overrides,
  });
}

describe('Done Gate', () => {
  it('blocks completion when evidence is missing', () => {
    const result = evaluateDoneGate({ task: makeTask(), evidence: null, requiredChecks: ['test'], now });

    expect(result.status).toBe('blocked');
    expect(result.reasons).toContain('evidence record is missing');
  });

  it('blocks missing or failed required checks', () => {
    const result = evaluateDoneGate({
      task: makeTask(),
      evidence: makeEvidence({
        checks: [{
          id: 'test-1',
          taskId: 'task-1',
          kind: 'test',
          command: 'npm test',
          status: 'fail',
          required: true,
          startedAt: now,
          completedAt: now,
          durationMs: 1,
        }],
      }),
      requiredChecks: ['test', 'build'],
      now,
    });

    expect(result.status).toBe('blocked');
    expect(result.missingChecks).toEqual(['build']);
    expect(result.failedChecks).toEqual(['test-1']);
  });

  it('blocks official mutation risk without approval', () => {
    const result = evaluateDoneGate({
      task: makeTask({ risk: 'repo_mutate_official' }),
      evidence: makeEvidence(),
      requiredChecks: ['test'],
      now,
    });

    expect(result.status).toBe('blocked');
    expect(result.requiredApprovalRisk).toBe('repo_mutate_official');
    expect(result.reasons).toContain('approval is required for risk repo_mutate_official');
  });

  it('blocks stale or rollback-less edit evidence', () => {
    const result = evaluateDoneGate({
      task: makeTask(),
      evidence: makeEvidence({
        editTransactions: [{
          id: 'edit-1',
          taskId: 'task-1',
          status: 'stale',
          createdAt: now,
          updatedAt: now,
          changedFiles: [{
            path: 'src/index.ts',
            status: 'modified',
            beforeHash: { algorithm: 'sha256', value: 'before' },
            afterHash: { algorithm: 'sha256', value: 'after' },
          }],
        }],
      }),
      requiredChecks: ['test'],
      now,
    });

    expect(result.status).toBe('blocked');
    expect(result.staleEditTransactionIds).toEqual(['edit-1']);
    expect(result.reasons).toContain('edit transaction edit-1 is missing rollback evidence');
  });

  it('passes when required evidence, checks, edit records, and approvals are present', () => {
    const result = evaluateDoneGate({
      task: makeTask({ risk: 'repo_mutate_official' }),
      evidence: makeEvidence({
        approvals: [{
          id: 'approval-1',
          taskId: 'task-1',
          risk: 'repo_mutate_official',
          approvedBy: 'user',
          approvedAt: now,
          scope: ['repo'],
        }],
      }),
      requiredChecks: ['test'],
      now,
    });

    expect(result.status).toBe('passed');
    expect(result.reasons).toEqual([]);
  });
});
