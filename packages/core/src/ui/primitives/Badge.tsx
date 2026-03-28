/**
 * @sunco/core - Badge Primitive
 *
 * Inline badge for tags like "(Recommended)" per UX-01.
 * Layer 1: Styled Ink Text for consistent badge appearance.
 */

import React from 'react';
import { Text } from 'ink';
import { theme } from '../theme/tokens.js';

export interface BadgeProps {
  /** Badge label text (rendered as " (label)") */
  label: string;
  /** Override color (defaults to theme primary) */
  color?: string;
}

/**
 * Badge: Inline label for tagging options.
 * Used in interactive choices to mark recommended options (UX-01).
 */
export const Badge: React.FC<BadgeProps> = ({ label, color = theme.colors.primary }) => (
  <Text color={color} bold> ({label})</Text>
);
