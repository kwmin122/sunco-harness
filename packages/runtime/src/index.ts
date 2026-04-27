import {
  DoneGateResultSchema,
  type CheckKind,
  type CheckResult,
  type DoneGateResult,
  type EditTransaction,
  type EvidenceRecord,
  type RiskLevel,
  type Task,
} from '@sunco/core/runtime';
import { createEditTransaction } from '@sunco/edit-engine';
import { EvidenceStore } from '@sunco/evidence';
import { runVerifier, selectJsChecks } from '@sunco/verifier';

export type DoneGateInput = {
  task: Task;
  evidence?: EvidenceRecord | null;
  requiredChecks?: CheckKind[];
  now?: string;
};

export type RuntimeTaskInput = {
  cwd: string;
  goal: string;
  taskId?: string;
  risk?: RiskLevel;
  store?: EvidenceStore;
  now?: () => string;
  metadata?: Record<string, unknown>;
};

export type RuntimeLoopInput = RuntimeTaskInput & {
  maxAttempts?: number;
};

export type RuntimeLoopResult = {
  task: Task;
  evidence: EvidenceRecord | null;
  gate: DoneGateResult;
  nextAction: 'done' | 'blocked';
};

export type RuntimeStatus = {
  task: Task | null;
  evidence: EvidenceRecord | null;
  gate: DoneGateResult | null;
  checks: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
  };
  changedFiles: string[];
  nextAction: string;
};

const APPROVAL_REQUIRED_RISKS: RiskLevel[] = ['repo_mutate_official', 'remote_mutate', 'external_mutate'];
const MUTATION_RISKS: RiskLevel[] = ['repo_mutate', 'repo_mutate_official', 'remote_mutate', 'external_mutate'];

export function evaluateDoneGate(input: DoneGateInput): DoneGateResult {
  const evaluatedAt = input.now ?? new Date().toISOString();
  const reasons: string[] = [];
  const nextActions: string[] = [];
  const missingChecks: CheckKind[] = [];
  const failedChecks: string[] = [];
  const staleEditTransactionIds: string[] = [];
  const evidence = input.evidence ?? null;
  const requiredChecks = Array.from(new Set(input.requiredChecks ?? deriveRequiredChecks(evidence)));

  if (!evidence) {
    reasons.push('evidence record is missing');
    nextActions.push('create evidence and run sunco verify');
  } else {
    const checksByKind = new Map<CheckKind, CheckResult[]>();
    for (const check of evidence.checks) {
      const checks = checksByKind.get(check.kind) ?? [];
      checks.push(check);
      checksByKind.set(check.kind, checks);
    }

    for (const kind of requiredChecks) {
      const checks = checksByKind.get(kind) ?? [];
      if (checks.length === 0) {
        missingChecks.push(kind);
        reasons.push(`${kind} check was not run`);
      }
    }

    const requiredResults = evidence.checks.filter((check) => check.required);
    if (requiredChecks.length === 0 && requiredResults.length === 0) {
      reasons.push('no required verification checks were recorded');
      nextActions.push('run sunco verify before marking the task done');
    }

    for (const check of requiredResults) {
      if (check.status === 'fail' || check.status === 'blocked') {
        failedChecks.push(check.id);
        reasons.push(`${check.kind} check ${check.id} ${check.status}`);
      }
      if (check.status === 'skipped') {
        failedChecks.push(check.id);
        reasons.push(`${check.kind} check ${check.id} was skipped`);
      }
    }

    if (evidence.unresolvedFailures.length > 0) {
      reasons.push('unresolved failures remain');
      nextActions.push('resolve recorded failures and re-run done gate');
    }

    const approvalRisk = requiredApprovalRisk(input.task.risk);
    if (approvalRisk && !hasValidApproval(evidence, approvalRisk, evaluatedAt)) {
      reasons.push(`approval is required for risk ${approvalRisk}`);
      nextActions.push('record explicit user approval before continuing');
    }

    const editReasons = evaluateEditTransactions(input.task.risk, evidence.editTransactions);
    reasons.push(...editReasons.reasons);
    nextActions.push(...editReasons.nextActions);
    staleEditTransactionIds.push(...editReasons.staleEditTransactionIds);
  }

  if (missingChecks.length > 0) nextActions.push('run missing verification checks');
  if (failedChecks.length > 0) nextActions.push('fix failing checks and re-run verifier');

  return DoneGateResultSchema.parse({
    taskId: input.task.id,
    evidenceId: evidence?.id,
    evaluatedAt,
    status: reasons.length === 0 ? 'passed' : 'blocked',
    reasons: unique(reasons),
    nextActions: unique(nextActions),
    requiredChecks,
    missingChecks: unique(missingChecks),
    failedChecks: unique(failedChecks),
    requiredApprovalRisk: requiredApprovalRisk(input.task.risk),
    unresolvedFailures: evidence?.unresolvedFailures ?? [],
    staleEditTransactionIds: unique(staleEditTransactionIds),
  });
}

export async function createRuntimeTask(input: RuntimeTaskInput): Promise<{ task: Task; evidence: EvidenceRecord }> {
  const store = input.store ?? new EvidenceStore({ cwd: input.cwd });
  const now = input.now?.() ?? new Date().toISOString();
  const created = await store.createTask({
    id: input.taskId ?? makeTaskId(now),
    goal: input.goal,
    risk: input.risk ?? 'repo_mutate',
    now,
    metadata: input.metadata,
  });
  await store.appendDecision({
    id: `decision-${Date.now()}-created`,
    taskId: created.task.id,
    at: now,
    source: 'runtime',
    type: 'created',
    summary: 'Runtime task created',
    relatedEvidenceId: created.evidence.id,
    inputs: {},
    outputs: {},
    metadata: {},
  });
  return created;
}

