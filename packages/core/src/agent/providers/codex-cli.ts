/**
 * @sunco/core - Codex CLI Provider
 *
 * Spawns `codex review` subprocess via execa for Layer 6 cross-model verification.
 * Verification-only provider — never used for planning or execution (D-03).
 *
 * Decisions: D-04 (subprocess transport), D-07 (read-only sandbox), D-14/D-15 (inherit auth, no API key)
 */

import { execa } from 'execa';
import { ProviderExecutionError } from '../errors.js';
import { normalizeResult } from '../result.js';
import type {
  AgentProvider,
  AgentRequest,
  AgentExecutionContext,
  AgentResult,
  AgentFamily,
  AgentTransport,
} from '../types.js';

export class CodexCliProvider implements AgentProvider {
  readonly id: string = 'codex-cli';
  readonly family: AgentFamily = 'openai';
  readonly transport: AgentTransport = 'cli';

  async isAvailable(): Promise<boolean> {
    try {
      await execa('which', ['codex']);
      return true;
    } catch {
      return false;
    }
  }

  async execute(
    request: AgentRequest,
    context: AgentExecutionContext,
  ): Promise<AgentResult> {
    const baseRef = (request.meta?.baseRef as string | undefined) ?? 'HEAD~1';
    const args = [
      'review',
      '--base', baseRef,
      '-c', 'sandbox_permissions=["disk-full-read-access"]',
      '-',
    ];

    const startTime = Date.now();
    try {
      const result = await execa('codex', args, {
        input: request.prompt,
        cwd: context.cwd,
        timeout: context.timeout,
        cancelSignal: context.signal,
      });

      return normalizeResult(
        {
          text: result.stdout,
          success: true,
          usage: {
            estimated: true,
            wallTimeMs: Date.now() - startTime,
          },
        },
        this.id,
      );
    } catch (err: unknown) {
      throw new ProviderExecutionError(
        this.id,
        err instanceof Error ? err.message : 'Unknown codex CLI error',
        { exitCode: (err as { exitCode?: number }).exitCode },
        { cause: err },
      );
    }
  }
}
