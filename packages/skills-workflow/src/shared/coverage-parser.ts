/**
 * Coverage parser for Istanbul/Vitest json-summary output.
 *
 * Parses coverage-summary.json into a structured CoverageReport
 * used by the validate skill to audit test coverage.
 *
 * Requirements: VRF-10
 * Decisions: D-13 (coverage audit), D-14 (delta tracking), D-15 (uncovered detection)
 */

import type {
  CoverageMetric,
  CoverageReport,
  FileCoverage,
} from './verify-types.js';

// ---------------------------------------------------------------------------
// Internal types for raw Istanbul json-summary format
// ---------------------------------------------------------------------------

interface RawMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface RawFileEntry {
  lines: RawMetric;
  statements: RawMetric;
  branches: RawMetric;
  functions: RawMetric;
}

type RawCoverageSummary = Record<string, RawFileEntry>;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Convert a raw Istanbul metric to our CoverageMetric type.
 */
function toMetric(raw: RawMetric): CoverageMetric {
  return {
    total: raw.total,
    covered: raw.covered,
    skipped: raw.skipped,
    pct: raw.pct,
  };
}

/**
 * Parse Istanbul/Vitest json-summary output into a structured CoverageReport.
 *
 * The json-summary format has a "total" key for overall metrics and
 * file-path keys for per-file metrics. Each entry contains lines,
 * statements, branches, and functions sub-objects.
 *
 * @param jsonContent - Raw JSON string from coverage-summary.json
 * @param previousSnapshot - Optional previous coverage snapshot for delta computation
 * @returns Structured CoverageReport
 */
export function parseCoverageSummary(
  jsonContent: string,
  previousSnapshot?: CoverageReport['overall'],
): CoverageReport {
  const raw = JSON.parse(jsonContent) as RawCoverageSummary;

  // Extract overall from "total" key
  const totalEntry = raw['total'];
  if (!totalEntry) {
    throw new Error('Coverage summary missing "total" key');
  }

  const overall: CoverageReport['overall'] = {
    lines: toMetric(totalEntry.lines),
    statements: toMetric(totalEntry.statements),
    branches: toMetric(totalEntry.branches),
    functions: toMetric(totalEntry.functions),
  };

  // Build per-file entries from all non-"total" keys
  const files: FileCoverage[] = [];
  const uncoveredFiles: string[] = [];

  for (const [key, entry] of Object.entries(raw)) {
    if (key === 'total') continue;

    const fileCoverage: FileCoverage = {
      path: key,
      lines: toMetric(entry.lines),
      statements: toMetric(entry.statements),
      branches: toMetric(entry.branches),
      functions: toMetric(entry.functions),
    };

    files.push(fileCoverage);

    // Track uncovered files (0% line coverage)
    if (entry.lines.pct === 0) {
      uncoveredFiles.push(key);
    }
  }

  // Build report
  const report: CoverageReport = {
    overall,
    files,
    uncoveredFiles,
  };

  // Compute delta if previous snapshot provided
  if (previousSnapshot) {
    report.previousSnapshot = previousSnapshot;
    report.delta = {
      lines: overall.lines.pct - previousSnapshot.lines.pct,
      statements: overall.statements.pct - previousSnapshot.statements.pct,
      branches: overall.branches.pct - previousSnapshot.branches.pct,
      functions: overall.functions.pct - previousSnapshot.functions.pct,
    };
  }

  return report;
}
