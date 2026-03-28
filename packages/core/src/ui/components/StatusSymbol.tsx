/**
 * @sunco/core - StatusSymbol Component
 *
 * Visual status indicator with themed colors.
 * Layer 2: Reusable shared component (D-31).
 *
 * Requirement: UX-03 (visual feedback with distinct status symbols)
 */

import React from 'react';
import { Text } from 'ink';
import { theme } from '../theme/tokens.js';

/** Status type determines which symbol and color to render */
export type StatusType = 'success' | 'error' | 'warning' | 'info';

export interface StatusSymbolProps {
  /** Status type to display */
  status: StatusType;
}

const STATUS_MAP: Record<StatusType, { symbol: string; color: string }> = {
  success: { symbol: theme.symbols.checkmark, color: theme.colors.success },
  error: { symbol: theme.symbols.cross, color: theme.colors.error },
  warning: { symbol: theme.symbols.warning, color: theme.colors.warning },
  info: { symbol: theme.symbols.info, color: theme.colors.primary },
};

/**
 * StatusSymbol: Renders a colored status icon.
 * Success = green checkmark, Error = red cross, Warning = yellow triangle, Info = blue circle.
 */
export const StatusSymbol: React.FC<StatusSymbolProps> = ({ status }) => {
  const { symbol, color } = STATUS_MAP[status];
  return <Text color={color}>{symbol}</Text>;
};
