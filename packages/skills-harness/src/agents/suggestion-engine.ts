/**
 * @sunco/skills-harness - Agent Doc Suggestion Engine
 *
 * Generates specific, actionable improvement suggestions from doc metrics.
 * Per D-18: analyze only, never auto-generate or modify files.
 * Per D-19: specific with line numbers ("Line 45-52: contradicts line 12"),
 *   not vague ("Consider improving clarity").
 */

import type { AgentDocMetrics, AgentDocSuggestion } from './types.js';

/**
 * Generate specific, actionable suggestions based on agent doc metrics.
 *
 * Categories:
 * 1. Brevity: Flag docs over 60 lines (ETH Zurich insight)
 * 2. Contradictions: Flag opposing directives with exact line numbers
 * 3. Coverage gaps: Missing conventions, constraints, or architecture sections
 * 4. Structure: Low instruction density (sections without actionable content)
 *
 * @param metrics - Pre-computed doc metrics from analyzeAgentDoc()
 * @returns Array of suggestions, empty if doc is perfect
 */
export function generateSuggestions(metrics: AgentDocMetrics): AgentDocSuggestion[] {
  const suggestions: AgentDocSuggestion[] = [];

  // 1. Brevity: flag docs over 60 lines
  if (metrics.lineCountWarning) {
    suggestions.push({
      type: 'brevity',
      severity: 'high',
      message: `File has ${metrics.totalLines} lines. ETH Zurich research shows agent instruction files under 60 lines are more effective. Consolidate sections or remove redundant instructions.`,
    });
  }

  // 2. Contradictions: flag each with exact line numbers
  for (const contradiction of metrics.contradictions) {
    suggestions.push({
      type: 'contradiction',
      severity: 'high',
      message: `Lines ${contradiction.lineA} and ${contradiction.lineB} contradict: "${contradiction.textA}" vs "${contradiction.textB}". ${contradiction.reason}. Pick one directive and remove the other.`,
      lineRange: { start: contradiction.lineA, end: contradiction.lineB },
    });
  }

  // 3. Coverage gaps: missing key sections
  if (!metrics.hasConventions) {
    suggestions.push({
      type: 'coverage',
      severity: 'medium',
      message:
        'Missing Conventions section. Add a ## Conventions section to define naming, formatting, and coding style rules for this project.',
    });
  }

  if (!metrics.hasConstraints) {
    suggestions.push({
      type: 'coverage',
      severity: 'medium',
      message:
        'Missing Constraints section. Add a ## Constraints section to define technology restrictions, forbidden patterns, and hard boundaries.',
    });
  }

  if (!metrics.hasArchitecture) {
    suggestions.push({
      type: 'coverage',
      severity: 'medium',
      message:
        'Missing Architecture section. Add a ## Architecture section to define layer structure, dependency direction, and key design patterns.',
    });
  }

  // 4. Structure: low instruction density
  if (metrics.sectionCount > 0 && metrics.instructionDensity < 2) {
    suggestions.push({
      type: 'structure',
      severity: 'low',
      message: `Low instruction density (${metrics.instructionDensity.toFixed(1)} instructions/section). Sections should contain actionable directives, not just descriptions.`,
    });
  }

  return suggestions;
}
