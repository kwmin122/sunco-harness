/**
 * Advisor runtime matrix — single source of truth for what works where.
 *
 * Claude Code owns the ambient UX (UserPromptSubmit, PostToolUse hooks).
 * Codex CLI, Cursor, Antigravity get the engine + the /sunco:advisor skill
 * but no ambient injection — they fall back to manual invocation with
 * `--json` output that a caller can parse.
 *
 * This matrix is consumed by:
 *   - installer.cjs (decides which hooks to register per runtime)
 *   - /sunco:advisor skill (warns when the ambient path is unavailable)
 *   - contract-lint (asserts the matrix stays in sync with reality)
 */

export type RuntimeId = 'claude' | 'codex' | 'cursor' | 'antigravity';

export interface AdvisorRuntimeSupport {
  runtime: RuntimeId;
  /** Registers the ambient UserPromptSubmit hook. */
  ambientPromptHook: boolean;
  /** Registers the PostToolUse queue hook. */
  postActionHook: boolean;
  /** Ships `/sunco:advisor` skill / command. */
  manualSkill: boolean;
  /** Ships structured `--json` output usable by external callers. */
  jsonOutput: boolean;
  /** Short description for docs. */
  notes: string;
}

export const ADVISOR_RUNTIME_MATRIX: readonly AdvisorRuntimeSupport[] = [
  {
    runtime: 'claude',
    ambientPromptHook: true,
    postActionHook: true,
    manualSkill: true,
    jsonOutput: true,
    notes: 'full ambient advisor — hooks + skill',
  },
  {
    runtime: 'codex',
    ambientPromptHook: false,
    postActionHook: false,
    manualSkill: true,
    jsonOutput: true,
    notes: 'skill + --json only; no hook injection (Codex has its own shell)',
  },
  {
    runtime: 'cursor',
    ambientPromptHook: false,
    postActionHook: false,
    manualSkill: true,
    jsonOutput: true,
    notes: 'skill + --json only; hooks not surfaced in Cursor skill-pack format',
  },
  {
    runtime: 'antigravity',
    ambientPromptHook: false,
    postActionHook: false,
    manualSkill: true,
    jsonOutput: true,
    notes: 'partial — skill only, hook registration pending upstream support',
  },
] as const;

export function supportFor(runtime: RuntimeId): AdvisorRuntimeSupport {
  const match = ADVISOR_RUNTIME_MATRIX.find((r) => r.runtime === runtime);
  if (!match) {
    throw new Error(`Unknown runtime: ${runtime}`);
  }
  return match;
}
