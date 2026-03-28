/**
 * @sunco/core - Theme Tokens
 *
 * Thin design token layer: colors, symbols, spacing (D-40).
 * Not a design system -- just enough for consistent UX.
 */

// ---------------------------------------------------------------------------
// Color Tokens
// ---------------------------------------------------------------------------

export interface ThemeColors {
  /** Primary brand color (blue) */
  primary: string;
  /** Success color (green) */
  success: string;
  /** Warning color (yellow) */
  warning: string;
  /** Error color (red) */
  error: string;
  /** Muted/disabled text */
  muted: string;
  /** Normal text */
  text: string;
  /** Dimmed text */
  dim: string;
}

// ---------------------------------------------------------------------------
// Symbol Tokens (UX-03: visual feedback)
// ---------------------------------------------------------------------------

export interface ThemeSymbols {
  /** Success checkmark */
  checkmark: string;
  /** Error cross */
  cross: string;
  /** Warning triangle */
  warning: string;
  /** Info circle */
  info: string;
  /** Arrow (for recommendations, navigation) */
  arrow: string;
  /** Bullet point */
  bullet: string;
  /** Spinner animation frames */
  spinner: readonly string[];
}

// ---------------------------------------------------------------------------
// Spacing Tokens
// ---------------------------------------------------------------------------

export interface ThemeSpacing {
  /** Extra small spacing (1 char) */
  xs: number;
  /** Small spacing (2 chars) */
  sm: number;
  /** Medium spacing (4 chars) */
  md: number;
  /** Large spacing (8 chars) */
  lg: number;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export interface Theme {
  colors: ThemeColors;
  symbols: ThemeSymbols;
  spacing: ThemeSpacing;
}

/**
 * Default SUNCO theme.
 * Used by InkUiAdapter and chalk-based output.
 */
export const theme: Theme = {
  colors: {
    primary: '#5B8AF5',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    muted: '#6B7280',
    text: '#E5E7EB',
    dim: '#9CA3AF',
  },
  symbols: {
    checkmark: '\u2714', // heavy check mark
    cross: '\u2718',     // heavy ballot X
    warning: '\u26A0',   // warning sign
    info: '\u2139',      // information source
    arrow: '\u279C',     // heavy round-tipped rightwards arrow
    bullet: '\u2022',    // bullet
    spinner: ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'],
  },
  spacing: {
    xs: 1,
    sm: 2,
    md: 4,
    lg: 8,
  },
} as const;
