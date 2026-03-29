/**
 * @sunco/core - Agent System Types
 *
 * Types for the Agent Router, providers, permissions, and results.
 * Provider-agnostic abstraction supporting Claude Code CLI + Vercel AI SDK.
 *
 * Decisions: D-15 (dual path), D-16 (layer separation), D-17 (router knows 3 things),
 * D-18 (family + transport ID), D-19 (PermissionSet), D-20 (AgentResult),
 * D-21 (cost tracking), D-22 (cross-verification), D-23 (role defaults),
 * D-26 (cancel/timeout), D-28 (artifacts), D-29 (permission enforcement)
 */

import type { z } from 'zod';

// ---------------------------------------------------------------------------
// Agent Identity (D-18: family + transport)
// ---------------------------------------------------------------------------

/** Provider model family */
export type AgentFamily = 'claude' | 'openai' | 'google' | 'ollama' | 'custom';

/** Communication transport */
export type AgentTransport = 'cli' | 'sdk' | 'http';

/** Agent role determines permission defaults (D-23) */
export type AgentRole = 'research' | 'planning' | 'execution' | 'verification';

// ---------------------------------------------------------------------------
// Permissions (D-19: common PermissionSet, D-29: hard enforcement)
// ---------------------------------------------------------------------------

/**
 * Permission set scoping agent access.
 * Enforced by Permission Harness before provider execution.
 * All 6 fields are hard-enforced at logical level in Phase 1.
 */
export interface PermissionSet {
  /** Agent role determining default constraints */
  role: AgentRole;

  /** Glob patterns for readable file paths */
  readPaths: string[];

  /** Glob patterns for writable file paths */
  writePaths: string[];

  /** Whether the agent can run tests */
  allowTests: boolean;

  /** Whether the agent can make network requests */
  allowNetwork: boolean;

  /** Whether the agent can write to git (commit, push) */
  allowGitWrite: boolean;

  /** Allowed shell commands (empty = none) */
  allowCommands: string[];
}

// ---------------------------------------------------------------------------
// Artifacts (D-28: structured artifact type)
// ---------------------------------------------------------------------------

/** Structured artifact reference from agent execution */
export interface Artifact {
  /** File path (relative to project root) */
  path: string;

  /** What happened to the file */
  kind: 'created' | 'modified' | 'report';

  /** Human-readable description */
  description?: string;
}

// ---------------------------------------------------------------------------
// Usage Tracking (D-21: accurate + estimated costs)
// ---------------------------------------------------------------------------

/**
 * Per-call usage entry for detailed cost history.
 * Persisted in state under 'usage.history' for cost breakdown queries.
 */
export interface UsageEntry {
  skillId: string;
  phase: number | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}

/** Token and cost usage information */
export interface AgentUsage {
  /** Input tokens consumed (undefined if not available) */
  inputTokens?: number;

  /** Output tokens generated (undefined if not available) */
  outputTokens?: number;

  /** Estimated cost in USD (undefined if not available) */
  estimatedCostUsd?: number;

  /** Whether the usage values are estimated (true for CLI where exact data may not be available) */
  estimated: boolean;

  /** Wall-clock execution time in milliseconds */
  wallTimeMs: number;
}

// ---------------------------------------------------------------------------
// AgentResult (D-20: common result format)
// ---------------------------------------------------------------------------

/** Normalized result from any agent provider */
export interface AgentResult {
  /** Provider ID that produced this result (e.g., 'claude-code-cli') */
  providerId: string;

  /** Whether execution completed successfully */
  success: boolean;

  /** Raw text output from the agent */
  outputText: string;

  /** Structured artifact references */
  artifacts: Artifact[];

  /** Non-fatal warnings generated during execution */
  warnings: string[];

  /** Token/cost usage information */
  usage: AgentUsage;

  /** Raw provider-specific response (for debugging/escape hatch) */
  raw?: unknown;
}

// ---------------------------------------------------------------------------
// AgentRequest (what skills send to the router)
// ---------------------------------------------------------------------------

/** Request to execute an agent task */
export interface AgentRequest {
  /** Agent role for this task (determines permission defaults) */
  role: AgentRole;

  /** Natural language prompt for the agent */
  prompt: string;

  /** Permission scoping for this execution */
  permissions: PermissionSet;

  /** Optional Zod schema for structured output validation */
  expectedSchema?: z.ZodType;

  /** Timeout in milliseconds (overrides config default) */
  timeout?: number;

  /** Optional specific provider ID to target */
  providerId?: string;

  /** Optional system prompt prefix */
  systemPrompt?: string;

  /** AbortSignal for cancellation (D-26) */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// AgentExecutionContext (internal context passed to providers)
// ---------------------------------------------------------------------------

/** Internal context passed to AgentProvider.execute() */
export interface AgentExecutionContext {
  /** Working directory for the agent */
  cwd: string;

  /** Enforced permissions for this execution */
  permissions: PermissionSet;

  /** Timeout in milliseconds */
  timeout: number;

  /** AbortSignal for cancellation */
  signal: AbortSignal;
}

// ---------------------------------------------------------------------------
// AgentProvider (D-15: provider interface, D-18: family + transport)
// ---------------------------------------------------------------------------

/**
 * Agent provider interface.
 * Each provider implements one transport for one family.
 * Example: claude-code-cli = {family: 'claude', transport: 'cli'}
 */
export interface AgentProvider {
  /** Unique provider ID (e.g., 'claude-code-cli', 'claude-sdk') */
  readonly id: string;

  /** Model family */
  readonly family: AgentFamily;

  /** Communication transport */
  readonly transport: AgentTransport;

  /** Check if this provider is available (e.g., CLI installed, API key set) */
  isAvailable(): Promise<boolean>;

  /** Execute an agent request */
  execute(request: AgentRequest, context: AgentExecutionContext): Promise<AgentResult>;
}

// ---------------------------------------------------------------------------
// AgentRouterApi (skill-facing API via ctx.agent)
// ---------------------------------------------------------------------------

/**
 * Agent Router API exposed to skills via ctx.agent.
 * Skills don't interact with providers directly.
 */
export interface AgentRouterApi {
  /**
   * Run an agent task through the router.
   * Router selects provider, enforces permissions, normalizes result.
   */
  run(request: AgentRequest): Promise<AgentResult>;

  /**
   * Run the same request against multiple providers for cross-verification (D-22).
   * Returns results from all providers.
   */
  crossVerify(request: AgentRequest, providerIds?: string[]): Promise<AgentResult[]>;

  /**
   * List available provider IDs.
   */
  listProviders(): Promise<string[]>;
}
