/**
 * @sunco/cli - SUNCO CLI Entry Point
 *
 * Wires all subsystems together: config, state, skills, agent router,
 * UI adapter, and recommender. Then parses CLI args via Commander.js.
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

async function main(): Promise<void> {
  const program = createProgram();
  const lifecycle = createLifecycle();

  let services: Awaited<ReturnType<typeof lifecycle.boot>> | undefined;

  try {
    services = await lifecycle.boot(process.cwd());
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
