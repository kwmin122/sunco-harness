/**
 * @sunco/skills-harness - Layer Detector
 *
 * Scans project directory structure to identify architectural layers
 * and their dependency direction rules. Uses directory name heuristics
 * mapped against COMMON_LAYER_PATTERNS.
 *
 * Decision: D-02 (layer detection via directory name heuristics)
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { COMMON_LAYER_PATTERNS, type DetectedLayer, type LayerResult } from './types.js';

/** Standard source root directory names to scan */
const SOURCE_ROOTS = ['src', 'lib', 'app', 'packages'] as const;

/**
 * Check if a path is a directory.
 */
async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Find the source root directory within the project.
 * Checks for common source root names in order of preference.
 *
 * @returns The source root name (e.g., 'src') or null if none found
 */
async function findSourceRoot(cwd: string): Promise<string | null> {
  for (const candidate of SOURCE_ROOTS) {
    if (await isDirectory(join(cwd, candidate))) {
      return candidate;
    }
  }
  return null;
}

/**
 * Detect architectural layers in the project by scanning directory structure.
 *
 * Scans subdirectories of the source root and matches them (case-insensitively)
 * against COMMON_LAYER_PATTERNS. Each matched directory becomes a DetectedLayer
 * with dependency direction rules from COMMON_LAYER_PATTERNS.
 *
 * @param opts - Options with cwd (project root path)
 * @returns LayerResult with detected layers and source root
 */
export async function detectLayers(opts: {
  cwd: string;
}): Promise<LayerResult> {
  const { cwd } = opts;
  const sourceRoot = await findSourceRoot(cwd);

  if (!sourceRoot) {
    return { layers: [], sourceRoot: null };
  }

  const sourceRootPath = join(cwd, sourceRoot);

  // Read top-level directories in source root
  let entries: string[];
  try {
    const dirEntries = await readdir(sourceRootPath, { withFileTypes: true });
    entries = dirEntries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { layers: [], sourceRoot };
  }

  // Match directories against layer patterns
  const layers: DetectedLayer[] = [];
  const matchedLayerNames = new Set<string>();

  for (const entry of entries) {
    const entryLower = entry.toLowerCase();

    for (const pattern of COMMON_LAYER_PATTERNS) {
      // Skip if we already matched this layer
      if (matchedLayerNames.has(pattern.name)) continue;

      // Case-insensitive match against any dirPattern
      const matched = pattern.dirPatterns.some(
        (dp) => dp.toLowerCase() === entryLower,
      );

      if (matched) {
        matchedLayerNames.add(pattern.name);
        layers.push({
          name: pattern.name,
          pattern: `${sourceRoot}/${entry}/*`,
          dirPatterns: [...pattern.dirPatterns],
          canImportFrom: [...pattern.canImportFrom],
        });
        break;
      }
    }
  }

  return { layers, sourceRoot };
}
