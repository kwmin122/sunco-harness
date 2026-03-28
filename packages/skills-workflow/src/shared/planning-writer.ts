/**
 * Planning artifact writer for sunco new.
 * Writes PROJECT.md, REQUIREMENTS.md, ROADMAP.md to .planning/ in user's project.
 * Uses node:fs/promises directly (FileStore is scoped to .sun/ only).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

/**
 * Safely write a planning artifact to .planning/ relative to cwd.
 * Creates .planning/ directory if it doesn't exist.
 * Path traversal guard: filename must resolve within .planning/.
 */
export async function writePlanningArtifact(
  cwd: string,
  filename: string,
  content: string,
): Promise<string> {
  const planningDir = join(cwd, '.planning');
  await mkdir(planningDir, { recursive: true });

  const targetPath = resolve(planningDir, filename);
  const rel = relative(planningDir, targetPath);
  if (rel.startsWith('..') || rel.includes('..')) {
    throw new Error(`Path traversal detected: ${filename}`);
  }

  await writeFile(targetPath, content, 'utf-8');
  return targetPath;
}
