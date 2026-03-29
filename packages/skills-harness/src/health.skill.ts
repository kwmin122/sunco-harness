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
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

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
    { flags: '--deep', description: 'Agent-based deep entropy detection (OpenAI Garbage Collection pattern)' },
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

    // 11. --deep: agent-based entropy detection (Garbage Collection pattern)
    // health.skill.ts is kind: 'deterministic' so ctx.agent may not be available.
    // We attempt it with try/catch — if no provider is configured, we log and skip.
    const isDeep = ctx.args.deep as boolean | undefined;
    if (isDeep) {
      await runDeepAnalysis(ctx, report);
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

// ---------------------------------------------------------------------------
// Deep Analysis (--deep flag): agent-based garbage collection
// ---------------------------------------------------------------------------

/**
 * Build the deep entropy detection prompt inline.
 * Mirrors buildHealthDeepPrompt in @sunco/skills-workflow/prompts/health-deep.ts
 * but kept local to avoid cross-package dependency from skills-harness to skills-workflow.
 *
 * Finds: doc-code mismatches, dead imports, stale TODOs, convention drift, dead code.
 * Output format: JSON array of { type, file, description, suggestion, severity }
 */
function buildDeepPromptInline(params: {
  readme: string;
  claudeMd: string;
  recentGitLog: string;
  sourceFiles: string[];
  existingHealthReport: string;
}): string {
  const { readme, claudeMd, recentGitLog, sourceFiles, existingHealthReport } = params;
  const fileList = sourceFiles.slice(0, 200).join('\n');
  const fileCount = sourceFiles.length;
  const truncated = fileCount > 200 ? `\n... and ${fileCount - 200} more files` : '';

  return `You are a garbage collection agent performing deep entropy detection on a TypeScript codebase.

Your job is to find quality debt that deterministic linters cannot catch: documentation drift, dead imports, stale todos, convention violations, and dead code.

## Project Context

### README.md
${readme || '(not found)'}

### CLAUDE.md (conventions + constraints)
${claudeMd || '(not found)'}

### Recent Git Log (last 50 commits)
${recentGitLog || '(not found)'}

### Source Files (${fileCount} total)
${fileList}${truncated}

### Existing Health Report
${existingHealthReport || '(not available)'}

## Your Task

Find entropy across these categories:

1. **doc-code-mismatch**: Documentation contradicts code state (README claims feature that doesn't exist, comments describe removed logic)
2. **dead-import**: Imports referencing non-existent or removed modules
3. **stale-todo**: TODO/FIXME comments that are overdue or reference stale context
4. **convention-drift**: Code patterns that violate CLAUDE.md documented conventions
5. **dead-code**: Exported functions, types, or files with no apparent consumers

## Output Format

Respond ONLY with a JSON code block. No explanation before or after.

\`\`\`json
{
  "findings": [
    {
      "type": "doc-code-mismatch",
      "file": "path/to/file.ts",
      "description": "Specific description of the entropy found",
      "suggestion": "Concrete action to resolve this",
      "severity": "medium"
    }
  ]
}
\`\`\`

Severity: critical (misleading/broken), high (affects correctness), medium (should fix soon), low (minor cleanup). Prefer precision over recall.`;
}

/**
 * Run agent-based deep entropy analysis and output results.
 * Gracefully handles missing agent provider (deterministic skill context).
 */
async function runDeepAnalysis(
  ctx: import('@sunco/core').SkillContext,
  report: HealthReport,
): Promise<void> {
  ctx.log.info('Starting --deep agent analysis...');

  // Gather project context
  let readme = '';
  let claudeMd = '';
  let recentGitLog = '';
  const sourceFiles: string[] = [];

  try {
    readme = await readFile(join(ctx.cwd, 'README.md'), 'utf-8');
  } catch { /* not found */ }

  try {
    claudeMd = await readFile(join(ctx.cwd, 'CLAUDE.md'), 'utf-8');
  } catch { /* not found */ }

  try {
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(ctx.cwd);
    const log = await git.log({ maxCount: 50 });
    recentGitLog = log.all.map((c) => `${c.hash.slice(0, 7)} ${c.date.slice(0, 10)} ${c.message}`).join('\n');
  } catch { /* git not available */ }

  try {
    sourceFiles.push(...(await collectSourceFiles(ctx.cwd)));
  } catch { /* glob failed */ }

  const existingHealthReport = formatHealthReport(report).join('\n');

  const prompt = buildDeepPromptInline({
    readme,
    claudeMd,
    recentGitLog,
    sourceFiles,
    existingHealthReport,
  });

  // Attempt agent dispatch — may not be available in deterministic context
  try {
    // ctx.agent may not exist for kind: 'deterministic', access defensively
    const agent = (ctx as unknown as Record<string, unknown>).agent as
      | { run: (opts: { role: string; prompt: string; timeout: number }) => Promise<{ outputText: string }> }
      | undefined;

    if (!agent?.run) {
      ctx.log.warn('--deep requires an agent provider. Configure one with `sunco settings agents`.');
      await ctx.ui.result({
        success: true,
        title: 'Health Deep Analysis',
        summary: 'Agent not available — configure a provider to enable --deep',
        details: ['Run `sunco settings agents` to configure an agent provider for deep analysis.'],
      });
      return;
    }

    const result = await agent.run({
      role: 'analysis',
      prompt,
      timeout: 120_000,
    });

    // Parse JSON findings from agent output
    const jsonBlocks = result.outputText.match(/```json\s*\n([\s\S]*?)```/g);
    let deepFindings: Array<{
      type: string;
      file: string;
      description: string;
      suggestion: string;
      severity: string;
    }> = [];

    if (jsonBlocks && jsonBlocks.length > 0) {
      const lastBlock = jsonBlocks[jsonBlocks.length - 1]!;
      const jsonStr = lastBlock.replace(/```json\s*\n?/, '').replace(/```$/, '').trim();
      try {
        const parsed = JSON.parse(jsonStr) as { findings?: unknown[] };
        deepFindings = (parsed.findings ?? []) as typeof deepFindings;
      } catch {
        ctx.log.warn('Failed to parse deep analysis JSON');
      }
    }

    // Output deep analysis results
    if (deepFindings.length === 0) {
      await ctx.ui.result({
        success: true,
        title: 'Health Deep Analysis',
        summary: 'No entropy found — codebase is clean',
        details: ['No doc-code mismatches, dead imports, stale TODOs, or dead code detected.'],
      });
    } else {
      const lines: string[] = [`${deepFindings.length} entropy finding(s)`, ''];
      for (const f of deepFindings) {
        lines.push(`[${String(f.severity).toUpperCase()}] ${f.type}`);
        lines.push(`  File: ${f.file}`);
        lines.push(`  ${f.description}`);
        lines.push(`  Fix: ${f.suggestion}`);
        lines.push('');
      }
      await ctx.ui.result({
        success: true,
        title: 'Health Deep Analysis',
        summary: `${deepFindings.length} entropy finding(s) detected`,
        details: lines,
      });
    }
  } catch (err) {
    ctx.log.warn('Deep analysis failed', { error: err });
    await ctx.ui.result({
      success: false,
      title: 'Health Deep Analysis',
      summary: `Deep analysis failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

/**
 * Collect source file paths from the project's packages directory.
 */
async function collectSourceFiles(cwd: string): Promise<string[]> {
  const paths: string[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      const full = join(dir, entry);
      const rel = `${prefix}/${entry}`;
      if (entry.match(/\.(ts|tsx|js|jsx)$/)) {
        paths.push(rel);
      } else if (!entry.includes('.')) {
        // Likely a directory — recurse (depth limit via path length)
        if (rel.split('/').length < 8) {
          await walk(full, rel);
        }
      }
    }
  }

  await walk(join(cwd, 'packages'), 'packages');
  await walk(join(cwd, 'apps'), 'apps');

  return paths;
}
