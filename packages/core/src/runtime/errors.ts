/**
 * @sunco/core - Runtime error hierarchy
 */

import { SunError } from '../errors/index.js';
import type { DoneGateResult, RiskLevel } from './types.js';

export class RuntimeError extends SunError {
  constructor(
    code: string,
    message: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(code, message, context, options);
    this.name = 'RuntimeError';
  }
}

export class RuntimeSchemaError extends RuntimeError {
  constructor(
    recordType: string,
    message: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'RUNTIME_SCHEMA_INVALID',
      `${recordType} failed runtime schema validation: ${message}`,
      { ...context, recordType },
      options,
    );
    this.name = 'RuntimeSchemaError';
  }
}

export class MissingEvidenceError extends RuntimeError {
  readonly taskId: string;

  constructor(
    taskId: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'RUNTIME_EVIDENCE_MISSING',
      `Task '${taskId}' has no evidence record`,
      { ...context, taskId },
      options,
    );
    this.name = 'MissingEvidenceError';
    this.taskId = taskId;
  }
}

export class DoneGateBlockedError extends RuntimeError {
  readonly result: DoneGateResult;

  constructor(
    result: DoneGateResult,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    const reasons = result.reasons.length > 0
      ? result.reasons.join('; ')
      : 'done gate blocked';

    super(
      'RUNTIME_DONE_BLOCKED',
      `Task '${result.taskId}' cannot be marked done: ${reasons}`,
      { ...context, result },
      options,
    );
    this.name = 'DoneGateBlockedError';
    this.result = result;
  }
}

export class RiskApprovalRequiredError extends RuntimeError {
  readonly taskId: string;
  readonly risk: RiskLevel;

  constructor(
    taskId: string,
    risk: RiskLevel,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'RUNTIME_APPROVAL_REQUIRED',
      `Task '${taskId}' requires approval for risk '${risk}'`,
      { ...context, taskId, risk },
      options,
    );
    this.name = 'RiskApprovalRequiredError';
    this.taskId = taskId;
    this.risk = risk;
  }
}
