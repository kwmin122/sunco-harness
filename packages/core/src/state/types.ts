/**
 * @sunco/core - State Engine Types
 *
 * Types for the dual state engine: SQLite (structured state) + flat files (human-readable artifacts).
 * .sun/ directory manages both concerns.
 *
 * Decisions: STE-01 (.sun/ structure), STE-02 (SQLite WAL), STE-03 (flat files),
 * STE-04 (parallel safety), STE-05 (state API)
 */

// ---------------------------------------------------------------------------
// .sun/ Directory Structure (STE-01)
// ---------------------------------------------------------------------------

/**
 * Canonical .sun/ directory layout.
 * All paths are relative to the project root.
 */
export const SUN_DIR_STRUCTURE = {
  /** Root .sun directory */
  root: '.sun',
  /** SQLite database */
  db: '.sun/state.db',
  /** SQLite WAL file */
  dbWal: '.sun/state.db-wal',
  /** SQLite shared memory file */
  dbShm: '.sun/state.db-shm',
  /** TOML project config */
  config: '.sun/config.toml',
  /** Rules directory (linter rules, conventions) */
  rules: '.sun/rules',
  /** Tribal knowledge directory */
  tribal: '.sun/tribal',
  /** Scenario files */
  scenarios: '.sun/scenarios',
  /** Planning artifacts */
  planning: '.sun/planning',
  /** Agent logs */
  logs: '.sun/logs',
  /** Gitignore for .sun/ (keep config, ignore db) */
  gitignore: '.sun/.gitignore',
} as const;

export type SunDirKey = keyof typeof SUN_DIR_STRUCTURE;

// ---------------------------------------------------------------------------
// StateApi (STE-05: SQLite-backed structured state)
// ---------------------------------------------------------------------------

/**
 * Structured state API backed by SQLite WAL mode.
 * Key-value store with namespace support.
 */
export interface StateApi {
  /**
   * Get a value by key. Returns undefined if not found.
   * @param key - Dot-separated key (e.g., 'analysis.result', 'skill.lastRun')
   */
  get<T = unknown>(key: string): Promise<T | undefined>;

  /**
   * Set a value by key. Serializes to JSON internally.
   * @param key - Dot-separated key
   * @param value - JSON-serializable value
   */
  set<T = unknown>(key: string, value: T): Promise<void>;

  /**
   * Delete a key.
   * @param key - Dot-separated key
   * @returns true if the key existed and was deleted
   */
  delete(key: string): Promise<boolean>;

  /**
   * List all keys matching a prefix.
   * @param prefix - Key prefix (e.g., 'skill.' lists all skill-related keys)
   * @returns Array of matching keys
   */
  list(prefix?: string): Promise<string[]>;

  /**
   * Check if a key exists.
   */
  has(key: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// FileStoreApi (STE-03: flat file artifacts)
// ---------------------------------------------------------------------------

/**
 * Flat file API for human-readable artifacts in .sun/.
 * Version-controlled content (rules, tribal knowledge, scenarios).
 *
 * `active-work.json` at `.sun/active-work.json` is not accessed via FileStore; it is managed by `active-work.ts`.
 */
export interface FileStoreApi {
  /**
   * Read a file from .sun/ subdirectory.
   * @param category - Subdirectory (e.g., 'rules', 'tribal', 'scenarios')
   * @param filename - File name within the category
   * @returns File content as string, or undefined if not found
   */
  read(category: string, filename: string): Promise<string | undefined>;

  /**
   * Write a file to .sun/ subdirectory.
   * Creates the category directory if it doesn't exist.
   * @param category - Subdirectory
   * @param filename - File name
   * @param content - File content
   */
  write(category: string, filename: string, content: string): Promise<void>;

  /**
   * Delete a file from .sun/ subdirectory.
   * @returns true if the file existed and was deleted
   */
  delete(category: string, filename: string): Promise<boolean>;

  /**
   * List all files in a .sun/ subdirectory.
   * @param category - Subdirectory
   * @returns Array of filenames (not full paths)
   */
  list(category: string): Promise<string[]>;

  /**
   * Check if a file exists.
   */
  exists(category: string, filename: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// StateEngine (combined interface for the full state subsystem)
// ---------------------------------------------------------------------------

/**
 * State engine combining SQLite state and flat file store.
 * Created once at CLI startup, passed through SkillContext.
 */
export interface StateEngine {
  /** SQLite-backed structured state */
  readonly state: StateApi;

  /** Flat file artifact store */
  readonly fileStore: FileStoreApi;

  /**
   * Initialize the .sun/ directory and SQLite database.
   * Creates directories, sets WAL mode, runs migrations.
   */
  initialize(projectRoot: string): Promise<void>;

  /**
   * Close the SQLite database connection.
   * Must be called on process exit.
   */
  close(): Promise<void>;
}
