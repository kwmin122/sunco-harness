/**
 * @sunco/core - Claude SDK Provider
 *
 * Provider using Vercel AI SDK with @ai-sdk/anthropic for direct API access.
 * Primary provider for research/planning/verification roles (D-23).
 *
 * Requires: `ai` and `@ai-sdk/anthropic` packages + ANTHROPIC_API_KEY env var.
 * When packages are not installed, isAvailable() returns false.
 *
 * Decisions: D-15 (dual path), D-18 (family + transport), D-26 (cancel/timeout)
 */

import { ProviderExecutionError, ProviderUnavailableError } from '../errors.js';
import { normalizeResult } from '../result.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentExecutionContext,
  AgentResult,
  AgentFamily,
  AgentTransport,
} from '../types.js';

// ---------------------------------------------------------------------------
// Default model
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// ---------------------------------------------------------------------------
// ClaudeSdkProvider
// ---------------------------------------------------------------------------

/**
 * Claude SDK provider via Vercel AI SDK.
 * Uses generateText() from 'ai' package with @ai-sdk/anthropic provider.
 * Reports exact token counts (estimated: false).
 */
export class ClaudeSdkProvider implements AgentProvider {
  readonly id: string = 'claude-sdk';
  readonly family: AgentFamily = 'claude';
  readonly transport: AgentTransport = 'sdk';

  /**
   * Check if the SDK is available.
   * Requires ANTHROPIC_API_KEY env var AND ai/@ai-sdk/anthropic packages.
   */
  async isAvailable(): Promise<boolean> {
    if (!process.env['ANTHROPIC_API_KEY']) {
      return false;
    }
    try {
      await import('ai');
      await import('@ai-sdk/anthropic');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a request via Vercel AI SDK.
   * Uses generateText with anthropic provider.
   */
  async execute(
    request: AgentRequest,
    context: AgentExecutionContext,
  ): Promise<AgentResult> {
    // Dynamic import -- packages may not be installed
    let generateText: (opts: Record<string, unknown>) => Promise<{
      text: string;
      usage?: { promptTokens?: number; completionTokens?: number };
    }>;
    let anthropic: (model: string) => unknown;

    try {
      const aiModule = await import('ai');
      const anthropicModule = await import('@ai-sdk/anthropic');
      generateText = aiModule.generateText as typeof generateText;
      anthropic = anthropicModule.anthropic as typeof anthropic;
    } catch (err) {
      throw new ProviderUnavailableError(
        this.id,
        'ai or @ai-sdk/anthropic package not installed',
        { cause: err },
      );
    }

    const startTime = Date.now();

    try {
      const model = anthropic(DEFAULT_MODEL);

      const result = await generateText({
        model,
        prompt: request.prompt,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        abortSignal: context.signal,
      });

      const wallTimeMs = Date.now() - startTime;
      const inputTokens = result.usage?.promptTokens;
      const outputTokens = result.usage?.completionTokens;

      // Estimate cost based on Claude Sonnet pricing
      // Input: $3/MTok, Output: $15/MTok (approximate)
      const estimatedCostUsd =
        ((inputTokens ?? 0) * 3 + (outputTokens ?? 0) * 15) / 1_000_000;

      return normalizeResult(
        {
          text: result.text,
          success: true,
          usage: {
            inputTokens,
            outputTokens,
            estimatedCostUsd,
            estimated: false, // SDK provides exact token counts
            wallTimeMs,
          },
          raw: result,
        },
        this.id,
      );
    } catch (err: unknown) {
      // Re-throw our own errors
      if (err instanceof ProviderUnavailableError) throw err;

      throw new ProviderExecutionError(
        this.id,
        err instanceof Error ? err.message : 'Unknown SDK error',
        undefined,
        { cause: err },
      );
    }
  }
}
