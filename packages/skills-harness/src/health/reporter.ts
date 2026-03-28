/**
 * @sunco/skills-harness - Health Reporter
 *
 * Computes weighted composite health score and formats output for
 * terminal table display and JSON consumption.
 *
 * Decisions: D-11 (weighted composite), D-15 (reporter output format)
 */

import type { FreshnessResult, PatternCount, PatternTrend, HealthReport } from './types.js';

// ---------------------------------------------------------------------------
// Weights (D-11: freshness 30%, patterns 40%, conventions 30%)
// ---------------------------------------------------------------------------

const WEIGHT_FRESHNESS = 0.30;
const WEIGHT_PATTERNS = 0.40;
const WEIGHT_CONVENTIONS = 0.30;

// ---------------------------------------------------------------------------
// Pattern Score Penalties
// ---------------------------------------------------------------------------

/** Penalty multipliers per anti-pattern type */
const PATTERN_PENALTIES: Record<string, number> = {
  'any-type': 2,
  'console-log': 1,
  'todo-comment': 0.5,
  'type-assertion': 0.5,
  'eslint-disable': 3,
};

/** Maximum total penalty (caps at 100) */
const MAX_PENALTY = 100;

/** Additional penalty if trends are increasing */
const TREND_PENALTY = 10;

// ---------------------------------------------------------------------------
// Score Computation
// ---------------------------------------------------------------------------

/**
 * Compute pattern score from anti-pattern counts.
 * Score = 100 - penalty, where penalty is based on pattern-specific multipliers.
 * If trends are increasing, an additional 10-point penalty is applied.
 *
 * @param patterns - Current pattern counts
 * @param previousPatterns - Previous pattern counts for trend detection
 * @returns Score 0-100
 */
export function computePatternScore(
  patterns: PatternCount[],
  previousPatterns?: PatternCount[],
): number {
  let penalty = 0;

  for (const p of patterns) {
    const multiplier = PATTERN_PENALTIES[p.pattern] ?? 1;
    penalty += p.count * multiplier;
  }

  // Cap penalty
  penalty = Math.min(penalty, MAX_PENALTY);

  // Check if trends are worsening
  if (previousPatterns && previousPatterns.length > 0) {
    const prevMap = new Map(previousPatterns.map((p) => [p.pattern, p.count]));
    let anyIncreasing = false;
    for (const p of patterns) {
      const prevCount = prevMap.get(p.pattern) ?? 0;
      if (p.count > prevCount && prevCount > 0) {
        const change = (p.count - prevCount) / prevCount;
        if (change > 0.10) {
          anyIncreasing = true;
          break;
        }
      }
    }
    if (anyIncreasing) {
      penalty = Math.min(penalty + TREND_PENALTY, MAX_PENALTY);
    }
  }

  return Math.max(0, Math.round(100 - penalty));
}

/**
 * Compute weighted composite health score.
 *
 * Formula: freshness * 0.30 + patternScore * 0.40 + conventionScore * 0.30
 *
 * @param opts - Individual category scores
 * @returns Composite score 0-100 (rounded integer)
 */
export function computeHealthScore(opts: {
  freshness: FreshnessResult;
  patternScore: number;
  conventionScore: number;
}): number {
  const { freshness, patternScore, conventionScore } = opts;

  const weighted =
    freshness.score * WEIGHT_FRESHNESS +
    patternScore * WEIGHT_PATTERNS +
    conventionScore * WEIGHT_CONVENTIONS;

  return Math.round(weighted);
}

// ---------------------------------------------------------------------------
// Terminal Formatting (D-15)
// ---------------------------------------------------------------------------

/** Trend arrow characters */
function trendArrow(trend: string): string {
  switch (trend) {
    case 'improving': return '\u2197 improving';
    case 'degrading': return '\u2198 degrading';
    case 'first-run': return '\u2014 first run';
    default: return '\u2192 stable';
  }
}

/** Category trend from individual trends */
function categoryTrend(trends: PatternTrend[]): string {
  if (trends.length === 0) return 'stable';
  const increasing = trends.filter((t) => t.trend === 'increasing').length;
  const decreasing = trends.filter((t) => t.trend === 'decreasing').length;
  if (increasing > decreasing) return 'degrading';
  if (decreasing > increasing) return 'improving';
  return 'stable';
}

/**
 * Format a health report as terminal table lines.
 *
 * Output format:
 * ```
 * Category          Score   Trend
 * ─────────────────────────────────
 * Document Freshness  85    ↗ improving
 * Anti-patterns       72    ↘ degrading
 * Conventions         95    → stable
 * ─────────────────────────────────
 * Overall             82    → stable
 * ```
 *
 * @param report - Complete health report
 * @returns Array of formatted lines
 */
export function formatHealthReport(report: HealthReport): string[] {
  const separator = '\u2500'.repeat(42);
  const patternTrend = categoryTrend(report.patterns.trends);

  // Determine convention trend (always stable since we compare against baseline)
  const conventionTrend = 'stable';

  // Determine freshness trend
  const freshnessTrend = report.trend === 'first-run' ? 'first-run' : 'stable';

  const lines: string[] = [
    '',
    `  Category              Score   Trend`,
    `  ${separator}`,
    `  Document Freshness    ${String(report.freshness.score).padStart(3)}     ${trendArrow(freshnessTrend)}`,
    `  Anti-patterns         ${String(report.patterns.score).padStart(3)}     ${trendArrow(patternTrend)}`,
    `  Conventions           ${String(report.conventions.score).padStart(3)}     ${trendArrow(conventionTrend)}`,
    `  ${separator}`,
    `  Overall               ${String(report.overallScore).padStart(3)}     ${trendArrow(report.trend)}`,
    '',
  ];

  // Add stale docs detail if any
  if (report.freshness.details.staleDocuments.length > 0) {
    lines.push('  Stale documents:');
    for (const doc of report.freshness.details.staleDocuments) {
      lines.push(`    - ${doc.docPath} (${doc.staleDays} days behind)`);
    }
    lines.push('');
  }

  // Add broken references if any
  if (report.freshness.details.brokenReferences.length > 0) {
    lines.push('  Broken references:');
    for (const ref of report.freshness.details.brokenReferences) {
      lines.push(`    - ${ref.docPath}:${ref.line} -> ${ref.reference}`);
    }
    lines.push('');
  }

  // Add pattern deviations if any
  if (report.conventions.deviations.length > 0) {
    lines.push('  Convention deviations:');
    for (const d of report.conventions.deviations) {
      lines.push(`    - ${d}`);
    }
    lines.push('');
  }

  return lines;
}

/**
 * Format a health report as JSON string.
 *
 * @param report - Complete health report
 * @returns Pretty-printed JSON string
 */
export function formatHealthJson(report: HealthReport): string {
  return JSON.stringify(report, null, 2);
}
