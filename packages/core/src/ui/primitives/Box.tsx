/**
 * @sunco/core - SunBox Primitive
 *
 * Thin wrapper over Ink's Box with SUN theme spacing tokens.
 * Layer 1: Not re-implementation -- just Ink + SUN defaults (D-31).
 */

import React from 'react';
import { Box as InkBox, type BoxProps as InkBoxProps } from 'ink';
import { theme } from '../theme/tokens.js';

export interface SunBoxProps extends Omit<InkBoxProps, 'padding' | 'gap'> {
  /** Spacing token for padding (xs=1, sm=2, md=4, lg=8) */
  padding?: keyof typeof theme.spacing;
  /** Spacing token for gap between children */
  gap?: keyof typeof theme.spacing;
}

/**
 * SunBox: Ink Box with theme-aware spacing.
 * Use `padding="sm"` instead of raw numbers for consistent layout.
 */
export const SunBox: React.FC<SunBoxProps> = ({ padding, gap, ...props }) => {
  const resolvedPadding = padding ? theme.spacing[padding] : undefined;
  const resolvedGap = gap ? theme.spacing[gap] : undefined;
  return <InkBox padding={resolvedPadding} gap={resolvedGap} {...props} />;
};
