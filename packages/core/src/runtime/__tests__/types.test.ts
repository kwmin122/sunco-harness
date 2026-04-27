/**
 * @sunco/core - M7 runtime record schema tests
 */

import { describe, expect, it } from 'vitest';
import {
  ApprovalRecordSchema,
  CheckResultSchema,
  DoneGateBlockedError,
  DoneGateResultSchema,
  EditTransactionSchema,
  EvidenceRecordSchema,
  RuntimeDecisionSchema,
  RiskApprovalRequiredError,
  TaskSchema,
} from '../../index.js';
import type {
  RuntimeAgentAdapter,
  RuntimeCodeIntelProvider,
  Task,
} from '../../index.js';

const now = '2026-04-27T00:00:00.000Z';

function makeTask(overrides: Partial<Task> = {}): Task {
  return TaskSchema.parse({
    id: 'task-1',
    goal: 'Add runtime core types',
    status: 'intake',
    risk: 'repo_mutate',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('runtime record schemas', () => {
  it('parses a task with M7 defaults', () => {
    const task = makeTask();

    expect(task).toMatchObject({
      id: 'task-1',
      status: 'intake',
      risk: 'repo_mutate',
      attempt: 0,
      metadata: {},
    });
  });

  it('rejects invalid task status, risk level, and unknown fields', () => {
    expect(() => makeTask({ status: 'complete' as never })).toThrow();
    expect(() => makeTask({ risk: 'dangerous' as never })).toThrow();
    expect(() =>
      TaskSchema.parse({
        id: 'task-1',
        goal: 'Bad shape',
        status: 'intake',
        risk: 'read_only',
        createdAt: now,
        updatedAt: now,
        surprise: true,
      }),
    ).toThrow();
  });

  it('validates check results for verifier output', () => {
    const result = CheckResultSchema.parse({
      id: 'check-1',
      taskId: 'task-1',
      kind: 'test',
      command: 'npm test',
      status: 'pass',
      startedAt: now,
      completedAt: now,
      durationMs: 1200,
      exitCode: 0,
      logPath: '.sunco/tasks/task-1/checks/test.log',
    });

    expect(result.required).toBe(true);
    expect(result.kind).toBe('test');
  });

  it('validates approval and edit records used by future gates', () => {
    const approval = ApprovalRecordSchema.parse({
      id: 'approval-1',
      taskId: 'task-1',
      risk: 'repo_mutate_official',
      approvedBy: 'user',
      approvedAt: now,
      scope: ['.planning/ROADMAP.md'],
    });

    const edit = EditTransactionSchema.parse({
      id: 'edit-1',
      taskId: 'task-1',
      status: 'observed',
      createdAt: now,
      updatedAt: now,
      changedFiles: [
        {
          path: 'packages/core/src/runtime/types.ts',
          status: 'added',
          beforeHash: null,
          afterHash: { algorithm: 'sha256', value: 'abc123' },
        },
      ],
      diffPath: '.sunco/tasks/task-1/diffs/changes.patch',
      rollbackPatchPath: '.sunco/tasks/task-1/diffs/rollback.patch',
    });

    expect(approval.risk).toBe('repo_mutate_official');
    expect(edit.changedFiles[0].status).toBe('added');
  });

  it('composes evidence records from checks, approvals, edits, and artifacts', () => {
    const evidence = EvidenceRecordSchema.parse({
      id: 'evidence-1',
      taskId: 'task-1',
      createdAt: now,
      updatedAt: now,
      checks: [
        {
          id: 'check-1',
          kind: 'build',
          command: 'npm run build',
          status: 'blocked',
          startedAt: now,
          durationMs: 0,
          summary: 'build was not run',
        },
      ],
      approvals: [],
      editTransactions: [],
      artifacts: [
        {
          kind: 'log',
          path: '.sunco/tasks/task-1/checks/build.log',
        },
      ],
      decisionsLogPath: '.sunco/tasks/task-1/decisions.jsonl',
      unresolvedFailures: ['build not run'],
    });

    expect(evidence.checks[0].required).toBe(true);
    expect(evidence.unresolvedFailures).toEqual(['build not run']);
  });

  it('validates done gate and decision records', () => {
    const gate = DoneGateResultSchema.parse({
      taskId: 'task-1',
      evidenceId: 'evidence-1',
      evaluatedAt: now,
      status: 'blocked',
      reasons: ['test failed'],
      nextActions: ['fix failing test and rerun verifier'],
      requiredChecks: ['test'],
      failedChecks: ['check-1'],
    });

    const decision = RuntimeDecisionSchema.parse({
      id: 'decision-1',
      taskId: 'task-1',
      at: now,
      source: 'done_gate',
      type: 'completion_blocked',
      summary: 'Done Gate blocked completion',
      outputs: { status: gate.status },
    });

    expect(gate.status).toBe('blocked');
    expect(decision.source).toBe('done_gate');
  });

  it('exports runtime errors for downstream packages', () => {
    const gate = DoneGateResultSchema.parse({
      taskId: 'task-1',
      evaluatedAt: now,
      status: 'blocked',
      reasons: ['missing evidence'],
    });

    const blocked = new DoneGateBlockedError(gate);
    const approval = new RiskApprovalRequiredError('task-1', 'remote_mutate');

    expect(blocked.code).toBe('RUNTIME_DONE_BLOCKED');
    expect(blocked.message).toContain('missing evidence');
    expect(approval.risk).toBe('remote_mutate');
  });

  it('types future agent adapter and code-intel providers without new packages', async () => {
    const task = makeTask();
    const adapter: RuntimeAgentAdapter = {
      id: 'manual',
      family: 'local',
      async isAvailable() {
        return true;
      },
      async execute() {
        return {
          success: true,
          summary: 'observed host-agent edits',
          decisions: [],
          artifacts: [],
        };
      },
    };

    const codeIntel: RuntimeCodeIntelProvider = {
      id: 'package-json',
      async detectProject(cwd) {
        return {
          cwd,
          packageManager: 'npm',
          languages: ['typescript'],
          files: ['package.json'],
        };
      },
      async selectChecks() {
        return [
          {
            kind: 'test',
            command: 'npm test',
            required: true,
          },
        ];
      },
    };

    await expect(adapter.isAvailable()).resolves.toBe(true);
    await expect(adapter.execute({ task, cwd: process.cwd() })).resolves.toMatchObject({
      success: true,
    });
    await expect(codeIntel.detectProject(process.cwd())).resolves.toMatchObject({
      packageManager: 'npm',
    });
    await expect(codeIntel.selectChecks({ task, project: {
      cwd: process.cwd(),
      languages: ['typescript'],
      files: ['package.json'],
    } })).resolves.toEqual([
      {
        kind: 'test',
        command: 'npm test',
        required: true,
      },
    ]);
  });
});
