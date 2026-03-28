/**
 * @sunco/core - Permission Harness
 *
 * Enforces permission boundaries before agent dispatch.
 * Role-based defaults per D-04/AGT-04, glob path matching with picomatch.
 *
 * Decisions: D-19 (PermissionSet), D-23 (role defaults), D-29 (hard enforcement)
 */

import { createRequire } from 'node:module';
import { PermissionDeniedError } from './errors.js';
import type { AgentRequest, AgentRole, PermissionSet } from './types.js';

// picomatch is CJS, use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const picomatch = require('picomatch') as (
  pattern: string | string[],
  options?: { dot?: boolean },
) => (input: string) => boolean;

// ---------------------------------------------------------------------------
// Role Permission Defaults (D-23, AGT-04)
// ---------------------------------------------------------------------------

/**
 * Default permission constraints per agent role.
 * These represent the MAXIMUM permissions a role can have.
 * A request can be stricter, but never more permissive.
 */
export const ROLE_PERMISSIONS: Record<AgentRole, Omit<PermissionSet, 'role'>> = {
  research: {
    readPaths: ['**'],
    writePaths: [],
    allowTests: false,
    allowNetwork: false,
    allowGitWrite: false,
    allowCommands: [],
  },
  planning: {
    readPaths: ['**'],
    writePaths: ['.planning/**', '.sun/planning/**'],
    allowTests: false,
    allowNetwork: false,
    allowGitWrite: false,
    allowCommands: [],
  },
  execution: {
    readPaths: ['**'],
    writePaths: ['src/**', 'packages/**', 'tests/**'],
    allowTests: true,
    allowNetwork: false,
    allowGitWrite: true,
    allowCommands: ['npm test', 'npm run build'],
  },
  verification: {
    readPaths: ['**'],
    writePaths: [],
    allowTests: true,
    allowNetwork: false,
    allowGitWrite: false,
    allowCommands: ['npm test'],
  },
};

// ---------------------------------------------------------------------------
// Permission Enforcement
// ---------------------------------------------------------------------------

/**
 * Enforce that a request's permissions do not exceed the role's defaults.
 * Throws PermissionDeniedError on any violation.
 *
 * Rules:
 * - Boolean permissions: request cannot be true if role default is false
 * - Write paths: each requested path must match at least one role default glob
 * - Commands: each requested command must be in the role's allowed list
 */
export function enforcePermissions(request: AgentRequest): void {
  const role = request.role;
  const defaults = ROLE_PERMISSIONS[role];
  const perms = request.permissions;

  // Boolean permissions: cannot escalate beyond role defaults
  if (perms.allowTests && !defaults.allowTests) {
    throw new PermissionDeniedError(
      'permission-harness',
      'allowTests not permitted for role: ' + role,
    );
  }

  if (perms.allowNetwork && !defaults.allowNetwork) {
    throw new PermissionDeniedError(
      'permission-harness',
      'allowNetwork not permitted for role: ' + role,
    );
  }

  if (perms.allowGitWrite && !defaults.allowGitWrite) {
    throw new PermissionDeniedError(
      'permission-harness',
      'allowGitWrite not permitted for role: ' + role,
    );
  }

  // Write paths: each requested path must match at least one role default glob
  if (perms.writePaths.length > 0) {
    if (defaults.writePaths.length === 0) {
      throw new PermissionDeniedError(
        'permission-harness',
        `writePaths not permitted for role: ${role} (requested: ${perms.writePaths.join(', ')})`,
      );
    }

    const isAllowed = picomatch(defaults.writePaths, { dot: true });
    for (const path of perms.writePaths) {
      if (!isAllowed(path)) {
        throw new PermissionDeniedError(
          'permission-harness',
          `writePath '${path}' not permitted for role: ${role}`,
        );
      }
    }
  }

  // Commands: each requested command must be in the role's allowed list
  for (const cmd of perms.allowCommands) {
    if (!defaults.allowCommands.includes(cmd)) {
      throw new PermissionDeniedError(
        'permission-harness',
        `command '${cmd}' not permitted for role: ${role}`,
      );
    }
  }
}
