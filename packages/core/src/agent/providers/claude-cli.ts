/**
 * @sunco/core - Claude Code CLI Provider
 *
 * Spawns `claude` subprocess via execa for agent execution.
 * Primary provider for execution role (D-23).
 *
 * Decisions: D-15 (dual path), D-18 (family + transport), D-26 (cancel/timeout)
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

// ---------------------------------------------------------------------------
// CLI JSON output shape
// ---------------------------------------------------------------------------

interface ClaudeCliOutput {
  result: string;
  cost_usd?: number;
  duration_ms?: number;
  is_error?: boolean;
  num_turns?: number;
  session_id?: string;
}

// ---------------------------------------------------------------------------
// ClaudeCliProvider
// ---------------------------------------------------------------------------

/**
 * Claude Code CLI provider.
 * Spawns `claude -p --output-format json` with execa.
 * Passes prompt via stdin, parses JSON stdout.
 */
export class ClaudeCliProvider implements AgentProvider {
  readonly id: string = 'claude-code-cli';
  readonly family: AgentFamily = 'claude';
  readonly transport: AgentTransport = 'cli';

  /**
   * Check if the claude CLI is available on PATH.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execa('which', ['claude']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a request via the Claude Code CLI.
   *
   * Spawns: claude -p --output-format json --max-turns 1
   * Input via stdin, output parsed from stdout JSON.
   */
  async execute(
    request: AgentRequest,
    context: AgentExecutionContext,
  ): Promise<AgentResult> {
    const args = this.buildArgs(request);
    const startTime = Date.now();

    let stdout: string;
    try {
      const result = await execa('claude', args, {
        input: request.prompt,
        cwd: context.cwd,
        timeout: context.timeout,
        cancelSignal: context.signal,
      });
      stdout = result.stdout;
    } catch (err: unknown) {
      throw new ProviderExecutionError(
        this.id,
        err instanceof Error ? err.message : 'Unknown CLI error',
        { exitCode: (err as { exitCode?: number }).exitCode },
        { cause: err },
      );
    }

    // Parse JSON output
    let parsed: ClaudeCliOutput;
    try {
      parsed = JSON.parse(stdout) as ClaudeCliOutput;
    } catch {
      throw new ProviderExecutionError(
        this.id,
        `Invalid JSON output from claude CLI: ${stdout.slice(0, 200)}`,
      );
    }

    const wallTimeMs = parsed.duration_ms ?? (Date.now() - startTime);

    return normalizeResult(
      {
        text: parsed.result,
        success: !parsed.is_error,
        usage: {
          estimatedCostUsd: parsed.cost_usd,
          estimated: true, // CLI token reporting is incomplete
          wallTimeMs,
        },
        raw: parsed,
      },
      this.id,
    );
  }

  /**
   * Build CLI arguments from request.
   */
  private buildArgs(request: AgentRequest): string[] {
    const args: string[] = ['-p', '--output-format', 'json', '--max-turns', '1'];

    // Add system prompt if present
    if (request.systemPrompt) {
      args.push('--system-prompt', request.systemPrompt);
    }

    return args;
  }
}
