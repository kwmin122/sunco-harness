/**
 * @sunco/core - SQLite WAL Database for Structured State
 *
 * Provides a key-value state store backed by SQLite in WAL mode.
 * Wraps better-sqlite3 (synchronous) with an async interface for future compatibility.
 *
 * Requirements: STE-02 (SQLite WAL), STE-04 (parallel safety), STE-05 (state API)
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType, Statement } from 'better-sqlite3';

import type { StateApi } from './types.js';

// ---------------------------------------------------------------------------
// SQL Statements
// ---------------------------------------------------------------------------

const SQL_CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const SQL_GET = 'SELECT value FROM state WHERE key = ?';
const SQL_SET = `INSERT OR REPLACE INTO state (key, value, updated_at) VALUES (?, ?, datetime('now'))`;
const SQL_DELETE = 'DELETE FROM state WHERE key = ?';
const SQL_LIST_ALL = 'SELECT key FROM state';
const SQL_LIST_PREFIX = 'SELECT key FROM state WHERE key LIKE ?';
const SQL_HAS = 'SELECT 1 FROM state WHERE key = ?';

// ---------------------------------------------------------------------------
// StateDatabase
// ---------------------------------------------------------------------------

/**
 * SQLite-backed state database implementing StateApi.
 *
 * Configuration:
 * - WAL journal mode for concurrent read access
 * - busy_timeout=5000 for write contention tolerance
 * - synchronous=NORMAL for balanced durability/performance
 */
export class StateDatabase implements StateApi {
  private readonly db: DatabaseType;
  private readonly stmtGet: Statement;
  private readonly stmtSet: Statement;
  private readonly stmtDelete: Statement;
  private readonly stmtListAll: Statement;
  private readonly stmtListPrefix: Statement;
  private readonly stmtHas: Statement;

  /** WAL journal mode value (for testing) */
  readonly journalMode: string;

  /** busy_timeout value (for testing) */
  readonly busyTimeout: number;

  /** synchronous pragma value (for testing) */
  readonly synchronous: number;

  private closed = false;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);

    // Set PRAGMAs before any table operations
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');

    // Read back PRAGMA values for verification
    this.journalMode = (this.db.pragma('journal_mode', { simple: true }) as string).toLowerCase();
    this.busyTimeout = this.db.pragma('busy_timeout', { simple: true }) as number;
    this.synchronous = this.db.pragma('synchronous', { simple: true }) as number;

    // Create the state table
    this.db.exec(SQL_CREATE_TABLE);

    // Prepare statements for performance
    this.stmtGet = this.db.prepare(SQL_GET);
    this.stmtSet = this.db.prepare(SQL_SET);
    this.stmtDelete = this.db.prepare(SQL_DELETE);
    this.stmtListAll = this.db.prepare(SQL_LIST_ALL);
    this.stmtListPrefix = this.db.prepare(SQL_LIST_PREFIX);
    this.stmtHas = this.db.prepare(SQL_HAS);
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const row = this.stmtGet.get(key) as { value: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.value) as T;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.stmtSet.run(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<boolean> {
    const result = this.stmtDelete.run(key);
    return result.changes > 0;
  }

  async list(prefix?: string): Promise<string[]> {
    let rows: Array<{ key: string }>;

    if (prefix !== undefined) {
      rows = this.stmtListPrefix.all(`${prefix}%`) as Array<{ key: string }>;
    } else {
      rows = this.stmtListAll.all() as Array<{ key: string }>;
    }

    return rows.map((row) => row.key);
  }

  async has(key: string): Promise<boolean> {
    const row = this.stmtHas.get(key);
    return row !== undefined;
  }

  /**
   * Close the database connection.
   * Safe to call multiple times.
   */
  close(): void {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new StateDatabase at the given path.
 *
 * @param dbPath - Absolute path to the SQLite database file
 * @returns StateDatabase instance (also implements StateApi)
 */
export function createDatabase(dbPath: string): StateDatabase {
  return new StateDatabase(dbPath);
}
