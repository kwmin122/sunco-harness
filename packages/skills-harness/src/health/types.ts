/**
 * @sunco/skills-harness - Health Subsystem Types
 *
 * Types for the health scoring system: document freshness detection,
 * anti-pattern tracking with trends, convention scoring, and composite report.
 *
 * Decisions: D-11 (weighted composite), D-12 (freshness checker),
 * D-13 (pattern tracker), D-14 (convention scorer), D-15 (reporter output)
 */

// ---------------------------------------------------------------------------
// Freshness Detection (D-12)
// ---------------------------------------------------------------------------

/** A document detected as stale (code modified more recently than doc) */
export interface StaleDocument {
  /** Path to the stale document relative to cwd */
  readonly docPath: string;
  /** ISO 8601 timestamp of document last modification */
  readonly lastModified: string;
  /** ISO 8601 timestamp of related code's last modification */
  readonly relatedCodeLastModified: string;
  /** Number of days the document is behind related code */
  readonly staleDays: number;
}

/** A broken cross-reference found in a document */
export interface BrokenReference {
  /** Path to the document containing the broken reference */
  readonly docPath: string;
  /** Line number where the broken reference was found */
  readonly line: number;
  /** The broken link/path text */
  readonly reference: string;
  /** Reason the reference is broken */
  readonly reason: string;
}

/** Result of document freshness checking */
export interface FreshnessResult {
  /** Score 0-100, higher = fresher documentation */
  readonly score: number;
  /** Documents detected as stale */
  readonly staleDocuments: StaleDocument[];
  /** Broken cross-references found */
  readonly brokenReferences: BrokenReference[];
  /** Total number of documentation files found */
  readonly totalDocuments: number;
}

// ---------------------------------------------------------------------------
// Anti-pattern Tracking (D-13)
// ---------------------------------------------------------------------------

/** Count of a specific anti-pattern across the codebase */
export interface PatternCount {
  /** Pattern identifier (e.g., 'any-type', 'console-log', 'todo-comment') */
  readonly pattern: string;
  /** Total occurrences found */
  readonly count: number;
  /** Files where the pattern was found */
  readonly files: string[];
}

/** Trend of an anti-pattern over time */
export interface PatternTrend {
  /** Pattern identifier */
  readonly pattern: string;
  /** Current occurrence count */
  readonly currentCount: number;
  /** Previous snapshot occurrence count */
  readonly previousCount: number;
  /** Trend direction */
  readonly trend: 'increasing' | 'decreasing' | 'stable';
  /** Percentage change from previous to current */
  readonly changePercent: number;
}

// ---------------------------------------------------------------------------
// Health Snapshot & Report (D-11, D-15)
// ---------------------------------------------------------------------------

/** Point-in-time health measurement stored in state */
export interface HealthSnapshot {
  /** ISO 8601 timestamp with time precision */
  readonly date: string;
  /** Freshness measurement */
  readonly freshness: FreshnessResult;
  /** Anti-pattern counts */
  readonly patterns: PatternCount[];
  /** Convention adherence score 0-100 */
  readonly conventionScore: number;
  /** Weighted composite score 0-100 */
  readonly overallScore: number;
}

/** Complete health report with scores and trends */
export interface HealthReport {
  /** Weighted composite score 0-100 */
  readonly overallScore: number;
  /** Freshness category */
  readonly freshness: { readonly score: number; readonly details: FreshnessResult };
  /** Anti-pattern category */
  readonly patterns: {
    readonly score: number;
    readonly trends: PatternTrend[];
    readonly counts: PatternCount[];
  };
  /** Convention adherence category */
  readonly conventions: { readonly score: number; readonly deviations: string[] };
  /** Overall trend direction */
  readonly trend: 'improving' | 'degrading' | 'stable' | 'first-run';
}
