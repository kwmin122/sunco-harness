/**
 * Iron Law Gate — "No fixes without confirmed root cause."
 *
 * Registers a PreToolUse hook that blocks Edit/Write tool calls
 * unless root cause has been confirmed in the IronLawState.
 *
 * Phase 23a — Iron Law Engine
 */

import type { HookDefinition, HookContext } from './lifecycle-hooks.js';
import type { IronLawState } from './debug-types.js';

// ---------------------------------------------------------------------------
// Error class for hook abort
// ---------------------------------------------------------------------------

/**
 * Thrown by hooks with canAbort=true to block tool execution.
 * The lifecycle-hooks runner re-throws this instead of swallowing it.
 */
export class HookAbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HookAbortError';
  }
}

// ---------------------------------------------------------------------------
// Blocked tool names
// ---------------------------------------------------------------------------

const BLOCKED_TOOLS = new Set(['Edit', 'Write', 'edit', 'write']);

// ---------------------------------------------------------------------------
// Gate logic
// ---------------------------------------------------------------------------

/**
 * Check if edits should be blocked based on Iron Law state.
 */
export function isEditBlocked(state: IronLawState): boolean {
  return !state.rootCauseConfirmed && state.editBlocked;
}

/**
 * Confirm a hypothesis as the root cause — unblocks edits.
 */
export function confirmRootCause(
  state: IronLawState,
  hypothesis: string,
): IronLawState {
  return {
    ...state,
    rootCauseConfirmed: true,
    editBlocked: false,
    hypotheses: state.hypotheses.map((h) =>
      h.description === hypothesis
        ? { ...h, tested: true, result: 'confirmed' as const }
        : h,
    ),
  };
}

/**
 * Reject a hypothesis — edits remain blocked.
 */
export function rejectHypothesis(
  state: IronLawState,
  hypothesis: string,
): IronLawState {
  return {
    ...state,
    hypotheses: state.hypotheses.map((h) =>
      h.description === hypothesis
        ? { ...h, tested: true, result: 'rejected' as const }
        : h,
    ),
  };
}

/**
 * Create a fresh IronLawState for a new debug session.
 */
export function createIronLawState(phase: number): IronLawState {
  return {
    rootCauseConfirmed: false,
    hypotheses: [],
    editBlocked: true,
    phase,
  };
}

/**
 * Add a hypothesis to the Iron Law state.
 */
export function addHypothesis(
  state: IronLawState,
  description: string,
): IronLawState {
  return {
    ...state,
    hypotheses: [
      ...state.hypotheses,
      { description, tested: false, result: 'pending' as const },
    ],
  };
}

// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------

/**
 * Create a PreToolUse hook that enforces the Iron Law.
 *
 * The hook checks if the tool being invoked is Edit or Write.
 * If root cause is not confirmed, it throws HookAbortError
 * to block the tool call.
 *
 * @param getState - Function that returns current IronLawState
 *   (must be a getter since state changes during the session)
 */
export function createIronLawGate(
  getState: () => IronLawState,
): HookDefinition {
  return {
    event: 'PreToolUse' as HookDefinition['event'],
    name: 'iron-law-gate',
    enabled: true,
    canAbort: true,
    handler: async (context: HookContext) => {
      const toolName = context.toolName;
      if (!toolName || !BLOCKED_TOOLS.has(toolName)) return;

      const state = getState();
      if (isEditBlocked(state)) {
        throw new HookAbortError(
          'Iron Law: confirm root cause before editing. ' +
            `Hypotheses tested: ${state.hypotheses.filter((h) => h.tested).length}, ` +
            `confirmed: ${state.hypotheses.filter((h) => h.result === 'confirmed').length}`,
        );
      }
    },
  };
}
