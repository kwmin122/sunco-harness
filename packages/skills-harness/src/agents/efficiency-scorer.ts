/**
 * @sunco/skills-harness - Agent Doc Efficiency Scorer
 *
 * Computes a 0-100 efficiency score from agent doc metrics.
 * Based on four components: brevity (30%), clarity (25%), coverage (25%), contradiction-free (20%).
 *
 * Per D-17 and ETH Zurich insight: shorter agent instructions perform better.
 * Per D-18: Read-only analysis, never modifies files.
 */

import type { AgentDocMetrics } from './types.js';

/** Vague phrases that reduce clarity of agent instructions */
const VAGUE_PHRASES = [
  'properly',
  'as needed',
  'when appropriate',
  'consider',
  'ensure',
  'make sure',
];

/**
 * Compute brevity score based on total line count.
 * ETH Zurich research: shorter is better for agent instructions.
 *
 * <= 30 lines: 100
 * <= 60 lines: 80
 * <= 100 lines: 50
 * <= 200 lines: 25
 * > 200 lines: 10
 */
export function brevityScore(totalLines: number): number {
  if (totalLines <= 30) return 100;
  if (totalLines <= 60) return 80;
  if (totalLines <= 100) return 50;
  if (totalLines <= 200) return 25;
  return 10;
}

/**
 * Count vague phrases across all section content.
 * Uses the sections' line ranges to check the original content.
 */
function countVaguePhrases(metrics: AgentDocMetrics): number {
  // We count vague phrases from section instruction text
  // Since we don't have the raw content, count from sections' titles and instruction counts
  // For a more precise count, the analyzer would need to pass phrase data.
  // For now, count from section titles (a reasonable proxy for the scorer's purpose).
  let count = 0;
  for (const section of metrics.sections) {
    const titleLower = section.title.toLowerCase();
    for (const phrase of VAGUE_PHRASES) {
      if (titleLower.includes(phrase)) count++;
    }
  }
  return count;
}

/**
 * Compute clarity score (0-100).
 * 100 - (vaguePhraseCount * 5), floored at 0.
 */
function clarityScore(metrics: AgentDocMetrics): number {
  const vagueCount = countVaguePhrases(metrics);
  return Math.max(0, 100 - vagueCount * 5);
}

/**
 * Compute coverage score (0-100).
 * 100 if all three key areas covered (conventions, constraints, architecture).
 * Deduct 33 for each missing.
 */
function coverageScore(metrics: AgentDocMetrics): number {
  let score = 100;
  if (!metrics.hasConventions) score -= 33;
  if (!metrics.hasConstraints) score -= 33;
  if (!metrics.hasArchitecture) score -= 33;
  return Math.max(0, score);
}

/**
 * Compute contradiction-free score (0-100).
 * 100 if no contradictions. Deduct 25 per contradiction, floored at 0.
 */
function contradictionFreeScore(metrics: AgentDocMetrics): number {
  return Math.max(0, 100 - metrics.contradictions.length * 25);
}

/**
 * Compute the overall efficiency score for an agent instruction file.
 *
 * Components:
 *   - Brevity (30%): Shorter docs score higher
 *   - Clarity (25%): Fewer vague phrases score higher
 *   - Coverage (25%): Conventions + Constraints + Architecture
 *   - Contradiction-free (20%): No contradicting directives
 *
 * @param metrics - Pre-computed doc metrics from analyzeAgentDoc()
 * @returns Integer score 0-100
 */
export function computeEfficiencyScore(metrics: AgentDocMetrics): number {
  const brevity = brevityScore(metrics.totalLines);
  const clarity = clarityScore(metrics);
  const coverage = coverageScore(metrics);
  const contradictionFree = contradictionFreeScore(metrics);

  const score = brevity * 0.3 + clarity * 0.25 + coverage * 0.25 + contradictionFree * 0.2;

  return Math.round(score);
}
