/**
 * @sunco/skills-harness - Anti-pattern Tracker
 *
 * Scans source files for anti-patterns (any types, console.log, TODO comments,
 * type assertions, eslint-disable). Stores snapshots in state for trend computation.
 *
 * Decision: D-13 (anti-pattern tracking with SQLite-backed snapshots)
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { StateApi } from '@sunco/core';
import type { PatternCount, PatternTrend, HealthSnapshot } from './types.js';

/** Source file extensions to scan */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** Directories to exclude from scanning */
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.sun', '.git', 'coverage', '.next', '.turbo',
  '__fixtures__', '__mocks__',
]);

/** State key prefix for health snapshots */
const SNAPSHOT_PREFIX = 'health.snapshot.';

/** Trend threshold: change > 10% = increasing/decreasing */
const TREND_THRESHOLD = 0.10;

// ---------------------------------------------------------------------------
// Anti-pattern Definitions
// ---------------------------------------------------------------------------

interface PatternDef {
  id: string;
  regex: RegExp;
}

const ANTI_PATTERNS: PatternDef[] = [
  { id: 'any-type', regex: /: any[\s;,)]/g },
  { id: 'any-type-as', regex: /as any/g },
  { id: 'console-log', regex: /console\.(log|warn|error)\(/g },
  { id: 'todo-comment', regex: /\/\/\s*(TODO|FIXME|HACK|XXX)/gi },
  { id: 'type-assertion', regex: /as [A-Z]/g },
  { id: 'eslint-disable', regex: /eslint-disable/g },
];

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------

/**
 * Recursively collect source files for scanning.
 */
async function collectSourceFiles(dir: string, files: string[]): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    let s;
    try {
      s = await stat(fullPath);
    } catch {
      continue;
    }

    if (s.isDirectory()) {
      await collectSourceFiles(fullPath, files);
    } else if (s.isFile() && SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Pattern Scanning
// ---------------------------------------------------------------------------

/**
 * Scan a file for anti-patterns and accumulate counts.
 */
function scanFileContent(
  content: string,
  filePath: string,
  accumulator: Map<string, { count: number; files: Set<string> }>,
): void {
  for (const pattern of ANTI_PATTERNS) {
    // Merge any-type and any-type-as into single 'any-type' count
    const id = pattern.id === 'any-type-as' ? 'any-type' : pattern.id;

    pattern.regex.lastIndex = 0;
    const matches = content.match(pattern.regex);
    if (matches && matches.length > 0) {
      const entry = accumulator.get(id) ?? { count: 0, files: new Set<string>() };
      entry.count += matches.length;
      entry.files.add(filePath);
      accumulator.set(id, entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Main Exports
// ---------------------------------------------------------------------------

/**
 * Scan source files for anti-patterns and store a snapshot in state.
 *
 * Scans all .ts/.tsx/.js/.jsx files (excluding node_modules, dist, etc.) for:
 * - any-type: `: any` and `as any` usage
 * - console-log: console.log/warn/error calls
 * - todo-comment: TODO/FIXME/HACK/XXX comments
 * - type-assertion: `as SomeType` assertions
 * - eslint-disable: eslint-disable directives
 *
 * Stores snapshot with ISO timestamp key in state.
 *
 * @param opts - Options with cwd and StateApi
 * @returns Array of PatternCount results
 */
export async function trackPatterns(opts: {
  cwd: string;
  state: StateApi;
}): Promise<PatternCount[]> {
  const { cwd, state } = opts;

  // Collect source files
  const files: string[] = [];
  await collectSourceFiles(cwd, files);

  // Scan each file
  const accumulator = new Map<string, { count: number; files: Set<string> }>();
  for (const filePath of files) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
    scanFileContent(content, relativePath, accumulator);
  }

  // Build PatternCount array
  const counts: PatternCount[] = [];
  for (const [pattern, data] of accumulator) {
    counts.push({
      pattern,
      count: data.count,
      files: [...data.files],
    });
  }

  // Ensure all tracked patterns appear (even with 0 count)
  const trackedPatterns = ['any-type', 'console-log', 'todo-comment', 'type-assertion', 'eslint-disable'];
  for (const p of trackedPatterns) {
    if (!counts.find((c) => c.pattern === p)) {
      counts.push({ pattern: p, count: 0, files: [] });
    }
  }

  // Store snapshot in state with ISO timestamp key (D-13, pitfall #5)
  const timestamp = new Date().toISOString();
  await state.set(`${SNAPSHOT_PREFIX}${timestamp}`, {
    date: timestamp,
    patterns: counts,
  });

  return counts;
}

/**
 * Compute pattern trends by comparing current counts against the most recent snapshot.
 *
 * Trend classification:
 * - increasing: change > +10%
 * - decreasing: change < -10%
 * - stable: change within +/- 10%
 *
 * @param state - StateApi to read previous snapshots
 * @param currentCounts - Current pattern counts to compare
 * @param days - Number of days to look back (default: 30)
 * @returns Array of PatternTrend results
 */
export async function getPatternTrends(
  state: StateApi,
  currentCounts: PatternCount[],
  days?: number,
): Promise<PatternTrend[]> {
  // Load snapshot keys
  const keys = await state.list(SNAPSHOT_PREFIX);

  if (keys.length === 0) {
    // First run -- no previous data
    return currentCounts.map((c) => ({
      pattern: c.pattern,
      currentCount: c.count,
      previousCount: 0,
      trend: 'stable' as const,
      changePercent: 0,
    }));
  }

  // Sort keys chronologically and get the most recent
  const sortedKeys = keys.sort();
  const latestKey = sortedKeys[sortedKeys.length - 1]!;

  // Load the most recent snapshot
  const previousSnapshot = await state.get<{ date: string; patterns: PatternCount[] }>(latestKey);
  if (!previousSnapshot) {
    return currentCounts.map((c) => ({
      pattern: c.pattern,
      currentCount: c.count,
      previousCount: 0,
      trend: 'stable' as const,
      changePercent: 0,
    }));
  }

  // Build lookup from previous snapshot
  const previousMap = new Map<string, number>();
  for (const p of previousSnapshot.patterns) {
    previousMap.set(p.pattern, p.count);
  }

  // Compute trends
  return currentCounts.map((current) => {
    const previousCount = previousMap.get(current.pattern) ?? 0;
    const currentCount = current.count;

    let changePercent: number;
    if (previousCount === 0) {
      changePercent = currentCount > 0 ? 100 : 0;
    } else {
      changePercent = ((currentCount - previousCount) / previousCount) * 100;
    }

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (changePercent > TREND_THRESHOLD * 100) {
      trend = 'increasing';
    } else if (changePercent < -(TREND_THRESHOLD * 100)) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      pattern: current.pattern,
      currentCount,
      previousCount,
      trend,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  });
}
