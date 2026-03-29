/**
 * Milestone helpers for sunco milestone lifecycle management.
 *
 * Provides archive operations, state reset, audit result parsing,
 * and gap-phase generation for milestone transitions.
 *
 * Requirements: SHP-01, SHP-02, WF-03, WF-04
 * Decisions: D-10 (archive without clobbering), D-12 (gap phases)
 */

import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { addPhase } from './roadmap-writer.js';

/**
 * Archive the current milestone planning artifacts.
 *
 * Copies `.planning/phases/`, `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`,
 * and `PROJECT.md` to `.planning/archive/{milestoneName}/`.
 * Does NOT delete originals (Pitfall 5: copy, don't move).
 *
 * @param cwd - Workspace root directory
 * @param milestoneName - Name for the archive directory
 * @returns Absolute path to the archive directory
 */
export async function archiveMilestone(cwd: string, milestoneName: string): Promise<string> {
  const planningDir = join(cwd, '.planning');
  const archiveDir = join(planningDir, 'archive', milestoneName);

  await mkdir(archiveDir, { recursive: true });

  // Copy planning artifacts to archive
  const artifactsToCopy = [
    { src: 'phases', isDir: true },
    { src: 'STATE.md', isDir: false },
    { src: 'ROADMAP.md', isDir: false },
    { src: 'REQUIREMENTS.md', isDir: false },
    { src: 'PROJECT.md', isDir: false },
  ];

  for (const artifact of artifactsToCopy) {
    const srcPath = join(planningDir, artifact.src);
    const destPath = join(archiveDir, artifact.src);

    try {
      await cp(srcPath, destPath, { recursive: artifact.isDir });
    } catch {
      // Skip missing artifacts (e.g., REQUIREMENTS.md may not exist)
    }
  }

  return archiveDir;
}

/**
 * Reset STATE.md for a new milestone.
 *
 * Writes a fresh STATE.md with the new milestone name, phase 1,
 * and plan not started.
 *
 * @param cwd - Workspace root directory
 * @param milestoneName - Name of the new milestone
 */
export async function resetStateForNewMilestone(cwd: string, milestoneName: string): Promise<void> {
  const statePath = join(cwd, '.planning', 'STATE.md');
  const now = new Date().toISOString().slice(0, 10);

  const content = `---
gsd_state_version: 1.0
milestone: ${milestoneName}
milestone_name: ${milestoneName}
status: planning
stopped_at: New milestone initialized
last_updated: "${new Date().toISOString()}"
last_activity: ${now} -- New milestone ${milestoneName} initialized
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 1 -- PLANNING
Plan: Not started
Status: Planning Phase 1
Last activity: ${now} -- New milestone ${milestoneName} initialized

Progress: [..........] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

## Accumulated Context

### Decisions

None yet.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: ${new Date().toISOString()}
Stopped at: New milestone initialized
Resume file: None
`;

  await writeFile(statePath, content, 'utf-8');
}

/**
 * Parse an agent-generated milestone audit report.
 *
 * Extracts score, met requirements, and unmet requirements from
 * the audit JSON output.
 *
 * @param auditReport - Raw audit report string (expected JSON)
 * @returns Parsed audit result with score and requirement lists
 */
export function parseMilestoneAudit(auditReport: string): {
  score: number;
  met: string[];
  unmet: string[];
} {
  try {
    // Try to extract JSON from the report (may be wrapped in markdown code block)
    const jsonMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(auditReport);
    const jsonStr = jsonMatch ? jsonMatch[1] : auditReport;
    const parsed = JSON.parse(jsonStr.trim()) as {
      score?: number;
      met?: string[];
      unmet?: string[];
    };

    return {
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      met: Array.isArray(parsed.met) ? parsed.met : [],
      unmet: Array.isArray(parsed.unmet) ? parsed.unmet : [],
    };
  } catch {
    // Fallback: try to extract score and requirement IDs via regex
    const scoreMatch = /score["\s:]+(\d+)/i.exec(auditReport);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

    const metMatch = /met["\s:]+\[(.*?)\]/is.exec(auditReport);
    const unmetMatch = /unmet["\s:]+\[(.*?)\]/is.exec(auditReport);

    const extractIds = (raw: string | undefined): string[] => {
      if (!raw) return [];
      return raw
        .split(',')
        .map((s) => s.replace(/["'\s]/g, ''))
        .filter(Boolean);
    };

    return {
      score,
      met: extractIds(metMatch?.[1]),
      unmet: extractIds(unmetMatch?.[1]),
    };
  }
}

/**
 * Generate catch-up phases for unmet requirements and append them
 * to the roadmap content.
 *
 * Groups unmet requirements and calls `addPhase()` from roadmap-writer
 * for each group.
 *
 * @param unmetReqs - Array of unmet requirement IDs
 * @param roadmapContent - Current ROADMAP.md content
 * @returns Updated roadmap content with new catch-up phases
 */
export function buildGapPhases(unmetReqs: string[], roadmapContent: string): string {
  if (unmetReqs.length === 0) return roadmapContent;

  // Group requirements by prefix (e.g., AUTH-01, AUTH-02 -> AUTH group)
  const groups = new Map<string, string[]>();
  for (const req of unmetReqs) {
    const prefix = req.replace(/-\d+$/, '');
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix)!.push(req);
  }

  let result = roadmapContent;

  for (const [prefix, reqs] of groups) {
    const name = `${prefix} Gap Resolution`;
    const description = `Address unmet requirements: ${reqs.join(', ')}`;
    result = addPhase(result, name, description);
  }

  return result;
}
