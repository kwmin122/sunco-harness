/**
 * @sunco/core - Permission Harness Tests
 *
 * Tests for ROLE_PERMISSIONS defaults and enforcePermissions validation.
 * Covers all 4 roles: research, planning, execution, verification.
 */

import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, enforcePermissions } from '../permission.js';
import { PermissionDeniedError } from '../errors.js';
import type { AgentRequest, PermissionSet } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    role: 'research',
    prompt: 'test prompt',
    permissions: {
      role: 'research',
      readPaths: ['**'],
      writePaths: [],
      allowTests: false,
      allowNetwork: false,
      allowGitWrite: false,
      allowCommands: [],
    },
    ...overrides,
  };
}

function makePermissions(
  role: PermissionSet['role'],
  overrides: Partial<PermissionSet> = {},
): PermissionSet {
  return {
    role,
    readPaths: ['**'],
    writePaths: [],
    allowTests: false,
    allowNetwork: false,
    allowGitWrite: false,
    allowCommands: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ROLE_PERMISSIONS defaults
// ---------------------------------------------------------------------------

describe('ROLE_PERMISSIONS', () => {
  it('maps research role to read-only with no write access', () => {
    const perms = ROLE_PERMISSIONS.research;
    expect(perms.readPaths).toEqual(['**']);
    expect(perms.writePaths).toEqual([]);
    expect(perms.allowTests).toBe(false);
    expect(perms.allowNetwork).toBe(false);
    expect(perms.allowGitWrite).toBe(false);
    expect(perms.allowCommands).toEqual([]);
  });

  it('maps planning role to .planning and .sun/planning write access', () => {
    const perms = ROLE_PERMISSIONS.planning;
    expect(perms.readPaths).toEqual(['**']);
    expect(perms.writePaths).toEqual(['.planning/**', '.sun/planning/**']);
    expect(perms.allowTests).toBe(false);
    expect(perms.allowNetwork).toBe(false);
    expect(perms.allowGitWrite).toBe(false);
    expect(perms.allowCommands).toEqual([]);
  });

  it('maps execution role to src/packages/tests write access with tests and git', () => {
    const perms = ROLE_PERMISSIONS.execution;
    expect(perms.readPaths).toEqual(['**']);
    expect(perms.writePaths).toEqual(['src/**', 'packages/**', 'tests/**']);
    expect(perms.allowTests).toBe(true);
    expect(perms.allowNetwork).toBe(false);
    expect(perms.allowGitWrite).toBe(true);
    expect(perms.allowCommands).toEqual(['npm test', 'npm run build']);
  });

  it('maps verification role to read-only with test permission', () => {
    const perms = ROLE_PERMISSIONS.verification;
    expect(perms.readPaths).toEqual(['**']);
    expect(perms.writePaths).toEqual([]);
    expect(perms.allowTests).toBe(true);
    expect(perms.allowNetwork).toBe(false);
    expect(perms.allowGitWrite).toBe(false);
    expect(perms.allowCommands).toEqual(['npm test', 'npx vitest']);
  });
});

// ---------------------------------------------------------------------------
// enforcePermissions - valid cases
// ---------------------------------------------------------------------------

describe('enforcePermissions - valid', () => {
  it('passes research role with read-only permissions', () => {
    const request = makeRequest({
      role: 'research',
      permissions: makePermissions('research'),
    });
    expect(() => enforcePermissions(request)).not.toThrow();
  });

  it('passes planning role with .planning write path', () => {
    const request = makeRequest({
      role: 'planning',
      permissions: makePermissions('planning', {
        writePaths: ['.planning/plan.md'],
      }),
    });
    expect(() => enforcePermissions(request)).not.toThrow();
  });

  it('passes execution role with src write path', () => {
    const request = makeRequest({
      role: 'execution',
      permissions: makePermissions('execution', {
        writePaths: ['src/index.ts'],
        allowTests: true,
        allowGitWrite: true,
        allowCommands: ['npm test'],
      }),
    });
    expect(() => enforcePermissions(request)).not.toThrow();
  });

  it('passes verification role with test permissions and no write paths', () => {
    const request = makeRequest({
      role: 'verification',
      permissions: makePermissions('verification', {
        allowTests: true,
        allowCommands: ['npm test'],
      }),
    });
    expect(() => enforcePermissions(request)).not.toThrow();
  });

  it('passes with stricter permissions than role defaults', () => {
    // Execution role but requesting only src/lib.ts (subset of src/**)
    const request = makeRequest({
      role: 'execution',
      permissions: makePermissions('execution', {
        writePaths: ['src/lib.ts'],
        allowTests: false, // stricter than default
        allowGitWrite: false, // stricter than default
        allowCommands: [], // stricter than default
      }),
    });
    expect(() => enforcePermissions(request)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// enforcePermissions - invalid cases
// ---------------------------------------------------------------------------

describe('enforcePermissions - invalid', () => {
  it('throws PermissionDeniedError when research role requests write path', () => {
    const request = makeRequest({
      role: 'research',
      permissions: makePermissions('research', {
        writePaths: ['src/index.ts'],
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('throws PermissionDeniedError when planning role writes outside .planning/', () => {
    const request = makeRequest({
      role: 'planning',
      permissions: makePermissions('planning', {
        writePaths: ['src/main.ts'],
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('throws PermissionDeniedError when research role requests allowTests', () => {
    const request = makeRequest({
      role: 'research',
      permissions: makePermissions('research', {
        allowTests: true,
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('throws PermissionDeniedError when research role requests allowNetwork', () => {
    const request = makeRequest({
      role: 'research',
      permissions: makePermissions('research', {
        allowNetwork: true,
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('throws PermissionDeniedError when research role requests allowGitWrite', () => {
    const request = makeRequest({
      role: 'research',
      permissions: makePermissions('research', {
        allowGitWrite: true,
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('throws PermissionDeniedError when verification role requests git write', () => {
    const request = makeRequest({
      role: 'verification',
      permissions: makePermissions('verification', {
        allowTests: true,
        allowGitWrite: true,
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('throws PermissionDeniedError when role requests disallowed command', () => {
    const request = makeRequest({
      role: 'research',
      permissions: makePermissions('research', {
        allowCommands: ['rm -rf /'],
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('throws PermissionDeniedError when execution role requests non-allowed command', () => {
    const request = makeRequest({
      role: 'execution',
      permissions: makePermissions('execution', {
        writePaths: ['src/index.ts'],
        allowTests: true,
        allowCommands: ['npm test', 'rm -rf /'],
      }),
    });
    expect(() => enforcePermissions(request)).toThrow(PermissionDeniedError);
  });

  it('includes permission name in error message', () => {
    const request = makeRequest({
      role: 'research',
      permissions: makePermissions('research', {
        allowGitWrite: true,
      }),
    });
    try {
      enforcePermissions(request);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionDeniedError);
      expect((err as PermissionDeniedError).permission).toContain('allowGitWrite');
    }
  });
});
