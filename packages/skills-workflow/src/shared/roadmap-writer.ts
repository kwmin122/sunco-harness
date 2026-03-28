/**
 * Roadmap writer - Add, insert, and remove phases in ROADMAP.md
 */

/**
 * Append a new phase with the next sequential integer number.
 */
export function addPhase(_content: string, _name: string, _description: string): string {
  // Implemented in Task 2
  return _content;
}

/**
 * Insert a phase as a decimal (e.g. 3.1) after the specified phase number.
 */
export function insertPhase(_content: string, _name: string, _description: string, _afterPhase: number): string {
  // Implemented in Task 2
  return _content;
}

export interface RemovePhaseResult {
  content: string;
  removed: boolean;
  reason?: string;
}

/**
 * Remove a phase if not started/completed, renumber subsequent phases.
 */
export function removePhase(_content: string, _phaseNumber: number | string): RemovePhaseResult {
  // Implemented in Task 2
  return { content: _content, removed: false, reason: 'not implemented' };
}
