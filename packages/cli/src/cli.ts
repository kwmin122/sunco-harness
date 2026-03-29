/**
 * @sunco/cli - SUNCO CLI Entry Point
 *
 * Wires all subsystems together: config, state, skills, agent router,
 * UI adapter, and recommender. Then parses CLI args via Commander.js.
 *
 * Dual skill loading strategy:
 * - Direct imports: skills are bundled into the CLI binary (production)
 * - Scanner: discovers additional skill files at runtime (development/extensibility)
 * Direct imports take priority; scanner skips already-registered skill IDs (D-14).
 *
 * Usage:
 *   npx sunco          - run with npx
 *   sunco              - run globally installed
 *   sunco --help       - show available commands
 *   sunco <skill>      - execute a skill
 *
 * Requirements: CLI-01 (sunco binary), D-03 (entry point)
 */

import { createProgram, registerSkills, createLifecycle } from '@sunco/core';
import {
  samplePromptSkill,
  initSkill,
  lintSkill,
  healthSkill,
  agentsSkill,
  guardSkill,
} from '@sunco/skills-harness';
import {
  statusSkill,
  progressSkill,
  nextSkill,
  contextSkill,
  noteSkill,
  todoSkill,
  seedSkill,
  backlogSkill,
  pauseSkill,
  resumeSkill,
  phaseSkill,
  settingsSkill as workflowSettingsSkill,
  newSkill,
  scanSkill,
  discussSkill,
  assumeSkill,
  researchSkill,
  planSkill,
  executeSkill,
  reviewSkill,
  verifySkill,
  validateSkill,
  testGenSkill,
  shipSkill,
  releaseSkill,
  milestoneSkill,
  autoSkill,
  quickSkill,
  fastSkill,
  doSkill,
} from '@sunco/skills-workflow';

/**
 * Pre-loaded skills: directly imported to ensure they are bundled by tsup.
 * These are registered BEFORE the filesystem scanner runs, so they take
 * priority over dynamically discovered duplicates.
 *
 * Phase 2 harness skills (settings removed -- replaced by workflow version)
 * Phase 3 workflow skills (enhanced settings + 11 new skills)
 */
const preloadedSkills = [
  // Phase 2 harness skills
  samplePromptSkill,
  initSkill,
  lintSkill,
  healthSkill,
  agentsSkill,
  guardSkill,
  // Phase 3 workflow skills
  workflowSettingsSkill,  // Enhanced settings replaces harness version
  statusSkill,
  progressSkill,
  nextSkill,
  contextSkill,
  noteSkill,
  todoSkill,
  seedSkill,
  backlogSkill,
  pauseSkill,
  resumeSkill,
  phaseSkill,
  // Phase 4 project initialization skills
  newSkill,
  scanSkill,
  // Phase 5 context + planning skills
  discussSkill,
  assumeSkill,
  researchSkill,
  planSkill,
  // Phase 6 execution + review skills
  executeSkill,
  reviewSkill,
  // Phase 7 verification pipeline skills
  verifySkill,
  validateSkill,
  testGenSkill,
  // Phase 8 shipping + milestones skills
  shipSkill,
  releaseSkill,
  milestoneSkill,
  // Phase 9 composition skills
  autoSkill,
  quickSkill,
  fastSkill,
  doSkill,
];

async function main(): Promise<void> {
  const program = createProgram();
  const lifecycle = createLifecycle();

  let services: Awaited<ReturnType<typeof lifecycle.boot>> | undefined;

  try {
    services = await lifecycle.boot(process.cwd(), { preloadedSkills });
    const executeHook = lifecycle.createExecuteHook(services);

    registerSkills(program, services.registry, executeHook);

    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    // Render error via console (UI may not be available)
    if (error instanceof Error) {
      console.error(`\n  Error: ${error.message}\n`);
    }
    process.exitCode = 1;
  } finally {
    if (services) {
      await lifecycle.teardown(services);
    }
  }
}

main();
