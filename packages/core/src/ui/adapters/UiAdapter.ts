/**
 * @sunco/core - Renderer-facing UI Adapter Contract
 *
 * UiAdapter is what rendering backends (Ink, Silent, SUN Terminal) implement.
 * SkillUi delegates to UiAdapter via pattern mounting.
 *
 * Decisions: D-38 (two-layer separation), D-39 (adapter swappable)
 */

// ---------------------------------------------------------------------------
// UI Pattern Types
// ---------------------------------------------------------------------------

/** Kinds of UI patterns that can be mounted */
export type UiPatternKind = 'entry' | 'ask' | 'progress' | 'result';

/**
 * A UI pattern to mount in the adapter.
 * The adapter renders the appropriate component for the pattern kind.
 */
export interface UiPattern {
  /** Unique handle ID for this mounted pattern instance */
  handleId: string;

  /** Kind of pattern to render */
  kind: UiPatternKind;

  /** Pattern-specific data (matches the corresponding *Input type from SkillUi) */
  data: Record<string, unknown>;
}

/**
 * Outcome from a mounted pattern (e.g., user's choice from 'ask' pattern).
 * Undefined for patterns that don't produce output (e.g., 'entry').
 */
export interface UiOutcome {
  /** Pattern kind that produced this outcome */
  kind: UiPatternKind;

  /** Pattern-specific result data */
  data?: Record<string, unknown>;
}

/**
 * Incremental update to a mounted pattern (e.g., progress update).
 */
export interface UiPatch {
  /** Fields to update (partial pattern data) */
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// UiAdapter Interface (D-38, D-39: renderer-facing contract)
// ---------------------------------------------------------------------------

/**
 * Renderer-facing UI adapter interface.
 *
 * Implementations:
 * - InkUiAdapter: Default interactive terminal UI (Ink + React)
 * - SilentUiAdapter: CI/test/--json/batch mode (no interactive output)
 * - (future) SunTerminalUiAdapter: SUN Terminal native app
 *
 * SkillUi translates skill intent (entry/ask/progress/result) into
 * UiPattern mount/update/dispose calls on the adapter.
 */
export interface UiAdapter {
  /**
   * Mount a UI pattern and wait for its outcome.
   * For interactive patterns (ask), resolves when user makes selection.
   * For display patterns (entry, result), resolves after rendering.
   */
  mountPattern(pattern: UiPattern): Promise<UiOutcome>;

  /**
   * Send an incremental update to a mounted pattern.
   * Used for progress updates during long-running operations.
   */
  update(handleId: string, patch: UiPatch): void;

  /**
   * Dispose a mounted pattern (clean up rendering resources).
   * Called after pattern completes or on abort.
   */
  dispose(handleId: string): void;
}
