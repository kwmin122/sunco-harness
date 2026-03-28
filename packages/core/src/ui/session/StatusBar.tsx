/**
 * @sunco/core - StatusBar Component (Session-level)
 *
 * Session-level UI showing model usage and context.
 * NOT part of skill lifecycle -- lives at CLI runtime level (D-37).
 * Skills do NOT import this; the CLI runtime manages it.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/tokens.js';

export interface StatusBarProps {
  /** AI provider name (e.g., 'Claude', 'GPT-4') */
  provider?: string;
  /** Token usage percentage (0-100) */
  tokenUsage?: number;
  /** Context window usage percentage (0-100) */
  contextUsage?: number;
  /** Estimated cost in USD */
  cost?: number;
}

/**
 * Render a mini usage bar: [======    ] 60%
 */
function miniBar(percent: number, width = 10): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

/**
 * StatusBar: Session-level display for agent resource usage.
 * Renders at the bottom of the terminal by the CLI runtime.
 *
 * Shows: provider name, token usage %, context usage %, estimated cost.
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  provider,
  tokenUsage,
  contextUsage,
  cost,
}) => (
  <Box
    borderStyle="single"
    borderColor={theme.colors.dim}
    paddingX={1}
    gap={2}
  >
    {provider && (
      <Text color={theme.colors.primary} bold>{provider}</Text>
    )}
    {tokenUsage !== undefined && (
      <Box gap={1}>
        <Text color={theme.colors.dim}>tokens</Text>
        <Text color={theme.colors.text}>
          {miniBar(tokenUsage)} {Math.round(tokenUsage)}%
        </Text>
      </Box>
    )}
    {contextUsage !== undefined && (
      <Box gap={1}>
        <Text color={theme.colors.dim}>context</Text>
        <Text color={theme.colors.text}>
          {miniBar(contextUsage)} {Math.round(contextUsage)}%
        </Text>
      </Box>
    )}
    {cost !== undefined && (
      <Box gap={1}>
        <Text color={theme.colors.dim}>cost</Text>
        <Text color={theme.colors.warning}>${cost.toFixed(4)}</Text>
      </Box>
    )}
  </Box>
);
