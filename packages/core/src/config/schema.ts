/**
 * @sunco/core - Config Schema Validation
 *
 * Re-exports SunConfigSchema from config/types.ts and provides
 * validateConfig() that wraps Zod parsing with user-friendly ConfigError.
 *
 * On validation failure, catches ZodError and re-throws as ConfigError
 * with field paths for clear user diagnostics.
 */

import { ZodError } from 'zod';
import { SunConfigSchema } from './types.js';
import { ConfigError } from '../errors/index.js';
import type { SunConfig } from './types.js';

export { SunConfigSchema } from './types.js';

/**
 * Validate and fill defaults for a raw config object.
 *
 * @param raw - Parsed TOML data (unknown shape)
 * @returns Validated SunConfig with all defaults filled
 * @throws ConfigError with field paths when validation fails
 */
export function validateConfig(raw: unknown): SunConfig {
  try {
    return SunConfigSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const lines = err.issues.map((issue) => {
        const path = issue.path.join('.');
        return `  ${path}: ${issue.message}`;
      });
      throw new ConfigError(
        `Config validation failed:\n${lines.join('\n')}`,
        { issues: err.issues },
        { cause: err },
      );
    }
    throw err;
  }
}
