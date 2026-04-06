/**
 * Adaptive Timeout — skill-aware timeout calculation.
 *
 * Maps skill kind and complexity to appropriate timeout durations.
 * Deterministic skills always get the shortest timeout; prompt-based
 * skills scale with complexity.
 *
 * Requirements: LH-17
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeoutProfile = 'simple' | 'standard' | 'complex' | 'research';

export interface TimeoutConfig {
  /** Simple tasks: 5 minutes */
  simple: number;
  /** Standard tasks: 30 minutes */
  standard: number;
  /** Complex tasks: 60 minutes */
  complex: number;
  /** Research tasks: 60 minutes */
  research: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_TIMEOUTS: TimeoutConfig = {
  simple: 5 * 60 * 1000,       // 300_000
  standard: 30 * 60 * 1000,    // 1_800_000
  complex: 60 * 60 * 1000,     // 3_600_000
  research: 60 * 60 * 1000,    // 3_600_000
};

// ---------------------------------------------------------------------------
// Timeout Selection
// ---------------------------------------------------------------------------

/**
 * Determine the appropriate timeout for a skill invocation.
 *
 * Rules:
 *  - deterministic skills: always simple (5 min) — they never need LLM time
 *  - prompt + simple: simple (5 min)
 *  - prompt + standard/undefined: standard (30 min)
 *  - prompt + complex: complex (60 min)
 *  - hybrid: use complexity if provided, else standard
 *
 * @param skillKind - The skill's execution kind
 * @param complexity - Optional complexity hint
 * @param overrides - Optional per-profile timeout overrides
 * @returns Timeout in milliseconds
 */
export function getAdaptiveTimeout(
  skillKind: 'deterministic' | 'prompt' | 'hybrid',
  complexity?: 'simple' | 'standard' | 'complex',
  overrides?: Partial<TimeoutConfig>,
): number {
  const timeouts: TimeoutConfig = { ...DEFAULT_TIMEOUTS, ...overrides };

  // Deterministic skills never need long timeouts
  if (skillKind === 'deterministic') {
    return timeouts.simple;
  }

  // Prompt-based skills scale with complexity
  if (skillKind === 'prompt') {
    if (complexity === 'simple') return timeouts.simple;
    if (complexity === 'complex') return timeouts.complex;
    return timeouts.standard; // default for 'standard' or undefined
  }

  // Hybrid: respect complexity hint, default to standard
  if (complexity === 'simple') return timeouts.simple;
  if (complexity === 'complex') return timeouts.complex;
  return timeouts.standard;
}
