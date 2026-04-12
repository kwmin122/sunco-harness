/**
 * @sunco/skills-workflow - Assumption Preview Shared Module
 *
 * Pure functions for assumption preview logic, extracted from assume.skill.ts
 * as part of Phase 33 Wave 2 absorption into plan --assume.
 *
 * No SkillContext dependency — all dependencies injected explicitly.
 */

import type { AgentRequest, AgentResult } from '@sunco/core';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAssumePrompt } from '../prompts/assume.js';
import { resolvePhaseDir, readPhaseArtifactSmart } from './phase-reader.js';
import { readContextZone } from './context-zones.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Assumption {
  id: string;
  area: string;
  assumption: string;
  confidence: string;
  rationale: string;
  alternative: string;
}

export interface Correction {
  assumptionId: string;
  area: string;
  text: string;
}

export interface AssumeOptions {
  cwd: string;
  phaseNumber: number | null;
  phaseArg?: unknown;
  agentRun: (request: AgentRequest) => Promise<AgentResult>;
  uiAsk: (input: { message: string; options: Array<{ id: string; label: string; isRecommended?: boolean }> }) => Promise<{ selectedId: string }>;
  uiAskText: (input: { message: string }) => Promise<{ text: string }>;
  log: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };
}

export interface AssumeResult {
  success: boolean;
  summary: string;
  assumptions: Assumption[];
  corrections: Correction[];
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Extract current phase number from STATE.md.
 */
export function extractPhaseFromState(stateMd: string): number | null {
  const match = /^Phase:\s*(\d+)/m.exec(stateMd);
  if (match) {
    return parseInt(match[1]!, 10);
  }
  return null;
}

/**
 * Parse agent output into Assumption objects.
 * Splits on ---ASSUMPTION--- separator and extracts fields.
 */
export function parseAssumptions(agentOutput: string): Assumption[] {
  const blocks = agentOutput.split('---ASSUMPTION---').filter((b) => b.trim());
  const assumptions: Assumption[] = [];

  for (const block of blocks) {
    const id = extractField(block, 'ID');
    const area = extractField(block, 'AREA');
    const assumption = extractField(block, 'ASSUMPTION');
    const confidence = extractField(block, 'CONFIDENCE');
    const rationale = extractField(block, 'RATIONALE');
    const alternative = extractField(block, 'ALTERNATIVE');

    // Skip blocks missing required fields
    if (!id || !assumption) continue;

    assumptions.push({
      id,
      area: area || 'General',
      assumption,
      confidence: confidence || 'MEDIUM',
      rationale: rationale || '',
      alternative: alternative || '',
    });
  }

  return assumptions;
}

/**
 * Extract a field value from an assumption block.
 * Matches "FIELD: value" pattern (value can span to next field line).
 */
export function extractField(block: string, fieldName: string): string {
  const re = new RegExp(`^${fieldName}:\\s*(.+?)(?=\\n[A-Z]+:|$)`, 'ms');
  const match = re.exec(block);
  return match ? match[1]!.trim() : '';
}

/**
 * Find the highest decision number in CONTEXT.md.
 * Looks for "D-{N}:" patterns.
 */
export function findLastDecisionNumber(contextMd: string): number {
  const re = /\bD-(\d+):/g;
  let max = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contextMd)) !== null) {
    const num = parseInt(match[1]!, 10);
    if (num > max) max = num;
  }
  return max;
}

/**
 * Append corrections as new locked decisions to CONTEXT.md.
 * Inserts before </decisions> tag or before "### Claude's Discretion" if present.
 * CRITICAL: Read-modify-write pattern (Pitfall 6 from RESEARCH.md).
 */
