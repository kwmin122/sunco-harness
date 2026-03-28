/**
 * Roadmap parser - Extracts phase and progress data from ROADMAP.md
 */

import type { ParsedPhase, ParsedProgress } from './types.js';

export interface ParseRoadmapResult {
  phases: ParsedPhase[];
  progress: ParsedProgress[];
}

/**
 * Parse ROADMAP.md content into structured phase and progress data.
 */
export function parseRoadmap(_content: string): ParseRoadmapResult {
  // Implemented in Task 2
  return { phases: [], progress: [] };
}
