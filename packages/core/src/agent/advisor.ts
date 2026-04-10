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

    let prompt = buildPrompt(req);

    if (prompt.length > this.cfg.maxPromptChars) {
      warnings.push({ code: 'prompt_too_long', message: `Prompt ${prompt.length} > cap ${this.cfg.maxPromptChars}` });
      if (this.cfg.strict) return this.fail(warnings, started);
      prompt = this.truncatePrompt(prompt, req);
    }

    try {
      const response = await this.invokeTransport(prompt);
      const { signaturePresent, advice, warning } = this.verifySignature(response);
      if (warning) warnings.push(warning);

      if (!signaturePresent && this.cfg.requireSignature && this.cfg.strict) {
        return this.fail(warnings, started);
      }

      return {
        success: true,
        signaturePresent,
        advice: signaturePresent ? advice : undefined,
        rawResponse: response,
        warnings,
        durationMs: Date.now() - started,
        transport: this.cfg.transport,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = /timeout|abort/i.test(msg);
      warnings.push({ code: isTimeout ? 'timeout' : 'transport_error', message: msg });
      if (this.cfg.strict) throw new Error(`Advisor strict mode: ${msg}`);
      return this.fail(warnings, started);
    }
  }

  private truncatePrompt(prompt: string, req: AdvisorRequest): string {
    const evidenceStart = prompt.indexOf('## Evidence');
    if (evidenceStart === -1) return prompt.slice(0, this.cfg.maxPromptChars);

    const beforeEvidence = prompt.slice(0, evidenceStart);
    const remaining = this.cfg.maxPromptChars - beforeEvidence.length - 100;
    if (remaining <= 0) return prompt.slice(0, this.cfg.maxPromptChars);

    const truncatedEvidence = `## Evidence\n(truncated to fit ${this.cfg.maxPromptChars} char cap — ${req.context.evidence.length} items)\n1. ${req.context.evidence[0] ?? 'none'}`;
    const questionIdx = prompt.indexOf('## Question');
    const questionBlock = questionIdx !== -1 ? prompt.slice(questionIdx) : '';

    return beforeEvidence + truncatedEvidence + '\n\n' + questionBlock;
  }

  private async invokeTransport(prompt: string): Promise<string> {
    const args = this.cfg.transport === 'subagent'
      ? ['-p', '--agent', this.cfg.subagentName, '--output-format', 'text', '--max-turns', String(this.cfg.maxTurns), prompt]
      : ['-p', '--model', this.cfg.modelHint, '--output-format', 'text', '--max-turns', String(this.cfg.maxTurns), prompt];

    const result = await execa('claude', args, {
      cwd: this.cwd,
      timeout: this.cfg.timeoutMs,
    });
    return result.stdout;
  }

  private verifySignature(response: string) {
    const pattern = this.cfg.signaturePattern;
    const idx = response.lastIndexOf(pattern);
    const found = idx !== -1;
    const advice = found
      ? (response.slice(0, idx) + response.slice(idx + pattern.length)).trim()
      : '';
    const warning: AdvisorWarning | undefined = found
      ? undefined
      : { code: 'no_signature', message: `Missing signature: ${pattern}` };
    return { signaturePresent: found, advice, warning };
  }

  private disabled(started: number): AdvisorResult {
    return {
      success: false,
      signaturePresent: false,
      warnings: [{ code: 'disabled', message: 'Advisor disabled by config' }],
      durationMs: Date.now() - started,
      transport: this.cfg.transport,
    };
  }

  private fail(warnings: AdvisorWarning[], started: number): AdvisorResult {
    return {
      success: false,
      signaturePresent: false,
      warnings,
      durationMs: Date.now() - started,
      transport: this.cfg.transport,
    };
  }

  resetCounts(): void {
    this.callCounts.clear();
  }
}
