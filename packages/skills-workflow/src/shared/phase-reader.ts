/**
 * Phase directory reader/writer for sunco workflow skills.
 *
 * Provides shared utilities for resolving phase directories,
 * reading artifacts from them, and writing new artifacts.
 * Used by all Phase 5 skills (discuss, plan, execute, verify).
 *
 * Uses node:fs/promises directly (phase dirs are in .planning/,
 * not .sun/ -- FileStore is scoped to .sun/ only).
 */

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

/**
 * Resolve the full path to a phase directory by phase number.
 * Scans `.planning/phases/` for a directory starting with the zero-padded phase number.
 *
 * @param cwd - Project root directory
 * @param phaseNumber - Phase number (e.g., 5)
 * @returns Full path to phase directory, or null if not found
 */
export async function resolvePhaseDir(
  cwd: string,
  phaseNumber: number,
): Promise<string | null> {
  const phasesDir = join(cwd, '.planning', 'phases');
  const padded = String(phaseNumber).padStart(2, '0');

  let entries: string[];
  try {
    entries = await readdir(phasesDir);
  } catch {
    return null;
  }

  const match = entries.find((entry) => entry.startsWith(`${padded}-`));
  if (!match) return null;

  return join(phasesDir, match);
}

/**
 * Read an artifact file from a phase directory.
 *
 * @param cwd - Project root directory
 * @param phaseNumber - Phase number (e.g., 5)
 * @param filename - Filename within the phase directory (e.g., "05-CONTEXT.md")
 * @returns File content as string, or null if not found
 */
export async function readPhaseArtifact(
  cwd: string,
  phaseNumber: number,
  filename: string,
): Promise<string | null> {
  const phaseDir = await resolvePhaseDir(cwd, phaseNumber);
  if (!phaseDir) return null;

  try {
    return await readFile(join(phaseDir, filename), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write an artifact file to a phase directory.
 * Creates the phase directory if it doesn't exist.
 * Includes path traversal guard (same pattern as planning-writer.ts).
 *
 * @param cwd - Project root directory
 * @param phaseNumber - Phase number (e.g., 5)
 * @param slug - Phase slug (e.g., "context-planning")
 * @param filename - Filename to write (e.g., "05-CONTEXT.md")
 * @param content - File content
 * @returns Full path to written file
 */
export async function writePhaseArtifact(
  cwd: string,
  phaseNumber: number,
  slug: string,
  filename: string,
  content: string,
): Promise<string> {
  const padded = String(phaseNumber).padStart(2, '0');
  const phaseDir = join(cwd, '.planning', 'phases', `${padded}-${slug}`);

  // Path traversal guard
  const targetPath = resolve(phaseDir, filename);
  const rel = relative(phaseDir, targetPath);
  if (rel.startsWith('..') || rel.includes('..')) {
    throw new Error(`Path traversal detected: ${filename}`);
  }

  await mkdir(phaseDir, { recursive: true });
  await writeFile(targetPath, content, 'utf-8');

  return targetPath;
}
