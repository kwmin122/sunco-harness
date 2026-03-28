/**
 * Pre-scan context builder for sunco scan.
 * Gathers deterministic data about a codebase before agent dispatch.
 * Reuses detectEcosystems from Phase 2 (D-14).
 */

import { detectEcosystems } from '@sunco/skills-harness';
import { glob } from 'glob';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PreScanContext {
  ecosystems: string[];
  primaryEcosystem: string | null;
  fileCount: number;
  fileTree: string[]; // Truncated to 500 entries
  keyFiles: Record<string, string>; // filename -> content (sampled, capped at 5KB)
}

const KEY_FILES = [
  'package.json',
  'tsconfig.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'README.md',
  'docker-compose.yml',
  'Dockerfile',
  '.env.example',
  'Makefile',
];

export async function buildPreScanContext(
  cwd: string,
): Promise<PreScanContext> {
  const [ecoResult, fileTree] = await Promise.all([
    detectEcosystems({ cwd }),
    glob('**/*', {
      cwd,
      ignore: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        '.sun/**',
        '*.lock',
        'package-lock.json',
      ],
      maxDepth: 4,
    }),
  ]);

  const keyFiles: Record<string, string> = {};
  for (const name of KEY_FILES) {
    try {
      const content = await readFile(join(cwd, name), 'utf-8');
      keyFiles[name] = content.slice(0, 5000); // Cap at 5KB per file
    } catch {
      /* skip missing */
    }
  }

  return {
    ecosystems: ecoResult.ecosystems,
    primaryEcosystem: ecoResult.primaryEcosystem,
    fileCount: fileTree.length,
    fileTree: fileTree.slice(0, 500),
    keyFiles,
  };
}
