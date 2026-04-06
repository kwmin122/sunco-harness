/**
 * @sunco/core - Skill System Types
 *
 * Core types for the skill system: defineSkill() metadata, SkillContext,
 * SkillResult, and supporting types.
 *
 * Decisions: D-05 (defineSkill = source of truth), D-06 (ID != command),
 * D-07 (stage = safety filter), D-08 (routable vs directExec),
 * D-12 (minimum required fields), D-14 (conflict policy)
 */

import type { SunConfig } from '../config/types.js';
import type { StateApi, FileStoreApi } from '../state/types.js';
import type { AgentRouterApi } from '../agent/types.js';
import type { RecommenderApi } from '../recommend/types.js';
import type { SkillUi } from '../ui/adapters/SkillUi.js';
import type { SkillId, CommandName } from '../types.js';

// ---------------------------------------------------------------------------
// Skill Metadata Enums
// ---------------------------------------------------------------------------

/**
 * Skill kind determines agent access (D-12).
 * - deterministic: no agent access (ctx.agent is blocked)
 * - prompt: agent access required
 * - hybrid: agent access optional
 */
export type SkillKind = 'deterministic' | 'prompt' | 'hybrid';

/**
 * Skill lifecycle stage (D-07: safety filter, not activation unit).
 * - experimental: may break, warned on activation
 * - canary: testing in production
 * - stable: production-ready
 * - internal: not user-facing
 */
export type SkillStage = 'experimental' | 'canary' | 'stable' | 'internal';

/**
 * Skill routing mode (D-08).
 * - routable: can be dispatched by `sun do`/`sun next`/`sun auto`
 * - directExec: only invokable via explicit CLI command
 */
export type SkillRouting = 'routable' | 'directExec';

/**
 * Skill category for organization and grouping.
 */
export type SkillCategory = 'core' | 'harness' | 'workflow' | 'extension' | string;

/**
 * Skill complexity hint for model routing (Phase 18: LH-09).
 * - simple: fast model sufficient (lint, format, lookup)
 * - standard: balanced model (implementation, debugging)
 * - complex: quality model needed (architecture, deep reasoning)
 */
export type SkillComplexity = 'simple' | 'standard' | 'complex';

// ---------------------------------------------------------------------------
// Skill Option
// ---------------------------------------------------------------------------

/** CLI option definition for a skill command */
export interface SkillOption {
  /** Commander.js flags string (e.g., '--verbose', '-f, --force') */
  flags: string;
  /** Human-readable description */
  description: string;
  /** Default value */
  defaultValue?: unknown;
}

// ---------------------------------------------------------------------------
// Skill Logger
// ---------------------------------------------------------------------------

/** Structured logging interface available to skills via ctx.log */
export interface SkillLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// SkillContext (D-33: skills access everything through context)
// ---------------------------------------------------------------------------

/**
 * Context provided to every skill's execute() function.
 * This is the primary API surface skills interact with.
 */
export interface SkillContext {
  /** Merged TOML config (readonly) */
  readonly config: Readonly<SunConfig>;

  /** State engine API (SQLite-backed structured state) */
  readonly state: StateApi;

  /** File store API (flat file read/write for .sun/ artifacts) */
  readonly fileStore: FileStoreApi;

  /** Agent router API (blocked for deterministic skills via proxy) */
  readonly agent: AgentRouterApi;

  /** Proactive recommendation engine */
  readonly recommend: RecommenderApi;

  /** UI interaction API (D-33: entry/ask/progress/result) */
  readonly ui: SkillUi;

  /** Structured logger */
  readonly log: SkillLogger;

  /**
   * Invoke another skill by ID (D-06: uses skill ID, not command name).
   * Circular invocation is detected and throws CircularSkillInvocationError.
   */
  readonly run: (skillId: SkillId, args?: Record<string, unknown>) => Promise<SkillResult>;

  /** Current working directory */
  readonly cwd: string;

  /** Parsed CLI arguments for this skill */
  readonly args: Record<string, unknown>;

  /** AbortSignal for cancellation support (D-26) */
  readonly signal: AbortSignal;
}

// ---------------------------------------------------------------------------
// SkillResult
// ---------------------------------------------------------------------------

/** Result returned by skill execution */
export interface SkillResult {
  /** Whether the skill completed successfully */
  success: boolean;

  /** Human-readable summary of the outcome */
  summary?: string;

  /** Structured output data (schema depends on skill) */
  data?: unknown;

  /** Warnings generated during execution */
  warnings?: string[];

  /** Duration of execution in milliseconds */
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// SkillDefinition (D-05: defineSkill() = source of truth)
// ---------------------------------------------------------------------------

/**
 * Complete skill definition created via defineSkill().
 * This is the source of truth for skill metadata and execution logic.
 */
export interface SkillDefinition {
  /** Unique stable skill ID (e.g., 'harness.init') -- D-06 */
  readonly id: SkillId;

  /** CLI command name (e.g., 'init') -- D-06: separate from ID */
  readonly command: CommandName;

  /** Human-readable description */
  readonly description: string;

  /** Skill kind determining agent access -- D-12 */
  readonly kind: SkillKind;

  /** Lifecycle stage -- D-07 */
  readonly stage: SkillStage;

  /** Organization category */
  readonly category: SkillCategory;

  /** Routing mode -- D-08 */
  readonly routing: SkillRouting;

  /** CLI options */
  readonly options?: readonly SkillOption[];

  /** Complexity hint for model routing (Phase 18: LH-09) */
  readonly complexity?: SkillComplexity;

  /** Skill execution function */
  readonly execute: (ctx: SkillContext) => Promise<SkillResult>;
}

/**
 * Input to defineSkill() factory function.
 * Same shape as SkillDefinition -- the factory validates and freezes.
 */
export type SkillDefinitionInput = {
  id: SkillId;
  command: CommandName;
  description: string;
  kind: SkillKind;
  stage: SkillStage;
  category: SkillCategory;
  routing: SkillRouting;
  options?: SkillOption[];
  complexity?: SkillComplexity;
  execute: (ctx: SkillContext) => Promise<SkillResult>;
};
