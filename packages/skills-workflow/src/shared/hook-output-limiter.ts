/**
 * Hook output limiter — enforces 10K character cap on hook output.
 *
 * Hooks can produce arbitrary output; this utility truncates to a safe
 * limit and signals when truncation occurred so callers can log a warning.
 *
 * Requirements: LH-12
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters allowed in a single hook's output. */
export const HOOK_OUTPUT_LIMIT = 10_000;

// ---------------------------------------------------------------------------
// Limiter
// ---------------------------------------------------------------------------

export interface LimitResult {
  text: string;
  truncated: boolean;
  originalLength: number;
}

/**
 * Truncate hook output to HOOK_OUTPUT_LIMIT characters.
 *
 * If the output exceeds the limit, the returned text is cut at the limit
 * boundary and a `[truncated]` marker is appended.
 */
export function limitHookOutput(output: string): LimitResult {
  const originalLength = output.length;

  if (originalLength <= HOOK_OUTPUT_LIMIT) {
    return { text: output, truncated: false, originalLength };
  }

  const truncated = output.slice(0, HOOK_OUTPUT_LIMIT);
  const marker = `\n[truncated: ${originalLength} chars exceeded ${HOOK_OUTPUT_LIMIT} limit]`;

  return {
    text: truncated + marker,
    truncated: true,
    originalLength,
  };
}
