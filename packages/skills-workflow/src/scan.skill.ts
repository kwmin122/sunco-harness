/**
 * @sunco/skills-workflow - Scan Skill
 *
 * Agent-powered codebase analysis that produces 7 structured documents
 * in .sun/codebase/. Pre-scans deterministically, then dispatches
 * 7 parallel agents, each focused on one analysis document.
 *
 * First parallel agent dispatch in SUN.
 *
 * Requirements: WF-02
 * Decisions: D-07 through D-12, D-15, D-16
 */

import { defineSkill } from '@sunco/core';
import { buildPreScanContext } from './shared/pre-scan.js';
import { buildScanStackPrompt } from './prompts/scan-stack.js';
import { buildScanArchitecturePrompt } from './prompts/scan-architecture.js';
import { buildScanStructurePrompt } from './prompts/scan-structure.js';
import { buildScanConventionsPrompt } from './prompts/scan-conventions.js';
import { buildScanTestsPrompt } from './prompts/scan-tests.js';
import { buildScanIntegrationsPrompt } from './prompts/scan-integrations.js';
import { buildScanConcernsPrompt } from './prompts/scan-concerns.js';
import type { PreScanContext } from './shared/pre-scan.js';
import type { PermissionSet } from '@sunco/core';

// ---------------------------------------------------------------------------
// Scan document definitions
// ---------------------------------------------------------------------------

const SCAN_DOCS = [
  { name: 'STACK', builder: buildScanStackPrompt },
  { name: 'ARCHITECTURE', builder: buildScanArchitecturePrompt },
  { name: 'STRUCTURE', builder: buildScanStructurePrompt },
  { name: 'CONVENTIONS', builder: buildScanConventionsPrompt },
  { name: 'TESTS', builder: buildScanTestsPrompt },
  { name: 'INTEGRATIONS', builder: buildScanIntegrationsPrompt },
  { name: 'CONCERNS', builder: buildScanConcernsPrompt },
] as const;

/** Read-only permissions for research agents (D-08) */
const SCAN_PERMISSIONS: PermissionSet = {
  role: 'research',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.scan',
  command: 'scan',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'standard',
  description:
    'Analyze existing codebase -- produces 7 structured documents in .sun/codebase/',

  async execute(ctx) {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Scan',
      description: 'Analyzing codebase...',
    });

    // --- Check provider availability (D-11) ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Scan',
        summary: 'No AI provider available',
        details: [
          'sunco scan requires an AI provider to analyze your codebase.',
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
          'Or set ANTHROPIC_API_KEY for the SDK provider.',
        ],
      });
      return {
        success: false,
        summary: 'No AI provider available',
      };
    }

    // --- Pre-scan (deterministic grounding) ---
    const preScanProgress = ctx.ui.progress({
      title: 'Pre-scanning...',
      total: 2,
    });

    let preScan: PreScanContext;
    try {
      preScan = await buildPreScanContext(ctx.cwd);
      preScanProgress.update({ completed: 2, message: 'Pre-scan complete' });
      preScanProgress.done({ summary: 'Pre-scan complete' });
    } catch (err) {
      preScanProgress.done({ summary: 'Pre-scan failed' });
      const message =
        err instanceof Error ? err.message : 'Unknown pre-scan error';
      await ctx.ui.result({
        success: false,
        title: 'Scan',
        summary: `Pre-scan failed: ${message}`,
      });
      return { success: false, summary: `Pre-scan failed: ${message}` };
    }

    // --- Parallel agent dispatch (D-08) ---
    const analyzeProgress = ctx.ui.progress({
      title: 'Analyzing codebase',
      total: SCAN_DOCS.length,
    });

    const agentPromises = SCAN_DOCS.map((doc) =>
      ctx.agent.run({
        role: 'research',
        prompt: doc.builder(preScan),
        permissions: SCAN_PERMISSIONS,
        timeout: 120_000,
      }),
    );

    const results = await Promise.allSettled(agentPromises);

    // --- Process results ---
    const docsWritten: string[] = [];
    const docsFailed: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const doc = SCAN_DOCS[i]!;
      const filename = `${doc.name}.md`;

      if (result.status === 'fulfilled' && result.value.success) {
        await ctx.fileStore.write('codebase', filename, result.value.outputText);
        docsWritten.push(filename);
      } else {
        docsFailed.push(filename);
        const reason =
          result.status === 'rejected'
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : 'Agent returned unsuccessful result';
        warnings.push(`Failed to generate ${filename}: ${reason}`);
      }

      analyzeProgress.update({
        completed: i + 1,
        message: `${doc.name}...`,
      });
    }

    analyzeProgress.done({
      summary: `${docsWritten.length}/${SCAN_DOCS.length} documents generated`,
    });

    // --- Result display ---
    const success = docsWritten.length > 0;
    const summary = `${docsWritten.length}/${SCAN_DOCS.length} documents generated`;
    const details = docsWritten.map((f) => `.sun/codebase/${f}`);

    await ctx.ui.result({
      success,
      title: 'Scan',
      summary,
      details,
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    return {
      success,
      summary,
      data: { docsWritten, docsFailed },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
