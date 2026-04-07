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
 *   npx popcoru        - run installer with npx (or npx sunco)
 *   sunco <skill>      - execute a skill (when globally installed)
 *   sunco --help       - show available commands
 *
 * Requirements: CLI-01 (sunco binary), D-03 (entry point)
 */

import { createProgram, registerSkills, createLifecycle, SilentUiAdapter, createSkillUi, createSkillContext } from '@sunco/core';
import {
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
  ultraplanSkill,
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
  debugSkill,
  diagnoseSkill,
  forensicsSkill,
  querySkill,
  exportSkill,
  graphSkill,
  docSkill,
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
  ultraplanSkill,
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
  // Phase 10 debugging skills
  debugSkill,
  diagnoseSkill,
  forensicsSkill,
  // Phase 13 headless CI/CD skills
  querySkill,
  exportSkill,
  // Phase 14 context optimization skills
  graphSkill,
  // Phase 15 document generation skills
  docSkill,
];

async function main(): Promise<void> {
  const program = createProgram();
  const lifecycle = createLifecycle();

  let services: Awaited<ReturnType<typeof lifecycle.boot>> | undefined;

  try {
    services = await lifecycle.boot(process.cwd(), { preloadedSkills });
    const executeHook = lifecycle.createExecuteHook(services);

    registerSkills(program, services.registry, executeHook);

    // ---------------------------------------------------------------------------
    // Headless subcommand (CI/CD mode)
    // ---------------------------------------------------------------------------
    // Registered after skill subcommands so it does not conflict with skill names.
    // Runs any registered skill with SilentUiAdapter, JSON stdout, structured exit codes.

    program
      .command('headless')
      .description('Run any skill in headless mode (CI/CD) — JSON output, structured exit codes')
      .argument('<command>', 'Skill command to run (e.g., status, query, verify)')
      .argument('[args...]', 'Arguments to pass to the skill')
      .option('--timeout <ms>', 'Maximum execution time in milliseconds')
      .allowUnknownOption(true)
      .action(async (command: string, args: string[], options: { timeout?: string }) => {
        // Set timeout if provided
        if (options.timeout) {
          const ms = parseInt(options.timeout, 10);
          if (!isNaN(ms) && ms > 0) {
            setTimeout(() => {
              console.log(JSON.stringify({ success: false, summary: `Timeout after ${ms}ms`, exitCode: 1 }));
              process.exit(1);
            }, ms);
          }
        }

        // services is guaranteed non-null here: headless is registered only after
        // lifecycle.boot() succeeds, so services is always defined at this point.
        const bootedServices = services!;

        // Look up the skill by command name in the registry
        const skill = bootedServices.registry.getByCommand(command);
        if (!skill) {
          console.log(JSON.stringify({ success: false, summary: `Unknown skill: ${command}`, exitCode: 1 }));
          process.exitCode = 1;
          return;
        }

        try {
          // Parse args into an options object: --key value -> { key: value }, --flag -> { flag: true }
          const parsedArgs: Record<string, unknown> = { _: args };
          for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg?.startsWith('--')) {
              const key = arg.slice(2);
              const next = args[i + 1];
              if (next !== undefined && !next.startsWith('--')) {
                parsedArgs[key] = next;
                i++;
              } else {
                parsedArgs[key] = true;
              }
            }
          }

          // Build a silent UI and a skill context, reusing all booted services
          const silentAdapter = new SilentUiAdapter();
          const silentUi = createSkillUi(silentAdapter);

          const ctx = createSkillContext({
            skillId: skill.id,
            config: bootedServices.config,
            state: bootedServices.stateEngine.state,
            fileStore: bootedServices.stateEngine.fileStore,
            agentRouter: bootedServices.agentRouter,
            recommender: bootedServices.recommender,
            ui: silentUi,
            registry: bootedServices.registry,
            cwd: bootedServices.cwd,
            args: parsedArgs,
          });

          const result = await skill.execute(ctx);

          // Determine exit code: 0=success, 2=blocked, 1=error
          let exitCode = 0;
          if (!result.success) {
            const data = result.data as Record<string, unknown> | undefined;
            exitCode = data?.blocked ? 2 : 1;
          }

          console.log(JSON.stringify({
            success: result.success,
            summary: result.summary,
            data: result.data,
            warnings: result.warnings,
            exitCode,
          }));

          process.exitCode = exitCode;
        } catch (err) {
          console.log(JSON.stringify({
            success: false,
            summary: err instanceof Error ? err.message : String(err),
            exitCode: 1,
          }));
          process.exitCode = 1;
        }
      });

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
