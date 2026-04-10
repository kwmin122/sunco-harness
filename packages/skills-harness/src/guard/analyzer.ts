/**
 * @sunco/skills-harness - Guard Analyzer
 *
 * Shared analysis engine for single-run and watch mode.
 * Combines lint results + anti-pattern detection + tribal knowledge matching.
 *
 * analyzeFile: per-file analysis (used in watch mode on each change)
 * analyzeProject: full project scan (used in single-run mode)
 *
 * Decisions: D-22 (incremental linting), D-23 (two modes share same engine),
 * D-24 (tribal knowledge as soft warnings)
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, isAbsolute } from 'node:path';
import type { StateApi, FileStoreApi } from '@sunco/core';
import type { BoundariesConfig, SunLintViolation } from '../lint/types.js';
import type {
  AntiPatternMatch,
  GuardResult,
  TribalPattern,
  TribalWarning,
} from './types.js';
import { lintSingleFile } from './incremental-linter.js';
import { loadTribalPatterns } from './tribal-loader.js';
import { detectPromotionCandidates } from './promoter.js';

// ---------------------------------------------------------------------------
// Anti-pattern Definitions (shared with health/pattern-tracker)
// ---------------------------------------------------------------------------

interface PatternDef {
  id: string;
  regex: RegExp;
}

/**
 * Anti-pattern definitions for scanning source files.
 * Same patterns as health/pattern-tracker but used per-line for line-level matches.
 */
const ANTI_PATTERNS: PatternDef[] = [
  { id: 'any-type', regex: /:\s*any[\s;,)]/g },
  { id: 'any-type', regex: /as\s+any/g },
  { id: 'console-log', regex: /console\.(log|warn|error)\(/g },
  { id: 'todo-comment', regex: /\/\/\s*(TODO|FIXME|HACK|XXX)/gi },
  { id: 'type-assertion', regex: /as\s+[A-Z]/g },
  { id: 'eslint-disable', regex: /eslint-disable/g },
];

/** Source file extensions to scan */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** Directories to exclude from scanning */
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.sun', '.git', 'coverage',
  '.next', '.turbo', '__fixtures__', '__mocks__',
]);

// ---------------------------------------------------------------------------
// Per-line Anti-pattern Scanning
// ---------------------------------------------------------------------------

/**
 * Scan file content line-by-line for anti-patterns.
 * Returns line-level matches (unlike health/pattern-tracker which counts totals).
 */
function scanAntiPatterns(filePath: string, content: string): AntiPatternMatch[] {
  const lines = content.split('\n');
  const matches: AntiPatternMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const pattern of ANTI_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(line)) !== null) {
        matches.push({
          pattern: pattern.id,
          file: filePath,
          line: i + 1,
          match: match[0],
        });
      }
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Tribal Knowledge Matching
// ---------------------------------------------------------------------------

/**
 * Check file content against tribal knowledge patterns.
 * Returns warnings for each matching line.
 */
function matchTribalPatterns(
  filePath: string,
  content: string,
  tribalPatterns: TribalPattern[],
): TribalWarning[] {
  if (tribalPatterns.length === 0) return [];

  const lines = content.split('\n');
  const warnings: TribalWarning[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const tribal of tribalPatterns) {
      tribal.pattern.lastIndex = 0;
      if (tribal.pattern.test(line)) {
        warnings.push({
          source: tribal.source,
          pattern: tribal.id,
          file: filePath,
          line: i + 1,
          message: tribal.message,
        });
      }
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------

/**
 * Recursively collect source files for scanning.
 */
async function collectSourceFiles(dir: string, files: string[]): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);
    let s;
    try {
      s = await stat(fullPath);
    } catch {
      continue;
    }

    if (s.isDirectory()) {
      await collectSourceFiles(fullPath, files);
    } else if (s.isFile() && SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
}

async function collectSpecifiedSourceFiles(cwd: string, files: readonly string[]): Promise<string[]> {
  const sourceFiles: string[] = [];

  for (const file of files) {
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue;

    const fullPath = isAbsolute(file) ? file : join(cwd, file);
    try {
      const s = await stat(fullPath);
      if (s.isFile()) {
        sourceFiles.push(fullPath);
      }
    } catch {
      // Ignore deleted or non-existent files from a git diff.
    }
  }

  return sourceFiles;
}

// ---------------------------------------------------------------------------
// Main Exports
// ---------------------------------------------------------------------------

/**
 * Analyze a single file: run incremental lint + anti-pattern detection + tribal matching.
 *
 * Used by both single-run (per file) and watch mode (on file change).
 *
 * @param opts - File path, content, boundaries config, tribal patterns, cwd
 * @returns Combined analysis results for the single file
 */
export async function analyzeFile(opts: {
  filePath: string;
  fileContent: string;
  boundariesConfig: BoundariesConfig;
  tribalPatterns: TribalPattern[];
  cwd: string;
}): Promise<{
  violations: SunLintViolation[];
  antiPatterns: AntiPatternMatch[];
  tribalWarnings: TribalWarning[];
}> {
  const { filePath, fileContent, boundariesConfig, tribalPatterns, cwd } = opts;

  // Run incremental lint
  const violations = await lintSingleFile({
    filePath,
    fileContent,
    boundariesConfig,
    cwd,
  });

  // Scan for anti-patterns
  const antiPatterns = scanAntiPatterns(filePath, fileContent);

  // Match tribal knowledge patterns
  const tribalWarnings = matchTribalPatterns(filePath, fileContent, tribalPatterns);

  return { violations, antiPatterns, tribalWarnings };
}

/**
 * Analyze the entire project: scan all source files and aggregate results.
 *
 * Used in single-run mode (`sunco guard` without --watch).
 *
 * @param opts - Working directory, FileStore, State, boundaries config
 * @returns Aggregated GuardResult for the whole project
 */
export async function analyzeProject(opts: {
  cwd: string;
  fileStore: FileStoreApi;
  state: StateApi;
  boundariesConfig: BoundariesConfig;
  files?: readonly string[];
}): Promise<GuardResult> {
  const { cwd, fileStore, state, boundariesConfig, files } = opts;

  // Load tribal patterns from .sun/tribal/
  const tribalPatterns = await loadTribalPatterns(fileStore);

  // Collect source files
  const filePaths: string[] = files && files.length > 0
    ? await collectSpecifiedSourceFiles(cwd, files)
    : [];
  if (!files || files.length === 0) {
    await collectSourceFiles(cwd, filePaths);
  }

  // Analyze each file
  const allViolations: SunLintViolation[] = [];
  const allAntiPatterns: AntiPatternMatch[] = [];
  const allTribalWarnings: TribalWarning[] = [];

  for (const fullPath of filePaths) {
    let content: string;
    try {
      content = await readFile(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const relativePath = fullPath.startsWith(cwd) ? fullPath.slice(cwd.length + 1) : fullPath;

    const result = await analyzeFile({
      filePath: relativePath,
      fileContent: content,
      boundariesConfig,
      tribalPatterns,
      cwd,
    });

    allViolations.push(...result.violations);
    allAntiPatterns.push(...result.antiPatterns);
    allTribalWarnings.push(...result.tribalWarnings);
  }

  // Detect promotion candidates
  const promotionSuggestions = await detectPromotionCandidates({
    antiPatterns: allAntiPatterns,
    state,
  });

  return {
    filesAnalyzed: filePaths.length,
    lintViolations: allViolations,
    antiPatterns: allAntiPatterns,
    promotionSuggestions,
    tribalWarnings: allTribalWarnings,
  };
}
