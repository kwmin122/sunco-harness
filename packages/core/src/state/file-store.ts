/**
 * @sunco/core - Flat File Store for Human-Readable Artifacts
 *
 * Provides read/write access to files in .sun/ subdirectories.
 * Rules, tribal knowledge, scenarios, and planning artifacts are stored
 * as flat files for human readability and git tracking.
 *
 * Requirement: STE-03 (flat file artifacts)
 */

import { readFile, writeFile, access, readdir, unlink, mkdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

import type { FileStoreApi } from './types.js';

// ---------------------------------------------------------------------------
// FileStore
// ---------------------------------------------------------------------------

/**
 * Flat file store operating within the .sun/ directory.
 *
 * Files are organized by category (subdirectory):
 * - rules/ - Linter rules, conventions
 * - tribal/ - Tribal knowledge documents
 * - scenarios/ - Test/verification scenarios
 * - planning/ - Planning artifacts
 *
 * Path traversal is strictly prevented.
 */
export class FileStore implements FileStoreApi {
  private readonly sunDir: string;

  /**
   * @param sunDir - Absolute path to the .sun/ directory
   */
  constructor(sunDir: string) {
    this.sunDir = resolve(sunDir);
  }

  async read(category: string, filename: string): Promise<string | undefined> {
    const filePath = this.resolveSafePath(category, filename);

    try {
      return await readFile(filePath, 'utf-8');
    } catch (err: unknown) {
      if (isEnoent(err)) return undefined;
      throw err;
    }
  }

  async write(category: string, filename: string, content: string): Promise<void> {
    const filePath = this.resolveSafePath(category, filename);
    const dir = join(this.sunDir, category);

    // Ensure category directory exists
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }

  async delete(category: string, filename: string): Promise<boolean> {
    const filePath = this.resolveSafePath(category, filename);

    try {
      await unlink(filePath);
      return true;
    } catch (err: unknown) {
      if (isEnoent(err)) return false;
      throw err;
    }
  }

  async list(category: string): Promise<string[]> {
    const dirPath = this.resolveSafePath(category);

    try {
      return await readdir(dirPath);
    } catch (err: unknown) {
      if (isEnoent(err)) return [];
      throw err;
    }
  }

  async exists(category: string, filename: string): Promise<boolean> {
    const filePath = this.resolveSafePath(category, filename);

    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Resolve a safe path within .sun/, preventing directory traversal.
   *
   * @param category - Subdirectory name
   * @param filename - Optional filename within the category
   * @returns Absolute path that is guaranteed to be within .sun/
   * @throws Error if the resolved path escapes .sun/
   */
  private resolveSafePath(category: string, filename?: string): string {
    const parts = filename !== undefined
      ? [this.sunDir, category, filename]
      : [this.sunDir, category];

    const resolved = resolve(join(...parts));
    const rel = relative(this.sunDir, resolved);

    // Path traversal check:
    // - Relative path must not start with '..'
    // - Relative path must not be absolute (edge case on Windows)
    if (rel.startsWith('..') || resolve(rel) === rel) {
      throw new Error(
        `Path traversal denied: "${category}${filename ? '/' + filename : ''}" resolves outside .sun/`,
      );
    }

    return resolved;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Type guard for ENOENT errors.
 */
function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  );
}
