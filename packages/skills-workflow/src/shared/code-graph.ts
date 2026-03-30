/**
 * @sunco/skills-workflow - CodeGraph
 *
 * Lightweight code dependency graph using pure regex-based import parsing.
 * Zero external dependencies. Supports TypeScript, JavaScript, Python, Go.
 *
 * Features:
 * - Build dependency graph from source file list
 * - Blast radius analysis (BFS traversal through reverse deps)
 * - Serialize/deserialize for persistent caching in .sun/graph.json
 *
 * Requirements: CTX-01
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname, relative, extname, normalize } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  file: string; // relative path from basePath
  exports: string[];
  imports: Array<{ from: string; symbols: string[] }>;
}

export interface GraphEdge {
  from: string; // importer file (relative)
  to: string; // imported file resolved (relative)
}

export interface BlastRadiusResult {
  directDeps: string[]; // files that directly import the changed file
  transitiveDeps: string[]; // files affected transitively (2+ hops)
  totalAffected: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go']);

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.sun',
  '__pycache__',
  '.cache',
  'coverage',
  '.turbo',
]);

const MAX_FILES = 5000;
const DEFAULT_MAX_DEPTH = 5;

// ---------------------------------------------------------------------------
// CodeGraph
// ---------------------------------------------------------------------------

export class CodeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  // Reverse dependency map: file -> Set of files that import it
  private reverseDeps: Map<string, Set<string>> = new Map();

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  /**
   * Build the graph by scanning files and parsing imports.
   *
   * @param files - List of relative file paths to include
   * @param basePath - Absolute base directory (all files resolved against this)
   */
  async build(files: string[], basePath: string): Promise<void> {
    // Reset state
    this.nodes.clear();
    this.edges = [];
    this.reverseDeps.clear();

    const cap = files.slice(0, MAX_FILES);

    // Parse each file
    for (const relFile of cap) {
      const absPath = join(basePath, relFile);
      let content: string;
      try {
        content = await readFile(absPath, 'utf-8');
      } catch {
        // Skip unreadable files
        continue;
      }

      const imports = this.parseImports(content, relFile);
      const exports = this.parseExports(content, relFile);

      this.nodes.set(relFile, { file: relFile, exports, imports });
    }

    // Build edges + reverse deps
    for (const [relFile, node] of this.nodes) {
      for (const imp of node.imports) {
        const resolved = this.resolveImport(imp.from, relFile, basePath);
        if (resolved !== null && this.nodes.has(resolved)) {
          const edge: GraphEdge = { from: relFile, to: resolved };
          this.edges.push(edge);

          // Update reverse dependency map
          if (!this.reverseDeps.has(resolved)) {
            this.reverseDeps.set(resolved, new Set());
          }
          this.reverseDeps.get(resolved)!.add(relFile);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Import parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse imports from file content using language-appropriate regexes.
   * Supports TypeScript/JavaScript, Python, and Go.
   *
   * Aims for 80% coverage with simple patterns — correctness over completeness.
   */
  parseImports(content: string, filePath: string): Array<{ from: string; symbols: string[] }> {
    const ext = extname(filePath).toLowerCase();

    if (ext === '.py') {
      return this._parsePythonImports(content);
    }
    if (ext === '.go') {
      return this._parseGoImports(content);
    }
    // Default: TypeScript / JavaScript
    return this._parseTsJsImports(content);
  }

  private _parseTsJsImports(content: string): Array<{ from: string; symbols: string[] }> {
    const results: Array<{ from: string; symbols: string[] }> = [];

    // ES6 named/default/namespace imports: import { X, Y } from '...' / import X from '...'
    // Also handles: import '...' (side-effect only)
    const esImportRe =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))?\s+from\s+)?['"]([^'"]+)['"]/g;

    let m: RegExpExecArray | null;
    while ((m = esImportRe.exec(content)) !== null) {
      const path = m[1];
      if (path) {
        const symbols = this._extractNamedImports(m[0]);
        results.push({ from: path, symbols });
      }
    }

    // CommonJS require: require('...')
    const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = requireRe.exec(content)) !== null) {
      const path = m[1];
      if (path) {
        results.push({ from: path, symbols: [] });
      }
    }

    // Dynamic import: import('...')
    const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = dynamicRe.exec(content)) !== null) {
      const path = m[1];
      if (path) {
        results.push({ from: path, symbols: [] });
      }
    }

    // export { X } from '...' / export * from '...'
    const reExportRe = /export\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/g;
    while ((m = reExportRe.exec(content)) !== null) {
      const path = m[1];
      if (path) {
        const symbols = this._extractNamedImports(m[0]);
        results.push({ from: path, symbols });
      }
    }

    return results;
  }

  private _extractNamedImports(importStatement: string): string[] {
    const braceMatch = /\{([^}]*)\}/.exec(importStatement);
    if (!braceMatch) return [];
    return braceMatch[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+as\s+\w+/, '').trim())
      .filter(Boolean);
  }

  private _parsePythonImports(content: string): Array<{ from: string; symbols: string[] }> {
    const results: Array<{ from: string; symbols: string[] }> = [];

    // from X import Y, Z
    const fromImportRe = /^from\s+(\S+)\s+import\s+(.+)/gm;
    let m: RegExpExecArray | null;
    while ((m = fromImportRe.exec(content)) !== null) {
      const mod = m[1]!;
      const rest = m[2]!.trim();
      // Handle parenthesized multi-line imports: from X import (A, B)
      const symbolStr = rest.replace(/[()]/g, '');
      const symbols = symbolStr.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean);
      results.push({ from: mod, symbols });
    }

    // import X
    // import X as Y
    const simpleImportRe = /^import\s+(\S+)/gm;
    while ((m = simpleImportRe.exec(content)) !== null) {
      const mod = m[1]!.split(',')[0]!.trim(); // handle `import X, Y` (rare)
      results.push({ from: mod, symbols: [] });
    }

    return results;
  }

  private _parseGoImports(content: string): Array<{ from: string; symbols: string[] }> {
    const results: Array<{ from: string; symbols: string[] }> = [];

    // Single import: import "pkg"
    const singleRe = /^import\s+(?:\w+\s+)?["']([^"']+)["']/gm;
    let m: RegExpExecArray | null;
    while ((m = singleRe.exec(content)) !== null) {
      const path = m[1]!;
      results.push({ from: path, symbols: [] });
    }

    // Block import: import ( "pkg" )
    const blockRe = /import\s*\(([^)]+)\)/gs;
    while ((m = blockRe.exec(content)) !== null) {
      const block = m[1]!;
      const pathRe = /(?:\w+\s+)?["']([^"']+)["']/g;
      let pm: RegExpExecArray | null;
      while ((pm = pathRe.exec(block)) !== null) {
        const path = pm[1]!;
        results.push({ from: path, symbols: [] });
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Export parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse exported symbols from file content.
   * Best-effort for TS/JS. Python and Go return empty (not needed for blast radius).
   */
  parseExports(content: string, filePath: string): string[] {
    const ext = extname(filePath).toLowerCase();
    if (ext !== '.ts' && ext !== '.tsx' && ext !== '.js' && ext !== '.jsx') {
      return [];
    }

    const exports: string[] = [];

    // export function/class/const/let/var/type/interface X
    const namedExportRe = /^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/gm;
    let m: RegExpExecArray | null;
    while ((m = namedExportRe.exec(content)) !== null) {
      if (m[1]) exports.push(m[1]);
    }

    // export { X, Y as Z }
    const braceExportRe = /^export\s+\{([^}]+)\}/gm;
    while ((m = braceExportRe.exec(content)) !== null) {
      const names = m[1]!.split(',').map((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        return (parts[parts.length - 1] ?? '').trim();
      }).filter(Boolean);
      exports.push(...names);
    }

    return [...new Set(exports)];
  }

  // ---------------------------------------------------------------------------
  // Import resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve an import path to a relative file path within the project.
   *
   * - Relative paths (./foo, ../bar): resolved against the importer's directory
   * - Bare specifiers (lodash, @sunco/core): return null (external package)
   *
   * For relative paths, attempts common extensions if no extension is given.
   */
  resolveImport(importPath: string, fromFile: string, basePath: string): string | null {
    // Bare specifiers = external package
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const fromDir = dirname(fromFile); // relative directory of importer
    let resolved = normalize(join(fromDir, importPath));

    // Strip .js extension and try .ts (common in ESM TypeScript projects)
    if (resolved.endsWith('.js')) {
      const tsVariant = resolved.slice(0, -3) + '.ts';
      if (this.nodes.has(tsVariant)) return tsVariant;
      const tsxVariant = resolved.slice(0, -3) + '.tsx';
      if (this.nodes.has(tsxVariant)) return tsxVariant;
    }

    // Exact match
    if (this.nodes.has(resolved)) return resolved;

    // Try adding extensions
    const exts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];
    for (const ext of exts) {
      const candidate = resolved + ext;
      if (this.nodes.has(candidate)) return candidate;
    }

    // Try index files
    for (const ext of exts) {
      const candidate = join(resolved, 'index' + ext);
      if (this.nodes.has(normalize(candidate))) return normalize(candidate);
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Blast radius
  // ---------------------------------------------------------------------------

  /**
   * Compute blast radius for a set of changed files.
   *
   * Uses BFS through the reverse dependency graph.
   * Separates direct (depth=1) from transitive (depth>=2) dependents.
   *
   * @param changedFiles - Files that were modified (relative paths)
   * @param maxDepth - Maximum BFS depth (default: 5)
   */
  blastRadius(changedFiles: string[], maxDepth: number = DEFAULT_MAX_DEPTH): BlastRadiusResult {
    const directDeps = new Set<string>();
    const transitiveDeps = new Set<string>();

    // BFS queue entries: [file, depth]
    const visited = new Set<string>(changedFiles);
    const queue: Array<[string, number]> = changedFiles.map((f) => [f, 0]);

    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) continue;
      const [file, depth] = entry;

      if (depth >= maxDepth) continue;

      const importers = this.reverseDeps.get(file);
      if (!importers) continue;

      for (const importer of importers) {
        if (visited.has(importer)) continue;
        visited.add(importer);

        if (depth === 0) {
          directDeps.add(importer);
        } else {
          transitiveDeps.add(importer);
        }

        queue.push([importer, depth + 1]);
      }
    }

    // A file in directDeps should not also appear in transitiveDeps
    // (it was reached at depth 1, not 2+)
    for (const f of directDeps) {
      transitiveDeps.delete(f);
    }

    const directList = [...directDeps].sort();
    const transitiveList = [...transitiveDeps].sort();

    return {
      directDeps: directList,
      transitiveDeps: transitiveList,
      totalAffected: directList.length + transitiveList.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: [...this.nodes.values()],
      edges: this.edges,
    };
  }

  static fromJSON(data: { nodes: GraphNode[]; edges: GraphEdge[] }): CodeGraph {
    const graph = new CodeGraph();

    for (const node of data.nodes) {
      graph.nodes.set(node.file, node);
    }

    graph.edges = data.edges;

    // Rebuild reverse deps
    for (const edge of data.edges) {
      if (!graph.reverseDeps.has(edge.to)) {
        graph.reverseDeps.set(edge.to, new Set());
      }
      graph.reverseDeps.get(edge.to)!.add(edge.from);
    }

    return graph;
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.length;
  }

  // ---------------------------------------------------------------------------
  // File scanning utilities (used by the skill, exported for convenience)
  // ---------------------------------------------------------------------------

  /**
   * Scan a directory recursively and return relative paths of source files.
   *
   * Filters by supported extensions, ignores common non-source directories,
   * caps at MAX_FILES (5000).
   */
  static async scanFiles(basePath: string): Promise<string[]> {
    const files: string[] = [];
    await scanDir(basePath, basePath, files);
    return files;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function scanDir(
  basePath: string,
  currentDir: string,
  files: string[],
): Promise<void> {
  if (files.length >= MAX_FILES) return;

  let entries: string[];
  try {
    entries = await readdir(currentDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= MAX_FILES) return;

    const absPath = join(currentDir, entry);

    // Skip ignored directories
    if (IGNORE_DIRS.has(entry)) continue;

    let info;
    try {
      info = await stat(absPath);
    } catch {
      continue;
    }

    if (info.isDirectory()) {
      await scanDir(basePath, absPath, files);
    } else if (info.isFile()) {
      const ext = extname(entry).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        const relPath = relative(basePath, absPath);
        files.push(relPath);
      }
    }
  }
}
