/**
 * Context Zone classification — 4-tier context utilization system.
 *
 * Zones:
 *   Green  (0-50%)  — normal, full artifact loading
 *   Yellow (50-70%) — informational warning
 *   Orange (70-85%) — suggest /sunco:pause, auto-save HANDOFF
 *   Red    (85%+)   — suggest compact, capture state before auto-compact
 *
 * Pure calculation, no I/O. Used by:
 *   - sunco-context-monitor.cjs (hook)
 *   - sunco-statusline.cjs (hook)
 *   - auto.skill.ts (pipeline control)
 *   - phase-reader.ts (selective loading)
 *
 * Requirements: LH-01, LH-02
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextZone = 'green' | 'yellow' | 'orange' | 'red';

export interface ContextZoneResult {
  zone: ContextZone;
  usedPercent: number;
  suggestPause: boolean;
  suggestCompact: boolean;
  message: string | null;
}

export interface ContextZoneFile {
  zone: ContextZone;
  usedPercent: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Zone Classification
// ---------------------------------------------------------------------------

/**
 * Classify the current context utilization into a 4-tier zone.
 *
 * @param usedPercent - Percentage of context window used (0-100)
 * @returns Zone classification with action suggestions
 */
export function classifyContextZone(usedPercent: number): ContextZoneResult {
  const clamped = Math.max(0, Math.min(100, usedPercent));

  if (clamped >= 85) {
    return {
      zone: 'red',
      usedPercent: clamped,
      suggestPause: true,
      suggestCompact: true,
      message: 'Context critical — auto-compact imminent, saving state...',
    };
  }

  if (clamped >= 70) {
    return {
      zone: 'orange',
      usedPercent: clamped,
      suggestPause: true,
      suggestCompact: false,
      message: 'Context high — run /sunco:pause to save context and resume later',
    };
  }

  if (clamped >= 50) {
    return {
      zone: 'yellow',
      usedPercent: clamped,
      suggestPause: false,
      suggestCompact: false,
      message: 'Context moderate — monitoring',
    };
  }

  return {
    zone: 'green',
    usedPercent: clamped,
    suggestPause: false,
    suggestCompact: false,
    message: null,
  };
}

// ---------------------------------------------------------------------------
// File path constant
// ---------------------------------------------------------------------------

/** Filename for the zone state file written by context-monitor hook */
export const CONTEXT_ZONE_FILENAME = 'context-zone.json';

// ---------------------------------------------------------------------------
// I/O: Read zone file
// ---------------------------------------------------------------------------

/**
 * Read context zone from .sun/context-zone.json.
 * Returns null if file doesn't exist, is invalid, or is stale (>60s old).
 * Staleness check prevents acting on cached state from a previous session.
 */
export async function readContextZone(cwd: string): Promise<ContextZoneFile | null> {
  try {
    const { readFile, stat } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const filePath = join(cwd, '.sun', CONTEXT_ZONE_FILENAME);

    const fileStat = await stat(filePath);
    const ageMs = Date.now() - fileStat.mtimeMs;
    if (ageMs > 60_000) return null;

    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as ContextZoneFile;
  } catch {
    return null;
  }
}
