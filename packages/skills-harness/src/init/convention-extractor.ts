/**
 * @sunco/skills-harness - Convention Extractor
 *
 * AST-free regex-based analysis of source files to detect project conventions:
 * naming patterns, import style, export style, and test organization.
 *
 * Decision: D-03 (AST-free convention extraction via regex)
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type {
  NamingConvention,
  ImportStyle,
  ExportStyle,
  TestOrganization,
  ConventionResult,
} from './types.js';

/** Maximum number of files to sample */
const MAX_SAMPLE_SIZE = 50;

/** Source file extensions to analyze */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** Directories to exclude from sampling */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  'vendor',
  '__fixtures__',
  '__mocks__',
  '.git',
  'coverage',
  '.turbo',
]);

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------

/**
 * Recursively collect source file paths, excluding standard directories.
 */
async function collectSourceFiles(
  dir: string,
  files: string[],
  maxFiles: number,
): Promise<void> {
  if (files.length >= maxFiles) return;

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) break;

    // Skip excluded directories
    if (EXCLUDED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);

    let s;
    try {
      s = await stat(fullPath);
    } catch {
      continue;
    }

    if (s.isDirectory()) {
      await collectSourceFiles(fullPath, files, maxFiles);
    } else if (s.isFile() && SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Naming Detection
// ---------------------------------------------------------------------------

/** Regex to capture exported identifiers */
const EXPORT_NAME_RE =
  /^export\s+(?:function|const|let|var|class|type|interface|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;

/**
 * Classify an identifier name into a naming convention.
 */
function classifyName(name: string): NamingConvention | null {
  // Skip single-character names
  if (name.length <= 1) return null;

  // snake_case: contains underscore, all lowercase between underscores
  if (name.includes('_') && name === name.toLowerCase()) return 'snake_case';

  // kebab-case is not valid in JS identifiers, skip

  // PascalCase: starts with uppercase
  if (/^[A-Z]/.test(name)) return 'PascalCase';

  // camelCase: starts with lowercase, contains uppercase
  if (/^[a-z]/.test(name) && /[A-Z]/.test(name)) return 'camelCase';

  // all lowercase, no separator -- could be either, treat as camelCase
  if (/^[a-z]+$/.test(name)) return 'camelCase';

  return null;
}

/**
 * Detect the dominant naming convention from file contents.
 */
function detectNaming(contents: string[]): NamingConvention {
  const counts: Record<string, number> = {
    camelCase: 0,
    PascalCase: 0,
    snake_case: 0,
  };

  for (const content of contents) {
    let match: RegExpExecArray | null;
    // Reset regex state
    EXPORT_NAME_RE.lastIndex = 0;
    while ((match = EXPORT_NAME_RE.exec(content)) !== null) {
      const name = match[1]!;
      const convention = classifyName(name);
      if (convention && convention in counts) {
        counts[convention]!++;
      }
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return 'mixed';

  // Find dominant
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topName, topCount] = entries[0]!;
  const ratio = topCount / total;

  // Need >50% to declare a dominant convention
  if (ratio > 0.5) return topName as NamingConvention;
  return 'mixed';
}

// ---------------------------------------------------------------------------
// Import Style Detection
// ---------------------------------------------------------------------------

/** Regex to capture import source paths */
const IMPORT_PATH_RE = /^import\s+.+\s+from\s+['"](.+)['"]/gm;

/**
 * Detect the dominant import style from file contents.
 */
function detectImportStyle(contents: string[]): ImportStyle {
  let relative = 0;
  let alias = 0;

  for (const content of contents) {
    IMPORT_PATH_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_PATH_RE.exec(content)) !== null) {
      const path = match[1]!;
      if (path.startsWith('./') || path.startsWith('../')) {
        relative++;
      } else if (!path.startsWith('node:') && !isBareDependency(path)) {
        // Path aliases like @/utils, ~/lib, #src/foo
        alias++;
      }
      // Bare dependencies like 'vitest', 'node:fs' are not counted
    }
  }

  const total = relative + alias;
  if (total === 0) return 'relative'; // default

  const relativeRatio = relative / total;
  if (relativeRatio > 0.7) return 'relative';
  if (relativeRatio < 0.3) return 'alias';
  return 'mixed';
}

/**
 * Check if an import path is a bare npm dependency.
 */
function isBareDependency(importPath: string): boolean {
  // Scoped packages: @scope/name
  if (importPath.startsWith('@') && importPath.includes('/')) {
    const parts = importPath.split('/');
    // @scope/name or @scope/name/sub
    return parts.length >= 2 && !parts[0]!.includes('..');
  }
  // Regular packages: name or name/sub
  return !importPath.includes('/') || (
    !importPath.startsWith('.') &&
    !importPath.startsWith('~') &&
    !importPath.startsWith('#')
  );
}

// ---------------------------------------------------------------------------
// Export Style Detection
// ---------------------------------------------------------------------------

/** Regex for default exports */
const DEFAULT_EXPORT_RE = /^export\s+default\b/gm;

/** Regex for named exports (function, const, class, etc.) */
const NAMED_EXPORT_RE =
  /^export\s+(?:function|const|let|var|class|type|interface|enum)\s+/gm;

/**
 * Detect the dominant export style from file contents.
 */
function detectExportStyle(contents: string[]): ExportStyle {
  let defaults = 0;
  let named = 0;

  for (const content of contents) {
    DEFAULT_EXPORT_RE.lastIndex = 0;
    NAMED_EXPORT_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = DEFAULT_EXPORT_RE.exec(content)) !== null) {
      defaults++;
    }
    while ((match = NAMED_EXPORT_RE.exec(content)) !== null) {
      named++;
    }
  }

  const total = defaults + named;
  if (total === 0) return 'named'; // default

  const namedRatio = named / total;
  if (namedRatio > 0.7) return 'named';
  if (namedRatio < 0.3) return 'default';
  return 'mixed';
}

