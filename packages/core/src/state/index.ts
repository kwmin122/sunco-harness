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

// Active-work dashboard artifact (Phase 27)
export {
  readActiveWork,
  writeActiveWork,
  appendBackgroundWork,
  appendRoutingMiss,
  ACTIVE_WORK_PATH,
  DEFAULT_ACTIVE_WORK,
} from './active-work.js';
export type {
  Category,
  ActivePhase,
  BackgroundWorkItem,
  BlockedOn,
  NextRecommendedAction,
  RecentSkillCall,
  RoutingMiss,
  ActiveWork,
  ActiveWorkPatch,
} from './active-work.types.js';
export { ActiveWorkSchema, CATEGORIES, ACTIVE_WORK_VERSION } from './active-work.types.js';
