/**
 * @sunco/core - Agent Router
 *
 * Central dispatch for agent requests. Selects provider by role,
 * enforces permissions, tracks usage, supports cross-verification.
 *
 * Architecture: Router -> Permission Harness -> Provider Adapter -> Cost Tracker
 *
 * Decisions: D-15 (dual path), D-17 (router knows 3 things),
 * D-22 (cross-verification), D-23 (role defaults), D-26 (cancel/timeout)
 */

import { enforcePermissions } from './permission.js';
import { UsageTracker } from './tracker.js';
import {
  ProviderUnavailableError,
} from './errors.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentResult,
  AgentExecutionContext,
  AgentRouterApi,
  AgentRole,
  AgentTransport,
} from './types.js';

// ---------------------------------------------------------------------------
// Router Configuration
// ---------------------------------------------------------------------------

export interface AgentRouterConfig {
  /** Available agent providers */
  providers: AgentProvider[];
  /** Working directory for agent execution */
  cwd: string;
  /** Usage tracker (optional, creates new if not provided) */
  tracker?: UsageTracker;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
}

// ---------------------------------------------------------------------------
// Role -> Transport Mapping (D-23)
// ---------------------------------------------------------------------------

/**
 * Default transport preference per role.
 * execution -> cli (Claude Code for file operations)
 * research/planning/verification -> sdk (API for analysis)
 */
const ROLE_TRANSPORT_PREFERENCE: Record<AgentRole, AgentTransport> = {
  execution: 'cli',
  research: 'sdk',
  planning: 'sdk',
  verification: 'sdk',
};

// ---------------------------------------------------------------------------
// Agent Router Implementation
// ---------------------------------------------------------------------------

class AgentRouter implements AgentRouterApi {
  private readonly providers: Map<string, AgentProvider>;
  private readonly cwd: string;
  private readonly tracker: UsageTracker;
  private readonly defaultTimeout: number;

  constructor(config: AgentRouterConfig) {
    this.providers = new Map(config.providers.map((p) => [p.id, p]));
    this.cwd = config.cwd;
    this.tracker = config.tracker ?? new UsageTracker();
    this.defaultTimeout = config.defaultTimeout ?? 120_000;
  }

  /**
   * Run an agent task through the router.
   * 1. Select provider by role (D-23) or explicit providerId
   * 2. Enforce permissions
   * 3. Execute with timeout/signal
   * 4. Record usage
   */
  async run(request: AgentRequest): Promise<AgentResult> {
    // Step 1: Enforce permissions before anything else
    enforcePermissions(request);

    // Step 2: Select provider
    const provider = request.providerId
      ? await this.getSpecificProvider(request.providerId)
      : await this.selectProvider(request.role);

    // Step 3: Build execution context
    const timeout = request.timeout ?? this.defaultTimeout;
    const signal = request.signal ?? AbortSignal.timeout(timeout);
    const context: AgentExecutionContext = {
      cwd: this.cwd,
      permissions: request.permissions,
      timeout,
      signal,
    };

    // Step 4: Execute
    const result = await provider.execute(request, context);

    // Step 5: Record usage
    this.tracker.record(result);

    return result;
  }

  /**
   * Cross-verify: dispatch to multiple providers via Promise.allSettled.
   * Returns only fulfilled results (D-22).
   */
  async crossVerify(
    request: AgentRequest,
    providerIds?: string[],
  ): Promise<AgentResult[]> {
    // Enforce permissions first
    enforcePermissions(request);

    const timeout = request.timeout ?? this.defaultTimeout;
    const signal = request.signal ?? AbortSignal.timeout(timeout);
    const context: AgentExecutionContext = {
      cwd: this.cwd,
      permissions: request.permissions,
      timeout,
      signal,
    };

    // Determine which providers to use
    let providers: AgentProvider[];
    if (providerIds) {
      providers = providerIds
        .map((id) => this.providers.get(id))
        .filter((p): p is AgentProvider => p !== undefined);
    } else {
      providers = Array.from(this.providers.values());
    }

    // Dispatch to all providers
    const settled = await Promise.allSettled(
      providers.map((p) => p.execute(request, context)),
    );

    // Collect fulfilled results
    const results: AgentResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
        this.tracker.record(outcome.value);
      }
    }

    return results;
  }

  /**
   * List available provider IDs.
   */
  async listProviders(): Promise<string[]> {
    const checks = await Promise.all(
      Array.from(this.providers.entries()).map(async ([id, provider]) => ({
        id,
        available: await provider.isAvailable(),
      })),
    );
    return checks.filter((c) => c.available).map((c) => c.id);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Select provider by role preference (D-23).
   * Falls back to any available provider if preferred transport is unavailable.
   */
  private async selectProvider(role: AgentRole): Promise<AgentProvider> {
    const preferredTransport = ROLE_TRANSPORT_PREFERENCE[role];

    // Try preferred transport first
    for (const provider of this.providers.values()) {
      if (provider.transport === preferredTransport && await provider.isAvailable()) {
        return provider;
      }
    }

    // Fallback: any available provider
    for (const provider of this.providers.values()) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }

    throw new ProviderUnavailableError(
      'router',
      `No available provider for role '${role}'`,
    );
  }

  /**
   * Get a specific provider by ID.
   */
  private async getSpecificProvider(providerId: string): Promise<AgentProvider> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderUnavailableError(
        providerId,
        `Provider '${providerId}' not registered`,
      );
    }
    if (!await provider.isAvailable()) {
      throw new ProviderUnavailableError(
        providerId,
        `Provider '${providerId}' is not available`,
      );
    }
    return provider;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an AgentRouter instance.
 */
export function createAgentRouter(config: AgentRouterConfig): AgentRouterApi {
  return new AgentRouter(config);
}
