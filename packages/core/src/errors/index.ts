/**
 * @sunco/core - Error Hierarchy
 *
 * Base error classes for the SUNCO platform.
 * All SUNCO errors extend SunError for consistent handling.
 */

// ---------------------------------------------------------------------------
// Base Error
// ---------------------------------------------------------------------------

/**
 * Base error for all SUNCO errors.
 * Provides a consistent error code and structured context.
 */
export class SunError extends Error {
  /** Machine-readable error code (e.g., 'CONFIG_INVALID', 'SKILL_NOT_FOUND') */
  readonly code: string;

  /** Structured context for debugging */
  readonly context?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SunError';
    this.code = code;
    this.context = context;
  }
}

// ---------------------------------------------------------------------------
// Config Errors
// ---------------------------------------------------------------------------

/** Thrown when TOML config fails validation or parsing */
export class ConfigError extends SunError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super('CONFIG_INVALID', message, context, options);
    this.name = 'ConfigError';
  }
}

// ---------------------------------------------------------------------------
// Skill Errors
// ---------------------------------------------------------------------------

/** Thrown when a skill is not found in the registry */
export class SkillNotFoundError extends SunError {
  readonly skillId: string;

  constructor(
    skillId: string,
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'SKILL_NOT_FOUND',
      `Skill not found: '${skillId}'`,
      { ...context, skillId },
      options,
    );
    this.name = 'SkillNotFoundError';
    this.skillId = skillId;
  }
}

/** Thrown when a circular skill invocation is detected via ctx.run() */
export class CircularSkillInvocationError extends SunError {
  readonly chain: readonly string[];

  constructor(
    chain: readonly string[],
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'CIRCULAR_SKILL_INVOCATION',
      `Circular skill invocation detected: ${chain.join(' -> ')}`,
      { ...context, chain },
      options,
    );
    this.name = 'CircularSkillInvocationError';
    this.chain = chain;
  }
}

/** Thrown when duplicate skill IDs or commands are found (D-14) */
export class DuplicateSkillError extends SunError {
  readonly duplicateId: string;

  constructor(
    duplicateId: string,
    kind: 'id' | 'command',
    context?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(
      'DUPLICATE_SKILL',
      `Duplicate skill ${kind} found: '${duplicateId}'`,
      { ...context, duplicateId, kind },
      options,
    );
    this.name = 'DuplicateSkillError';
    this.duplicateId = duplicateId;
  }
}
