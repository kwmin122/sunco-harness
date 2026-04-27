/**
 * @sunco/core - Convention-Based Skill Scanner
 *
 * Discovers skill files from convention paths (packages/skills-{name}/src/{name}.skill.ts).
 * Each file is dynamically imported and its default export is extracted.
 *
 * Phase 1: Dynamic import approach.
 * Production: Pre-built manifest (future optimization).
 *
 * Decision: SKL-03 (convention-based discovery)
 */

import { readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SkillDefinition } from './types.js';

type DynamicImport = (specifier: string) => Promise<{ default?: unknown } & Record<string, unknown>>;

const SKILL_FILE_SUFFIXES = [
  '.skill.ts',
  '.skill.js',
  '.skill.mjs',
] as const;

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

/**
 * Scan base paths for skill files and dynamically import them.
 *
 * @param basePaths - Array of directory paths to scan (e.g., ['packages/skills-harness/src'])
 * @returns Array of validated SkillDefinition objects
 *
 * Behavior:
 * - Non-existent paths return empty array (no throw)
 * - Files without a default export are skipped (warning logged)
 * - Files that fail import are skipped (warning logged)
 */
export async function scanSkillFiles(
  basePaths: string[],
): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = [];

  for (const basePath of basePaths) {
    let files: string[];
    try {
      files = await findSkillFiles(basePath);
    } catch {
      // Non-existent path or permission error -- skip silently
      continue;
    }

    for (const file of files) {
      try {
        const mod = await import(pathToFileURL(await realpath(file)).href) as Awaited<ReturnType<DynamicImport>>;
        const skill = mod.default ?? mod;

        // Validate it looks like a SkillDefinition
        if (isSkillDefinition(skill)) {
          skills.push(skill);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`[sun:scanner] Skipped ${file}: no valid skill export`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[sun:scanner] Failed to import ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return skills;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findSkillFiles(basePath: string): Promise<string[]> {
  const files: string[] = [];
  await collectSkillFiles(basePath, files);
  return files.sort();
}

async function collectSkillFiles(directory: string, files: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSkillFiles(filePath, files);
    } else if (entry.isFile() && isSkillFileName(entry.name)) {
      files.push(filePath);
    }
  }
}

function isSkillFileName(fileName: string): boolean {
  return SKILL_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));
}

/**
 * Type guard: check if a value has the shape of a SkillDefinition.
 */
function isSkillDefinition(value: unknown): value is SkillDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.command === 'string' &&
    typeof obj.kind === 'string' &&
    typeof obj.execute === 'function'
  );
}
