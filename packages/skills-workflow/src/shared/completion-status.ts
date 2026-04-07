/**
 * Completion status protocol — structured subagent/skill outcome reporting.
 *
 * 4-status system from superpowers' implementer pattern:
 * DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED
 *
 * Platform-agnostic: works with Claude Code, Codex, Cursor, any agent.
 *
 * Phase 24c — superpowers integration
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompletionStatus =
  | 'DONE'
  | 'DONE_WITH_CONCERNS'
  | 'NEEDS_CONTEXT'
  | 'BLOCKED';

export interface CompletionReport {
  status: CompletionStatus;
  summary: string;
  concerns?: string[];
  missingContext?: string[];
  blockedReason?: string;
  attempted?: string[];
  recommendation?: string;
  evidence?: string[];
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function done(summary: string, evidence: string[] = []): CompletionReport {
  return { status: 'DONE', summary, evidence };
}

export function doneWithConcerns(
  summary: string,
  concerns: string[],
  evidence: string[] = [],
): CompletionReport {
  return { status: 'DONE_WITH_CONCERNS', summary, concerns, evidence };
}

export function needsContext(
  summary: string,
  missingContext: string[],
): CompletionReport {
  return { status: 'NEEDS_CONTEXT', summary, missingContext };
}

export function blocked(
  summary: string,
  blockedReason: string,
  attempted: string[],
  recommendation?: string,
): CompletionReport {
  return { status: 'BLOCKED', summary, blockedReason, attempted, recommendation };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a completion report for display.
 */
export function formatCompletionReport(report: CompletionReport): string {
  const lines: string[] = [];
  lines.push(`STATUS: ${report.status}`);
  lines.push(report.summary);

  if (report.concerns && report.concerns.length > 0) {
    lines.push('CONCERNS:');
    for (const c of report.concerns) lines.push(`  - ${c}`);
  }

  if (report.missingContext && report.missingContext.length > 0) {
    lines.push('MISSING CONTEXT:');
    for (const m of report.missingContext) lines.push(`  - ${m}`);
  }

  if (report.blockedReason) {
    lines.push(`BLOCKED: ${report.blockedReason}`);
  }

  if (report.attempted && report.attempted.length > 0) {
    lines.push('ATTEMPTED:');
    for (const a of report.attempted) lines.push(`  - ${a}`);
  }

  if (report.recommendation) {
    lines.push(`RECOMMENDATION: ${report.recommendation}`);
  }

  if (report.evidence && report.evidence.length > 0) {
    lines.push('EVIDENCE:');
    for (const e of report.evidence) lines.push(`  - ${e}`);
  }

  return lines.join('\n');
}

/**
 * Parse a completion status from agent output text.
 */
export function parseCompletionStatus(text: string): CompletionReport | null {
  const statusMatch = text.match(/STATUS:\s*(DONE_WITH_CONCERNS|DONE|NEEDS_CONTEXT|BLOCKED)/);
  if (!statusMatch) return null;

  const status = statusMatch[1] as CompletionStatus;
  return {
    status,
    summary: text.split('\n').find((l) => !l.startsWith('STATUS:') && l.trim())?.trim() ?? '',
  };
}