export function appendCorrections(contextMd: string, corrections: Correction[]): string {
  if (corrections.length === 0) return contextMd;

  const lastNum = findLastDecisionNumber(contextMd);
  const newDecisions: string[] = [];

  for (let i = 0; i < corrections.length; i++) {
    const c = corrections[i]!;
    const decNum = lastNum + i + 1;
    newDecisions.push(
      `- **D-${String(decNum).padStart(2, '0')}:** [CORRECTION from assume] ${c.text} (corrects assumption ${c.assumptionId})`,
    );
  }

  const insertBlock = '\n' + newDecisions.join('\n') + '\n';

  // Try to insert before "### Claude's Discretion" first
  const discretionIdx = contextMd.indexOf("### Claude's Discretion");
  if (discretionIdx !== -1) {
    return contextMd.slice(0, discretionIdx) + insertBlock + '\n' + contextMd.slice(discretionIdx);
  }

  // Otherwise insert before </decisions> tag
  const closingTag = '</decisions>';
  const closingIdx = contextMd.indexOf(closingTag);
  if (closingIdx !== -1) {
    return contextMd.slice(0, closingIdx) + insertBlock + contextMd.slice(closingIdx);
  }

  // Fallback: append at end
  return contextMd + insertBlock;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

const ASSUME_PERMISSIONS = {
  role: 'planning' as const,
  readPaths: ['**'],
  writePaths: [] as string[],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [] as string[],
};

/**
 * Run the full assumption preview pipeline with explicit dependencies (no SkillContext).
 */
export async function runAssumptionPreview(opts: AssumeOptions): Promise<AssumeResult> {
  const { cwd, phaseNumber, agentRun, uiAsk, uiAskText, log } = opts;

  if (phaseNumber === null) {
    return {
      success: false,
      summary: 'Cannot determine phase number. Provide --phase or ensure STATE.md exists.',
      assumptions: [],
      corrections: [],
    };
  }

  const padded = String(phaseNumber).padStart(2, '0');
  const zoneData = await readContextZone(cwd);
  const contextZone = zoneData?.zone ?? 'green';

  const smartResult = await readPhaseArtifactSmart(cwd, phaseNumber, `${padded}-CONTEXT.md`, {
    currentPhase: phaseNumber,
    contextZone,
  });
  const contextMd = smartResult.content;

  if (!contextMd) {
    return {
      success: false,
      summary: 'No CONTEXT.md found. Run sunco discuss first.',
      assumptions: [],
      corrections: [],
    };
  }

  const roadmapMd = await readFile(join(cwd, '.planning', 'ROADMAP.md'), 'utf-8').catch(
    () => 'ROADMAP.md not available.',
  );

  // Extract phase goal from ROADMAP.md
  const goalRe = new RegExp(`Phase\\s+${phaseNumber}[^\\n]*\\n([^\\n]+)`, 'i');
  const goalMatch = goalRe.exec(roadmapMd);
  const phaseGoal = goalMatch ? goalMatch[1]!.trim() : `Phase ${phaseNumber} implementation`;

  const agentResult = await agentRun({
    role: 'planning',
    prompt: buildAssumePrompt({
      contextMd,
      roadmapMd,
      phaseGoal,
      requirements: [],
      codebaseContext: '',
    }),
    permissions: ASSUME_PERMISSIONS,
    timeout: 120_000,
  });

  if (!agentResult.success) {
    return {
      success: false,
      summary: 'Assume agent failed. Check agent logs for details.',
      assumptions: [],
      corrections: [],
    };
  }

  const assumptions = parseAssumptions(agentResult.outputText);

  // Interactive review: present each assumption to user
  const corrections: Correction[] = [];

  for (const assumption of assumptions) {
    const result = await uiAsk({
      message: `[${assumption.confidence}] ${assumption.area}: ${assumption.assumption}`,
      options: [
        { id: 'approve', label: 'Correct', isRecommended: true },
        { id: 'correct', label: 'Needs correction' },
      ],
    });

    if (result.selectedId === 'correct') {
      const textResult = await uiAskText({
        message: 'What should be done instead?',
      });
      if (textResult.text) {
        corrections.push({
          assumptionId: assumption.id,
          area: assumption.area,
          text: textResult.text,
        });
      }
    }
  }

  // Append corrections to CONTEXT.md (D-06)
  if (corrections.length > 0) {
    // Re-read CONTEXT.md for read-modify-write safety (Pitfall 6)
    const freshRead = await readPhaseArtifactSmart(cwd, phaseNumber, `${padded}-CONTEXT.md`, {
      currentPhase: phaseNumber,
      contextZone,
    });
    const freshContextMd = freshRead.content;
    if (freshContextMd) {
      const updated = appendCorrections(freshContextMd, corrections);
      const phaseDir = await resolvePhaseDir(cwd, phaseNumber);
      if (phaseDir) {
        await writeFile(join(phaseDir, `${padded}-CONTEXT.md`), updated, 'utf-8');
        log.info('CONTEXT.md updated with corrections', { count: corrections.length });
      }
    }
  }

  const approved = assumptions.length - corrections.length;
  const summary = `Reviewed ${assumptions.length} assumptions. ${approved} approved, ${corrections.length} corrected.`;

  return {
    success: true,
    summary,
    assumptions,
    corrections,
  };
}
