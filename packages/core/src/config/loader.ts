/**
 * @sunco/core - Three-Layer TOML Config Loader
 *
 * Loads config from three layers in priority order:
 *   1. Global:    ~/.sun/config.toml     (lowest priority)
 *   2. Project:   {projectRoot}/.sun/config.toml
 *   3. Directory: {cwd}/.sun.toml        (highest priority)
 *
 * Missing files are silently skipped. Invalid TOML throws ConfigError
 * with file path and line/column. Result is validated via Zod and frozen.
 *
 * Decisions: CFG-01 (TOML format), CFG-02 (merge semantics), CFG-03 (Zod validation)
 */

import { readFile, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { deepMerge } from './merger.js';
import { validateConfig } from './schema.js';
import { ConfigError } from '../errors/index.js';
import type { SunConfig } from './types.js';

/** Options for loadConfig, mainly for testing */
export interface LoadConfigOptions {
  /** Override home directory (default: os.homedir()) */
  homeDir?: string;
}

/**
 * Try to read and parse a TOML file. Returns empty object if file not found.
 * Throws ConfigError if TOML syntax is invalid.
 */
async function readTomlFile(filePath: string): Promise<Record<string, unknown>> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    // File not found -- silently skip
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }

  try {
    return parseToml(content) as Record<string, unknown>;
  } catch (err: unknown) {
    // smol-toml throws TomlError with line/column
    const tomlErr = err as Error & { line?: number; column?: number };
    throw new ConfigError(
      `Invalid TOML in ${filePath}: ${tomlErr.message}`,
      {
        filePath,
        line: tomlErr.line,
        column: tomlErr.column,
      },
      { cause: err },
    );
  }
}

/**
 * Walk up from cwd to find the project root.
 * Project root is identified by a `.sun/` directory or `package.json` file.
 * Returns null if no project root found (reached filesystem root).
 */
async function findProjectRoot(cwd: string): Promise<string | null> {
  let current = resolve(cwd);
  const root = dirname(current);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Check for .sun/ directory
    try {
      await access(join(current, '.sun'));
      return current;
    } catch {
      // not found, continue
    }

    // Check for package.json as fallback project root marker
    try {
      await access(join(current, 'package.json'));
      return current;
    } catch {
      // not found, continue
    }

    // Move up one directory
    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return null;
    }
    current = parent;
  }
}

/**
 * Load SUNCO config from three layers, merge, validate, and freeze.
 *
 * @param cwd - Current working directory to start searching from
 * @param options - Optional overrides (homeDir for testing)
 * @returns Validated, frozen SunConfig with all defaults filled
 * @throws ConfigError on invalid TOML syntax or validation failure
 */
export async function loadConfig(
  cwd: string,
  options?: LoadConfigOptions,
): Promise<Readonly<SunConfig>> {
  const home = options?.homeDir ?? homedir();

  // Layer 1: Global config
  const globalConfig = await readTomlFile(join(home, '.sun', 'config.toml'));

  // Layer 2: Project config (find project root by walking up)
  const projectRoot = await findProjectRoot(cwd);
  const projectConfig = projectRoot
    ? await readTomlFile(join(projectRoot, '.sun', 'config.toml'))
    : {};

  // Layer 3: Directory config (cwd/.sun.toml)
  const dirConfig = await readTomlFile(join(cwd, '.sun.toml'));

  // Merge: global <- project <- directory
  const merged = deepMerge(deepMerge(globalConfig, projectConfig), dirConfig);

  // Validate via Zod (fills defaults, throws ConfigError on bad values)
  const validated = validateConfig(merged);

  // Freeze and return
  return Object.freeze(validated);
}
