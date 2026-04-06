/**
 * Lifecycle hook system v2 — register/emit pattern for skill lifecycle events.
 *
 * Events:
 *   PreSkill     — before a skill starts executing
 *   PostSkill    — after a skill completes
 *   PreCompact   — before context compaction
 *   SessionStart — when a session begins
 *   SessionEnd   — when a session ends
 *
 * Hooks run sequentially in registration order. Each hook is wrapped in
 * try/catch so a failing hook never breaks the pipeline. Hook output is
 * capped at 10K characters (LH-12).
 *
 * Requirements: LH-11, LH-12, LH-13
 */

import { limitHookOutput, HOOK_OUTPUT_LIMIT } from './hook-output-limiter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HookEvent =
  | 'PreSkill'
  | 'PostSkill'
  | 'PreCompact'
  | 'SessionStart'
  | 'SessionEnd';

export interface HookDefinition {
  event: HookEvent;
  name: string;
  handler: (context: HookContext) => Promise<void>;
  enabled: boolean;
}

export interface HookContext {
  skillId?: string;
  phase?: number;
  zone?: string;
  timestamp: string;
}

export interface HookRunner {
  register(hook: HookDefinition): void;
  emit(event: HookEvent, context: HookContext): Promise<void>;
  list(): HookDefinition[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new hook runner instance.
 *
 * The runner maintains an internal registry of hooks. `emit()` fires all
 * enabled hooks for the given event in registration order.
 */
export function createHookRunner(): HookRunner {
  const hooks: HookDefinition[] = [];

  return {
    register(hook: HookDefinition): void {
      hooks.push(hook);
    },

    async emit(event: HookEvent, context: HookContext): Promise<void> {
      for (const hook of hooks) {
        if (hook.event !== event || !hook.enabled) continue;

        try {
          await hook.handler(context);
        } catch {
          // Hooks never throw — swallow errors silently.
          // In production, callers can wrap handlers with logging if needed.
        }
      }
    },

    list(): HookDefinition[] {
      return [...hooks];
    },
  };
}

// Re-export limiter constant so consumers don't need a second import
export { HOOK_OUTPUT_LIMIT };
