/**
 * State reader - Parse STATE.md YAML frontmatter into structured data
 */

import type { ParsedState } from './types.js';

/**
 * Parse STATE.md content into structured state data.
 */
export function parseStateMd(_content: string): ParsedState {
  // Implemented in Task 2
  return {
    phase: null,
    plan: null,
    status: '',
    lastActivity: '',
    progress: {
      totalPhases: 0,
      completedPhases: 0,
      totalPlans: 0,
      completedPlans: 0,
      percent: 0,
    },
  };
}
