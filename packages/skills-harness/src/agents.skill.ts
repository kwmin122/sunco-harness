/**
 * @sunco/skills-harness - Agents Skill
 *
 * Analyze agent instruction files (CLAUDE.md, agents.md, AGENTS.md) for
 * efficiency scoring and improvement suggestions.
 *
 * Per D-18: Read-only analysis + suggestions only. NEVER auto-generate or modify agent docs.
 * Per D-19: Suggestions are specific with line numbers, not vague.
 * Per D-16: Static text analysis of line count, sections, instruction density.
 * Per D-17: 0-100 efficiency score based on brevity/clarity/coverage/contradictions.
 *
 * Requirements: HRN-12 (agent doc analysis), HRN-13 (no auto-generation)
 */

import { defineSkill } from '@sunco/core';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeAgentDoc } from './agents/doc-analyzer.js';
import { computeEfficiencyScore } from './agents/efficiency-scorer.js';
import { generateSuggestions } from './agents/suggestion-engine.js';
import type { AgentDocMetrics, AgentDocReport } from './agents/types.js';

/** Candidate file names for agent instruction docs */
const CANDIDATE_FILES = ['CLAUDE.md', 'agents.md', 'AGENTS.md', '.claude/agents.md'];

export default defineSkill({
  id: 'harness.agents',
  command: 'agents',
  kind: 'deterministic',
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  description: 'Analyze agent instruction files (CLAUDE.md, agents.md) -- efficiency score + suggestions',
  options: [
    { flags: '--json', description: 'Output analysis as JSON' },
    { flags: '--file <path>', description: 'Analyze specific file (default: auto-detect)' },
  ],

  async execute(ctx) {
    await ctx.ui.entry({ title: 'Agents', description: 'Agent instruction file analyzer' });

    // 1. Find agent doc files (read-only: only fs.access, never write)
    const foundDocs: string[] = [];

    if (ctx.args.file) {
      // --file specified: use that
      foundDocs.push(ctx.args.file as string);
    } else {
      // Auto-detect candidate files
      for (const candidate of CANDIDATE_FILES) {
        try {
          await access(join(ctx.cwd, candidate));
          foundDocs.push(candidate);
        } catch {
          // File not found -- skip
        }
      }
    }

    if (foundDocs.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Agents',
        summary: 'No agent instruction files found (CLAUDE.md, agents.md, AGENTS.md)',
      });
      return { success: false, summary: 'No agent docs found' };
    }

    // 2. Analyze each doc (per D-18: read-only analysis)
    const docs: AgentDocMetrics[] = [];
    for (const doc of foundDocs) {
      const fullPath = join(ctx.cwd, doc);
      const metrics = await analyzeAgentDoc(fullPath);
      metrics.efficiencyScore = computeEfficiencyScore(metrics);
      docs.push(metrics);
    }

    // 3. Generate suggestions (per D-18: suggest only, never modify)
    const suggestions = docs.flatMap((d) => generateSuggestions(d));

    // 4. Compute overall score (average across all docs)
    const overallScore = Math.round(
      docs.reduce((sum, d) => sum + d.efficiencyScore, 0) / docs.length,
    );

    const report: AgentDocReport = { docs, overallScore, suggestions };

    // 5. Output results
    if (ctx.args.json) {
      await ctx.ui.result({
        success: true,
        title: 'Agents',
        summary: JSON.stringify(report, null, 2),
      });
    } else {
      const details: string[] = [];

      for (const doc of docs) {
        details.push(`--- ${doc.filePath} ---`);
        details.push(`  Lines: ${doc.totalLines}${doc.lineCountWarning ? ' (warning: > 60)' : ''}`);
        details.push(`  Sections: ${doc.sectionCount}`);
        details.push(`  Instruction density: ${doc.instructionDensity.toFixed(1)} per section`);
        details.push(`  Efficiency: ${doc.efficiencyScore}/100`);
        details.push(`  Contradictions: ${doc.contradictions.length}`);
        details.push('');
      }

      if (suggestions.length > 0) {
        details.push('--- Suggestions ---');
        for (const s of suggestions) {
          const lineInfo = s.lineRange ? ` [L${s.lineRange.start}-${s.lineRange.end}]` : '';
          details.push(`  [${s.severity.toUpperCase()}] ${s.type}${lineInfo}: ${s.message}`);
        }
      }

      await ctx.ui.result({
        success: true,
        title: 'Agents',
        summary: `Agent doc efficiency: ${overallScore}/100 (${docs.length} file(s), ${suggestions.length} suggestion(s))`,
        details,
      });
    }

    // 6. Store result in state (read-only analysis result, not modifying agent docs)
    await ctx.state.set('agents.lastResult', {
      overallScore,
      docsAnalyzed: docs.length,
      suggestionsCount: suggestions.length,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      summary: `Agent doc efficiency: ${overallScore}/100 (${docs.length} file(s))`,
      data: report,
    };
  },
});
