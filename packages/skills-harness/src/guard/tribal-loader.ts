/**
 * @sunco/skills-harness - Tribal Knowledge Loader
 *
 * Loads tribal knowledge patterns from .sun/tribal/ via FileStoreApi.
 * Tribal patterns produce soft warnings (not errors) per D-24.
 *
 * Each tribal file has the format:
 *   # Pattern: <id>
 *   pattern: <regex>
 *   message: <warning message>
 *
 * Decision: D-24 (tribal knowledge as soft warnings alongside hard lint rules)
 */

import type { FileStoreApi } from '@sunco/core';
import type { TribalPattern } from './types.js';

/** Category name for tribal knowledge files in the FileStore (.sun/tribal/) */
const TRIBAL_CATEGORY = 'tribal';

/**
 * Parse a single tribal knowledge file into a TribalPattern.
 *
 * Expected format:
 *   # Pattern: <id>
 *   pattern: <regex-string>
 *   message: <warning message>
 *
 * @param filename - Source filename in .sun/tribal/
 * @param content - Raw file content
 * @returns Parsed TribalPattern or null if parsing fails
 */
function parseTribalFile(filename: string, content: string): TribalPattern | null {
  const lines = content.split('\n').map((l) => l.trim());

  let id: string | undefined;
  let patternStr: string | undefined;
  let message: string | undefined;

  for (const line of lines) {
    // Parse "# Pattern: <id>"
    const idMatch = line.match(/^#\s*Pattern:\s*(.+)$/i);
    if (idMatch) {
      id = idMatch[1]!.trim();
      continue;
    }

    // Parse "pattern: <regex>"
    const patternMatch = line.match(/^pattern:\s*(.+)$/i);
    if (patternMatch) {
      patternStr = patternMatch[1]!.trim();
      continue;
    }

    // Parse "message: <text>"
    const messageMatch = line.match(/^message:\s*(.+)$/i);
    if (messageMatch) {
      message = messageMatch[1]!.trim();
      continue;
    }
  }

  if (!id || !patternStr || !message) {
    return null;
  }

  try {
    const pattern = new RegExp(patternStr);
    return { id, pattern, message, source: filename };
  } catch {
    // Invalid regex -- skip this pattern
    return null;
  }
}

/**
 * Load all tribal knowledge patterns from .sun/tribal/.
 *
 * Reads all files from the 'tribal' FileStore category, parses each into
 * a TribalPattern with a compiled RegExp, and returns the valid patterns.
 *
 * @param fileStore - FileStore API for reading .sun/ artifacts
 * @returns Array of parsed TribalPattern objects
 */
export async function loadTribalPatterns(fileStore: FileStoreApi): Promise<TribalPattern[]> {
  const filenames = await fileStore.list(TRIBAL_CATEGORY);

  const patterns: TribalPattern[] = [];

  for (const filename of filenames) {
    const content = await fileStore.read(TRIBAL_CATEGORY, filename);
    if (content === undefined) continue;

    const pattern = parseTribalFile(filename, content);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  return patterns;
}
