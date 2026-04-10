/**
 * AdvisorRunner — Opus advisor harness (Phase 28).
 *
 * Invokes an Opus advisor via subagent or CLI flag at critical decision points.
 * Verifies response signature. Enforces per-skill call caps and timeouts.
 * Default: disabled. Non-strict: failures become warnings, not errors.
 */

import { execa } from 'execa';
import type { AdvisorConfig, AdvisorRequest, AdvisorResult, AdvisorWarning } from './types.js';

export class AdvisorRunner {
  private callCounts = new Map<string, number>();

  constructor(
    private cfg: AdvisorConfig,
    private cwd: string,
  ) {}

  async run(req: AdvisorRequest, buildPrompt: (req: AdvisorRequest) => string): Promise<AdvisorResult> {
    const started = Date.now();
    const warnings: AdvisorWarning[] = [];

    if (!this.cfg.enabled) {
      return this.disabled(started);
    }

    const count = this.callCounts.get(req.skillId) ?? 0;
    if (count >= this.cfg.maxCallsPerSkill) {
      warnings.push({ code: 'cap_exceeded', message: `Cap ${this.cfg.maxCallsPerSkill} reached for ${req.skillId}` });
      return this.fail(warnings, started);
    }
    this.callCounts.set(req.skillId, count + 1);

    const prompt = buildPrompt(req);
    if (prompt.length > this.cfg.maxPromptChars) {
      warnings.push({ code: 'prompt_too_long', message: `Prompt ${prompt.length} > cap ${this.cfg.maxPromptChars}` });
      if (this.cfg.strict) return this.fail(warnings, started);
    }

    try {
      const response = await this.invokeTransport(prompt);
      const { verified, advice, warning } = this.verifySignature(response);
      if (warning) warnings.push(warning);

      if (!verified && this.cfg.requireSignature && this.cfg.strict) {
        return this.fail(warnings, started);
      }

      return {
        success: true,
        verified,
        advice,
        rawResponse: response,
        warnings,
        durationMs: Date.now() - started,
        transport: this.cfg.transport,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = /timeout/i.test(msg);
      warnings.push({ code: isTimeout ? 'timeout' : 'transport_error', message: msg });
      if (this.cfg.strict) throw new Error(`Advisor strict mode: ${msg}`);
      return this.fail(warnings, started);
    }
  }

  private async invokeTransport(prompt: string): Promise<string> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.cfg.timeoutMs);
    try {
      if (this.cfg.transport === 'subagent') {
        const result = await execa('claude', [
          '-p',
          '--agent', this.cfg.subagentName,
          '--output-format', 'text',
          '--max-turns', String(this.cfg.maxTurns),
          prompt,
        ], {
          cwd: this.cwd,
          cancelSignal: ac.signal,
          timeout: this.cfg.timeoutMs,
        });
        return result.stdout;
      } else {
        const result = await execa('claude', [
          '-p',
          '--model', this.cfg.modelHint,
          '--output-format', 'text',
          '--max-turns', String(this.cfg.maxTurns),
          prompt,
        ], {
          cwd: this.cwd,
          cancelSignal: ac.signal,
          timeout: this.cfg.timeoutMs,
        });
        return result.stdout;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private verifySignature(response: string) {
    const pattern = this.cfg.signaturePattern;
    const found = response.includes(pattern);
    const advice = response.replace(pattern, '').trim();
    const warning: AdvisorWarning | undefined = found
      ? undefined
      : { code: 'no_signature', message: `Missing signature: ${pattern}` };
    return { verified: found, advice, warning };
  }

  private disabled(started: number): AdvisorResult {
    return {
      success: false,
      verified: false,
      warnings: [{ code: 'disabled', message: 'Advisor disabled by config' }],
      durationMs: Date.now() - started,
      transport: this.cfg.transport,
    };
  }

  private fail(warnings: AdvisorWarning[], started: number): AdvisorResult {
    return {
      success: false,
      verified: false,
      warnings,
      durationMs: Date.now() - started,
      transport: this.cfg.transport,
    };
  }

  resetCounts(): void {
    this.callCounts.clear();
  }
}
