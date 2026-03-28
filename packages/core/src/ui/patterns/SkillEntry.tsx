/**
 * @sunco/core - SkillEntry Pattern (Layer 3)
 *
 * Entry banner rendered when a skill starts.
 * Maps to the "entry" phase of the skill state machine:
 * idle -> [entry] -> choice? -> running -> result
 *
 * Auto-completes after display -- no user interaction needed.
 *
 * Decisions: D-32 (skill state machine), D-33 (skills never touch Ink)
 */

import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/tokens.js';
import type { SkillEntryInput } from '../adapters/SkillUi.js';

export interface SkillEntryProps extends SkillEntryInput {
  /** Callback when entry display completes */
  onComplete?: () => void;
}

/**
 * SkillEntry: Brief entry banner at skill start.
 * Renders title with optional description, then signals completion.
 */
export const SkillEntry: React.FC<SkillEntryProps> = ({
  title,
  description,
  subtitle,
  onComplete,
}) => {
  useEffect(() => {
    // Auto-complete after brief display
    const timer = setTimeout(() => {
      onComplete?.();
    }, 100);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Box gap={1}>
        <Text color={theme.colors.primary} bold>{title}</Text>
        {subtitle && <Text color={theme.colors.dim}>{subtitle}</Text>}
      </Box>
      {description && (
        <Text color={theme.colors.dim}>{description}</Text>
      )}
    </Box>
  );
};
