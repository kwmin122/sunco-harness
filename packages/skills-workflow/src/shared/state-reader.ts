/**
 * State reader - Parse STATE.md YAML frontmatter into structured data
 *
 * Extracts YAML frontmatter (between --- delimiters) and body content
 * from STATE.md. No YAML library -- parses the simple key: value format
 * used by GSD state files.
 */

import type { ParsedState } from './types.js';

const EMPTY_STATE: ParsedState = {
  phase: null,
  plan: null,
  status: '',
  lastActivity: '',
  progress: {
    totalPhases: 0,
    completedPhases: 0,
    totalPlans: 0,
    completedPlans: 0,
    percent: 0,
  },
};

/**
 * Parse STATE.md content into structured state data.
 * Extracts from YAML frontmatter and markdown body.
 * Returns safe defaults for missing or malformed content.
 */
export function parseStateMd(content: string): ParsedState {
  if (!content || !content.trim()) {
    return { ...EMPTY_STATE };
  }

  const { frontmatter, body } = splitFrontmatter(content);
  const fm = parseFrontmatterYaml(frontmatter);

  // Extract from frontmatter
  const status = fm['status'] ?? '';
  const lastActivity = fm['last_activity'] ?? '';

  // Extract progress block from frontmatter
  const progress = {
    totalPhases: toInt(fm['progress.total_phases']),
    completedPhases: toInt(fm['progress.completed_phases']),
    totalPlans: toInt(fm['progress.total_plans']),
    completedPlans: toInt(fm['progress.completed_plans']),
    percent: toInt(fm['progress.percent']),
  };

  // Extract from body
  const phase = extractPhaseFromBody(body);
  const plan = extractLineValue(body, /^Plan:\s*(.+)$/m);

  return {
    phase,
    plan,
    status,
    lastActivity,
    progress,
  };
}

/**
 * Split content into frontmatter (between --- delimiters) and body.
 */
function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const lines = content.split('\n');

  // First line must be ---
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: '', body: content };
  }

  // Find closing ---
  let closingIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closingIdx = i;
      break;
    }
  }

  if (closingIdx < 0) {
    return { frontmatter: '', body: content };
  }

  const frontmatter = lines.slice(1, closingIdx).join('\n');
  const body = lines.slice(closingIdx + 1).join('\n');

  return { frontmatter, body };
}

/**
 * Parse simple YAML frontmatter (key: value pairs with nested blocks).
 * Supports one level of nesting (e.g., progress.total_phases).
 * Returns a flat map with dot-separated keys for nested values.
 */
function parseFrontmatterYaml(yaml: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!yaml.trim()) return result;

  const lines = yaml.split('\n');
  let currentBlock = '';

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check indentation level
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent >= 2 && currentBlock) {
      // Nested key under current block
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        result[`${currentBlock}.${key}`] = stripQuotes(value);
      }
    } else {
      // Top-level key
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();

        if (value === '' || value === undefined) {
          // This is a block start (e.g., "progress:")
          currentBlock = key;
        } else {
          currentBlock = '';
          result[key] = stripQuotes(value);
        }
      }
    }
  }

  return result;
}

/**
 * Strip surrounding quotes from a YAML value.
 */
function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Extract phase number from body text.
 * Looks for "Phase: 03 (name)" or "Phase: 3" patterns.
 */
function extractPhaseFromBody(body: string): number | null {
  const match = /^Phase:\s*(\d+)/m.exec(body);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Extract a value from body text using a regex with one capture group.
 */
function extractLineValue(body: string, re: RegExp): string | null {
  const match = re.exec(body);
  return match ? match[1].trim() : null;
}

/**
 * Convert a string to integer, defaulting to 0.
 */
function toInt(value: string | undefined): number {
  if (!value) return 0;
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}
