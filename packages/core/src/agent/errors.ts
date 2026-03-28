/**
 * @sunco/core - Agent Error Hierarchy
 *
 * Four typed error classes for the Agent Router (D-27).
 * All extend SunError from the base error hierarchy.
 */

import { SunError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// AgentError Base
// ---------------------------------------------------------------------------

/** Base error for all agent-related errors */
export class AgentError extends SunError {
  /** Provider ID that generated this error (if known) */
  readonly providerId?: string;

  constructor(
    code: string,
    message: string,
    providerId?: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(code, message, { ...context, providerId }, options);
    this.name = 'AgentError';
    this.providerId = providerId;
  }
}

// ---------------------------------------------------------------------------
// D-27: Four Error Types
// ---------------------------------------------------------------------------

/**
 * Provider is not available (e.g., CLI not installed, API key missing).
 * Recoverable: router can fallback to another provider.
 */
export class ProviderUnavailableError extends AgentError {
  constructor(
    providerId: string,
    reason: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'PROVIDER_UNAVAILABLE',
      `Provider '${providerId}' is unavailable: ${reason}`,
      providerId,
      context,
      options,
    );
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Agent attempted an action not permitted by PermissionSet.
 * Not recoverable: the request itself needs different permissions.
 */
export class PermissionDeniedError extends AgentError {
  /** The specific permission that was denied */
  readonly permission: string;

  constructor(
    providerId: string,
    permission: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'PERMISSION_DENIED',
      `Permission denied for provider '${providerId}': ${permission}`,
      providerId,
      { ...context, permission },
      options,
    );
    this.name = 'PermissionDeniedError';
    this.permission = permission;
  }
}

/**
 * Agent execution exceeded timeout (D-26).
 * Provider process is killed/cancelled.
 */
export class ExecutionTimeoutError extends AgentError {
  /** Timeout duration in milliseconds */
  readonly timeoutMs: number;

  constructor(
    providerId: string,
    timeoutMs: number,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'EXECUTION_TIMEOUT',
      `Provider '${providerId}' execution timed out after ${timeoutMs}ms`,
      providerId,
      { ...context, timeoutMs },
      options,
    );
    this.name = 'ExecutionTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Provider encountered an error during execution.
 * Catch-all for provider-specific failures (API errors, process crashes, etc.).
 */
export class ProviderExecutionError extends AgentError {
  constructor(
    providerId: string,
    message: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'PROVIDER_EXECUTION_ERROR',
      `Provider '${providerId}' execution failed: ${message}`,
      providerId,
      context,
      options,
    );
    this.name = 'ProviderExecutionError';
  }
}
