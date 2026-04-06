/**
 * Context Rotation Engine — manages infinite execution sessions.
 *
 * Evaluates context window utilization and determines whether the
 * current session should continue, rotate (start fresh session with
 * handoff), or compact (summarize and continue).
 *
 * Requirements: LH-16
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RotationConfig {
  /** Context utilization threshold to start suggesting rotation (default 70) */
  thresholdPercent: number;
  /** Maximum number of recent sessions to keep for context (default 3) */
  maxSessionsToKeep: number;
}

export interface RotationResult {
  /** Whether rotation is recommended */
  shouldRotate: boolean;
  /** Current context utilization percentage */
  currentPercent: number;
  /** Recommended action */
  action: 'continue' | 'save-and-rotate' | 'save-and-compact';
  /** CLI command to resume in a new session */
  resumeCommand: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: RotationConfig = {
  thresholdPercent: 70,
  maxSessionsToKeep: 3,
};

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the current session should rotate based on
 * context window utilization.
 *
 * Zones:
 *  - < 70%:    continue (no action needed)
 *  - 70-84%:   save-and-rotate (suggest new session with handoff)
 *  - 85%+:     save-and-compact (auto-compact is imminent)
 *
 * @param contextPercent - Current context utilization (0-100)
 * @param config - Optional partial config overrides
 * @returns Rotation evaluation result
 */
export function evaluateRotation(
  contextPercent: number,
  config?: Partial<RotationConfig>,
): RotationResult {
  const cfg: RotationConfig = { ...DEFAULT_CONFIG, ...config };
  const threshold = cfg.thresholdPercent;
  const compactThreshold = threshold + 15; // 85% by default

  if (contextPercent >= compactThreshold) {
    return {
      shouldRotate: true,
      currentPercent: contextPercent,
      action: 'save-and-compact',
      resumeCommand: 'sunco resume --compact',
    };
  }

  if (contextPercent >= threshold) {
    return {
      shouldRotate: true,
      currentPercent: contextPercent,
      action: 'save-and-rotate',
      resumeCommand: 'sunco resume',
    };
  }

  return {
    shouldRotate: false,
    currentPercent: contextPercent,
    action: 'continue',
    resumeCommand: '',
  };
}
