/**
 * @sunco/core - SunText Primitive
 *
 * Thin wrapper over Ink's Text with SUN theme color tokens.
 * Layer 1: Not re-implementation -- just Ink + SUN defaults (D-31).
 */

import React from 'react';
import { Text as InkText, type TextProps as InkTextProps } from 'ink';
import { theme } from '../theme/tokens.js';

type ThemeColor = keyof typeof theme.colors;

export interface SunTextProps extends Omit<InkTextProps, 'color'> {
  /** Theme color token name (e.g., 'primary', 'error') or raw hex string */
  color?: ThemeColor | string;
}

/**
 * SunText: Ink Text with theme-aware colors.
 * Use `color="success"` for theme tokens, or pass raw hex for custom colors.
 */
export const SunText: React.FC<SunTextProps> = ({ color, ...props }) => {
  const resolvedColor = color && color in theme.colors
    ? theme.colors[color as ThemeColor]
    : color;
  return <InkText color={resolvedColor} {...props} />;
};
