/**
 * @sunco/core - Proof-first runtime records
 *
 * Canonical M7 task, evidence, verification, approval, edit, and decision
 * records. Later runtime packages depend on these shapes instead of inventing
 * package-local contracts.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Runtime constants
// ---------------------------------------------------------------------------

export const TASK_STATUSES = [
  'intake',
  'planned',
  'approved',
  'executing',
  'verifying',
  'blocked',
  'done',
  'shipped',
] as const;

export const RISK_LEVELS = [
  'read_only',
  'local_mutate',
  'repo_mutate',
  'repo_mutate_official',
  'remote_mutate',
  'external_mutate',
] as const;

export const CHECK_STATUSES = [
  'pass',
  'fail',
  'skipped',
  'blocked',
] as const;

export const CHECK_KINDS = [
  'typecheck',
  'test',
  'lint',
  'build',
  'custom',
] as const;

export const DONE_GATE_STATUSES = [
  'passed',
  'blocked',
] as const;

export const EDIT_TRANSACTION_STATUSES = [
  'observed',
  'applied',
  'stale',
  'failed',
  'rolled_back',
] as const;

export const CHANGED_FILE_STATUSES = [
  'added',
  'modified',
  'deleted',
  'renamed',
] as const;

export const RUNTIME_DECISION_SOURCES = [
  'router',
  'runtime',
  'evidence_store',
  'verifier',
  'done_gate',
  'edit_engine',
  'agent_adapter',
  'code_intel',
  'cli',
] as const;

export const RUNTIME_ARTIFACT_KINDS = [
  'file',
  'log',
  'diff',
  'rollback_patch',
  'external',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export type CheckKind = (typeof CHECK_KINDS)[number];
export type DoneGateStatus = (typeof DONE_GATE_STATUSES)[number];
export type EditTransactionStatus = (typeof EDIT_TRANSACTION_STATUSES)[number];
export type ChangedFileStatus = (typeof CHANGED_FILE_STATUSES)[number];
export type RuntimeDecisionSource = (typeof RUNTIME_DECISION_SOURCES)[number];
export type RuntimeArtifactKind = (typeof RUNTIME_ARTIFACT_KINDS)[number];

// ---------------------------------------------------------------------------
// Shared schema primitives
// ---------------------------------------------------------------------------

export const RuntimeMetadataSchema = z.record(z.string(), z.unknown());

export const RuntimeIdSchema = z.string().min(1);

export const RuntimeIsoTimestampSchema = z.string().datetime({ offset: true });

export const RuntimePathSchema = z.string().min(1);

export const TaskStatusSchema = z.enum(TASK_STATUSES);
export const RiskLevelSchema = z.enum(RISK_LEVELS);
export const CheckStatusSchema = z.enum(CHECK_STATUSES);
export const CheckKindSchema = z.enum(CHECK_KINDS);
export const DoneGateStatusSchema = z.enum(DONE_GATE_STATUSES);
export const EditTransactionStatusSchema = z.enum(EDIT_TRANSACTION_STATUSES);
export const ChangedFileStatusSchema = z.enum(CHANGED_FILE_STATUSES);
export const RuntimeDecisionSourceSchema = z.enum(RUNTIME_DECISION_SOURCES);
export const RuntimeArtifactKindSchema = z.enum(RUNTIME_ARTIFACT_KINDS);

// ---------------------------------------------------------------------------
// Record schemas
// ---------------------------------------------------------------------------

export const RuntimeArtifactSchema = z.object({
  kind: RuntimeArtifactKindSchema,
  path: RuntimePathSchema,
  description: z.string().optional(),
  sha256: z.string().min(1).optional(),
  uri: z.string().min(1).optional(),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const TaskSchema = z.object({
  id: RuntimeIdSchema,
  goal: z.string().min(1),
  status: TaskStatusSchema,
  risk: RiskLevelSchema,
  createdAt: RuntimeIsoTimestampSchema,
  updatedAt: RuntimeIsoTimestampSchema,
  activeEvidenceId: RuntimeIdSchema.optional(),
  evidencePath: RuntimePathSchema.optional(),
  attempt: z.number().int().nonnegative().default(0),
  parentTaskId: RuntimeIdSchema.optional(),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const CheckResultSchema = z.object({
  id: RuntimeIdSchema,
  taskId: RuntimeIdSchema.optional(),
  kind: CheckKindSchema,
  name: z.string().min(1).optional(),
  command: z.string().min(1),
  status: CheckStatusSchema,
  required: z.boolean().default(true),
  startedAt: RuntimeIsoTimestampSchema,
  completedAt: RuntimeIsoTimestampSchema.optional(),
  durationMs: z.number().nonnegative(),
  exitCode: z.number().int().nullable().optional(),
  logPath: RuntimePathSchema.optional(),
  summary: z.string().optional(),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const ApprovalRecordSchema = z.object({
  id: RuntimeIdSchema,
  taskId: RuntimeIdSchema,
  risk: RiskLevelSchema,
  approvedBy: z.string().min(1),
  approvedAt: RuntimeIsoTimestampSchema,
  expiresAt: RuntimeIsoTimestampSchema.optional(),
  scope: z.array(z.string().min(1)).default([]),
  reason: z.string().optional(),
  revokedAt: RuntimeIsoTimestampSchema.optional(),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const FileHashSchema = z.object({
  algorithm: z.literal('sha256'),
  value: z.string().min(1),
}).strict();

export const ChangedFileSchema = z.object({
  path: RuntimePathSchema,
  status: ChangedFileStatusSchema,
  beforeHash: FileHashSchema.nullable(),
  afterHash: FileHashSchema.nullable(),
  previousPath: RuntimePathSchema.optional(),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const EditTransactionSchema = z.object({
  id: RuntimeIdSchema,
  taskId: RuntimeIdSchema,
  status: EditTransactionStatusSchema,
  createdAt: RuntimeIsoTimestampSchema,
  updatedAt: RuntimeIsoTimestampSchema,
  changedFiles: z.array(ChangedFileSchema).default([]),
  diffPath: RuntimePathSchema.optional(),
  rollbackPatchPath: RuntimePathSchema.optional(),
  staleFiles: z.array(RuntimePathSchema).default([]),
  failureReason: z.string().optional(),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const RuntimeDecisionSchema = z.object({
  id: RuntimeIdSchema,
  taskId: RuntimeIdSchema.optional(),
  at: RuntimeIsoTimestampSchema,
  source: RuntimeDecisionSourceSchema,
  type: z.string().min(1),
  summary: z.string().min(1),
  reason: z.string().optional(),
  relatedEvidenceId: RuntimeIdSchema.optional(),
  inputs: RuntimeMetadataSchema.default({}),
  outputs: RuntimeMetadataSchema.default({}),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const EvidenceRecordSchema = z.object({
  id: RuntimeIdSchema,
  taskId: RuntimeIdSchema,
  createdAt: RuntimeIsoTimestampSchema,
  updatedAt: RuntimeIsoTimestampSchema,
  checks: z.array(CheckResultSchema).default([]),
  approvals: z.array(ApprovalRecordSchema).default([]),
  editTransactions: z.array(EditTransactionSchema).default([]),
  artifacts: z.array(RuntimeArtifactSchema).default([]),
  decisionsLogPath: RuntimePathSchema.optional(),
  unresolvedFailures: z.array(z.string().min(1)).default([]),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export const DoneGateResultSchema = z.object({
  taskId: RuntimeIdSchema,
  evidenceId: RuntimeIdSchema.optional(),
  evaluatedAt: RuntimeIsoTimestampSchema,
  status: DoneGateStatusSchema,
  reasons: z.array(z.string().min(1)).default([]),
  nextActions: z.array(z.string().min(1)).default([]),
  requiredChecks: z.array(CheckKindSchema).default([]),
  missingChecks: z.array(CheckKindSchema).default([]),
  failedChecks: z.array(RuntimeIdSchema).default([]),
  requiredApprovalRisk: RiskLevelSchema.optional(),
  unresolvedFailures: z.array(z.string().min(1)).default([]),
  staleEditTransactionIds: z.array(RuntimeIdSchema).default([]),
  metadata: RuntimeMetadataSchema.default({}),
}).strict();

export type RuntimeArtifact = z.infer<typeof RuntimeArtifactSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type CheckResult = z.infer<typeof CheckResultSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type FileHash = z.infer<typeof FileHashSchema>;
export type ChangedFile = z.infer<typeof ChangedFileSchema>;
export type EditTransaction = z.infer<typeof EditTransactionSchema>;
export type RuntimeDecision = z.infer<typeof RuntimeDecisionSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type DoneGateResult = z.infer<typeof DoneGateResultSchema>;

// ---------------------------------------------------------------------------
// Future package interfaces
// ---------------------------------------------------------------------------

export type RuntimeAgentRequest = {
  task: Task;
  cwd: string;
  evidence?: EvidenceRecord;
  maxTurns?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

export type RuntimeAgentResult = {
  success: boolean;
  summary: string;
  decisions: RuntimeDecision[];
  artifacts: RuntimeArtifact[];
  metadata?: Record<string, unknown>;
};

export interface RuntimeAgentAdapter {
  readonly id: string;
  readonly family: string;
  isAvailable(): Promise<boolean>;
  execute(request: RuntimeAgentRequest): Promise<RuntimeAgentResult>;
}

export type ProjectSignal = {
  cwd: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  languages: string[];
  files: string[];
  metadata?: Record<string, unknown>;
};

export type VerificationCheckSpec = {
  kind: CheckKind;
  command: string;
  required: boolean;
  cwd?: string;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

export interface RuntimeCodeIntelProvider {
  readonly id: string;
  detectProject(cwd: string): Promise<ProjectSignal>;
  selectChecks(input: {
    task: Task;
    project: ProjectSignal;
    evidence?: EvidenceRecord;
  }): Promise<VerificationCheckSpec[]>;
}
