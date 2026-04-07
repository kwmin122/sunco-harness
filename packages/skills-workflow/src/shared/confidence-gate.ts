/**
 * Confidence gate — filter findings into tiers by severity.
 *
 * Tier 1 (main report): critical + high severity findings
 * Tier 2 (appendix): medium severity findings
 * Tier 3 (hidden): low severity findings (available on request)
 *
 * Phase 23b — Review Army
 */

import type { VerifyFinding } from './verify-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfidenceGateResult {
  /** Tier 1: Main findings (critical + high) — always shown */
  main: VerifyFinding[];
  /** Tier 2: Appendix findings (medium) — shown in detail view */
  appendix: VerifyFinding[];
  /** Tier 3: Hidden findings (low) — available on request */
  hidden: VerifyFinding[];
  /** Summary counts */
  counts: {
    total: number;
    main: number;
    appendix: number;
    hidden: number;
  };
}

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

/**
 * Filter findings into confidence tiers.
 *
 * @param findings - All findings from verification layers
 * @returns Tiered findings with counts
 */
export function applyConfidenceGate(
  findings: VerifyFinding[],
): ConfidenceGateResult {
  const main: VerifyFinding[] = [];
  const appendix: VerifyFinding[] = [];
  const hidden: VerifyFinding[] = [];

  for (const finding of findings) {
    switch (finding.severity) {
      case 'critical':
      case 'high':
        main.push(finding);
        break;
      case 'medium':
        appendix.push(finding);
        break;
      case 'low':
        hidden.push(finding);
        break;
    }
  }

  return {
    main,
    appendix,
    hidden,
    counts: {
      total: findings.length,
      main: main.length,
      appendix: appendix.length,
      hidden: hidden.length,
    },
  };
}

/**
 * Format confidence gate result for display.
 */
export function formatConfidenceGateSummary(
  result: ConfidenceGateResult,
): string {
  const lines: string[] = [];
  lines.push(`Findings: ${result.counts.total} total`);
  lines.push(`  Main (critical+high): ${result.counts.main}`);
  lines.push(`  Appendix (medium): ${result.counts.appendix}`);
  lines.push(`  Hidden (low): ${result.counts.hidden}`);
  return lines.join('\n');
}
