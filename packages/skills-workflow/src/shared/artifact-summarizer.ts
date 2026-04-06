/**
 * Artifact Summarizer — deterministic artifact compression.
 *
 * Summarizes phase artifacts (CONTEXT.md, PLAN.md) into 3-line
 * summaries for selective loading. Zero LLM cost.
 *
 * Algorithm:
 *   1. Extract first heading as title
 *   2. Extract first paragraph (truncate at 200 chars) as description
 *   3. Extract D-NNN decision entries
 *   4. Calculate token reduction percentage
 *
 * Requirements: LH-03, LH-05
 */

import type { ContextZone } from './context-zones.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArtifactSummary {
  phaseNumber: number;
  filename: string;
  summary: string;
  keyDecisions: string[];
  status: string;
  originalTokens: number;
  summaryTokens: number;
  reductionPercent: number;
}

export interface ArtifactLoadPlan {
  phases: Array<{
    phaseNumber: number;
    artifacts: Array<{
      filename: string;
      mode: 'full' | 'summary' | 'skip';
      estimatedTokens: number;
    }>;
  }>;
  totalEstimatedTokens: number;
  totalOriginalTokens: number;
  reductionPercent: number;
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Estimate token count from text (rough: 1 token ≈ 4 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Summarizer
// ---------------------------------------------------------------------------

/**
 * Create a deterministic 3-line summary of an artifact.
 *
 * @param content - Full artifact content
 * @param phaseNumber - Phase number
 * @param filename - Artifact filename
 * @returns Summary with token reduction stats
 */
export function summarizeArtifact(
  content: string,
  phaseNumber: number,
  filename: string,
): ArtifactSummary {
  const lines = content.split('\n');

  // Extract title (first # heading)
  const titleLine = lines.find((l) => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^#+\s*/, '').trim() : `Phase ${phaseNumber}`;

  // Extract status from frontmatter or headings
  const statusMatch = content.match(/status:\s*(.+)/i) ?? content.match(/Status:\s*(.+)/i);
  const status = statusMatch ? statusMatch[1]!.trim() : 'unknown';

  // Extract first non-heading, non-empty paragraph (up to 200 chars)
  let description = '';
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('---') || line.trim() === '') continue;
    if (line.startsWith('- ') || line.startsWith('* ')) continue;
    description = line.trim().slice(0, 200);
    break;
  }

  // Extract D-NNN decisions
  const decisions: string[] = [];
  const decisionRegex = /D-(\d+)[:\s]+(.+)/g;
  let match: RegExpExecArray | null;
  while ((match = decisionRegex.exec(content)) !== null) {
    decisions.push(`D-${match[1]}: ${match[2]!.trim().slice(0, 100)}`);
  }

  // Build 3-line summary
  const summaryText = [
    `[Phase ${phaseNumber}] ${title}`,
    description || '(no description)',
    decisions.length > 0 ? `Decisions: ${decisions.slice(0, 3).join('; ')}` : `Status: ${status}`,
  ].join('\n');

  const originalTokens = estimateTokens(content);
  const summaryTokens = estimateTokens(summaryText);
  const reductionPercent =
    originalTokens > 0 ? Math.round(((originalTokens - summaryTokens) / originalTokens) * 100) : 0;

  return {
    phaseNumber,
    filename,
    summary: summaryText,
    keyDecisions: decisions,
    status,
    originalTokens,
    summaryTokens,
    reductionPercent,
  };
}

// ---------------------------------------------------------------------------
// Load Planning
// ---------------------------------------------------------------------------

/**
 * Plan which artifacts to load in full, summary, or skip mode.
 *
 * Rules:
 *   - Current phase: always full
 *   - Completed phase + Green/Yellow: full
 *   - Completed phase + Orange: summary
 *   - Completed phase + Red: skip
 *   - maxTokenBudget: skip lowest-priority (oldest completed) first
 *
 * @returns Load plan with estimated token counts and reduction %
 */
export function planArtifactLoading(
  phases: Array<{ number: number; completed: boolean; artifacts: string[] }>,
  currentPhase: number,
  contextZone: ContextZone,
  maxTokenBudget?: number,
): ArtifactLoadPlan {
  const plan: ArtifactLoadPlan = {
    phases: [],
    totalEstimatedTokens: 0,
    totalOriginalTokens: 0,
    reductionPercent: 0,
  };

  // Sort phases by number (ascending) for priority ordering
  const sorted = [...phases].sort((a, b) => a.number - b.number);

  for (const phase of sorted) {
    const isCurrent = phase.number === currentPhase;
    const artifacts: ArtifactLoadPlan['phases'][0]['artifacts'] = [];

    for (const filename of phase.artifacts) {
      // Rough estimate: average artifact is ~2KB = ~500 tokens
      const estimatedFullTokens = 500;
      const estimatedSummaryTokens = 50;

      let mode: 'full' | 'summary' | 'skip';

      if (isCurrent) {
        mode = 'full';
      } else if (!phase.completed) {
        mode = 'full';
      } else if (contextZone === 'red') {
        mode = 'skip';
      } else if (contextZone === 'orange') {
        mode = 'summary';
      } else {
        mode = 'full';
      }

      const estimatedTokens = mode === 'full' ? estimatedFullTokens : mode === 'summary' ? estimatedSummaryTokens : 0;

      artifacts.push({ filename, mode, estimatedTokens });
      plan.totalEstimatedTokens += estimatedTokens;
      plan.totalOriginalTokens += estimatedFullTokens;
    }

    plan.phases.push({ phaseNumber: phase.number, artifacts });
  }

  // Apply maxTokenBudget by downgrading oldest completed phases first
  if (maxTokenBudget !== undefined && plan.totalEstimatedTokens > maxTokenBudget) {
    // Walk from oldest to newest completed phases, downgrading
    for (const phasePlan of plan.phases) {
      if (plan.totalEstimatedTokens <= maxTokenBudget) break;

      const phaseData = sorted.find((p) => p.number === phasePlan.phaseNumber);
      if (!phaseData?.completed || phaseData.number === currentPhase) continue;

      for (const artifact of phasePlan.artifacts) {
        if (plan.totalEstimatedTokens <= maxTokenBudget) break;

        if (artifact.mode === 'full') {
          plan.totalEstimatedTokens -= artifact.estimatedTokens - 50;
          artifact.estimatedTokens = 50;
          artifact.mode = 'summary';
        } else if (artifact.mode === 'summary') {
          plan.totalEstimatedTokens -= artifact.estimatedTokens;
          artifact.estimatedTokens = 0;
          artifact.mode = 'skip';
        }
      }
    }
  }

  plan.reductionPercent =
    plan.totalOriginalTokens > 0
      ? Math.round(((plan.totalOriginalTokens - plan.totalEstimatedTokens) / plan.totalOriginalTokens) * 100)
      : 0;

  return plan;
}
