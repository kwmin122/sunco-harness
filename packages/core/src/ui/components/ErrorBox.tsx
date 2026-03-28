/**
 * @sunco/core - ErrorBox Component
 *
 * Bordered error display box with title and message.
 * Layer 2: Reusable shared component (D-31).
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/tokens.js';

export interface ErrorBoxProps {
  /** Error title (defaults to 'Error') */
  title?: string;
  /** Error message body */
  message: string;
}

/**
 * ErrorBox: Renders an error message in a visible bordered box.
 * Uses theme error color for border and title, text color for message body.
 */
export const ErrorBox: React.FC<ErrorBoxProps> = ({ title = 'Error', message }) => (
  <Box borderStyle="round" borderColor={theme.colors.error} paddingX={1} flexDirection="column">
    <Text color={theme.colors.error} bold>{theme.symbols.cross} {title}</Text>
    <Text color={theme.colors.text}>{message}</Text>
  </Box>
);
