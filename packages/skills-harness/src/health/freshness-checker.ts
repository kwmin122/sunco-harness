/**
 * @sunco/skills-harness - Document Freshness Checker
 *
 * Detects stale documentation by comparing file modification times between
 * docs and related code files. Also checks cross-references for broken links.
 *
 * Decision: D-12 (freshness detection via mtime comparison)
 */

import { readdir, readFile, stat, access } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import type { FreshnessResult, StaleDocument, BrokenReference } from './types.js';

/** Staleness threshold in days */
const STALE_THRESHOLD_DAYS = 7;

/** Penalty per broken reference (subtracted from score) */
const BROKEN_REF_PENALTY = 5;

/** Extensions considered as documentation */
const DOC_EXTENSIONS = new Set(['.md', '.mdx']);

/** Extensions considered as code files */
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs']);

/** Directories to exclude from scanning */
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.sun', '.git', 'coverage', '.next', '.turbo',
]);

/** Regex to match markdown links: [text](./path) */
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((\.[^)]+)\)/g;

/** Regex to match @see references: @see path */
const SEE_REF_RE = /@see\s+(\.\S+)/g;

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------

/**
 * Recursively collect documentation files.
 */
async function collectDocFiles(dir: string, files: string[]): Promise<void> {
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
      await collectDocFiles(fullPath, files);
    } else if (s.isFile() && DOC_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
}

/**
 * Recursively collect code files.
 */
async function collectCodeFiles(dir: string, files: string[]): Promise<void> {
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
      await collectCodeFiles(fullPath, files);
    } else if (s.isFile() && CODE_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Staleness Detection
// ---------------------------------------------------------------------------

/**
 * Find the most recent modification time of code files related to a doc.
 * Related code = files in the same directory, its children, parent directory,
 * or sibling directories (children of parent). This ensures docs in `docs/`
 * find related code in `src/`.
 */
async function findRelatedCodeMtime(
  docPath: string,
  allCodeFiles: string[],
): Promise<Date | null> {
  const docDir = dirname(docPath);
  const parentDir = dirname(docDir);

  // Code files in: same dir, children of doc dir, parent dir, or children of parent dir (siblings)
  const related = allCodeFiles.filter((f) => {
    const fDir = dirname(f);
    return (
      fDir === docDir ||
      fDir.startsWith(docDir + '/') ||
      fDir === parentDir ||
      fDir.startsWith(parentDir + '/')
    );
  });

  if (related.length === 0) return null;

  let maxMtime: Date | null = null;
  for (const codePath of related) {
    try {
      const s = await stat(codePath);
      if (!maxMtime || s.mtime > maxMtime) {
        maxMtime = s.mtime;
      }
    } catch {
      // skip
    }
  }

  return maxMtime;
}

// ---------------------------------------------------------------------------
// Broken Reference Detection
// ---------------------------------------------------------------------------

/**
 * Check a doc file for broken cross-references.
 */
async function findBrokenReferences(
  docPath: string,
  cwd: string,
): Promise<BrokenReference[]> {
  const broken: BrokenReference[] = [];

  let content: string;
  try {
    content = await readFile(docPath, 'utf-8');
  } catch {
    return broken;
  }

  const lines = content.split('\n');
  const docDir = dirname(docPath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Check markdown links
    MARKDOWN_LINK_RE.lastIndex = 0;
    let match;
    while ((match = MARKDOWN_LINK_RE.exec(line)) !== null) {
      const refPath = match[2]!;
      // Skip URLs and anchors
      if (refPath.startsWith('http') || refPath.startsWith('#')) continue;

      // Strip anchor from path
      const cleanPath = refPath.split('#')[0]!;
      if (!cleanPath) continue;

      const resolvedPath = resolve(docDir, cleanPath);
      try {
        await access(resolvedPath);
      } catch {
        broken.push({
          docPath: docPath.startsWith(cwd) ? docPath.slice(cwd.length + 1) : docPath,
          line: i + 1,
          reference: refPath,
          reason: `Target not found: ${cleanPath}`,
        });
      }
    }

    // Check @see references
    SEE_REF_RE.lastIndex = 0;
    while ((match = SEE_REF_RE.exec(line)) !== null) {
      const refPath = match[1]!;
      const resolvedPath = resolve(docDir, refPath);
      try {
        await access(resolvedPath);
      } catch {
        broken.push({
          docPath: docPath.startsWith(cwd) ? docPath.slice(cwd.length + 1) : docPath,
          line: i + 1,
          reference: refPath,
          reason: `Target not found: ${refPath}`,
        });
      }
    }
  }

  return broken;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Check document freshness by comparing documentation and code file mtimes.
 *
 * For each documentation file (.md, .mdx):
 * 1. Finds related code files in the same/parent/child directories
 * 2. Compares modification times -- if code modified >7 days after doc, marks stale
 * 3. Scans for broken cross-references ([text](./path) and @see patterns)
 * 4. Computes score: 100 * (1 - staleCount / totalDocs) - brokenRefPenalty
 *
 * @param opts - Options with cwd (project root path)
 * @returns FreshnessResult with score, stale docs, and broken references
 */
export async function checkFreshness(opts: { cwd: string }): Promise<FreshnessResult> {
  const { cwd } = opts;

  // Collect all doc and code files
  const docFiles: string[] = [];
  const codeFiles: string[] = [];
  await Promise.all([
    collectDocFiles(cwd, docFiles),
    collectCodeFiles(cwd, codeFiles),
  ]);

  if (docFiles.length === 0) {
    return { score: 100, staleDocuments: [], brokenReferences: [], totalDocuments: 0 };
  }

  const staleDocuments: StaleDocument[] = [];
  const allBrokenRefs: BrokenReference[] = [];

  for (const docPath of docFiles) {
    // Check staleness
    let docStat;
    try {
      docStat = await stat(docPath);
    } catch {
      continue;
    }

    const relatedCodeMtime = await findRelatedCodeMtime(docPath, codeFiles);
    if (relatedCodeMtime) {
      const diffMs = relatedCodeMtime.getTime() - docStat.mtime.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays > STALE_THRESHOLD_DAYS) {
        staleDocuments.push({
          docPath: docPath.startsWith(cwd) ? docPath.slice(cwd.length + 1) : docPath,
          lastModified: docStat.mtime.toISOString(),
          relatedCodeLastModified: relatedCodeMtime.toISOString(),
          staleDays: Math.round(diffDays),
        });
      }
    }

    // Check broken references
    const brokenRefs = await findBrokenReferences(docPath, cwd);
    allBrokenRefs.push(...brokenRefs);
  }

  // Compute score
  const totalDocuments = docFiles.length;
  const stalenessScore = 100 * (1 - staleDocuments.length / totalDocuments);
  const refPenalty = allBrokenRefs.length * BROKEN_REF_PENALTY;
  const score = Math.max(0, Math.round(stalenessScore - refPenalty));

  return {
    score,
    staleDocuments,
    brokenReferences: allBrokenRefs,
    totalDocuments,
  };
}
