/**
 * Roadmap parser - Extracts phase and progress data from ROADMAP.md
 *
 * Parses the standardized roadmap format:
 * - Phase list: "- [ ] **Phase N: Name** - description"
 * - Phase details: "### Phase N: Name" sections with requirements and plans
 * - Progress table: "| N. Name | X/Y | Status |"
 */

import type { ParsedPhase, ParsedProgress } from './types.js';

export interface ParseRoadmapResult {
  phases: ParsedPhase[];
  progress: ParsedProgress[];
}

/** Regex for phase list items: - [x] **Phase 3: Name** - description */
const PHASE_LINE_RE = /^- \[([ x])\] \*\*Phase (\d+(?:\.\d+)?): (.+?)\*\* - (.+)$/gm;

/** Regex for progress table rows: | 1. Core Platform | 12/12 | Complete | */
const PROGRESS_ROW_RE = /^\|\s*(\d+(?:\.\d+)?)\.\s*(.+?)\s*\|\s*(\d+)\/(\d+|\?)\s*\|\s*(.+?)\s*\|/gm;

/** Regex for plan list items: - [x] 01-01-PLAN.md -- desc */
const PLAN_LINE_RE = /^- \[([ x])\] (.+)$/gm;

/** Regex for requirements line: **Requirements**: REQ-01, REQ-02 */
const REQUIREMENTS_RE = /\*\*Requirements\*\*:\s*(.+)/;

/**
 * Parse a phase number string into a number or string (for decimals).
 * Integer phases return as number, decimal phases return as string.
 */
function parsePhaseNumber(raw: string): number | string {
  if (raw.includes('.')) {
    return raw.trim();
  }
  return parseInt(raw, 10);
}

/**
 * Parse ROADMAP.md content into structured phase and progress data.
 * Returns empty arrays for malformed or empty input (never throws).
 */
export function parseRoadmap(content: string): ParseRoadmapResult {
  if (!content || !content.trim()) {
    return { phases: [], progress: [] };
  }

  const phases = parsePhaseList(content);
  const details = parsePhaseDetails(content);
  const progress = parseProgressTable(content);

  // Merge detail info (requirements, plans) into phase objects
  for (const phase of phases) {
    const detail = details.get(String(phase.number));
    if (detail) {
      phase.requirements = detail.requirements;
      phase.plans = detail.plans;
      phase.completedCount = detail.plans.filter((p) => p.completed).length;
    }
  }

  // Also merge planCount from progress table
  for (const phase of phases) {
    const prog = progress.find((p) => String(p.phaseNumber) === String(phase.number));
    if (prog) {
      phase.planCount = prog.plansTotal;
    }
  }

  return { phases, progress };
}

/**
 * Extract phases from the phase list section.
 */
function parsePhaseList(content: string): ParsedPhase[] {
  const phases: ParsedPhase[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  PHASE_LINE_RE.lastIndex = 0;

  while ((match = PHASE_LINE_RE.exec(content)) !== null) {
    phases.push({
      number: parsePhaseNumber(match[2]),
      name: match[3].trim(),
      description: match[4].trim(),
      completed: match[1] === 'x',
      requirements: [],
      plans: [],
      planCount: null,
      completedCount: 0,
    });
  }

  return phases;
}

interface PhaseDetail {
  requirements: string[];
  plans: { name: string; completed: boolean }[];
}

/**
 * Extract per-phase details (requirements, plans) from ### Phase N sections.
 */
function parsePhaseDetails(content: string): Map<string, PhaseDetail> {
  const details = new Map<string, PhaseDetail>();

  // Split content into sections by ### Phase headers
  const sectionRe = /^### Phase (\d+(?:\.\d+)?): .+$/gm;
  const sectionStarts: { num: string; start: number }[] = [];
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRe.exec(content)) !== null) {
    sectionStarts.push({ num: sectionMatch[1], start: sectionMatch.index });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].start;
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].start : content.length;
    const section = content.slice(start, end);
    const phaseNum = sectionStarts[i].num;

    // Extract requirements
    const reqMatch = REQUIREMENTS_RE.exec(section);
    const requirements = reqMatch
      ? reqMatch[1]
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      : [];

    // Extract plan list items
    const plans: { name: string; completed: boolean }[] = [];

    // Find the "Plans:" line and extract plan items after it
    const plansLabelIdx = section.indexOf('Plans:');
    if (plansLabelIdx !== -1) {
      const plansSection = section.slice(plansLabelIdx);
      PLAN_LINE_RE.lastIndex = 0;
      let planMatch: RegExpExecArray | null;
      while ((planMatch = PLAN_LINE_RE.exec(plansSection)) !== null) {
        plans.push({
          name: planMatch[2].trim(),
          completed: planMatch[1] === 'x',
        });
      }
    }

    details.set(phaseNum, { requirements, plans });
  }

  return details;
}

/**
 * Extract rows from the progress table.
 */
function parseProgressTable(content: string): ParsedProgress[] {
  const rows: ParsedProgress[] = [];
  let match: RegExpExecArray | null;

  PROGRESS_ROW_RE.lastIndex = 0;

  while ((match = PROGRESS_ROW_RE.exec(content)) !== null) {
    rows.push({
      phaseNumber: parsePhaseNumber(match[1]),
      phaseName: match[2].trim(),
      plansComplete: parseInt(match[3], 10),
      plansTotal: match[4] === '?' ? null : parseInt(match[4], 10),
      status: match[5].trim(),
    });
  }

  return rows;
}
