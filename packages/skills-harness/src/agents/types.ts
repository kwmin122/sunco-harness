/**
 * @sunco/skills-harness - Agent Doc Analysis Types
 *
 * Types for analyzing agent instruction files (CLAUDE.md, agents.md, AGENTS.md).
 * Per D-16 (doc metrics), D-17 (efficiency scoring), D-18 (read-only analysis).
 */

/** Metrics extracted from a single agent instruction file */
export interface AgentDocMetrics {
  /** Path to the analyzed file */
  filePath: string;

  /** Total line count */
  totalLines: number;

  /** Number of markdown sections (headers) */
  sectionCount: number;

  /** Parsed sections with instruction counts */
  sections: AgentDocSection[];

  /** Average instructions per section */
  instructionDensity: number;

  /** Whether a "Conventions" section exists */
  hasConventions: boolean;

  /** Whether a "Constraints" section exists */
  hasConstraints: boolean;

  /** Whether an "Architecture" section exists */
  hasArchitecture: boolean;

  /** Detected contradictions between directives */
  contradictions: Contradiction[];

  /** True if totalLines > 60 (ETH Zurich brevity insight) */
  lineCountWarning: boolean;

  /** Efficiency score 0-100, computed by efficiency-scorer */
  efficiencyScore: number;
}

/** A parsed markdown section from an agent doc */
export interface AgentDocSection {
  /** Section header text */
  title: string;

  /** 1-based start line number */
  startLine: number;

  /** 1-based end line number (inclusive) */
  endLine: number;

  /** Number of lines in this section */
  lineCount: number;

  /** Lines that look like instructions (imperative verbs, bullet points) */
  instructionCount: number;
}

/** A contradiction found between two directives */
export interface Contradiction {
  /** Line number of the first directive */
  lineA: number;

  /** Line number of the second directive */
  lineB: number;

  /** Text of the first directive */
  textA: string;

  /** Text of the second directive */
  textB: string;

  /** Explanation of why these contradict */
  reason: string;
}

/** A specific, actionable suggestion for improving an agent doc */
export interface AgentDocSuggestion {
  /** Category of the suggestion */
  type: 'brevity' | 'clarity' | 'coverage' | 'contradiction' | 'structure';

  /** Impact severity */
  severity: 'high' | 'medium' | 'low';

  /** Specific, actionable message (per D-19: with line numbers, not vague) */
  message: string;

  /** Optional line range for targeted suggestions */
  lineRange?: { start: number; end: number };
}

/** Full report covering all analyzed agent docs */
export interface AgentDocReport {
  /** Individual doc analysis results */
  docs: AgentDocMetrics[];

  /** Average efficiency score across all docs */
  overallScore: number;

  /** Aggregated suggestions from all docs */
  suggestions: AgentDocSuggestion[];
}
