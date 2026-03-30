/**
 * @sunco/skills-workflow - Graph Skill
 *
 * Builds a code dependency graph from source files and stores it in
 * .sun/graph.json. Supports blast radius analysis: given a set of changed
 * files, returns all directly and transitively affected files.
 *
 * Zero LLM cost — pure regex-based import parsing, no Tree-sitter.
 * Supports TypeScript, JavaScript, Python, and Go.
 *
 * Usage:
 *   sunco graph              — build/refresh graph
 *   sunco graph --blast src/foo.ts   — files affected by changes to foo.ts
 *   sunco graph --blast src/a.ts,src/b.ts  — multiple changed files
 *   sunco graph --stats      — show graph size only
 *
 * Requirements: CTX-01
 */

import { defineSkill } from '@sunco/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CodeGraph } from './shared/code-graph.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraphData {
  nodes: ReturnType<CodeGraph['toJSON']>['nodes'];
  edges: ReturnType<CodeGraph['toJSON']>['edges'];
  builtAt: string;
  fileCount: number;
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.graph',
  command: 'graph',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  description:
    'Build code dependency graph and analyze blast radius of changes',
  options: [
    {
      flags: '--blast <files>',
      description:
        'Comma-separated files to analyze blast radius for (or omit to detect from git diff)',
    },
    {
      flags: '--stats',
      description: 'Show graph statistics only',
    },
    {
      flags: '--rebuild',
      description: 'Force graph rebuild even if cached',
    },
  ],

  async execute(ctx) {
    const blastArg = ctx.args['blast'] as string | boolean | undefined;
    const statsOnly = Boolean(ctx.args['stats']);
    const forceRebuild = Boolean(ctx.args['rebuild']);

    // --- Entry ---
    await ctx.ui.entry({
      title: 'Graph',
      description: 'Code dependency graph analysis',
    });

    const sunDir = join(ctx.cwd, '.sun');
    const graphPath = join(sunDir, 'graph.json');

    // --- Load or build graph ---
    let graph: CodeGraph;
    let fromCache = false;

    const cached = await loadCachedGraph(graphPath);
    if (cached && !forceRebuild) {
      graph = CodeGraph.fromJSON(cached);
      fromCache = true;
    } else {
      // Build graph by scanning source files
      const buildProgress = ctx.ui.progress({
        title: 'Scanning source files...',
        total: 3,
      });

      buildProgress.update({ completed: 1, message: 'Discovering files...' });
      const files = await CodeGraph.scanFiles(ctx.cwd);

      buildProgress.update({ completed: 2, message: `Parsing ${files.length} files...` });
      graph = new CodeGraph();
      await graph.build(files, ctx.cwd);

      // Persist to .sun/graph.json
      buildProgress.update({ completed: 3, message: 'Saving graph...' });
      await saveGraph(graphPath, sunDir, graph, files.length);

      buildProgress.done({
        summary: `Graph built: ${graph.nodeCount} nodes, ${graph.edgeCount} edges`,
      });
    }

    // --- Stats only mode ---
    if (statsOnly) {
      const summary = `${graph.nodeCount} nodes, ${graph.edgeCount} edges${fromCache ? ' (cached)' : ''}`;
      await ctx.ui.result({ success: true, title: 'Graph Stats', summary });
      return {
        success: true,
        summary,
        data: {
          nodeCount: graph.nodeCount,
          edgeCount: graph.edgeCount,
          fromCache,
        },
      };
    }

    // --- Blast radius mode ---
    if (blastArg !== undefined) {
      let changedFiles: string[];

      if (typeof blastArg === 'string' && blastArg.length > 0) {
        // Explicit comma-separated files
        changedFiles = blastArg
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
      } else {
        // No argument: detect from git diff --name-only
        changedFiles = await detectGitChangedFiles(ctx.cwd);
        if (changedFiles.length === 0) {
          await ctx.ui.result({
            success: false,
            title: 'Graph',
            summary: 'No changed files detected from git diff',
            details: [
              'Provide files explicitly: sunco graph --blast src/foo.ts',
              'Or stage/commit some changes first.',
            ],
          });
          return {
            success: false,
            summary: 'No changed files detected',
          };
        }
      }

      const blastProgress = ctx.ui.progress({
        title: 'Analyzing blast radius...',
        total: 1,
      });

      const result = graph.blastRadius(changedFiles);
      blastProgress.done({ summary: `${result.totalAffected} affected files` });

      const details: string[] = [
        `Changed: ${changedFiles.join(', ')}`,
      ];

      if (result.directDeps.length > 0) {
        details.push(`Direct (${result.directDeps.length}): ${result.directDeps.slice(0, 5).join(', ')}${result.directDeps.length > 5 ? ` ...+${result.directDeps.length - 5}` : ''}`);
      }
      if (result.transitiveDeps.length > 0) {
        details.push(`Transitive (${result.transitiveDeps.length}): ${result.transitiveDeps.slice(0, 5).join(', ')}${result.transitiveDeps.length > 5 ? ` ...+${result.transitiveDeps.length - 5}` : ''}`);
      }

      const summary = result.totalAffected === 0
        ? `No files affected by ${changedFiles.length} changed file(s)`
        : `${result.totalAffected} file(s) affected by ${changedFiles.length} changed file(s)`;

      await ctx.ui.result({
        success: true,
        title: 'Blast Radius',
        summary,
        details,
      });

      return {
        success: true,
        summary,
        data: {
          changedFiles,
          directDeps: result.directDeps,
          transitiveDeps: result.transitiveDeps,
          totalAffected: result.totalAffected,
          graphStats: { nodeCount: graph.nodeCount, edgeCount: graph.edgeCount },
        },
      };
    }

    // --- Default: show graph stats after build/load ---
    const cacheNote = fromCache ? ' (loaded from cache — run with --rebuild to refresh)' : ' (freshly built)';
    const summary = `${graph.nodeCount} nodes, ${graph.edgeCount} edges${cacheNote}`;

    await ctx.ui.result({
      success: true,
      title: 'Graph',
      summary,
      details: [
        `Graph saved to .sun/graph.json`,
        `Use --blast <file> to analyze blast radius`,
        `Use --stats for quick stats`,
      ],
    });

    return {
      success: true,
      summary,
      data: {
        nodeCount: graph.nodeCount,
        edgeCount: graph.edgeCount,
        fromCache,
        graphPath,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function loadCachedGraph(graphPath: string): Promise<GraphData | null> {
  try {
    const content = await readFile(graphPath, 'utf-8');
    const data = JSON.parse(content) as GraphData;
    if (!data.nodes || !data.edges) return null;
    return data;
  } catch {
    return null;
  }
}

async function saveGraph(
  graphPath: string,
  sunDir: string,
  graph: CodeGraph,
  fileCount: number,
): Promise<void> {
  await mkdir(sunDir, { recursive: true });
  const data: GraphData = {
    ...graph.toJSON(),
    builtAt: new Date().toISOString(),
    fileCount,
  };
  await writeFile(graphPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function detectGitChangedFiles(cwd: string): Promise<string[]> {
  try {
    // Dynamic import to avoid hard dependency
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(cwd);
    const diff = await git.diff(['--name-only']);
    const staged = await git.diff(['--cached', '--name-only']);
    const combined = [
      ...diff.split('\n'),
      ...staged.split('\n'),
    ]
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    // Deduplicate
    return [...new Set(combined)];
  } catch {
    return [];
  }
}
