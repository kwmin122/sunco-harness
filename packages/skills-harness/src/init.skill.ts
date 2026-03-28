/**
 * @sunco/skills-harness - Init Skill
 *
 * `sunco init` -- Detect project stack, layers, conventions, then create
 * .sun/ workspace with config.toml, generated lint rules, and directory scaffold.
 *
 * Deterministic skill: no agent access (zero LLM cost).
 * Runs all three detectors in parallel for speed.
 *
 * Decisions: D-01 (ecosystem), D-02 (layers), D-03 (conventions),
 * D-04 (.sun/ init), D-05 (presets), D-10 (rule generation)
 *
 * Requirements: HRN-04, HRN-05
 */

import { defineSkill } from '@sunco/core';
import { detectEcosystems } from './init/ecosystem-detector.js';
import { detectLayers } from './init/layer-detector.js';
import { extractConventions } from './init/convention-extractor.js';
import { initializeWorkspace } from './init/workspace-initializer.js';
import type { InitResult } from './init/types.js';

export default defineSkill({
  id: 'harness.init',
  command: 'init',
  kind: 'deterministic',
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  description: 'Initialize project harness -- detect stack, layers, conventions, generate rules',
  options: [
    { flags: '--preset <name>', description: 'Force a specific preset instead of auto-detection' },
    { flags: '--force', description: 'Overwrite existing .sun/ configuration' },
  ],

  async execute(ctx) {
    const force = ctx.args.force as boolean | undefined;

    await ctx.ui.entry({ title: 'Init', description: 'Analyzing project...' });

    // Phase 1: Detection (parallel for speed)
    const [ecosystems, layers, conventions] = await Promise.all([
      detectEcosystems({ cwd: ctx.cwd }),
      detectLayers({ cwd: ctx.cwd }),
      extractConventions({ cwd: ctx.cwd }),
    ]);

    const initResult: InitResult = {
      ecosystems,
      layers,
      conventions,
      projectRoot: ctx.cwd,
      timestamp: new Date().toISOString(),
    };

    // Phase 2: Workspace initialization
    const result = await initializeWorkspace({
      initResult,
      fileStore: ctx.fileStore,
      force: force ?? false,
    });

    // Store init result in state for other skills to read
    await ctx.state.set('init.result', initResult);
    await ctx.state.set('init.preset', result.preset.id);
    await ctx.state.set('init.lastRun', new Date().toISOString());

    await ctx.ui.result({
      success: true,
      title: 'Init Complete',
      summary: `Detected ${ecosystems.ecosystems.length} ecosystem(s), ${layers.layers.length} layer(s), preset: ${result.preset.id}`,
      details: [
        `Ecosystems: ${ecosystems.ecosystems.join(', ') || 'none'}`,
        `Layers: ${layers.layers.map((l) => l.name).join(', ') || 'none'}`,
        `Naming: ${conventions.naming}`,
        `Import style: ${conventions.importStyle}`,
        `Rules generated: ${result.rulesGenerated}`,
      ],
    });

    return {
      success: true,
      summary: `Project initialized with ${result.preset.id} preset`,
      data: initResult,
    };
  },
});
