/**
 * Verification pipeline types for sunco verify / validate / test-gen.
 *
 * Shared type definitions used across all verification layers:
 * - Layer 1: Multi-Agent Generation (4 expert agents + coordinator)
 * - Layer 2: Deterministic Guardrails (lint + guard)
 * - Layer 3: BDD Acceptance Criteria (holdout scenarios)
 * - Layer 4: Permission Scoping (file path verification)
 * - Layer 5: Adversarial Verification (intent reconstruction)
 * - Layer 6: Cross-Model Verification (different model blind spot detection)
 * - Layer 7: Human Eval Gate (final human sign-off)
 *
 * Requirements: VRF-06, VRF-10
 * Decisions: D-01 (7-layer model), D-02 (layer structure), D-10 (expert agents),
 *   D-11 (coordinator synthesis), D-13/D-14/D-15 (coverage audit)
 */

// ---------------------------------------------------------------------------
// Finding types
// ---------------------------------------------------------------------------

/** Individual finding from any verification layer or source */
export interface VerifyFinding {
  /** Which layer produced this finding (1-7) */
  layer: number;
  /** Source agent or tool that produced the finding */
  source:
    | 'security'
    | 'performance'
    | 'architecture'
    | 'correctness'
    | 'testing'
    | 'api-design'
    | 'migration'
    | 'maintainability'
    | 'coordinator'
    | 'lint'
    | 'guard'
    | 'tribal'
    | 'tdd'
    | 'acceptance'
    | 'scope'
    | 'adversarial'
    | 'intent'
    | 'scenario'
    | 'cross-model'
    | 'human-eval';
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Description of the issue */
  description: string;
  /** File path where the issue was found (if identifiable) */
  file?: string;
  /** Line number (if identifiable) */
  line?: number;
  /** Suggested fix or improvement */
  suggestion?: string;
  /** REV-03: tribal/regulatory flags requiring human review */
  humanRequired?: boolean;
}

// ---------------------------------------------------------------------------
// Verdict and layer results
// ---------------------------------------------------------------------------

/** Overall verification verdict */
export type VerifyVerdict = 'PASS' | 'WARN' | 'FAIL';

/** Result from a single verification layer */
export interface LayerResult {
  /** Layer number (1-7) */
  layer: number;
  /** Human-readable layer name */
  name: string;
  /** Findings produced by this layer */
  findings: VerifyFinding[];
  /** Whether this layer passed */
  passed: boolean;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/** Complete verification report across all layers */
export interface VerifyReport {
  /** Overall verdict: PASS, WARN, or FAIL */
  verdict: VerifyVerdict;
  /** Per-layer results */
  layers: LayerResult[];
  /** All findings aggregated from all layers */
  findings: VerifyFinding[];
  /** Whether any finding requires human review gate */
  humanGateRequired: boolean;
  /** ISO timestamp of report generation */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Coverage types (for validate skill)
// ---------------------------------------------------------------------------

/** A single coverage metric (lines, statements, branches, or functions) */
export interface CoverageMetric {
  /** Total number of items */
  total: number;
  /** Number of covered items */
  covered: number;
  /** Number of skipped items */
  skipped: number;
  /** Coverage percentage (0-100) */
  pct: number;
}

/** Per-file coverage data */
export interface FileCoverage {
  /** File path */
  path: string;
  /** Line coverage */
  lines: CoverageMetric;
  /** Statement coverage */
  statements: CoverageMetric;
  /** Branch coverage */
  branches: CoverageMetric;
  /** Function coverage */
  functions: CoverageMetric;
}

/** Complete coverage report parsed from json-summary output */
export interface CoverageReport {
  /** Overall coverage metrics */
  overall: {
    lines: CoverageMetric;
    statements: CoverageMetric;
    branches: CoverageMetric;
    functions: CoverageMetric;
  };
  /** Per-file coverage data */
  files: FileCoverage[];
  /** Files with 0% line coverage */
  uncoveredFiles: string[];
  /** Previous snapshot for delta computation */
  previousSnapshot?: CoverageReport['overall'];
  /** Delta between current and previous snapshot (pct difference) */
  delta?: {
    lines: number;
    statements: number;
    branches: number;
    functions: number;
  };
}
