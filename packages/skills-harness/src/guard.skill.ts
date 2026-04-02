/**
 * @sunco/skills-harness - Guard Skill
 *
 * `sunco guard` -- Anti-pattern detection with lint rule promotion, incremental
 * linting, chokidar file watching, and tribal knowledge integration.
 *
 * Two modes:
 *   sunco guard          -- single-run scan (analyzeProject)
 *   sunco guard --watch  -- continuous mode (chokidar + analyzeFile per change)
 *
 * 100% deterministic: no agent access.
 * "Guard is the real-time feedback loop."
 *
 * Decisions: D-20 (chokidar), D-21 (promotion suggest-only), D-22 (incremental),
 * D-23 (two modes), D-24 (tribal knowledge)
 *
 * Requirements: HRN-14, HRN-15, HRN-16
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { defineSkill } from '@sunco/core';
import { generateBoundariesConfig } from './lint/config-generator.js';
import { analyzeFile, analyzeProject } from './guard/analyzer.js';
import { detectPromotionCandidates, formatPromotionSuggestion } from './guard/promoter.js';
import { loadTribalPatterns } from './guard/tribal-loader.js';
import { createWatcher, stopWatcher } from './guard/watcher.js';
import type { InitResult } from './init/types.js';
import type { PromotionSuggestion } from './guard/types.js';

export default defineSkill({
  id: 'harness.guard',
  command: 'guard',
  kind: 'deterministic',
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  description: 'Guard codebase -- anti-pattern detection, lint rule promotion, watch mode',
  options: [
    { flags: '--watch', description: 'Continuous file watching mode (chokidar)' },
    { flags: '--json', description: 'Output results as JSON' },
    { flags: '--draft-claude-rules', description: 'Generate .claude/rules/ files from repeated anti-patterns' },
  ],

  async execute(ctx) {
    const watchMode = (ctx.args.watch as boolean) ?? false;
    const draftRules = (ctx.args['draft-claude-rules'] as boolean) ?? false;

    await ctx.ui.entry({
      title: 'Guard',
      description: watchMode ? 'Watching for changes...' : 'Scanning project...',
    });

    // Load init result for boundaries config
    const initResult = await ctx.state.get<InitResult>('init.result');
    if (!initResult) {
      await ctx.ui.result({
        success: false,
        title: 'Guard',
        summary: 'No init result found. Run "sunco init" first.',
      });
      return { success: false, summary: 'Run sunco init first' };
    }

    const boundariesConfig = generateBoundariesConfig(initResult.layers.layers);
    const tribalPatterns = await loadTribalPatterns(ctx.fileStore);

    if (watchMode) {
      // ---------------------------------------------------------------
      // Continuous mode -- long-running process (D-23)
      // ---------------------------------------------------------------
      const watcher = createWatcher({
        cwd: ctx.cwd,
        patterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        ignored: [],
        onFileChange: async (event) => {
          if (event.type === 'change' || event.type === 'add') {
            const content = await readFile(join(ctx.cwd, event.path), 'utf-8');
            const result = await analyzeFile({
              filePath: event.path,
              fileContent: content,
              boundariesConfig,
              tribalPatterns,
              cwd: ctx.cwd,
            });

            // Display inline results for files with issues
            if (result.violations.length > 0 || result.antiPatterns.length > 0) {
              ctx.log.info(`[guard] ${event.path}: ${result.violations.length} violations, ${result.antiPatterns.length} anti-patterns`);
            }
            if (result.tribalWarnings.length > 0) {
              ctx.log.info(`[guard] ${event.path}: ${result.tribalWarnings.length} tribal warnings`);
            }
          }
        },
      });

      // Clean shutdown via AbortSignal (per pitfall #4)
      const cleanup = () => {
        void stopWatcher(watcher);
      };
      ctx.signal.addEventListener('abort', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      // Keep alive -- return a promise that resolves on abort
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve());
      });

      return { success: true, summary: 'Watch mode stopped' };
    } else {
      // ---------------------------------------------------------------
      // Single-run scan mode (D-23)
      // ---------------------------------------------------------------
      const result = await analyzeProject({
        cwd: ctx.cwd,
        fileStore: ctx.fileStore,
        state: ctx.state,
        boundariesConfig,
      });

      // Check for promotion candidates
      const promotions = await detectPromotionCandidates({
        antiPatterns: result.antiPatterns,
        state: ctx.state,
      });

      // Build display details
      const details: string[] = [
        ...result.lintViolations.map(
          (v) => `${v.severity}: ${v.file}:${v.line} ${v.violation}`,
        ),
        ...result.tribalWarnings.map(
          (w) => `tribal: ${w.file}:${w.line} ${w.message}`,
        ),
        ...promotions.map((p) => `promotion: ${formatPromotionSuggestion(p)}`),
      ];

      // Display results
      await ctx.ui.result({
        success: result.lintViolations.length === 0,
        title: 'Guard',
        summary: `${result.filesAnalyzed} files scanned, ${result.lintViolations.length} violations, ${result.antiPatterns.length} anti-patterns`,
        details,
      });

      // Persist guard result to state
      await ctx.state.set('guard.lastResult', {
        violations: result.lintViolations.length,
        antiPatterns: result.antiPatterns.length,
        promotions: promotions.length,
        timestamp: new Date().toISOString(),
      });

      // --draft-claude-rules: generate .claude/rules/ files from promotion candidates
      if (draftRules && promotions.length > 0) {
        const rulesDir = join(ctx.cwd, '.claude', 'rules');
        await mkdir(rulesDir, { recursive: true });
        let rulesWritten = 0;

        for (const promo of promotions) {
          const ruleId = promo.suggestedRule.id;
          const ruleName = ruleId
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          const rulePath = join(rulesDir, `${ruleName}.md`);

          // Skip if rule file already exists
          try { await access(rulePath); continue; } catch { /* doesn't exist, create it */ }

          const ruleContent = [
            `---`,
            `description: ${promo.pattern} — auto-promoted from guard analysis`,
            `globs:`,
            `  - "**/*.ts"`,
            `  - "**/*.tsx"`,
            `---`,
            ``,
            `## ${promo.pattern}`,
            ``,
            `Pattern detected by \`sunco guard\`:`,
            `- Occurrences: ${promo.occurrences}`,
            `- Files: ${promo.files.join(', ')}`,
            ``,
            `### Rule`,
            ``,
            promo.message,
            ``,
          ].join('\n');

          await writeFile(rulePath, ruleContent, 'utf8');
          rulesWritten++;
        }

        if (rulesWritten > 0) {
          details.push(`\n--- Draft Rules Generated ---`);
          details.push(`  ${rulesWritten} rule(s) written to .claude/rules/`);
          details.push(`  Review and commit these files to enforce the rules.`);
        }
      }

      return {
        success: result.lintViolations.length === 0,
        summary: `${result.lintViolations.length} violations, ${promotions.length} promotion suggestions`,
        data: { ...result, promotionSuggestions: promotions },
      };
    }
  },
});