export async function runRuntimeLoop(input: RuntimeLoopInput): Promise<RuntimeLoopResult> {
  const store = input.store ?? new EvidenceStore({ cwd: input.cwd });
  const now = input.now ?? (() => new Date().toISOString());
  const { task } = await createRuntimeTask({ ...input, store, now });
  const executingTask = await store.writeTask({
    ...task,
    status: 'executing',
    updatedAt: now(),
  });

  await createEditTransaction({
    cwd: input.cwd,
    taskId: executingTask.id,
    store,
    now: now(),
  });

  const verifyingTask = await store.writeTask({
    ...executingTask,
    status: 'verifying',
    updatedAt: now(),
  });
  const checks = await selectJsChecks(input.cwd);
  const requiredChecks = unique(checks.filter((check) => check.required).map((check) => check.kind));
  await runVerifier({
    cwd: input.cwd,
    taskId: verifyingTask.id,
    store,
    checks,
    now,
  });

  const evidence = await store.readEvidence(verifyingTask.id);
  const gate = evaluateDoneGate({
    task: verifyingTask,
    evidence,
    requiredChecks,
    now: now(),
  });
  const finalTask = await store.writeTask({
    ...verifyingTask,
    status: gate.status === 'passed' ? 'done' : 'blocked',
    updatedAt: now(),
  });
  await store.appendDecision({
    id: `decision-${Date.now()}-${gate.status}`,
    taskId: finalTask.id,
    at: now(),
    source: 'done_gate',
    type: gate.status === 'passed' ? 'done_gate_passed' : 'done_gate_blocked',
    summary: gate.status === 'passed' ? 'Done Gate passed' : 'Done Gate blocked completion',
    relatedEvidenceId: evidence?.id,
    inputs: {},
    outputs: { reasons: gate.reasons, nextActions: gate.nextActions },
    metadata: {},
  });

  return {
    task: finalTask,
    evidence,
    gate,
    nextAction: gate.status === 'passed' ? 'done' : 'blocked',
  };
}

export async function getRuntimeStatus(input: {
  cwd: string;
  taskId: string;
  store?: EvidenceStore;
  requiredChecks?: CheckKind[];
  now?: string;
}): Promise<RuntimeStatus> {
  const store = input.store ?? new EvidenceStore({ cwd: input.cwd });
  const task = await store.readTask(input.taskId);
  const evidence = await store.readEvidence(input.taskId);
  const gate = task
    ? evaluateDoneGate({ task, evidence, requiredChecks: input.requiredChecks, now: input.now })
    : null;
  const checks = evidence?.checks ?? [];
  const editTransactions = evidence?.editTransactions ?? [];

  return {
    task,
    evidence,
    gate,
    checks: {
      total: checks.length,
      passed: checks.filter((check) => check.status === 'pass').length,
      failed: checks.filter((check) => check.status === 'fail').length,
      blocked: checks.filter((check) => check.status === 'blocked').length,
    },
    changedFiles: unique(editTransactions.flatMap((edit) => edit.changedFiles.map((file) => file.path))),
    nextAction: gate?.status === 'passed'
      ? 'ready to mark done'
      : gate?.nextActions[0] ?? 'create task evidence',
  };
}

function deriveRequiredChecks(evidence: EvidenceRecord | null): CheckKind[] {
  if (!evidence) return [];
  return unique(evidence.checks.filter((check) => check.required).map((check) => check.kind));
}

function requiredApprovalRisk(risk: RiskLevel): RiskLevel | undefined {
  return APPROVAL_REQUIRED_RISKS.includes(risk) ? risk : undefined;
}

function hasValidApproval(evidence: EvidenceRecord, risk: RiskLevel, now: string): boolean {
  return evidence.approvals.some((approval) => {
    if (approval.risk !== risk) return false;
    if (approval.revokedAt) return false;
    if (approval.expiresAt && approval.expiresAt <= now) return false;
    return true;
  });
}

function evaluateEditTransactions(risk: RiskLevel, edits: EditTransaction[]): {
  reasons: string[];
  nextActions: string[];
  staleEditTransactionIds: string[];
} {
  const reasons: string[] = [];
  const nextActions: string[] = [];
  const staleEditTransactionIds: string[] = [];

  if (!MUTATION_RISKS.includes(risk)) {
    return { reasons, nextActions, staleEditTransactionIds };
  }

  if (edits.length === 0) {
    reasons.push(`edit evidence is required for risk ${risk}`);
    nextActions.push('record changed files, diff, and rollback patch');
    return { reasons, nextActions, staleEditTransactionIds };
  }

  if (edits.every((edit) => edit.changedFiles.length === 0)) {
    reasons.push(`changed-file evidence is required for risk ${risk}`);
    nextActions.push('make the intended repo change or lower the task risk');
  }

  for (const edit of edits) {
    if (edit.status === 'stale' || edit.status === 'failed' || edit.staleFiles.length > 0) {
      reasons.push(`edit transaction ${edit.id} is ${edit.status}`);
      staleEditTransactionIds.push(edit.id);
      nextActions.push('refresh edit evidence before marking done');
    }

    if (edit.changedFiles.length > 0 && !edit.diffPath) {
      reasons.push(`edit transaction ${edit.id} is missing diff evidence`);
      nextActions.push('record a task-scoped diff patch');
    }

    if (edit.changedFiles.length > 0 && !edit.rollbackPatchPath) {
      reasons.push(`edit transaction ${edit.id} is missing rollback evidence`);
      nextActions.push('record a rollback patch');
    }
  }

  return { reasons, nextActions, staleEditTransactionIds };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function makeTaskId(now: string): string {
  return `task-${now.replace(/[^0-9]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}
