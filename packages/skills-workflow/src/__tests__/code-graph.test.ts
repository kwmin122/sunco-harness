/**
 * Tests for CodeGraph — import parser, blast radius, serialization.
 *
 * All tests use in-memory content strings. No filesystem I/O.
 *
 * Coverage:
 * - parseImports: TS named/default/require/dynamic, Python from/import, Go single/block
 * - resolveImport: relative path, package name (null), extension resolution
 * - blastRadius: direct dep, 2-hop transitive, cycle safety, empty graph, multiple seeds
 * - toJSON / fromJSON round-trip
 * - build from in-memory node injection
 * - parseExports: named, brace, default
 * - nodeCount / edgeCount stats
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGraph } from '../shared/code-graph.js';
import type { GraphNode, GraphEdge } from '../shared/code-graph.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a CodeGraph directly from in-memory nodes (bypasses filesystem).
 * Edges are derived from resolveImport logic.
 */
function buildFromNodes(
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
): CodeGraph {
  return CodeGraph.fromJSON({ nodes, edges });
}

// ---------------------------------------------------------------------------
// parseImports — TypeScript / JavaScript
// ---------------------------------------------------------------------------

describe('CodeGraph.parseImports — TypeScript', () => {
  const graph = new CodeGraph();

  it('parses named ES6 import', () => {
    const result = graph.parseImports(
      `import { readFile, writeFile } from 'node:fs/promises';`,
      'src/index.ts',
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('node:fs/promises');
    expect(result[0]!.symbols).toContain('readFile');
    expect(result[0]!.symbols).toContain('writeFile');
  });

  it('parses default ES6 import', () => {
    const result = graph.parseImports(
      `import chalk from 'chalk';`,
      'src/cmd.ts',
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('chalk');
  });

  it('parses side-effect import (no symbols)', () => {
    const result = graph.parseImports(
      `import './register.js';`,
      'src/main.ts',
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('./register.js');
    expect(result[0]!.symbols).toHaveLength(0);
  });

  it('parses CommonJS require', () => {
    const result = graph.parseImports(
      `const path = require('path');`,
      'scripts/build.js',
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('path');
  });

  it('parses dynamic import', () => {
    const result = graph.parseImports(
      `const mod = await import('./plugin.js');`,
      'src/loader.ts',
    );
    expect(result.some((r) => r.from === './plugin.js')).toBe(true);
  });

  it('parses re-export from', () => {
    const result = graph.parseImports(
      `export { CodeGraph } from './shared/code-graph.js';`,
      'src/index.ts',
    );
    expect(result.some((r) => r.from === './shared/code-graph.js')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseImports — Python
// ---------------------------------------------------------------------------

describe('CodeGraph.parseImports — Python', () => {
  const graph = new CodeGraph();

  it('parses from ... import statement', () => {
    const result = graph.parseImports(
      `from pathlib import Path, PurePath`,
      'scripts/main.py',
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('pathlib');
    expect(result[0]!.symbols).toContain('Path');
    expect(result[0]!.symbols).toContain('PurePath');
  });

  it('parses import statement', () => {
    const result = graph.parseImports(
      `import os\nimport sys`,
      'scripts/main.py',
    );
    const froms = result.map((r) => r.from);
    expect(froms).toContain('os');
    expect(froms).toContain('sys');
  });

  it('parses relative Python import', () => {
    const result = graph.parseImports(
      `from .utils import helper`,
      'app/core.py',
    );
    expect(result[0]!.from).toBe('.utils');
    expect(result[0]!.symbols).toContain('helper');
  });
});

// ---------------------------------------------------------------------------
// parseImports — Go
// ---------------------------------------------------------------------------

describe('CodeGraph.parseImports — Go', () => {
  const graph = new CodeGraph();

  it('parses single Go import', () => {
    const result = graph.parseImports(
      `import "fmt"`,
      'main.go',
    );
    expect(result.some((r) => r.from === 'fmt')).toBe(true);
  });

  it('parses Go block import', () => {
    const result = graph.parseImports(
      `import (
  "fmt"
  "os"
  "github.com/user/repo/utils"
)`,
      'main.go',
    );
    const froms = result.map((r) => r.from);
    expect(froms).toContain('fmt');
    expect(froms).toContain('os');
    expect(froms).toContain('github.com/user/repo/utils');
  });
});

// ---------------------------------------------------------------------------
// resolveImport
// ---------------------------------------------------------------------------

describe('CodeGraph.resolveImport', () => {
  it('returns null for bare package specifier', () => {
    const graph = new CodeGraph();
    expect(graph.resolveImport('lodash', 'src/index.ts', '/project')).toBeNull();
    expect(graph.resolveImport('@scope/pkg', 'src/index.ts', '/project')).toBeNull();
  });

  it('resolves relative path with .ts extension via node map', () => {
    const graph = buildFromNodes([
      { file: 'src/utils.ts', exports: [], imports: [] },
      { file: 'src/index.ts', exports: [], imports: [] },
    ]);

    const resolved = graph.resolveImport('./utils', 'src/index.ts', '/project');
    expect(resolved).toBe('src/utils.ts');
  });

  it('resolves .js extension to .ts in TypeScript project', () => {
    const graph = buildFromNodes([
      { file: 'src/helper.ts', exports: [], imports: [] },
    ]);

    const resolved = graph.resolveImport('./helper.js', 'src/index.ts', '/project');
    expect(resolved).toBe('src/helper.ts');
  });

  it('resolves parent directory traversal', () => {
    const graph = buildFromNodes([
      { file: 'src/shared/utils.ts', exports: [], imports: [] },
    ]);

    const resolved = graph.resolveImport('../shared/utils', 'src/core/index.ts', '/project');
    expect(resolved).toBe('src/shared/utils.ts');
  });

  it('returns null when resolved path not in graph', () => {
    const graph = buildFromNodes([
      { file: 'src/index.ts', exports: [], imports: [] },
    ]);

    const resolved = graph.resolveImport('./nonexistent', 'src/index.ts', '/project');
    expect(resolved).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// blastRadius
// ---------------------------------------------------------------------------

describe('CodeGraph.blastRadius', () => {
  it('returns empty result for unknown file', () => {
    const graph = new CodeGraph();
    const result = graph.blastRadius(['unknown.ts']);
    expect(result.directDeps).toHaveLength(0);
    expect(result.transitiveDeps).toHaveLength(0);
    expect(result.totalAffected).toBe(0);
  });

  it('identifies direct importers', () => {
    // a.ts -> b.ts (a imports b)
    // Blast radius of b: a is a direct dep
    const graph = buildFromNodes(
      [
        { file: 'a.ts', exports: [], imports: [{ from: './b', symbols: [] }] },
        { file: 'b.ts', exports: [], imports: [] },
      ],
      [{ from: 'a.ts', to: 'b.ts' }],
    );

    const result = graph.blastRadius(['b.ts']);
    expect(result.directDeps).toContain('a.ts');
    expect(result.transitiveDeps).toHaveLength(0);
    expect(result.totalAffected).toBe(1);
  });

  it('identifies 2-hop transitive dependents', () => {
    // a.ts -> b.ts -> c.ts
    // Blast radius of c: b is direct, a is transitive
    const graph = buildFromNodes(
      [
        { file: 'a.ts', exports: [], imports: [{ from: './b', symbols: [] }] },
        { file: 'b.ts', exports: [], imports: [{ from: './c', symbols: [] }] },
        { file: 'c.ts', exports: [], imports: [] },
      ],
      [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' },
      ],
    );

    const result = graph.blastRadius(['c.ts']);
    expect(result.directDeps).toContain('b.ts');
    expect(result.transitiveDeps).toContain('a.ts');
    expect(result.totalAffected).toBe(2);
  });

  it('handles cyclic dependencies without infinite loop', () => {
    // a.ts -> b.ts -> a.ts (cycle)
    const graph = buildFromNodes(
      [
        { file: 'a.ts', exports: [], imports: [{ from: './b', symbols: [] }] },
        { file: 'b.ts', exports: [], imports: [{ from: './a', symbols: [] }] },
      ],
      [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'a.ts' },
      ],
    );

    // Should complete without infinite loop
    const result = graph.blastRadius(['a.ts']);
    expect(result.totalAffected).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple changed files as seeds', () => {
    // a.ts -> c.ts, b.ts -> c.ts
    // Blast radius of [a.ts, b.ts]: should find c.ts dependents if any
    const graph = buildFromNodes(
      [
        { file: 'a.ts', exports: [], imports: [] },
        { file: 'b.ts', exports: [], imports: [] },
        { file: 'c.ts', exports: [], imports: [{ from: './a', symbols: [] }] },
        { file: 'd.ts', exports: [], imports: [{ from: './b', symbols: [] }] },
      ],
      [
        { from: 'c.ts', to: 'a.ts' },
        { from: 'd.ts', to: 'b.ts' },
      ],
    );

    const result = graph.blastRadius(['a.ts', 'b.ts']);
    expect(result.directDeps).toContain('c.ts');
    expect(result.directDeps).toContain('d.ts');
    expect(result.totalAffected).toBe(2);
  });

  it('respects maxDepth cap', () => {
    // chain: a -> b -> c -> d -> e -> f
    const graph = buildFromNodes(
      [
        { file: 'a.ts', exports: [], imports: [] },
        { file: 'b.ts', exports: [], imports: [{ from: './a', symbols: [] }] },
        { file: 'c.ts', exports: [], imports: [{ from: './b', symbols: [] }] },
        { file: 'd.ts', exports: [], imports: [{ from: './c', symbols: [] }] },
        { file: 'e.ts', exports: [], imports: [{ from: './d', symbols: [] }] },
        { file: 'f.ts', exports: [], imports: [{ from: './e', symbols: [] }] },
      ],
      [
        { from: 'b.ts', to: 'a.ts' },
        { from: 'c.ts', to: 'b.ts' },
        { from: 'd.ts', to: 'c.ts' },
        { from: 'e.ts', to: 'd.ts' },
        { from: 'f.ts', to: 'e.ts' },
      ],
    );

    // With maxDepth=2, only b (depth 1) and c (depth 2) should be reached
    const result = graph.blastRadius(['a.ts'], 2);
    expect(result.directDeps).toContain('b.ts');
    const allAffected = [...result.directDeps, ...result.transitiveDeps];
    expect(allAffected).not.toContain('e.ts');
    expect(allAffected).not.toContain('f.ts');
  });
});

// ---------------------------------------------------------------------------
// toJSON / fromJSON round-trip
// ---------------------------------------------------------------------------

describe('CodeGraph serialization', () => {
  it('round-trips nodes and edges through JSON', () => {
    const nodes: GraphNode[] = [
      { file: 'a.ts', exports: ['doThing'], imports: [{ from: './b', symbols: ['helper'] }] },
      { file: 'b.ts', exports: ['helper'], imports: [] },
    ];
    const edges: GraphEdge[] = [{ from: 'a.ts', to: 'b.ts' }];

    const original = buildFromNodes(nodes, edges);
    const json = original.toJSON();
    const restored = CodeGraph.fromJSON(json);

    expect(restored.nodeCount).toBe(2);
    expect(restored.edgeCount).toBe(1);

    // Blast radius should work on restored graph
    const result = restored.blastRadius(['b.ts']);
    expect(result.directDeps).toContain('a.ts');
  });

  it('preserves empty graph in round-trip', () => {
    const graph = new CodeGraph();
    const json = graph.toJSON();
    const restored = CodeGraph.fromJSON(json);

    expect(restored.nodeCount).toBe(0);
    expect(restored.edgeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

describe('CodeGraph stats', () => {
  it('reports correct nodeCount and edgeCount', () => {
    const graph = buildFromNodes(
      [
        { file: 'a.ts', exports: [], imports: [] },
        { file: 'b.ts', exports: [], imports: [] },
        { file: 'c.ts', exports: [], imports: [] },
      ],
      [
        { from: 'a.ts', to: 'b.ts' },
        { from: 'b.ts', to: 'c.ts' },
      ],
    );

    expect(graph.nodeCount).toBe(3);
    expect(graph.edgeCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// parseExports
// ---------------------------------------------------------------------------

describe('CodeGraph.parseExports', () => {
  const graph = new CodeGraph();

  it('extracts named export declarations', () => {
    const exports = graph.parseExports(
      `export function doThing(): void {}
export const MAX = 100;
export class MyClass {}`,
      'src/lib.ts',
    );
    expect(exports).toContain('doThing');
    expect(exports).toContain('MAX');
    expect(exports).toContain('MyClass');
  });

  it('extracts brace exports', () => {
    const exports = graph.parseExports(
      `export { doThing, MAX as MAXIMUM };`,
      'src/lib.ts',
    );
    expect(exports).toContain('doThing');
    expect(exports).toContain('MAXIMUM');
  });

  it('returns empty array for Python files', () => {
    const exports = graph.parseExports('def helper(): pass', 'scripts/main.py');
    expect(exports).toHaveLength(0);
  });
});
