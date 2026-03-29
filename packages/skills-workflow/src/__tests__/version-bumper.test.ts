/**
 * Tests for version-bumper.ts (Phase 8, SHP-01, SHP-02)
 *
 * Verifies:
 * - bumpVersion increments major/minor/patch correctly
 * - bumpVersion resets lower components to 0
 * - bumpVersion handles 0.0.0 edge case
 * - updateAllVersions finds all workspace package.json and updates version field
 * - updateAllVersions returns list of updated relative paths
 * - updateAllVersions ignores node_modules
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted ensures variables are available in vi.mock factory)
// ---------------------------------------------------------------------------

const { mockGlob, mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockGlob: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock('glob', () => ({
  glob: mockGlob,
}));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { bumpVersion, updateAllVersions } from '../shared/version-bumper.js';

// ---------------------------------------------------------------------------
// bumpVersion tests
// ---------------------------------------------------------------------------

describe('bumpVersion', () => {
  it('increments patch version', () => {
    expect(bumpVersion('1.0.0', 'patch')).toBe('1.0.1');
  });

  it('increments minor version and resets patch', () => {
    expect(bumpVersion('1.0.0', 'minor')).toBe('1.1.0');
  });

  it('increments major version and resets minor+patch', () => {
    expect(bumpVersion('1.0.0', 'major')).toBe('2.0.0');
  });

  it('handles 0.0.0 edge case', () => {
    expect(bumpVersion('0.0.0', 'patch')).toBe('0.0.1');
  });

  it('increments minor and resets patch for non-zero versions', () => {
    expect(bumpVersion('2.3.4', 'minor')).toBe('2.4.0');
  });

  it('increments major and resets minor+patch for non-zero versions', () => {
    expect(bumpVersion('2.3.4', 'major')).toBe('3.0.0');
  });

  it('increments patch for non-zero versions', () => {
    expect(bumpVersion('2.3.4', 'patch')).toBe('2.3.5');
  });
});

// ---------------------------------------------------------------------------
// updateAllVersions tests
// ---------------------------------------------------------------------------

describe('updateAllVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds all package.json files and updates version', async () => {
    mockGlob.mockResolvedValue(['package.json', 'packages/core/package.json']);

    const pkg1 = { name: 'root', version: '0.1.0' };
    const pkg2 = { name: '@sunco/core', version: '0.1.0' };

    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(pkg1, null, 2))
      .mockResolvedValueOnce(JSON.stringify(pkg2, null, 2));

    mockWriteFile.mockResolvedValue(undefined);

    const result = await updateAllVersions('/project', '1.0.0');

    expect(result).toEqual(['package.json', 'packages/core/package.json']);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);

    // Verify first package.json was updated with correct version
    const written1 = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written1.version).toBe('1.0.0');

    const written2 = JSON.parse(mockWriteFile.mock.calls[1][1] as string);
    expect(written2.version).toBe('1.0.0');
  });

  it('skips package.json files without version field', async () => {
    mockGlob.mockResolvedValue(['package.json', 'tools/package.json']);

    const pkg1 = { name: 'root', version: '0.1.0' };
    const pkg2 = { name: 'tools', private: true }; // no version

    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(pkg1, null, 2))
      .mockResolvedValueOnce(JSON.stringify(pkg2, null, 2));

    mockWriteFile.mockResolvedValue(undefined);

    const result = await updateAllVersions('/project', '1.0.0');

    expect(result).toEqual(['package.json']);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it('passes correct glob options to exclude node_modules', async () => {
    mockGlob.mockResolvedValue([]);
    mockWriteFile.mockResolvedValue(undefined);

    await updateAllVersions('/project', '1.0.0');

    expect(mockGlob).toHaveBeenCalledWith('**/package.json', {
      cwd: '/project',
      ignore: ['**/node_modules/**'],
    });
  });

  it('returns empty array when no package.json found', async () => {
    mockGlob.mockResolvedValue([]);

    const result = await updateAllVersions('/project', '1.0.0');

    expect(result).toEqual([]);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
