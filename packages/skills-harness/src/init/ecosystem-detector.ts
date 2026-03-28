/**
 * @sunco/skills-harness - Ecosystem Detector
 *
 * Scans project root for marker files to identify which programming
 * ecosystems are present. Supports 15+ ecosystems via ECOSYSTEM_MARKERS.
 *
 * Decision: D-01 (convention file scanning for ecosystem detection)
 */

import { access } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ECOSYSTEM_MARKERS, type EcosystemResult } from './types.js';

/**
 * Check if a file exists at the given path.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if any file matching a glob pattern exists in the directory.
 * Supports simple `*.ext` patterns only.
 */
async function globExists(cwd: string, pattern: string): Promise<boolean> {
  if (!pattern.startsWith('*')) {
    return fileExists(join(cwd, pattern));
  }

  // Extract extension from *.ext pattern
  const ext = pattern.slice(1); // e.g., '.csproj' from '*.csproj'
  try {
    const entries = await readdir(cwd);
    return entries.some((entry) => entry.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Detect ecosystems present in the project by scanning for marker files.
 *
 * Iterates through ECOSYSTEM_MARKERS, checking for each marker file.
 * Returns deduplicated ecosystem names, all matching markers, and the
 * primary ecosystem (first high-confidence match).
 *
 * @param opts - Options with cwd (project root path)
 * @returns EcosystemResult with detected ecosystems
 */
export async function detectEcosystems(opts: {
  cwd: string;
}): Promise<EcosystemResult> {
  const { cwd } = opts;
  const matchedMarkers: typeof ECOSYSTEM_MARKERS[number][] = [];

  // Check each marker file
  const checks = ECOSYSTEM_MARKERS.map(async (marker) => {
    const found = marker.file.includes('*')
      ? await globExists(cwd, marker.file)
      : await fileExists(join(cwd, marker.file));

    if (found) {
      matchedMarkers.push(marker);
    }
  });

  await Promise.all(checks);

  // Sort markers to maintain ECOSYSTEM_MARKERS order (Promise.all may resolve out of order)
  const orderedMarkers = ECOSYSTEM_MARKERS.filter((m) => matchedMarkers.includes(m));

  // Deduplicate ecosystem names while preserving order
  const seen = new Set<string>();
  const ecosystems: string[] = [];
  for (const marker of orderedMarkers) {
    if (!seen.has(marker.ecosystem)) {
      seen.add(marker.ecosystem);
      ecosystems.push(marker.ecosystem);
    }
  }

  // Primary ecosystem = first high-confidence match
  const primaryMarker = orderedMarkers.find((m) => m.confidence === 'high');
  const primaryEcosystem = primaryMarker?.ecosystem ?? null;

  return {
    ecosystems,
    markers: [...orderedMarkers],
    primaryEcosystem,
  };
}
