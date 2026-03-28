/**
 * @sunco/skills-harness - Health Skill
 *
 * Codebase health scoring: document freshness, anti-pattern tracking,
 * convention adherence, and weighted composite score 0-100.
 *
 * Commands:
 *   sunco health         -- show health report with terminal table
 *   sunco health --json  -- output health report as JSON
 *   sunco health --no-snapshot -- skip storing snapshot (dry run)
 *
 * Requirements: HRN-09 (freshness), HRN-10 (patterns), HRN-11 (scoring)
 */

import { defineSkill } from '@sunco/core';
import { checkFreshness } from './health/freshness-checker.js';
import { trackPatterns, getPatternTrends } from './health/pattern-tracker.js';
import { scoreConventions } from './health/convention-scorer.js';
import {
  computeHealthScore,
  computePatternScore,
  formatHealthReport,
  formatHealthJson,
} from './health/reporter.js';
import type { InitResult } from './init/types.js';
import type { ConventionResult } from './init/types.js';
import type { HealthReport, HealthSnapshot, PatternCount } from './health/types.js';

/** Default conventions used when no init result is available */
const DEFAULT_CONVENTIONS: ConventionResult = {
  naming: 'camelCase',
  importStyle: 'relative',
  exportStyle: 'named',
  testOrganization: '__tests__',
  sampleSize: 0,
};

export default defineSkill({
  id: 'harness.health',
  command: 'health',
  kind: 'deterministic',
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  description: 'Codebase health score -- freshness, anti-patterns, conventions',
  options: [
    { flags: '--json', description: 'Output health report as JSON' },
    { flags: '--no-snapshot', description: 'Skip storing snapshot (dry run)' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({
      title: 'Health Check',
      description: 'Analyzing codebase health...',
    });

    // 1. Load init result for convention baseline
    const initResult = await ctx.state.get<InitResult>('init.result');
    const expectedConventions = initResult?.conventions ?? DEFAULT_CONVENTIONS;

    // 2. Run all checks in parallel
    const [freshness, patterns, conventionResult] = await Promise.all([
      checkFreshness({ cwd: ctx.cwd }),
      trackPatterns({ cwd: ctx.cwd, state: ctx.state }),
      scoreConventions({ cwd: ctx.cwd, expectedConventions }),
    ]);

    // 3. Get previous patterns for trend computation
    const previousPatterns = await loadPreviousPatterns(ctx.state);

    // 4. Get trends from previous snapshots
    const trends = await getPatternTrends(ctx.state, patterns);

    // 5. Compute scores
    const patternScore = computePatternScore(patterns, previousPatterns);
    const overallScore = computeHealthScore({
      freshness,
      patternScore,
      conventionScore: conventionResult.score,
    });

    // 6. Determine overall trend
    const overallTrend = determineOverallTrend(trends);

    // 7. Build report
    const report: HealthReport = {
      overallScore,
      freshness: { score: freshness.score, details: freshness },
      patterns: { score: patternScore, trends, counts: patterns },
      conventions: { score: conventionResult.score, deviations: conventionResult.deviations },
      trend: overallTrend,
    };

    // 8. Store snapshot (unless --no-snapshot)
    const noSnapshot = ctx.args.noSnapshot as boolean | undefined;
    if (!noSnapshot) {
      const snapshot: HealthSnapshot = {
        date: new Date().toISOString(),
        freshness,
        patterns,
        conventionScore: conventionResult.score,
        overallScore,
      };
      await ctx.state.set(`health.snapshot.${snapshot.date}`, snapshot);
    }

    // 9. Store last result for recommender
    await ctx.state.set('health.lastResult', {
      overallScore,
      timestamp: new Date().toISOString(),
    });

    // 10. Output
    const isJson = ctx.args.json as boolean | undefined;
    if (isJson) {
      const json = formatHealthJson(report);
      await ctx.ui.result({
        success: true,
        title: 'Health Report',
        summary: `Health score: ${overallScore}/100`,
        details: [json],
      });
    } else {
      const lines = formatHealthReport(report);
      await ctx.ui.result({
        success: true,
        title: 'Health Report',
        summary: `Health score: ${overallScore}/100`,
        details: lines,
      });
    }

    return {
      success: true,
      summary: `Health score: ${overallScore}/100`,
      data: report,
    };
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load the most recent pattern counts from stored snapshots.
 */
async function loadPreviousPatterns(
  state: import('@sunco/core').StateApi,
): Promise<PatternCount[] | undefined> {
  const keys = await state.list('health.snapshot.');
  if (keys.length === 0) return undefined;

  const sortedKeys = keys.sort();
  const latestKey = sortedKeys[sortedKeys.length - 1]!;
  const snapshot = await state.get<{ patterns?: PatternCount[] }>(latestKey);
  return snapshot?.patterns;
}

/**
 * Determine overall health trend from pattern trends.
 */
function determineOverallTrend(
  trends: import('./health/types.js').PatternTrend[],
): 'improving' | 'degrading' | 'stable' | 'first-run' {
  if (trends.length === 0) return 'first-run';

  // Check if all previous counts are 0 (first run)
  const allFirstRun = trends.every((t) => t.previousCount === 0);
  if (allFirstRun) return 'first-run';

  const increasing = trends.filter((t) => t.trend === 'increasing').length;
  const decreasing = trends.filter((t) => t.trend === 'decreasing').length;

  if (decreasing > increasing) return 'improving'; // fewer anti-patterns = improving
  if (increasing > decreasing) return 'degrading';
  return 'stable';
}