// ---------------------------------------------------------------------------
// Test Organization Detection
// ---------------------------------------------------------------------------

/**
 * Detect how tests are organized in the project.
 */
async function detectTestOrganization(cwd: string): Promise<TestOrganization> {
  // Check for __tests__/ directories
  const hasTestsDir = await dirExistsRecursive(cwd, '__tests__');
  if (hasTestsDir) return '__tests__';

  // Check for co-located test files (*.test.ts alongside source)
  const hasColocated = await hasColocatedTests(cwd);
  if (hasColocated) return 'co-located';

  // Check for top-level test/ or tests/ directory
  for (const name of ['test', 'tests']) {
    try {
      const s = await stat(join(cwd, name));
      if (s.isDirectory()) return 'top-level-test';
    } catch {
      // continue
    }
  }

  return 'unknown';
}

/**
 * Check if a directory name exists anywhere within src/.
 */
async function dirExistsRecursive(
  baseDir: string,
  targetName: string,
): Promise<boolean> {
  const srcDir = join(baseDir, 'src');
  try {
    await stat(srcDir);
  } catch {
    return false;
  }

  return searchForDir(srcDir, targetName);
}

async function searchForDir(dir: string, targetName: string): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    if (entry.isDirectory()) {
      if (entry.name === targetName) return true;
      if (await searchForDir(join(dir, entry.name), targetName)) return true;
    }
  }
  return false;
}

/**
 * Check for test files co-located with source files in src/.
 */
async function hasColocatedTests(cwd: string): Promise<boolean> {
  const srcDir = join(cwd, 'src');
  try {
    await stat(srcDir);
  } catch {
    return false;
  }

  return searchForColocatedTests(srcDir);
}

async function searchForColocatedTests(dir: string): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return false;
  }

  // Check if any .test.ts/.test.tsx/.test.js/.test.jsx file exists alongside a source file
  const testFiles = entries.filter((e) =>
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(e),
  );
  if (testFiles.length > 0) return true;

  // Recurse into subdirectories (skip __tests__ to avoid false positives)
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry) || entry === '__tests__') continue;
    try {
      const s = await stat(join(dir, entry));
      if (s.isDirectory()) {
        if (await searchForColocatedTests(join(dir, entry))) return true;
      }
    } catch {
      // skip
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Extract conventions from a project by sampling source files.
 *
 * Analyzes up to 50 source files (.ts, .tsx, .js, .jsx) to detect:
 * - Naming convention (camelCase, PascalCase, snake_case, mixed)
 * - Import style (relative, alias, mixed)
 * - Export style (named, default, mixed)
 * - Test organization (__tests__, co-located, top-level-test, unknown)
 *
 * Excludes node_modules, dist, build, .next, vendor, __fixtures__, __mocks__.
 *
 * @param opts - Options with cwd (project root path)
 * @returns ConventionResult with detected conventions
 */
export async function extractConventions(opts: {
  cwd: string;
}): Promise<ConventionResult> {
  const { cwd } = opts;

  // Collect source files (from cwd, not just src/)
  const files: string[] = [];
  await collectSourceFiles(cwd, files, MAX_SAMPLE_SIZE);

  // Read file contents
  const contents: string[] = [];
  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      contents.push(content);
    } catch {
      // skip unreadable files
    }
  }

  // Detect test organization (structural, not content-based)
  const testOrganization = await detectTestOrganization(cwd);

  return {
    naming: detectNaming(contents),
    importStyle: detectImportStyle(contents),
    exportStyle: detectExportStyle(contents),
    testOrganization,
    sampleSize: files.length,
  };
}
