/**
 * @sunco/core - State Engine Module
 *
 * Public API for the dual state engine: SQLite + flat files.
 */

// Types
export type { StateApi, FileStoreApi, StateEngine, SunDirKey } from './types.js';
export { SUN_DIR_STRUCTURE } from './types.js';

// Directory management
export { initSunDirectory, ensureSunDir } from './directory.js';

// Database
export { createDatabase, StateDatabase } from './database.js';

// File store
export { FileStore } from './file-store.js';

// Factory
export { createStateEngine } from './api.js';
