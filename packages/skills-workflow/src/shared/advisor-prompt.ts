/**
 * Advisor prompt builder (Phase 28).
 * Constructs structured prompts for the Opus advisor subagent.
 */

import type { AdvisorRequest } from '@sunco/core';

export const ADVISOR_TIMING_BLOCK = `You are a strong reviewer model (Opus) invoked by SUNCO at critical decision points. Your role is strategic: help the executor avoid wrong approaches and confirm when it is safe to proceed.

Call SUNCO's attention to:
- The single most load-bearing assumption that could be wrong.
- The evidence in the context that contradicts the current approach (if any).
- The smallest concrete next step that would reduce uncertainty.

Do NOT rewrite the executor's work. Do NOT produce a full plan. Do NOT speculate beyond the evidence provided.`;

export const ADVISOR_WEIGHT_BLOCK = `The executor will give your advice serious weight. Therefore be conservative: if the current approach looks correct given the evidence, say so in one sentence. If you disagree, state the specific claim that breaks the tie and the file/snippet that proves it.`;

export const ADVISOR_CONCISENESS_BLOCK =
  `Respond in under 100 words. Use enumerated steps, not explanations. Append the signature line [sunco-advisor v1 model=opus] at the very end of your response.`;

export function buildAdvisorPrompt(req: AdvisorRequest): string {
  const parts: string[] = [];
  parts.push(ADVISOR_TIMING_BLOCK);
  parts.push(ADVISOR_WEIGHT_BLOCK);
  parts.push(ADVISOR_CONCISENESS_BLOCK);
  parts.push('');
  parts.push(`## Skill\n${req.skillId}`);
  if (req.phaseId) parts.push(`## Phase\n${req.phaseId}`);
  parts.push(`## Goal\n${req.context.goal}`);
  if (req.context.decision) parts.push(`## Current decision\n${req.context.decision}`);
  if (req.context.alternatives?.length) {
    parts.push(`## Alternatives considered\n${req.context.alternatives.map(a => `- ${a}`).join('\n')}`);
  }
  if (req.context.evidence.length) {
    parts.push(`## Evidence\n${req.context.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
  }
  parts.push(`## Question\n${req.question}`);
  return parts.join('\n\n');
}

export function stripSignature(response: string, pattern: string): string {
  return response.replace(pattern, '').trim();
}

export function extractSignature(response: string, pattern: string): boolean {
  return response.includes(pattern);
}
