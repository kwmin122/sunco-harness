/**
 * Shared debug types for sunco diagnose / debug / forensics.
 *
 * Type contracts for all 3 debugging skills:
 * - diagnose: deterministic log parsing (zero LLM cost)
 * - debug: agent-powered failure classification
 * - forensics: agent-powered post-mortem analysis
 *
 * Requirements: DBG-02
 * Decisions: D-01 (failure classification), D-03 (debug analysis),
 *   D-08 (diagnose result), D-10 (forensics report)
 */

// ---------------------------------------------------------------------------
// Failure classification (D-01)
// ---------------------------------------------------------------------------

/**
 * Failure type classification for debug skill.
 *
 * Original 3 (Phase 10):
 * - context_shortage: agent ran out of context or had incomplete info
 * - direction_error: agent took wrong approach
 * - structural_conflict: codebase architecture prevents the change
 *
 * Extended 6 (Phase 23a — Iron Law Engine):
 * - state_corruption: stale cache, inconsistent state files
 * - race_condition: timing-dependent, intermittent failures
 * - type_mismatch: TS errors, schema validation failures
 * - dependency_conflict: version conflicts, peer dep warnings
 * - boundary_violation: cross-package imports, layer breaches
 * - silent_failure: no errors but wrong output, missing side effects
 */
export type FailureType =
  | 'context_shortage'
  | 'direction_error'
  | 'structural_conflict'
  | 'state_corruption'
  | 'race_condition'
  | 'type_mismatch'
  | 'dependency_conflict'
  | 'boundary_violation'
  | 'silent_failure';

// ---------------------------------------------------------------------------
// Individual error items
// ---------------------------------------------------------------------------

/** A single error extracted from build/test/lint output */
export interface DiagnoseError {
  /** Error category */
  type: 'test_failure' | 'type_error' | 'lint_error';
  /** File path where the error occurred */
  file: string;
  /** Line number (null if not identifiable) */
  line: number | null;
  /** Human-readable error message */
  message: string;
  /** Error code (TS error code or ESLint rule ID) */
  code?: string;
  /** Stack trace (for test failures) */
  stack?: string;
}

// ---------------------------------------------------------------------------
// Diagnose result (D-08)
// ---------------------------------------------------------------------------

/** Full result from the diagnose skill's deterministic analysis */
export interface DiagnoseResult {
  /** Extracted test failures */
  test_failures: DiagnoseError[];
  /** Extracted TypeScript type errors */
  type_errors: DiagnoseError[];
  /** Extracted ESLint errors */
  lint_errors: DiagnoseError[];
  /** Total error count across all categories */
  total_errors: number;
  /** Raw output captured from each tool */
  raw_output: {
    test?: string;
    tsc?: string;
    lint?: string;
  };
}

// ---------------------------------------------------------------------------
// Debug analysis result (D-03)
// ---------------------------------------------------------------------------

/** Result from the debug skill's agent-powered analysis */
export interface DebugAnalysis {
  /** Classification of the failure */
  failure_type: FailureType;
  /** Root cause description */
  root_cause: string;
  /** Files affected with specific reasons */
  affected_files: { file: string; line?: number; reason: string }[];
  /** Suggested fixes with priority */
  fix_suggestions: { action: string; file?: string; priority: 'high' | 'medium' | 'low' }[];
  /** Confidence score (0-100) */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Forensics report (D-10)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Iron Law Engine types (Phase 23a)
// ---------------------------------------------------------------------------

/** Bug pattern category for 2-tier classification */
export type BugCategory = 'structural' | 'behavioral' | 'environmental';

/** A bug pattern definition with indicators and common fixes */
export interface BugPattern {
  type: FailureType;
  category: BugCategory;
  description: string;
  indicators: string[];
  commonFixes: string[];
}

/** State for the Iron Law gate — tracks hypotheses and root cause confirmation */
export interface IronLawState {
  rootCauseConfirmed: boolean;
  hypotheses: {
    description: string;
    tested: boolean;
    result: 'confirmed' | 'rejected' | 'pending';
  }[];
  editBlocked: boolean;
  phase: number;
}

/** A persisted debug learning from a previous session */
export interface DebugLearning {
  id: string;
  pattern: FailureType;
  symptom: string;
  rootCause: string;
  fix: string;
  files: string[];
  createdAt: string;
  hitCount: number;
}

/** Result from the error sanitizer */
export interface SanitizeResult {
  text: string;
  redactions: { type: string; count: number }[];
  totalRedacted: number;
}

/** Extended debug analysis with Iron Law fields */
export interface IronLawDebugAnalysis extends DebugAnalysis {
  hypotheses_tested?: {
    description: string;
    verification: string;
    result: 'confirmed' | 'rejected';
  }[];
  root_cause_confirmed?: boolean;
  prior_learnings_matched?: string[];
}

/** Debug stuck result extending the base StuckResult */
export interface DebugStuckResult {
  stuck: boolean;
  reason: string | null;
  hypothesesTested: number;
  hypothesesRejected: number;
  escalationReason:
    | 'max_retries'
    | 'all_hypotheses_rejected'
    | 'oscillation'
    | null;
}

// ---------------------------------------------------------------------------
// Forensics report (D-10)
// ---------------------------------------------------------------------------

/** Result from the forensics skill's post-mortem analysis */
export interface ForensicsReport {
  /** Reconstructed timeline of events */
  timeline: { timestamp: string; event: string; source: string }[];
  /** Where the workflow diverged from the plan */
  divergence_point: string;
  /** Hypothesis for the root cause of failure */
  root_cause_hypothesis: string;
  /** Plans affected by the failure */
  affected_plans: string[];
  /** Recommendations for preventing recurrence */
  prevention_recommendations: string[];
}
