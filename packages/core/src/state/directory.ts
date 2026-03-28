/**
 * @sunco/core - .sun/ Directory Structure Management
 *
 * Creates and manages the .sun/ directory tree for a project.
 * All state, rules, tribal knowledge, and planning artifacts live here.
 *
 * Requirement: STE-01 (.sun/ directory structure)
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

import { SUN_DIR_STRUCTURE } from './types.js';

/**
 * Directories to create inside .sun/.
 * Derived from SUN_DIR_STRUCTURE, filtering to directory-type entries.
 */
const SUBDIRECTORIES = [
  SUN_DIR_STRUCTURE.rules,
  SUN_DIR_STRUCTURE.tribal,
  SUN_DIR_STRUCTURE.scenarios,
  SUN_DIR_STRUCTURE.planning,
  SUN_DIR_STRUCTURE.logs,
] as const;

/**
 * Content for .sun/.gitignore.
 * Keeps config and human-readable files tracked, ignores SQLite runtime files.
 */
const GITIGNORE_CONTENT = `# SQLite runtime files (not tracked)
state.db
state.db-wal
state.db-shm
`;

/**
 * Initialize the .sun/ directory structure at the given project root.
 *
 * Creates:
 * - .sun/
 * - .sun/rules/
 * - .sun/tribal/
 * - .sun/scenarios/
 * - .sun/planning/
 * - .sun/logs/
 * - .sun/.gitignore (ignores db files)
 *
 * Idempotent: safe to call multiple times.
 *
 * @param basePath - Project root directory (absolute path)
 */
export async function initSunDirectory(basePath: string): Promise<void> {
  // Create root .sun/ directory
  const sunRoot = join(basePath, SUN_DIR_STRUCTURE.root);
  await mkdir(sunRoot, { recursive: true });

  // Create all subdirectories in parallel
  await Promise.all(
    SUBDIRECTORIES.map((subdir) =>
      mkdir(join(basePath, subdir), { recursive: true }),
    ),
  );

  // Write .gitignore (always overwrite to ensure correct content)
  const gitignorePath = join(basePath, SUN_DIR_STRUCTURE.gitignore);
  await writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf-8');
}

/**
 * Ensure the .sun/ directory exists and return its full path.
 *
 * Creates the full directory structure if it doesn't exist.
 * Returns the absolute path to the .sun/ directory.
 *
 * @param basePath - Project root directory (absolute path)
 * @returns Absolute path to the .sun/ directory
 */
export async function ensureSunDir(basePath: string): Promise<string> {
  const sunRoot = join(basePath, SUN_DIR_STRUCTURE.root);

  try {
    await access(sunRoot);
  } catch {
    // Directory doesn't exist, create full structure
    await initSunDirectory(basePath);
  }

  return sunRoot;
}
