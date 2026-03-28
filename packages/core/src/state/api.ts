/**
 * @sunco/core - State Engine API
 *
 * Combined entry point creating a StateEngine with both
 * SQLite-backed state (StateApi) and flat file store (FileStoreApi).
 *
 * Usage:
 *   const engine = createStateEngine();
 *   await engine.initialize(projectRoot);
 *   await engine.state.set('key', value);
 *   const content = await engine.fileStore.read('rules', 'arch.md');
 *   await engine.close();
 *
 * Requirements: STE-01 through STE-05
 */

import { join } from 'node:path';

import type { StateEngine } from './types.js';
import { SUN_DIR_STRUCTURE } from './types.js';
import { initSunDirectory } from './directory.js';
import { createDatabase, StateDatabase } from './database.js';
import { FileStore } from './file-store.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a StateEngine instance.
 *
 * Call initialize(projectRoot) before using state/fileStore.
 * Call close() when done (e.g., on process exit).
 *
 * @returns StateEngine with uninitialized state and fileStore
 */
export function createStateEngine(): StateEngine {
  let db: StateDatabase | null = null;
  let files: FileStore | null = null;

  const engine: StateEngine = {
    get state() {
      if (!db) throw new Error('StateEngine not initialized. Call initialize() first.');
      return db;
    },

    get fileStore() {
      if (!files) throw new Error('StateEngine not initialized. Call initialize() first.');
      return files;
    },

    async initialize(projectRoot: string): Promise<void> {
      // Create .sun/ directory structure
      await initSunDirectory(projectRoot);

      const sunDir = join(projectRoot, SUN_DIR_STRUCTURE.root);

      // Initialize SQLite database
      const dbPath = join(projectRoot, SUN_DIR_STRUCTURE.db);
      db = createDatabase(dbPath);

      // Initialize flat file store
      files = new FileStore(sunDir);
    },

    async close(): Promise<void> {
      if (db) {
        db.close();
        db = null;
      }
      files = null;
    },
  };

  return engine;
}
