/**
 * @sunco/core - SkillProgress Pattern (Layer 3)
 *
 * Progress display supporting determinate (bar) and indeterminate (spinner) modes.
 * Maps to the "running" phase of the skill state machine:
 * idle -> entry -> choice? -> [running] -> result
 *
 * Parent component manages state; this renders current progress.
 *
 * Decisions: D-32 (state machine), D-35 (ProgressHandle)
 * Requirements: UX-03 (visual feedback with progress indicators)
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { theme } from '../theme/tokens.js';

export interface SkillProgressProps {
  /** Progress title (e.g., 'Scanning...') */
  title: string;
  /** Total number of items (undefined for indeterminate spinner) */
  total?: number;
  /** Number of completed items (for determinate bar) */
  completed?: number;
  /** Status message displayed alongside progress */
  message?: string;
}

/** Width of the progress bar in characters */
const BAR_WIDTH = 20;

/**
 * Render a text-based progress bar: [=========>          ] 45%
 */
function renderProgressBar(completed: number, total: number): string {
  const ratio = Math.min(1, Math.max(0, completed / total));
  const filled = Math.round(ratio * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const percent = Math.round(ratio * 100);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  return `[${bar}] ${percent}%`;
}

/**
 * SkillProgress: Displays either a progress bar or spinner with message.
 *
 * - If total is provided: renders a progress bar showing completed/total
 * - If total is undefined: renders an ink-spinner with a message
 */
export const SkillProgress: React.FC<SkillProgressProps> = ({
  title,
  total,
  completed = 0,
  message,
}) => {
  const isDeterminate = total !== undefined && total > 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1}>
        {isDeterminate ? (
          <>
            <Text color={theme.colors.primary}>{title}</Text>
            <Text color={theme.colors.text}>
              {renderProgressBar(completed, total)}
            </Text>
            <Text color={theme.colors.dim}>
              {completed}/{total}
            </Text>
          </>
        ) : (
          <>
            <Text color={theme.colors.primary}>
              <Spinner type="dots" />
            </Text>
            <Text color={theme.colors.text}>{title}</Text>
          </>
        )}
      </Box>
      {message && (
        <Text color={theme.colors.dim}>{message}</Text>
      )}
    </Box>
  );
};
