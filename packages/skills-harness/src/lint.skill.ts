/**
 * @sunco/skills-harness - Lint Skill
 *
 * `sunco lint` -- Architecture boundary linter with agent-readable error messages.
 * 100% deterministic: no LLM, no agent access. Reads init detection result from
 * state, loads rules, runs ESLint with eslint-plugin-boundaries, and outputs
 * structured violations with fix instructions.
 *
 * "Linter teaches while blocking." (D-08)
 *
 * Supports:
 *   sunco lint              -- lint all source files, terminal output
 *   sunco lint --fix        -- auto-fix deterministic violations (D-09)
 *   sunco lint --json       -- output violations as JSON for agent consumption (D-08)
 *   sunco lint --files <g>  -- lint specific files by glob pattern
 *
 * Requirements: HRN-07 (architecture linter), HRN-08 (deterministic, --fix)
 */

import { defineSkill } from '@sunco/core';
import { loadRules } from './lint/rule-store.js';
import { generateBoundariesConfig } from './lint/config-generator.js';
import { runLint } from './lint/runner.js';
import { runLintWithFix } from './lint/fixer.js';
import { formatViolations, formatForTerminal, formatForJson } from './lint/formatter.js';
import type { InitResult } from './init/types.js';

export default defineSkill({
  id: 'harness.lint',
  command: 'lint',
  kind: 'deterministic',
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  description: 'Lint architecture boundaries -- dependency direction, layer violations',
  options: [
    { flags: '--fix', description: 'Auto-fix deterministic violations' },
    { flags: '--json', description: 'Output violations as JSON for agent consumption' },
    { flags: '--files <glob>', description: 'Lint specific files (default: all source files)' },
  ],

  async execute(ctx) {
    const fix = (ctx.args.fix as boolean) ?? false;
    const json = (ctx.args.json as boolean) ?? false;
    const filesGlob = ctx.args.files as string | undefined;

    await ctx.ui.entry({ title: 'Lint', description: 'Checking architecture boundaries...' });

    // Step 1: Load init detection result from state
    const initResult = await ctx.state.get<InitResult>('init.result');
    if (!initResult) {
      await ctx.ui.result({
        success: false,
        title: 'Lint',
        summary: 'No init result found. Run "sunco init" first.',
      });
      return { success: false, summary: 'Run sunco init first' };
    }

    // Step 2: Load rules from .sun/rules/
    const rules = await loadRules(ctx.fileStore);
    ctx.log.debug('Loaded lint rules', { count: rules.length });

    // Step 3: Generate boundaries config from detected layers
    const boundariesConfig = generateBoundariesConfig(initResult.layers.layers);
    ctx.log.debug('Generated boundaries config', {
      elements: boundariesConfig.elements.length,
      rules: boundariesConfig.dependencyRules.length,
    });

    // Step 4: Determine files to lint
    const sourceRoot = initResult.layers.sourceRoot ?? 'src';
    const files = filesGlob ? [filesGlob] : [`${sourceRoot}/**/*.{ts,tsx,js,jsx}`];

    // Step 5: Run lint (with or without fix)
    const result = fix
      ? await runLintWithFix({ files, boundariesConfig, cwd: ctx.cwd })
      : await runLint({ files, boundariesConfig, cwd: ctx.cwd });

    // Step 6: Enrich violations with layer-aware fix instructions
    // Re-format violations using the formatter which generates better fix_instruction
    // than the runner's basic messages
    const enrichedViolations = result.violations.length > 0
      ? result.violations.flatMap((v) =>
          formatViolations(v.file, [
            {
              ruleId: v.rule === 'parse-error' ? null : v.rule,
              line: v.line,
              column: v.column,
              message: v.violation,
              severity: v.severity === 'error' ? 2 : 1,
            },
          ], initResult.layers.layers),
        )
      : [];

    // Step 7: Output
    if (json) {
      const jsonOutput = formatForJson(enrichedViolations);
      await ctx.ui.result({
        success: enrichedViolations.length === 0,
        title: 'Lint',
        summary: jsonOutput,
      });
    } else {
      const terminalLines = formatForTerminal(enrichedViolations);
      // Fail loudly, succeed silently: 0 violations = single-line detail
      const details =
        enrichedViolations.length === 0
          ? ['All architecture boundaries respected']
          : terminalLines;
      await ctx.ui.result({
        success: result.errorCount === 0,
        title: fix ? 'Lint (with fix)' : 'Lint',
        summary: `${result.filesLinted} files linted, ${result.errorCount} errors, ${result.warningCount} warnings`,
        details,
      });
    }

    // Store lint result for recommender
    await ctx.state.set('lint.lastResult', {
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      filesLinted: result.filesLinted,
      timestamp: new Date().toISOString(),
    });

    return {
      success: result.errorCount === 0,
      summary: `${result.errorCount} errors, ${result.warningCount} warnings`,
      data: result,
    };
  },
});
