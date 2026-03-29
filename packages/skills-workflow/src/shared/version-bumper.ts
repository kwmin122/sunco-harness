/**
 * Version bumper for sunco ship release flow.
 *
 * Provides semver-style version increment (no external semver library)
 * and workspace-wide version update via glob scanning.
 *
 * Requirements: SHP-01, SHP-02
 * Decisions: D-06 (version bumper contract)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'glob';

/**
 * Increment a semver version string by the given bump type.
 *
 * Parses MAJOR.MINOR.PATCH via split('.'), increments the correct
 * component, and resets lower components to 0.
 *
 * @param version - Current version string (e.g. '1.2.3')
 * @param type - Bump type: 'major', 'minor', or 'patch'
 * @returns New version string
 */
export function bumpVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
  const parts = version.split('.').map(Number);
  const [major, minor, patch] = parts;

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Find and update the `version` field in all workspace package.json files.
 *
 * Uses glob to scan for package.json files (excluding node_modules),
 * reads each, updates the version field if present, and writes back
 * with consistent formatting (2-space indent + trailing newline).
 *
 * @param cwd - Workspace root directory
 * @param newVersion - New version string to set
 * @returns List of relative paths that were updated
 */
export async function updateAllVersions(cwd: string, newVersion: string): Promise<string[]> {
  const files = await glob('**/package.json', {
    cwd,
    ignore: ['**/node_modules/**'],
  });

  const updated: string[] = [];

  for (const relPath of files) {
    const fullPath = join(cwd, relPath);
    const raw = await readFile(fullPath, 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;

    if ('version' in pkg) {
      pkg.version = newVersion;
      await writeFile(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      updated.push(relPath);
    }
  }

  return updated;
}
