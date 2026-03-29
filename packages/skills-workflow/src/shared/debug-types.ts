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
 * - context_shortage: agent ran out of context or had incomplete info
 * - direction_error: agent took wrong approach
 * - structural_conflict: codebase architecture prevents the change
 */
export type FailureType = 'context_shortage' | 'direction_error' | 'structural_conflict';

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
